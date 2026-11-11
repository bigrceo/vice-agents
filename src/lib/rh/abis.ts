/** Minimal ABIs (checked against deployed bytecode selectors on 4663). */
import { parseAbi } from "viem";

const TOKEN_PARAMS =
  "(string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials,address creatorFeeRecipient,uint16 creatorTaxBps,bool buybackEnabled,bytes32 expectedEconomics,bytes32 salt)";

const LAUNCHED_TOKEN =
  "(address token,address curve,address deployer,address creatorFeeRecipient,address pairToken,uint256 graduationThreshold,uint24 poolFee,int24 tickSpacing,uint16 creatorTaxBps,bool buybackEnabled,uint8 phase,uint256 sweptQuote,uint256 sweptTokens,uint256 sweptAt,bool exists)";

const LAUNCH_DEPLOYMENT =
  "(address pairToken,address creatorFeeRecipient,address originalDeployer,address feePolicy,(address protocolFeeRecipient,uint16 protocolFeeShareBps,uint16 buybackBurnBps,uint16 hookFeeBps,uint16 maxInternalPriceImpactBps) policy,address feeEscrow,address buybackVault,uint256 phantomQuote,uint256 curveFeeBps,uint256 creatorTaxBps,bool buybackEnabled,uint256 graduationThreshold,uint256 supply,bytes32 salt,string name,string symbol,string logo,string description,(string twitter,string telegram,string discord,string website,string farcaster) socials)";

export const factoryAbi = parseAbi([
  "function launchFee() view returns (uint256)",
  "function maxCreatorTaxBps() view returns (uint256)",
  `function launchToken(${TOKEN_PARAMS} params, uint256 launchConfigId, address pairToken) payable returns (address token, address curve)`,
  `function getLaunchedToken(address token) view returns (${LAUNCHED_TOKEN})`,
  "function getLaunchConfig(uint256 id) view returns ((uint256 supply,uint256 curveFeeBps,uint256 phantomQuote,uint256 graduationThreshold,uint24 poolFee,int24 tickSpacing,bool enabled))",
  "function previewLaunchEconomics(uint256 launchConfigId, address pairToken) view returns (bytes32)",
  "function transferCreatorFeeRecipient(address token, address newRecipient)",
  "function pendingCreatorFeeRecipient(address token) view returns (address newRecipient, uint256 effectiveAt, uint256 expiresAt)",
  "event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)",
  "event CreatorFeeRecipientUpdated(address indexed token, address indexed previousRecipient, address indexed newRecipient)",
  "event CreatorFeeRecipientChangeProposed(address indexed token, address indexed currentRecipient, address indexed proposedRecipient, uint256 effectiveAt, uint256 expiresAt)",
  "event PoolGraduated(address indexed token, uint256 positionId, uint256 tokenAmount, uint256 pairTokenAmount)",
]);

export const deployerAbi = parseAbi([
  `function predictLaunchAddresses(${LAUNCH_DEPLOYMENT} params) view returns (address token, address curve)`,
]);

export const curveAbi = parseAbi([
  "function token() view returns (address)",
  "function pairToken() view returns (address)",
  "function deployer() view returns (address)",
  "function buy(uint256 quoteIn, uint256 minTokensOut, address recipient) payable returns (uint256 tokensOut)",
  "function sell(uint256 tokensIn, uint256 minQuoteOut, address recipient) returns (uint256 quoteOut)",
  "function sweepFees(uint256 minBuybackTokensOut)",
  "function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)",
  "function realQuoteReserve() view returns (uint256)",
  "function sellableTokens() view returns (uint256)",
  "function reservedTokens() view returns (uint256)",
  "function phantomQuote() view returns (uint256)",
  "function graduationThreshold() view returns (uint256)",
  "function feeBps() view returns (uint256)",
  "function creatorTaxBps() view returns (uint256)",
  "function quoteFeeBalance() view returns (uint256)",
  "function creatorTaxBalance() view returns (uint256)",
  "function buybackQuoteBalance() view returns (uint256)",
  "function protocolFeeShareBps() view returns (uint16)",
  "function graduated() view returns (bool)",
  "function launchedAt() view returns (uint256)",
  "function snipeTaxStartBps() view returns (uint256)",
  "function snipeTaxSeconds() view returns (uint256)",
  "function snipeTaxExempt(address) view returns (bool)",
  "event CurveBuy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 tax)",
  "event CurveSell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 tax)",
  "event FeesSwept(uint256 protocolAmount, uint256 buybackAmount, uint256 creatorAmount)",
  "event CurveCompleted(address recipient, uint256 quoteOut, uint256 tokenOut)",
]);

