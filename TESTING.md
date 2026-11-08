# OPT/IN Testing Plan

## What testing has to answer

1. **Does it work?** Every rule does what its card, reveal, or fine print says, with no errors.
2. **Is it balanced?** No strategy (share everything, share nothing, pay, Fair Play) is always right. Each trade has a real cost and a real upside.
3. **Does it teach 9-12.CS.3.3?** Students notice the privacy, safety, and convenience trade-offs, and can explain one.

Each question gets its own kind of test. Hand-playing is the slowest tool, so save it for question 3.

| Layer | Answers | How long | When to run |
|---|---|---|---|
| A. Check page (`?check`) | Does it work? | Seconds | After every change |
| B. Bot lab (`?bots`) | Is it balanced? | Seconds to a minute per test | After any price, perk, wave, or inference change |
| C. Focused manual checks | Does it look and feel right? | 5–10 min per area | When an area changes, and a full pass before class |
| D. Classroom playtest | Does it teach? | One class period | Before each new unit, or after big changes |

---

## A. Check page (`index.html?check`)

Scripted checks that run in the page and list PASS or FAIL. They set up a situation directly (share these types, set hearts to 2, seed the class), run the rule, and compare the result to the number on the card. No install.

**How to run:** open `index.html?check` in a browser. The checks live in `checks.js` and load only with `?check`. If the browser blocks the local file, serve the folder with `python3 -m http.server 8417` and open `http://localhost:8417/index.html?check`.

Checks run in memory. They never touch saved runs, the class models, or the leaderboard, so they are safe to run on a classroom device.

**Rule for adding checks:** every number a player can read on a card, reveal, or fine-print clause gets one check. When a bug is found, add a check for it before fixing it.

**Covered so far:** price modifiers and their worst-case stack, all six inferences (unlock rule, harm, upside), the four data types, Halo and mayday, class models and packs, Delete My Data, saves and old-save cleanup, offline death, dossier counts, leftover wording, and a full run to wave 10.

**Not covered yet:** behavior patterns, the hotspot ring, Fair Play billing, breaches, amended offers, the leaderboard with real network traffic, and anything visual. Those stay in layer C until they get checks.

## B. Balance bot (`index.html?bots`)

Bots play real runs at high speed with no drawing. They aim at the nearest ship, look a fraction of a second ahead to dodge shots and ships, and dash through a shot they can't avoid. In the shop they follow a fixed policy. A run takes about 0.1–0.5 seconds.

**How to run:** open `index.html?bots` (or `bots.html`), served from `python3 -m http.server 8417` like the check page. Like the other lab tools, it runs in memory and never touches saved runs, the class models, or the leaderboard.

**Compare a card.** Pick a card and which of Accept, Buy, and Skip to compare. The card is put in every shop so each run faces the choice. Also set what the bot does with every other card (buy if affordable, Accept data cards, or take nothing), Halo, bot skill, runs, and the wave to stop at.

**Ready-made tests:** THRUST Accept / Buy / Skip · share everything vs. share nothing · leaderboard overlap · where the sharing gap comes from · how much to share (all-in, selective, and non-sharers) · card league (every card against the same baseline at each skill; about 25 minutes) · Halo on vs. off · Fair Play vs. paying per card · bot skill check.

**Reading the results.**
- Every option plays the same seeds, so the "vs." column compares each run with the first option's run on the same seed. Luck mostly cancels out.
- **Waves cleared** shows the average and a ±95% range. Each dot is one run.
- "No clear difference" means the range crosses zero, so run more seeds before deciding.
- **Copy as text** gives a Markdown table to paste into notes or a chat.

**Bot skill.** Novice notices 60% of shots and never dashes. Average notices 85%. Expert notices 98% and plans further ahead. Run the skill check first: if two options differ by less than the gap between skill levels, skill matters more than the choice.

