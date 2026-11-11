import { concatHex, encodeAbiParameters, encodeFunctionData, parseAbi, toHex, type Address, type Hex } from "viem";
import { PONS, ZERO } from "./chain";

// Chain-local Uniswap deployments (as used by ponsmcp/pons-mcp, MIT).
export const V4 = {
  quoter: "0x8dc178efb8111bb0973dd9d722ebeff267c98f94",
  universalRouter: "0x8876789976decbfcbbbe364623c63652db8c0904", // the Universal Router Pons and ponsmcp use; 0x204F…0498 also works,
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
} as const satisfies Record<string, Address>;

const CMD_V4_SWAP = 0x10;
const ACT_SWAP_EXACT_IN_SINGLE = 0x06;
const ACT_SETTLE = 0x0b;
const ACT_SETTLE_ALL = 0x0c;
const ACT_TAKE = 0x0e;
const MSG_SENDER: Address = "0x0000000000000000000000000000000000000001";

export type PoolKey = { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address };
const poolKeyType = { type: "tuple", components: [
  { name: "currency0", type: "address" }, { name: "currency1", type: "address" },
  { name: "fee", type: "uint24" }, { name: "tickSpacing", type: "int24" }, { name: "hooks", type: "address" },
] } as const;

export function poolKeyOf(token: Address, pair: Address, fee: number, tickSpacing: number): PoolKey {
  const [currency0, currency1] = token.toLowerCase() < pair.toLowerCase() ? [token, pair] : [pair, token];
  return { currency0, currency1, fee, tickSpacing, hooks: PONS.memeHook };
}

export const quoterAbi = parseAbi([
  "function quoteExactInputSingle(((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) params) returns (uint256 amountOut, uint256 gasEstimate)",
]);
const routerAbi = parseAbi(["function execute(bytes commands, bytes[] inputs, uint256 deadline) payable"]);
export const permit2Abi = parseAbi([
  "function approve(address token, address spender, uint160 amount, uint48 expiration)",
  "function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
]);

function exactInSingle(key: PoolKey, zeroForOne: boolean, amountIn: bigint, minOut: bigint): Hex {
  return encodeAbiParameters(
    [{ type: "tuple", components: [{ name: "poolKey", ...poolKeyType }, { name: "zeroForOne", type: "bool" }, { name: "amountIn", type: "uint128" }, { name: "amountOutMinimum", type: "uint128" }, { name: "hookData", type: "bytes" }] }],
    [{ poolKey: key, zeroForOne, amountIn, amountOutMinimum: minOut, hookData: "0x" }],
  );
}

/** Universal Router calldata for an exact-in single-pool v4 swap. ETH in is paid from msg.value; ERC-20 in is pulled via Permit2. */
export function v4SwapCalldata(key: PoolKey, tokenIn: Address, amountIn: bigint, minOut: bigint, deadline: bigint): { data: Hex; value: bigint } {
  const zeroForOne = tokenIn.toLowerCase() === key.currency0.toLowerCase();
  const tokenOut = zeroForOne ? key.currency1 : key.currency0;
  const nativeIn = tokenIn === ZERO;
  const actions = concatHex([toHex(ACT_SWAP_EXACT_IN_SINGLE, { size: 1 }), toHex(nativeIn ? ACT_SETTLE : ACT_SETTLE_ALL, { size: 1 }), toHex(ACT_TAKE, { size: 1 })]);
  const params = [
    exactInSingle(key, zeroForOne, amountIn, minOut),
    nativeIn
      ? encodeAbiParameters([{ type: "address" }, { type: "uint256" }, { type: "bool" }], [ZERO, amountIn, false])
      : encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [tokenIn, amountIn]),
    encodeAbiParameters([{ type: "address" }, { type: "address" }, { type: "uint256" }], [tokenOut, MSG_SENDER, 0n]),
  ];
  const input = encodeAbiParameters([{ type: "bytes" }, { type: "bytes[]" }], [actions, params]);
  return {
    data: encodeFunctionData({ abi: routerAbi, functionName: "execute", args: [toHex(CMD_V4_SWAP, { size: 1 }), [input], deadline] }),
    value: nativeIn ? amountIn : 0n,
  };
}
