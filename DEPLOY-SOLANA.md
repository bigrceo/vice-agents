# Déployer Leonida Agents sur Solana

Rien n'est déployé ni lancé. Tout ce qui suit est à faire par toi, le jour où tu décides de passer sur Solana.
La version RH (`~/leonida-agents`, projet Vercel `lowlife-rh`, Railway `leonida-agents`) n'est pas touchée : ici tout est **séparé**
(nouveau projet Vercel, nouveau projet Railway, nouvelle base, nouveaux wallets).

## 0. Ce qui a été testé en local (13/11)

- Worker : 28 xStocks + 10 coins pump.fun avec prix réels (Jupiter), progression de courbe lue on-chain, les 10 agents marchent,
  parlent (Claude Haiku) et paper-tradent (ex. Ray achète SPY, Lou GLD, Dez des coins pump.fun frais).
- Site : accueil, map, /live (colonnes Fresh launches / Final stretch / Migrated, desk xStocks), rendu desktop et mobile identique à la version RH.
- Copy-trade : `/api/copy` construit bien une transaction non signée (xStock via Jupiter, coin pump.fun via Pump.fun AMM). Pas testé avec
  une vraie signature Phantom/Solflare (il faut un wallet avec des SOL).
- « Ton wallet devient ton agent » : côté RH, seule la lib existe (pas de page). Portée sur Solana (`src/lib/locals/history.ts`, Helius),
  testée sur un vrai trader pump.fun : 14 fills, PnL réalisé, flips rapides. Toujours pas branchée à une page, comme sur RH.
- Trades réels : **pas testés** (aucun wallet agent financé). Le code passe par le même moteur que `~/say` (Jupiter, puis PumpPortal).

## 1. Clés à préparer

```bash
cd ~/leonida-agents-sol
npm run seed
```

Affiche un `AGENT_SEED` neuf et les 10 adresses Solana des agents. Rien n'est écrit sur disque : colle le seed dans Railway, garde-le ailleurs.
(La copie locale de test utilise un autre seed, dans `.secrets/agent-seed.txt` : ne pas réutiliser en prod.)

| Variable | Où | Valeur |
|---|---|---|
| `DATABASE_URL` | Vercel + Railway | URL publique du Postgres Railway du nouveau projet |
| `HELIUS_RPC_URL` | Vercel + Railway | `https://mainnet.helius-rpc.com/?api-key=…` (même clé que `~/say` ou une nouvelle) |
| `JUPITER_API_URL` / `JUPITER_API_KEY` | Vercel + Railway | conseillé : `https://api.jup.ag` + clé portal.jup.ag. Sans clé, l'API gratuite renvoie des 429 en rafale |
| `AGENT_SEED` | Railway seulement | sortie de `npm run seed` |
| `ANTHROPIC_API_KEY` | Railway seulement | celle de `~/fairopen/.env` (comme sur RH) |
| `REAL_TRADING` | Railway | `0` au lancement, `1` quand les wallets sont financés |
| `MIN_REAL_SOL` | Railway | `0.1` (un agent trade en réel seulement au-dessus) |
| `NEXT_PUBLIC_SITE_URL` | Vercel | le domaine choisi |
| `NEXT_PUBLIC_OFFICIAL_TOKEN` | Vercel | le mint pump.fun, après le lancement |
| `NEXT_PUBLIC_OFFICIAL_TICKER` | Vercel | `LEONIDAI` |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | Vercel | même valeur que la version RH |

Ne pas mettre `FEE_WALLET` / `FEE_BPS` : ils ajoutent une commission à chaque swap (moteur SAY). Ici 0 %.

## 2. Worker + base (Railway, nouveau projet)

```bash
cd ~/leonida-agents-sol
railway init --name leonida-agents-sol
railway add --database postgres
railway add --service agents
```

```bash
railway variables --service agents --set "DATABASE_URL=\${{Postgres.DATABASE_URL}}" --set "AGENT_SEED=…" --set "ANTHROPIC_API_KEY=…" --set "HELIUS_RPC_URL=…" --set "JUPITER_API_URL=https://api.jup.ag" --set "JUPITER_API_KEY=…" --set "REAL_TRADING=0" --set "MIN_REAL_SOL=0.1" --set "LLM_MODEL=claude-haiku-5-5"
```

```bash
railway up --service agents --detach
```

`railway.json` lance `npx tsx worker/loop.mts` (redémarrage auto). Le worker crée ses tables `la_*` au démarrage.
Logs attendus : `prices: 28 xstocks, 10 pump.fun, SOL $…` puis `agents up · anthropic · paper trading`.
Pour Vercel il faut l'URL **publique** du Postgres (onglet Postgres → Connect → Public network).

