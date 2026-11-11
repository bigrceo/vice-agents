import { createPublicClient, fallback, http } from "viem";
import { CHAIN } from "./net";

/**
 * Accès à la chaîne, avec bascule automatique.
 *
 * Un seul endpoint public ne tient pas : celui de Robinhood a renvoyé des 403
 * après quelques milliers de lectures. On en empile donc plusieurs, viem passe
 * au suivant dès qu'un refuse.
 *
 * Tous ne savent pas tout faire — `robinhood-rpc.publicnode.com` répond aux
 * lectures et aux simulations mais refuse `eth_getLogs`. D'où deux clients :
 * un pour les lectures et devis, un pour l'indexation.
 */

/**
 * Une surcharge unique qui prend le pas sur tout : c'est elle qui branche le
 * front sur un fork local (http://127.0.0.1:8545). Non renseignée, on parle à
 * la mainnet.
 */
const OVERRIDE = process.env.NEXT_PUBLIC_RPC_URL ?? "";
const OFFICIAL = OVERRIDE || CHAIN.rpcUrl;
const PUBLICNODE = OVERRIDE || "https://robinhood-rpc.publicnode.com";

/** Ordre de préférence surchargeable, pour brancher un endpoint dédié. */
const EXTRA = (process.env.RPC_URLS ?? "")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

const opts = { retryCount: 3, retryDelay: 600, timeout: 20_000 } as const;

/**
 * Lectures et simulations.
 * `rank` réordonne les endpoints selon leur latence réelle, en arrière-plan.
 */
export const readClient = createPublicClient({
  transport: fallback(
    [...EXTRA.map((u) => http(u, opts)), http(PUBLICNODE, opts), http(OFFICIAL, opts)],
    { rank: { interval: 120_000, sampleCount: 3 }, retryCount: 2 },
  ),
});

/**
 * Journaux : seul l'endpoint officiel les sert.
 * PublicNode renvoie 403 sur `eth_getLogs`, l'inclure ferait échouer une
 * requête sur deux.
 */
export const logsClient = createPublicClient({
  transport: fallback(
    [...EXTRA.map((u) => http(u, opts)), http(OFFICIAL, opts)],
    { retryCount: 2 },
  ),
});
