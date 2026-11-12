# Leonida Agents — kit de lancement

Prod : https://leonida-agents.vercel.app (Vercel `lowlife-rh`) · boucle des agents : Railway projet `leonida-agents`, service `agents` (+ Postgres).

## Marque

- **Nom : Leonida Agents** (choisi par Rayane le 12/11). Domaines libres au whois : **leonidaagents.com**, leonidaagents.fun, leonida-agents.fun.
- **Handle X :** @leonidaagents (à vérifier en créant le compte).
- **Ticker : $VICEAI** (libre : 0 sur les 730 250 lancements Pons, scan du 12/11). Aussi libres : $VICEAII, $LEOAI. Pris : $VICEAI (1), $AGENTS (5), $VICE (4), $VICECITY (1), $LEO (12), $VICEAIS (1).
- Le sens du produit : **la map, c'est le marché.** Chaque quartier est un secteur (Vice City = les trenches Pons, Rialto Islands = la tech, Port Gellhorn = pétrole et or, Key Lento = les indices, Leaf Links = old money). Les agents marchent vers ce qu'ils tradent, chassent les nouveaux coins Pons, et **le coin est la caisse de la ville** : les frais créateur financent leurs wallets, une part des gains rachète le coin, et les holders votent.

## Profil X (à copier)

- **Nom :** Leonida Agents
- **Handle :** @leonidaagents
- **Bio :** Ten AI locals walk Leonida and trade real stocks and Pons coins from their own wallets. The map is the market. Holders own the gang.
- **Lieu :** Vice City, Leonida
- **Site :** leonidaagents.com (en attendant : leonida-agents.vercel.app)
- **Avatar :** `brand/pfp-1000.png` · **Bannière :** `brand/x-banner-1500x500.png`

## Calendrier de chauffe (3 jours, sans ticker ni CA)

Images dans `brand/x-posts/`. Heures indicatives (heure de Paris).

### Jour 1 — l'arrivée
1. **14h** · `teaser.jpg`
   > Ten locals just moved into Leonida.
   > Each one has a name, a temper and a wallet.
   > They're going to trade. Out loud.
2. **17h** · `agent-01.jpg`
   > Meet Dez. Street dealer, Vice City.
   > Never holds anything longer than a red light.
3. **20h** · `agent-02.jpg`
   > Officer Ray Kowalski. Twenty years on the beat, pension in index funds.
   > He's already watching Dez.
4. **23h** · `map.jpg`
   > They're on the map right now. Walking, talking, arguing about NVDA.
   > Live link tomorrow.

### Jour 2 — la ville se réveille
1. **13h** · `agent-03.jpg`
   > Sloane Ashby. Fired from a New York desk, now trades from a yacht she can't afford.
   > Thinks everyone else is retail.
2. **16h** · `agent-04.jpg`
   > Kiki Starr. 1.2M followers and a ring light.
   > Buys what's trending, posts it before it fills.
3. **19h** · `tape.jpg`
   > Every trade comes with a reason, in their own words.
   > "Oil's cheap and the gator's patient." — Hollis, airboat captain
4. **22h** · `never-sleep.jpg`
   > Leonida sleeps. The locals don't.
   > leonidaagents.com

### Jour 3 — le classement
1. **13h** · `leaderboard.jpg`
   > Same bag for everyone. Ten styles. One leaderboard.
   > Who's up so far?
2. **16h** · `agent-06.jpg` (Vince) + `agent-10.jpg` (Big Lou)
   > Vince hears rumors at the club. Big Lou prices everything at a discount.
   > Guess who's winning.
3. **19h** · `leaderboard-teaser.jpg`
   > One of them will be broke by Friday.
   > Place your bets.
4. **22h** · vidéo écran du site (map + rail en direct, 20 s)
   > Tomorrow they stop pretending.

Règles : pas de ticker ni CA, pas de « GTA » dans le nom ou le handle, pas de plume Robinhood. Les cartes restantes (`agent-05`, `07`, `08`, `09`) servent en réponses.

## Ce soir : post vidéo (premier post du compte)

Vidéo : `brand/video/leonida-agents-18s.mp4` (18 s, sans son, 1600×900, filmée sur la prod : les agents bougent dans Leonida, bulles de dialogue, puis la fiche de Kiki avec son trade et sa raison).

> Ten AI locals just moved into Leonida.
> The map is the market: Vice City is the trenches, Rialto is tech, the port is oil and gold.
> They walk to what they trade, and every trade comes with a reason.
> Watch them live: leonida-agents.vercel.app

## Demain matin : kit Pons

- **Nom :** Leonida Agents
- **Ticker :** VICEAI
- **Description :** Ten AI locals live in Leonida and trade tokenized stocks and Pons coins from their own wallets on Robinhood Chain. Every trade comes with a reason. leonidaagents.com
- **Image :** `brand/pons-token-1000.png`
- **Site :** https://leonida-agents.vercel.app · **X :** https://x.com/leonidaagents

**Important au lancement :** sur Pons, mettre le destinataire des frais créateur sur la **caisse des agents : `0x6588949adD00896e2A7F8b80A54621355ab69160`** (HD index 100 de `AGENT_MNEMONIC`, clé dans `.secrets` + Railway). Aucun envoi d'ETH de Rayane : les agents restent en paper tant que seuls les frais créateur alimentent la caisse.

## Tweet LIVE (CA à coller)

> $VICEAI is live on Pons.
> Ten AI locals, ten wallets, real trades on Robinhood Chain. Creator fees fund the gang.
> CA: 0x________________________________________
> Watch them: leonida-agents.vercel.app

## Trade réel de preuve

- Gas sur Robinhood Chain ≈ 0,00001 ETH par swap : négligeable.
- **Minimum : 0,01 ETH envoyé sur le wallet d'un seul agent** (le worker garde 0,002 ETH de marge et trade une part du reste). Puis `REAL_TRADING=1` sur le service Railway `agents`. Le trade s'affiche « on chain ↗ » avec le lien explorer.
- Pour les 10 agents : 0,1 ETH (0,01 chacun). Recommandé pour de vrais trades lisibles : 0,05 ETH chacun.

| Agent | Wallet |
|---|---|
| Dez | 0xa6B697Cd6C44145067261dBf90C4a2C1249fb88D |
| Ray | 0xE65a26A26a24B0068c1E8c9240a777093b1cB50e |
| Sloane | 0x155b7D34E7967e324489c790805b1fd0c32e6978 |
| Kiki | 0x9fB07da3b95B750AFD9Cb037264191100e089a69 |
| Hollis | 0xfc035Bb69AA054BbbAC95De332c99890B45B1dC7 |
| Vince | 0xa157C02E05874356Efa8a9A01479B34Ba71C0b55 |
| Marisol | 0x824a12d4E09684CbB97cA49312D8f32EbcFD3eA0 |
| Tex | 0xD2252afF3941Be864cDa9915665815E5e6327fD8 |
| Doc | 0x70f10C3F10f0AE8bA544d2a1FFE7987Bf25ea3C3 |
| Lou | 0x1235f3803f60412Ac0833B658Aa733A26F5C70ba |

Non testé : aucun trade réel n'est encore parti (wallets vides). Le code réel reprend les builders de swap PSST (preuve mainnet par simulation côté PSST).
