/**
 * Launch transaction builder. With NEXT_PUBLIC_MIND_LAUNCHER set the user signs
 * MindLauncher.launch (launch + dev buy, one signature); otherwise the direct
 * factory.launchToken (value = launchFee, no dev buy). In both cases
 * creatorFeeRecipient = TREASURY_ADDRESS and buybackEnabled = false.
 */
import { encodeFunctionData, getAddress, keccak256, encodeAbiParameters, toHex } from "viem";
import { readClient } from "./rpc";
import { deployerAbi, factoryAbi, hookAbi, launcherAbi } from "./abis";
import { ADDR, ENV, SLIPPAGE_BPS, type Hex } from "./config";
import { withSlippage } from "./util";

export interface LaunchInput {
  name: string;
  symbol: string;
  description: string;
  image: string | null;
  links: { x?: string; telegram?: string; website?: string };
  /** Dev buy in wei (preferred) or ETH. Ignored without MindLauncher. */
  devBuyWei?: bigint;
  devBuyEth?: number;
  /** Who signs (and receives the dev buy tokens). */
  buyer: Hex;
  salt?: Hex;
}

export interface LaunchTx {
  to: Hex;
  data: Hex;
  value: bigint;
  predictedToken?: Hex;
  predictedCurve?: Hex;
  via: "launcher" | "factory";
  launchFee: bigint;
  devBuyWei: bigint;
  expectedTokensOut?: bigint;
  salt: Hex;
}

const ethToWei = (eth: number) => BigInt(Math.round(eth * 1e9)) * 10n ** 9n;

export async function buildLaunchTx(input: LaunchInput): Promise<LaunchTx> {
  const buyer = getAddress(input.buyer) as Hex;
  // Coinable: the creator keeps the creator fees; direct factory launch (no MindLauncher, no dev buy).
  const treasury = buyer;
  const launcher = null as Hex | null;
  const configId = ENV.launchConfigId;
  const creatorTaxBps = ENV.creatorTaxBps;
  const salt = input.salt ?? (toHex(crypto.getRandomValues(new Uint8Array(32))) as Hex);
  let devBuyWei = input.devBuyWei ?? (input.devBuyEth ? ethToWei(input.devBuyEth) : 0n);
  if (!launcher) devBuyWei = 0n;

  const f = { address: ADDR.factory, abi: factoryAbi } as const;
  const [launchFee, economics, config, policy] = await Promise.all([
    readClient.readContract({ ...f, functionName: "launchFee" }),
    readClient.readContract({ ...f, functionName: "previewLaunchEconomics", args: [configId, ADDR.zero] }),
    readClient.readContract({ ...f, functionName: "getLaunchConfig", args: [configId] }),
    readClient.readContract({ address: ADDR.memeHook, abi: hookAbi, functionName: "currentFeePolicy" }),
  ]);
  if (!config.enabled) throw new Error(`Pons launch config ${configId} is disabled`);
  if (devBuyWei >= config.graduationThreshold) throw new Error("Dev buy would graduate the curve in the launch tx");

  const params = {
    name: input.name,
    symbol: input.symbol,
    logo: input.image ?? "",
    description: input.description,
    socials: {
      twitter: input.links.x ?? "",
      telegram: input.links.telegram ?? "",
      discord: "",
      website: input.links.website ?? "",
      farcaster: "",
    },
    creatorFeeRecipient: treasury,
    creatorTaxBps,
    buybackEnabled: false,
    expectedEconomics: economics,
    salt,
  } as const;

  // Exact opening quote: fresh curve, reserves = (phantomQuote, supply).
  let expectedTokensOut: bigint | undefined;
  let minTokensOut = 0n;
  if (devBuyWei > 0n) {
    const net = devBuyWei - (devBuyWei * (config.curveFeeBps + BigInt(creatorTaxBps))) / 10_000n;
    expectedTokensOut = (net * 10_000n * config.supply) / (config.phantomQuote * 10_000n + net * 10_000n);
    minTokensOut = withSlippage(expectedTokensOut, SLIPPAGE_BPS);
  }

  // Pons namespaces the CREATE2 salt by the initiating account; MindLauncher
  // additionally namespaces it by the signer.
  const originalDeployer = launcher ?? buyer;
  const ponsSalt = launcher
    ? keccak256(encodeAbiParameters([{ type: "address" }, { type: "bytes32" }], [buyer, salt]))
    : salt;
  let predictedToken: Hex | undefined;
  let predictedCurve: Hex | undefined;
  try {
    const [t, c] = await readClient.readContract({
      address: ADDR.launchDeployer,
      abi: deployerAbi,
      functionName: "predictLaunchAddresses",
      args: [
        {
          pairToken: ADDR.zero,
          creatorFeeRecipient: treasury,
          originalDeployer,
          feePolicy: ADDR.memeHook,
          policy,
          feeEscrow: ADDR.feeEscrow,
          buybackVault: ADDR.buybackVault,
          phantomQuote: config.phantomQuote,
          curveFeeBps: config.curveFeeBps,
          creatorTaxBps: BigInt(creatorTaxBps),
          buybackEnabled: false,
          graduationThreshold: config.graduationThreshold,
          supply: config.supply,
          salt: ponsSalt,
          name: params.name,
          symbol: params.symbol,
          logo: params.logo,
          description: params.description,
          socials: params.socials,
        },
      ],
    });
    predictedToken = t;
    predictedCurve = c;
  } catch {
    // prediction is best effort; verifyLaunch reads the real address from the receipt
  }

  if (launcher) {
    return {
      to: launcher,
      data: encodeFunctionData({
        abi: launcherAbi,
        functionName: "launch",
        args: [params, configId, ADDR.zero, minTokensOut, buyer],
      }),
      value: launchFee + devBuyWei,
      predictedToken,
      predictedCurve,
      via: "launcher",
      launchFee,
      devBuyWei,
      expectedTokensOut,
      salt,
    };
  }
  return {
    to: ADDR.factory,
    data: encodeFunctionData({ abi: factoryAbi, functionName: "launchToken", args: [params, configId, ADDR.zero] }),
    value: launchFee,
    predictedToken,
    predictedCurve,
    via: "factory",
    launchFee,
    devBuyWei: 0n,
    salt,
  };
}