export const hookAbi = parseAbi([
  "function sweepPoolFees(bytes32 poolId, uint256 minConversionQuoteOut, uint256 minBuybackTokensOut)",
  "function pendingFees(bytes32 poolId, address currency) view returns (uint256)",
  "function pendingCreatorTax(bytes32 poolId, address currency) view returns (uint256)",
  "function pendingBuyback(bytes32 poolId, address currency) view returns (uint256)",
  "function launches(bytes32 poolId) view returns (bool registered, bool memecoinIsCurrency0, address memecoin, address quoteToken, address creator, address buybackCreatorRecipient, address protocolFeeRecipient, uint16 creatorTaxBps, uint16 protocolFeeShareBps, uint16 buybackBurnBps, uint16 hookFeeBps, uint16 maxInternalPriceImpactBps, bool buybackEnabled)",
  "function feeSweepOperator() view returns (address)",
  "function currentFeePolicy() view returns ((address protocolFeeRecipient,uint16 protocolFeeShareBps,uint16 buybackBurnBps,uint16 hookFeeBps,uint16 maxInternalPriceImpactBps))",
  "event PoolFeesSwept(bytes32 indexed poolId, uint256 protocolAmount, uint256 buybackAmount, uint256 creatorAmount, uint256 tokensLocked)",
]);

/**
 * PonsV2 fee escrow (0xd3AF…Ac9e). Pull-payment ledger, no owner:
 * curve/hook call credit{value}(recipient); the recipient later calls claim()
 * (whole balance) or claim(amount); ETH is sent to msg.sender. claim() with a
 * zero balance reverts NoBalance().
 */
export const escrowAbi = parseAbi([
  "function balanceOf(address recipient) view returns (uint256)",
  "function balanceOfToken(address recipient, address token) view returns (uint256)",
  "function claim() returns (uint256 amount)",
  "function claim(uint256 amount) returns (uint256)",
  "function claimToken(address token) returns (uint256 amount)",
  "error NoBalance()",
  "event Credited(address indexed recipient, address indexed from, uint256 amount)",
  "event Claimed(address indexed recipient, uint256 amount)",
]);

export const erc20Abi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

export const launcherAbi = parseAbi([
  `function launch(${TOKEN_PARAMS} params, uint256 launchConfigId, address pairToken, uint256 minTokensOut, address buyer) payable returns (address token, address curve, uint256 tokensOut)`,
  "function TREASURY() view returns (address)",
  "function FACTORY() view returns (address)",
  "function MAX_CREATOR_TAX_BPS() view returns (uint16)",
  "function effectiveSalt(address caller, bytes32 salt) pure returns (bytes32)",
  "event MindLaunched(address indexed token, address indexed curve, address indexed buyer, uint256 devBuyEth)",
]);

export const disperseAbi = parseAbi([
  "function disperseEther(address[] recipients, uint256[] amounts) payable",
  "event Dispersed(address indexed sender, uint256 total, uint256 count)",
  "event Skipped(address indexed recipient, uint256 amount)",
]);

export const poolManagerAbi = parseAbi([
  "function extsload(bytes32 slot) view returns (bytes32)",
  "event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)",
]);

export const universalRouterAbi = parseAbi([
  "function execute(bytes commands, bytes[] inputs, uint256 deadline) payable",
]);

export const permit2Abi = parseAbi([
  "function approve(address token, address spender, uint160 amount, uint48 expiration)",
  "function allowance(address user, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
]);
