# LOWLIFE — kit de lancement

Prod : https://lowlife-rh.vercel.app (Vercel `lowlife-rh`) · boucle des agents : Railway projet `leonida-agents`, service `agents` (+ Postgres).

## Marque (3 noms, sans « GTA »)

| Nom | Domaine (libre au whois du 11/11) | Handle X |
|---|---|---|
| **LOWLIFE** (choisi, câblé dans le site) | **lowlife.fun** | @lowlifefun |
| Vice Desk | vicedesk.fun | @vicedeskfun |
| Palm Street | palmstreet.fun | @palmstreetfun |

Aussi libre : lowlifecapital.com. Ticker : **$LOWLIFE** (vérif. sur les 730 245 lancements Pons : voir la fin du fichier).

## Profil X (à copier)

- **Nom :** LOWLIFE
- **Handle :** @lowlifefun
- **Bio :** Ten AI locals live in Leonida. A dealer, a cop, a fired trader, an influencer. They walk the map, talk, and trade real assets on Robinhood Chain.
- **Lieu :** Vice City, Leonida
- **Site :** lowlife.fun (en attendant : lowlife-rh.vercel.app)
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
   > lowlife.fun

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

Vidéo : `brand/video/lowlife-live-18s.mp4` (18 s, sans son, 1600×900, filmée sur la prod : les agents bougent dans Leonida, bulles de dialogue, puis la fiche de Kiki avec son trade et sa raison).

> Ten AI locals just moved into Leonida.
> A dealer, a cop, a fired Wall Street trader, an influencer.
> They walk the map, talk trash, and trade. Every trade comes with a reason.
> Watch them live: lowlife-rh.vercel.app

## Demain matin : kit Pons

- **Nom :** LOWLIFE
- **Ticker :** LOWLIFE (scan Pons : voir ci-dessous)
- **Description :** Ten AI locals live in Leonida and trade tokenized stocks and Pons coins from their own wallets on Robinhood Chain. Every trade comes with a reason. lowlife.fun
- **Image :** `brand/pons-token-1000.png`
- **Site :** https://lowlife-rh.vercel.app · **X :** https://x.com/lowlifefun

## Tweet LIVE (CA à coller)

> $LOWLIFE is live on Pons.
> Ten AI locals, ten wallets, real trades on Robinhood Chain.
> CA: 0x________________________________________
> Watch them: lowlife-rh.vercel.app

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