**Custom tests from the console.** Each arm can set these options:
- `cards`: what to do with specific cards, e.g. `{route:'free'}`
- `others`: what to do with every other card (`buy`, `share`, `skip`)
- `halo`, `fair`, `skill`
- `read`: seconds spent in each shop (matters for IMPULSE PROFILED and the timer)
- `force`: cards put in every shop
- `crowd`: number of seeded class runs
- `packs`, `start` (data already on file), `inf` (inferences already on)
- `noInf` (sharing never unlocks an inference), `markup` (test-only what-if: a price multiplier for players with nothing on file; the game has none), `shareOnly` (with `others:'share'`, Accept only these data types, e.g. `['LOC']`), `harm` (what-if knobs for the game's `HARM` object, such as `{per:.3}`), `noHarm` (turns off the file-weight harms), `split` (test-only what-if: Habits keeps its longer streak but pays no extra points), `startCoins` (what-if: credits every player starts with; the game uses `START_COINS`, 40)

Example:
```js
bots.run({name:'RESERVE when the class is seeded', runs:40, waves:15, forceCards:true,
  arms:[{name:'Accept', cards:{sos:'free'}, crowd:5}, {name:'Buy', cards:{sos:'pay'}, crowd:5}]})
```
Add a test to `PRESETS` in `bots.js` to give it a button.

**Plays to its upgrades.** With THRUST it plans its dodges using the slide. With LEAD it keeps the cursor on the ship it is shooting, so shots bend toward it. With BURNERS it dashes to get out of a crowd, not only to dodge a hit. With PROXIMITY it moves in to about 110 pixels from its target, as long as that stays safe. The novice bot never dashes, so BURNERS is wasted on it. Because a bought card replaces a seat and costs credits, "Buy vs. Skip" can come out worse than skipping even for a good upgrade. Read it as the whole trade, not the card alone.

**Bot findings before the member price (2026-11-05; the game then had a ×1.4 "no-file markup"; 24 runs per option, average bot with hotspot, stop at wave 30).**
- Share everything reached wave 30 every run. Share nothing reached 14.7 (±2.0). Fair Play reached 18.3.
- A careful non-sharer (expert) averaged 17.7 waves and never out-scored an average sharer. The careless sharer (novice) reached 28.8. The overlap target is not met.
- Inferences move the waves by under half a wave. They cut hits, so their upsides outweigh their harms for the bot.
- The no-file markup is the biggest single lever: ×1.4 gives 14.7 waves, ×1.1 gives 19.1, ×1.0 gives 25.0. Between ×1.4 and ×1.2 nothing changes.
- With Habits on file and no markup, share nothing reached 29.0, about the same as sharing everything.
- Bots with the hotspot take about 100 credits from it per run, and breaches stay at about 3 per run even when sharing nothing.

**Bot findings with a 15% member price, since removed (2026-11-07; 24 runs per option, average bot with hotspot, stop at wave 30).**
- The game's no-file price is now the member price plus about 18% (members pay 15% less). That was ×1.4.
- Share nothing: 16.6 waves (±3.2), up from 14.7. Score 44,081, up from 26,327. Share everything is still 30 waves and about 166,000.
- A careful non-sharer (expert) averaged 20.5 waves and 57,092 points. It beat an average sharer in 0% of runs. Target: 50%.
- Regular price ×1.1 gives 19.1 waves, and no member price at all gives 25.0. The price alone can't close the gap. Sharing's harms have to cost something during a run.

**Bot findings with no extra price for non-sharers (2026-11-07; 24 runs per option, average bot with hotspot, stop at wave 30).**
- All-in sharers: 30 waves, about 166,500 points. Location + Habits: 30 waves, beats all-in 57% of the time. Location only: 29.1 (17%). Health + Purchases: 27.3 (24%). Purchases only: 26.7 (7%). Non-sharers: 25.0 (0%).
- A careful non-sharer (expert) averaged 26.6 waves and beat an average all-in sharer 2% of the time.
- More sharing still means a better score, apart from Location + Habits.
- Breaches are about the same for everyone (4.8–5.8 per run). The hotspot's exposure drives them, not shared data, and a breach only adds one broker ship to the next wave. Right now the main cost of sharing everything doesn't fall on all-in sharers.
- Selective sharers end up with more types than they chose (about 3.3 of their "two"), because bundled amendments share a second type.

**Breach what-ifs (2026-11-07; test-only, 20 runs per option, stop at wave 30).** "Beats" is the chance of out-scoring an all-in run.

| Breach rule | All-in waves | Location + Habits beats all-in | Non-sharer beats all-in | Careful non-sharer beats all-in |
|---|---|---|---|---|
| Game now (one broker ship) | 30.0 | 57% | 0% | 2% |
| A: lose 10% of credits per leaked type | 29.7 | 68% | 6% | 11% |
| B: A, plus chance driven by data (hotspot counts 30%, +8 points per type past two) | 30.0 | 64% | 0% | 7% |
| C: 15% per type, data-driven, strips the shield | 30.0 | 60% | 0% | 6% |
| D: 1♥ per two leaked types, data-driven | 30.0 | 73% | 2% | 21% |

- Credit losses barely touch all-in sharers. They get upgrades free, so their credits are surplus (they lost about 2,400 a run and still reached wave 30).
- Hearts bite most, but no breach rule stops all-in sharers from reaching wave 30 every run. Breaches alone can't reach the target.
- Selective sharers (Location + Habits) beat all-in in every version.

**Harms what-ifs (2026-11-07; test-only, `harm` arm option, 24 runs per option, 40 for the overlap test, average bot with hotspot, stop at wave 30).** Each shared type and inference does damage. The damage grows with file weight (types shared + inferences, 0–10), multiplied by 1 + scale × (weight − 1). The game is unchanged; `bots.js` lists each harm. "Beats" is the chance of out-scoring an all-in run.

| Setting | All-in waves (reached 30) | Location + Habits beats all-in | Non-sharer beats all-in | Careful non-sharer beats all-in | Careless sharer (novice) |
|---|---|---|---|---|---|
| No harms (game now) | 30.0 (100%) | 57% | 0% | 2% | 28.8 waves |
| Harms, scale .15 | 28.3 (54%) | 79% | 27% | 31% | 26.5 waves, 121,353 pts |
| Harms, scale .30, stronger Found / Build known / Route | 27.6 (50%) | 76% | 31% | 35% | 23.8 waves, 97,628 pts |

- Harms are the first lever that stops all-in sharers from reaching wave 30 every run. More harm drops them further.
- Selective sharing (Location + Habits) now clearly does best (≥60% target met).
- At the stronger setting a careful non-sharer (110,119) out-scores a careless sharer (97,628) on average. That was the first target.
- Non-sharers reach wave 30 more often than all-in sharers (63% against 50–54%), but still score less. Two reasons: some non-sharer runs end early (wave 10–20) on expensive shops, and sharing Habits pays more points per kill (a longer combo window). The harms can't close that score gap. Waves are close; points per wave are not.
- Health + Purchases, Location only, and Purchases only all fall between non-sharers and all-in, with wide ranges.

**Habits score split (2026-11-07; test-only, `split` arm option, with the stronger harms, same seeds).** Sharing Habits keeps its 3.4 s streak window, music and nags. Points count a separate streak that resets after 2.2 s or on a hit, the same as for non-sharers.

| Setting | All-in score | Location + Habits beats all-in | Non-sharer beats all-in | Careful non-sharer beats all-in | Careless sharer score |
|---|---|---|---|---|---|
| Stronger harms | 134,095 | 76% | 31% | 35% | 97,628 |
| Stronger harms + split | 129,898 | 74% | 36% | 40% | 95,337 |

- The split cuts an all-in score by about 20% at wave 10 but only 3% by wave 30. Late waves are dense enough to keep any streak alive inside 2.2 s.
- Where the rest of the gap is: of the runs that reached wave 30, all-in averaged about 148,600 and non-sharers about 137,000 (8% less). But 7 of 24 non-sharer runs ended by waves 9–19, with 8,000–35,000 points. All-in's worst run reached wave 21. Non-sharers lose on the leaderboard mostly because of early deaths, not points per wave.
- The next lever is the early economy for everyone who pays (enough credits for upgrades by wave 5), not more harm or less score.

**Starting credits (2026-11-07; test-only, `startCoins` arm option, 24 runs per option, same seeds, stop at wave 30).** Every player starts the run with the same credits. The game starts everyone at 0. "Early deaths" counts runs that ended before wave 20.

| Setting | All-in waves (reached 30) | Location + Habits beats all-in | Non-sharer beats all-in | Careful non-sharer beats all-in | Non-sharer early deaths |
|---|---|---|---|---|---|
| 0 credits, stronger harms + split | 27.6 (50%) | 74% | 36% | 40% | 7 of 24 |
| 20 credits, stronger harms + split | 26.7 (29%) | 84% | 59% | 69% | 5 of 24 |
| 40 credits, stronger harms + split | 27.4 (33%) | 87% | 87% | 91% | 0 |
| **40 credits, harms .15, no split** | 28.3 (54%) | **73%** | **54%** | **63%** | 0 |

- Starting credits are the biggest lever so far. They remove the early deaths that held non-sharers back.
- 40 credits with the stronger harms overshoots: non-sharers tie selective sharers and beat all-in 87% of the time.
- **40 credits with the milder harms (scale .15) and no Habits split meets every target.** Selective sharers score highest (161,342), non-sharers and careful non-sharers can beat all-in sharers, and careless all-in sharers do worst (13% reach wave 30). It's also the smallest change set: no score split is needed. The **Starting credits** preset runs this setting.
- 20 credits with the stronger harms also meets the targets, but 5 of 24 non-sharer runs still end before wave 20.

**Built into the game (2026-11-07): 40 starting credits and the file harms at scale .15, no score split.** Confirmed with the game's own code, 24 runs per option, same seeds, stop at wave 30, no errors:
- All-in 28.3 waves (54% reach 30). Location + Habits beats all-in 74%. Non-sharer 56%. Careful non-sharer (expert) 64%. Careless sharer (novice) 18%, 13% reach 30.
- No early deaths (before wave 20) except one careless-sharer run. Matches the what-if within 2 points.

**What the bot does not do:** read the fine print, shoot ads, change Halo mid-run, or play like a student. Use it to compare choices, not to judge difficulty.

**Balance targets (fill these in):**

- [ ] **How much to share.** Students judge sharing from the leaderboard: scores next to what each player shared. Selective sharers (one or two types) should do best. Non-sharers should be able to beat all-in sharers, who share every type. Use the **How much to share** test; "Beats" is the chance a run out-scores an all-in run.
  - At the same skill, a selective sharer beats an all-in sharer in at least 60% of pairings. Now 74%.
  - At the same skill, a non-sharer beats an all-in sharer in at least 40% of pairings. Now 56%.
  - A careful non-sharer (expert) beats an average all-in sharer in at least 50% of pairings. Now 64%.
- [ ] A share-nothing player can afford at least ___ upgrades by wave 5.
- [ ] No single upgrade is bought in more than ___% of shops.
- [ ] Each inference's harm and upside are both used in at least ___% of runs that have it.

The bot does not play like a student. Use it to compare strategies, not to judge difficulty.

## C. Focused manual checks

Use dev mode and the sandbox to jump to a setup instead of playing up to it. Presets worth adding: **all inferences on**, **seeded class** (all four models at full strength), **hurt** (2♥), **jump to wave N**.

For each area: load the setup, watch for the effect on screen, check the matching dossier line.

**UI lab (`index.html?ui`).** A panel of buttons that puts the game on any banner, reveal, screen, dialog, toast, or ad without playing to it. About 94 items, grouped: wave banners, Halo and rescue, reveals (all inferences and patterns), shop variants, screens, dossier variants, dialogs, toasts, and ads. Each button calls the game's own function, so what shows is what a player sees.
- Like the check page, it runs in memory and never touches saved runs, the class models, or the leaderboard.
- **keep banners up** holds a banner on screen so you can inspect it. The panel fades when the mouse leaves it, and the backtick key (`` ` ``) collapses it.
- Dossier and leaderboard scenes are built from a short headless run, so their numbers are real telemetry.
- **run all** triggers every item and marks any that throw, log an error, or leave nothing on screen. From the console: `uiLab.go('HALO SAVED YOU')` triggers one by its label.
- When a new banner, reveal, or screen is added to the game, add a button for it in `ui.js`.

**Decisions page (`decisions.html`).** Every choice a player can make, with what each option gets them (＋) and what it costs them (−): data upgrades, other upgrades, the shop's side choices, class packs, Halo, Fair Play, the hotspot, how much to share, Delete My Data, behavior patterns, and inferences. Use it to review the game's trade-offs in one place.
- Most of it is read live from the game's tables, so new upgrades, data types, inferences, and patterns appear on their own.
- The hand-written parts in `decisions.js` are stamped with a fingerprint of the game text or code they describe. When that changes, the entry shows **OUT OF DATE** and the check page fails, until the wording is reviewed and re-stamped (`decisionsStamp()` in the console, pasted over `STAMPS`).
- **Rule:** when a decision point is added, removed, or changed in `index.html`, update `decisions.js` in the same change.

## D. Classroom playtest

- **Assign strategies.** One group always accepts, one never accepts, one tries Fair Play, one plays however they like.
- **Ask three questions after:** What surprised you? What did you not understand? Was there a choice you did not feel you made yourself?
- **Collect:** the leaderboard, a photo of a few dossiers, and the answers.
- **Look for:** confusion (a card or reveal nobody understood), dominance (everyone found one best choice), and the lesson landing (a student explains a trade-off in their own words).

---

## Inventory: what to test

★ = high risk. Test these first, and give them checks on the check page.

### Title and profile
- [ ] Name prompt: classroom-safe filter rejects bad names; name shows on the board.
- [ ] PLAY, CONTINUE (a saved run picks up), and Abandon (drops only that run).
- [ ] ★ Delete My Data: clears shared types, inferences, packs, the member file, Halo files, the mimic, the retreat record, and the board rows. Does not change the class Accept count.
- [ ] Changelog, settings, keys, mute.

### Intro and waves
- [ ] Opt-in intro, and "skip intro" on later runs.
- [ ] Ping, watcher, crawler ships and their formations at each tier.
- [ ] Broker every 5 waves; breach broker when the file is breached.
- [ ] MIMIC learns from hits and carries across runs.
- [ ] Wave clear scoops all coins.

### Shop (terms screen)
- [ ] Three seats: what the fight calls for, a survival pick, and a wildcard.
- [ ] Accept (free, shares data) vs. Buy (credits, no data).
- [ ] ★ Every price modifier, alone and stacked:
  - Risk score ×0.8 or ×1.5
  - Usual first pick ×2 (NEXT MOVE PREDICTED)
  - NEEDS PREDICTED ×1.5 on PLATING and RESERVE at 2♥ or less
  - IMPULSE rush price ×1.25 while the timer runs
  - Class deal ×0.7
  - Fair Play ×0.8
- [ ] ★ Worst-case stack is still payable, and nothing drops to 0.
- [ ] Maxed upgrades: paying repairs 1♥ or adds score; Accept still shares.
- [ ] Amended offers: on-device (nothing shared), bundled (shares a second type), resold (counts double).
- [ ] Loyalty bonus 40%, or 70% with IMPULSE PROFILED.
- [ ] Offer timer: 10s, or 5s with IMPULSE PROFILED; turns off after reading slowly twice.
- [ ] Fine print opens; the secret word pays +15.
- [ ] POPULAR badge and the class labels (CLASS PICK, CLASS BESTSELLER, CLASS DEAL) show on the right cards.

### Data types (4)
For each of Location, Health, Habits, Purchases:
- [ ] Its perk is free with Accept: THRUST, RESERVE, LEAD, REWARDS.
- [ ] Its personal effects (the "fx" lines) all happen.
- [ ] Its ads appear, plus pair ads when two types are shared.
- [ ] It shows in the pause menu, the HUD chips, and the dossier.

### Inferences (6)
For each, check: unlock rule (both types shared, one of them at least twice), reveal screen, harm, upside, dossier lines.
- [ ] ROUTE PREDICTED (Location + Habits): ships aim ahead, and some fly there (more on a bigger file) · 50% more warning.
- [ ] RISK SCORE (Health + Habits): when hit often, +50% prices, Halo returns 1♥ less, mayday 2s slower · 20% off when careful.
- [ ] ★ RETREAT MAPPED (Location + Health): at 2♥ or less, about half of new ships spawn near your usual hurt spot, more on a bigger file · mayday 2s sooner.
- [ ] ★ HOME INFERRED (Location + Purchases): ships spawn closer, with less warning on a bigger file · shield every 3rd wave.
- [ ] ★ NEEDS PREDICTED (Health + Purchases): when hurt, repairs +50% and every repair heals 1♥ less · repair always stocked when hurt.
- [ ] ★ IMPULSE PROFILED (Habits + Purchases): 5s timer, +25% before it ends · 70% loyalty bonus.
- [ ] RETREAT and HOME together: retreat spawns still happen when hurt.

### Your file (harms that grow)
- [ ] ★ Every run starts with 40 credits, so the first shop has something you can buy.
- [ ] ★ YOUR FILE on the HUD shows 10 pips: types shared + inferences. The pips pulse when it grows.
- [ ] Pause menu: YOUR FILE shows the count and the harm multiplier (×1.00 to ×2.35).
- [ ] Location: some ships spawn 150–210 px from you, with a cyan warning ring.
- [ ] Health: hurt, ships fire faster. From 4 on file, "hurt" starts at 3♥.
- [ ] Habits: from 3 on file, patterns take longer to lose. From 5, one more pattern can unlock per wave.
- [ ] Purchases: some ordinary ships get a yellow dashed ring and dodge your upgrades.
- [ ] NEEDS PREDICTED: a RESERVE heal that is cut shows SOLD SHORT −1♥.

### Behavior patterns (5, no Accept needed)
For each, check: it triggers from play, its effect applies, and its fix drops it after 4 waves or runs.
- [ ] COMFORT ZONE MAPPED · PANIC DASHER · SITTING DUCK · NEXT MOVE PREDICTED · EDGE KITE

### Hotspot ring
- [ ] Fire bonus, shield charge, and credits for standing still.
- [ ] Free Wi-Fi adds exposure; Fair Play's Secure Wi-Fi does not.

### Fair Play and the member file
- [ ] Billing each wave; it ends when you cannot pay.
- [ ] No ads or timer while billed; the watch and sales still continue.
- [ ] Canceling keeps the member file.

### Breach
- [ ] Breach chance rises with exposure and combined data; the breach wave and banner appear.

### Halo and mayday
- [ ] Halo offered at wave 3, or sooner when a hit would end the run.
- [ ] Halo on: instant return at 3♥ (2♥ if RISK SCORE rates you high-risk), sells health and location, and the next broker aims better.
- [ ] Halo off: mayday wait (5s, 3s with RETREAT MAPPED, 2s more if rated high-risk), slow and unarmed, one hit ends the run, return at 2♥.
- [ ] Toggling from the pause menu; turning it off does not undo a sale.

### Class models and packs (4)
For each of Location, Habits, Health, Purchases:
- [ ] ★ Only runs that shared that type add to it; sandbox and dev runs do not count toward the Accept number.
- [ ] Ramps to full strength at 5 runs; older runs fade.
- [ ] ★ The harm applies to every player, including players who never shared.
- [ ] The pack shows in the shop once the model has data, costs 40, and stays until Delete My Data.
- [ ] Dossier "How the class was used" lines.

### Saves
- [ ] ★ Continue from each checkpoint: mid-wave, shop, breach, Halo offer, reveal.
- [ ] Old saves with removed types (Face, Contacts, Messages) load cleanly.
- [ ] Two players on one device (dev player switcher) do not share files.

### Leaderboard and network
- [ ] ★ Works offline: the run still saves locally and the game never stalls.
- [ ] ★ Several students finishing at the same moment do not lose each other's rows.
- [ ] Keeps 20 names; a higher score knocks a lower one off.

### Dossier
- [ ] Every section fills: How you chose, What sharing got you, What sharing cost, What privacy got you, What privacy cost, How the class was used.
- [ ] Counts say "of 4 data types" and "of 6 inferences."

### Devices
- [ ] The devices students actually use: screen size, keyboard or touch, sound.
- [ ] Frame rate on the slowest classroom device at wave 10 or later.

### Text
- [ ] No leftover mentions of Face Scan, Contacts, or Messages on any screen.
- [ ] Choice screens say "shared"; "sold" appears only after the fact or in fine print.
- [ ] Every card, reveal, and fine-print number matches what the game does.

---

## Bug log

| Date | Where | What happened | What should happen | Check added? | Fixed in |
|---|---|---|---|---|---|
| | | | | | |

## Open questions

- Which devices and browsers do students use?
- How many students play at the same time?
- Is the school network reliable, or should offline play be the normal case?
