# OPT/IN Testing Plan

## What testing has to answer

1. **Does it work?** Every rule does what its card, reveal, or fine print says, with no errors.
2. **Is it balanced?** No strategy (share everything, share nothing, pay, Fair Play) is always right. Each trade has a real cost and a real upside.
3. **Does it teach 9-12.CS.3.3?** Students notice the privacy, safety, and convenience trade-offs, and can explain one.

Each question gets its own kind of test. Hand-playing is the slowest tool, so save it for question 3.

| Layer | Answers | How long | When to run |
|---|---|---|---|
| A. Check page (`?check`) | Does it work? | Seconds | After every change |
| B. Balance bot | Is it balanced? | Minutes | After any price, perk, wave, or inference change |
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

## B. Balance bot

A simple bot plays runs at high speed with no drawing. Each strategy plays 50 runs. The report shows, per strategy: average and best wave, credits at each shop, upgrades bought, inferences unlocked, hits taken at 2♥ or less, and how runs ended (death, mayday failed, Halo).

**Strategies:** share everything · share nothing and pay · share only Location · Fair Play · read slowly (timer turns off).

**Balance targets (fill these in):**

- [ ] Share-everything and share-nothing average waves differ by no more than ___ waves.
- [ ] A share-nothing player can afford at least ___ upgrades by wave 5.
- [ ] No single upgrade is bought in more than ___% of shops.
- [ ] Each inference's harm and upside are both used in at least ___% of runs that have it.

The bot does not play like a student. Use it to compare strategies, not to judge difficulty.

## C. Focused manual checks

Use dev mode and the sandbox to jump to a setup instead of playing up to it. Presets worth adding: **all inferences on**, **seeded class** (all four models at full strength), **hurt** (2♥), **jump to wave N**.

For each area: load the setup, watch for the effect on screen, check the matching dossier line.

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
  - No file on record ×1.4
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
- [ ] ROUTE PREDICTED (Location + Habits): ships aim ahead · 50% more warning.
- [ ] RISK SCORE (Health + Habits): +50% prices when hit often · 20% off when careful.
- [ ] ★ RETREAT MAPPED (Location + Health): at 2♥ or less, half of new ships spawn near your usual hurt spot · mayday 2s sooner.
- [ ] ★ HOME INFERRED (Location + Purchases): ships spawn closer · shield every 3rd wave.
- [ ] ★ NEEDS PREDICTED (Health + Purchases): repairs +50% when hurt · repair always stocked when hurt.
- [ ] ★ IMPULSE PROFILED (Habits + Purchases): 5s timer, +25% before it ends · 70% loyalty bonus.
- [ ] RETREAT and HOME together: retreat spawns still happen when hurt.

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
- [ ] Halo on: instant return at 3♥, sells health and location, and the next broker aims better.
- [ ] Halo off: mayday wait (5s, 3s with RETREAT MAPPED), slow and unarmed, one hit ends the run, return at 2♥.
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
