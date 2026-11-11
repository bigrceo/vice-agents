/**
 * On-chain configuration. Every value here is publicly checkable on the explorer.
 */

export const CHAIN = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
  explorer: "https://robinhoodchain.blockscout.com",
} as const;

/** Uniswap v4 et les utilitaires canoniques, tels que déployés sur 4663. */
export const V4 = {
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
  universalRouter: "0x204FAca1764B154221e35c0d20aBb3c525710498",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
} as const;

/** Pons V2, as deployed on 4663 (read live from the factory on 2026-10-06). */
export const PONS = {
  factory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
  launchDeployer: "0x3711ceA4feaDE896C913C68F01Eda97Cb06D1A42",
  feeEscrow: "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e",
  memeHook: "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044",
  buybackVault: "0x42df2a798f82289E177311362e8f5ccC45c1219c",
} as const;

export const explorerAddress = (a: string) => `${CHAIN.explorer}/address/${a}`;
export const explorerTx = (h: string) => `${CHAIN.explorer}/tx/${h}`;
export const explorerToken = (a: string) => `${CHAIN.explorer}/token/${a}`;