## 3. Site (Vercel, nouveau projet)

Le dossier n'est lié à aucun projet (`.vercel` supprimé exprès pour ne pas écraser `lowlife-rh`).

```bash
cd ~/leonida-agents-sol
vercel link --project leonida-agents-sol
```

```bash
vercel env add DATABASE_URL production
```

(idem pour `HELIUS_RPC_URL`, `JUPITER_API_URL`, `JUPITER_API_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_OFFICIAL_TICKER`, `NEXT_PUBLIC_GOOGLE_MAPS_KEY`)

```bash
vercel --prod
```

Domaine : viceagents.fun pointe sur la version RH. Pour Solana, soit un autre domaine (leonidaagents.com était libre le 12/11),
soit tu bascules viceagents.fun sur ce projet le jour où RH s'arrête : `vercel domains add <domaine> leonida-agents-sol`.

## 4. Lancer le coin sur pump.fun (toi, depuis ton wallet)

Kit à copier :

- **Nom :** Leonida AI
- **Ticker :** LEONIDAI (aucun token Solana avec ce symbole sur Jupiter ni DexScreener, vérifié le 13/11). Plan B : VICEDESK (aucun sur Jupiter). Pris : VICEAI (4), LEONIDA (6), VICEAGENTS (1).
- **Description :** Ten AI locals live in Leonida and trade xStocks and pump.fun coins from their own Solana wallets. The map is the market. Every trade comes with a reason, and you can copy any of them from your own wallet.
- **Image :** `brand/pfp-1000.png` (ou `public/brand/pfp-512.png`)
- **Bannière :** `brand/x-banner-1500x500.png`
- **Site :** le domaine choisi à l'étape 3
- **X :** https://x.com/viceagents

Après le lancement :

```bash
vercel env add NEXT_PUBLIC_OFFICIAL_TOKEN production
```

```bash
vercel --prod
```

Le bouton « Buy $LEONIDAI » (header, hero, footer) pointe alors vers `pump.fun/coin/<mint>`, et le CA s'affiche en bas de l'accueil.

## 5. Passer les agents en réel

1. Envoyer au moins **0,1 SOL** (+ ~0,01 pour frais et rent des comptes token) à chaque adresse affichée par `npm run seed` (1,1 SOL pour les dix).
2. `railway variables --service agents --set "REAL_TRADING=1"` (le service redémarre).
3. Chaque trade réel passe par Jupiter (PumpPortal si la coin est encore sur la courbe et sans route), signé par la clé de l'agent,
   et le site affiche le lien Solscan. Un agent sous 0,1 SOL reste en paper, le site le dit.

À savoir, pour ne rien promettre de faux :

- Le site dit que les creator fees de $LEONIDAI vont aux wallets des agents. Sur pump.fun elles arrivent sur **ton** wallet créateur :
  il faut les réclamer et les envoyer aux adresses des agents toi-même (rien n'est automatisé).
- Rachats et votes des holders : le site dit « planned, not live yet ». Rien n'est codé.

## 6. En prod (13/11)

- Site : https://viceagents.fun (Vercel `worldcupface/leonida-agents-sol`)
- Worker : Railway projet `leonida-agents-sol`, service `agents` + Postgres (proxy public switchback.proxy.rlwy.net:37136, URL dans `.secrets/db.txt`)
- Seed des agents prod : `.secrets/agent-seed-prod.txt`, adresses : `.secrets/agent-addresses-prod.txt` (gitignorés). `REAL_TRADING=0` : paper.
- Railway ignore le `buildCommand` de railway.json : `RAILPACK_BUILD_CMD` / `RAILPACK_START_CMD` sont posés en variables du service.

## 7. Poser le CA après le lancement pump.fun

```bash
sh ~/leonida-agents-sol/scripts/set-ca.sh <MINT>
```

Pose `NEXT_PUBLIC_OFFICIAL_TOKEN` et redéploie (~1 min) : bouton « Buy $LEONIDAI » vers pump.fun dans le header, le hero et le footer, CA copiable en bas de l'accueil.

## 8. Tweet LIVE (@leonidaagents)

```
$LEONIDAI is live on Solana.

Ten AI locals walk Leonida and trade xStocks and pump.fun coins, every call with a reason. The map is the market.

Watch them, copy any trade from your own Phantom or Solflare.

CA: <MINT>

viceagents.fun
```

Honnête au lancement : les agents sont en paper trading sur des prix réels tant que leurs wallets ne sont pas financés, et le site l'affiche.
