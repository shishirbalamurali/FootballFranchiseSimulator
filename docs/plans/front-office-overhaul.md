# Front Office Overhaul — plan v2

Drafts · scouting · college storylines · trades · free agency · coaching trees ·
**player cards** · **X-Factor players**.
Status: **plan only, no code yet.** v1 2026-09-27; v2 the same day expands mechanics and UI
and adds §10 (player card) and §11 (X-Factor). Coordination follows `AGENTS.md`; §17 splits the work.

---

## 0. The pitch

Today these systems are separate screens with separate rules: you scout by spending 10 points
to reveal a number, draft from a list, trade against a value chart you can re-roll, sign free agents
in a 4-day market, and watch a coaching list update once a year. Player cards show every badge at once
and don't tell you what matters about the player *right now*.

The overhaul turns this into **one front-office loop that runs all year**. Its currency is
**information**, and its output is **stories you remember**, told through **player cards that show
status first** and a tiny tier of **X-Factor players whose one-of-a-kind abilities change games**.

> You follow a sophomore at a small school because your area scout loves him. He breaks out,
> declares early, and a rival GM — your old coordinator — trades up two spots to take him one pick
> before you. Three years later he's an X-Factor with an ability nobody else has, and his card
> glows gold when he's in the zone against you in the playoffs. He asks that team for a trade,
> and your scout was right.

Every mechanic below exists to make that paragraph possible, to be **cheap to play** (≤ 60–90 s
per offseason stage when delegated), and to be **honest about uncertainty**.

## 1. Design pillars

1. **Fog of war is the game.** You never see a prospect's true ratings (or a rival player's hidden
   trajectory). You see *your staff's opinion* with a confidence range that narrows when you invest.
   Every team believes something different, which is why steals, busts, reaches and trade-ups happen.
2. **People, not tables.** Scouts, coaches, GMs, agents and prospects are persistent people with
   names, biases, histories and relationships. Every system reads and writes those relationships.
3. **Every choice costs something.** Scouting time is finite. Cap space comes with dead money. Trade
   value is judged by *this* partner's needs. Promoting a coordinator loses him. There's no free +2.
4. **Status first.** Every player surface answers "what's going on with him, and what should I do?"
   before it shows numbers. Detail is one tap away, never in the way.
5. **Rare means rare.** X-Factor is ≤ 1% of the league. Each ability is unique, readable in one line,
   visible when it fires, capped in impact, and it can be countered.
6. **Honest drama.** Storylines and abilities trigger from real sim state, resolve exactly once, and
   adapt to trades, injuries and cuts. Nothing contradicts the box score.
7. **Efficient to play.** Every stage offers *Delegate* (the assistant does it), *Recommend* (it
   pre-fills and you confirm) or *Do it myself*. Batch actions. At most one decision modal per stage.
8. **Cheap to save.** Derive from ids and seeds (the `character.js` pattern) and store only decisions
   and deltas. §15 sets a hard save budget.

## 2. What exists today (verified against the source)

| System | Where | What it does | Main problems |
|---|---|---|---|
| College | `engine/collegePipeline.js`, `collegeProduction.js`, `FranchiseOffice.jsx` `CollegeWatch` | 1,400 players in 4 cohorts, tiers, deterministic game stats, 2 story events a season (wk 12, wk 18) | Four fixed arc labels (`i % 4`). No schools, standings, awards, early declarations or transfers. One-line stories. Paginated card grid with stats shown as `KEY: v`. Following a college player is separate from the draft watchlist |
| Scouting | store `scoutingPoints`/`scoutedProspects`, `Draft.jsx` `getOvrRange` | 10 points, reset at `startFreeAgency`; 1 point reveals exact OVR/POT/attributes | **Leaks the truth**: `getOvrRange` seeds on `id.charCodeAt(0)+charCodeAt(2)`, which is constant for every `college-…` id, so every range has the same offset from true OVR. The visible, sortable `grade` = `ovr*.45 + ceiling*.55`. Binary, offseason only, no scouts |
| Draft | `engine/draft.js`, `draftExperience.js`, store `startDraft`/`makePick`/`simOneCpuPick`, `Draft.jsx` (943 lines), `DraftTradeDesk.jsx` | 7 rounds, CPU style weights, 18% CPU trade-ups, user pick trades at 103% of chart value, 90 s clock | Only current-year picks exist (`draftPickOwners` reset in `finalizeDraft`; `pickKey`'s `year` is never set). Two pick-value charts that disagree. Timer auto-pick takes the highest *true* OVR. Every CPU board shares the true grade, so there are no real reaches. No combine, pro day, interviews, medicals, UDFA scramble or 5th-year option. A `Math.random` `collegeProfile` path is left over |
| Trades | `screens/tradeLogic.js`, store `executeTrade`/`maybeGenerateCPUTradeOffer`/`acceptTradeOffer`, `engine/leagueTrades.js`, `TradeCenter.jsx` | Value = OVR curve × position × age × dev × contract; CPU accepts at a ratio ≥ 0.9 after `0.88–1.06` random variance | **Re-roll exploit**: the variance is redrawn on every Propose click. **No cap check** in `executeTrade`. No future picks, counters, trade block, conditional picks or "what would it take". Team mode is inferred from overall rating only. Incoming offers: a random team, 18%/week, one at a time. League trades: 1:1 swaps, one a week. `devTrait === 'Superstar X-Factor'` in `getPlayerValue` never matches any real player |
| Free agency | `engine/faMarket.js` (Claude, K6), `screens/freeAgencyLogic.js` (legacy), `FreeAgency.jsx` | 4-day market, suitors, floors, personality weighting | Contracts are `{salary, years}` only, with no guarantees, bonus or dead money (cutting is free). No tags, RFA or comp picks. Re-signing has no deadline pressure. The legacy random `evaluateOffer` still exists |
| Coaching trees | `engine/franchiseStaff.js`, store `hireStaff`/`fireStaff`/`upgradeStaff`, `CoachingStaff` UI | 4 roles × 32 teams plus a market; reputation, 3 skill branches, `mentorId`, history; a yearly carousel | Coaches have no scheme, age, contract or personality. Bonuses are flat. The tree is only `mentorId`, with no view and no prestige. User coordinators are never poached. No scouting or position staff |
| Player card | `components/PlayerModal.jsx` (392 lines), `PlayerIdentity.jsx`, `ui/rarity` | Header: rarity wash, dev badge, mood badge, every public trait badge, "🔒 +N unknown", POT/cap/years tiles, OVR + change. Tabs: Character (default) / Attributes / Statistics | **Cluttered and status-blind**: 6–10 chips before any content. Injury, depth role, walk year, holdout and trade request aren't in the header. The accent colour comes from OVR rarity, not situation. No quick actions. Personality is the default tab even for a player you only want to check is healthy. No compact variant, so rows, trade chips and draft cards each re-implement bits of it |
| Dev tiers | `engine/player.js` `DEV_TRAITS` (Superstar/Star/Normal/Slow), `progression.js` | Dev trait scales growth; rare promotions | Dev trait affects only progression, never the game itself. There's no elite tier with in-game identity |

Other context that shapes the plan:
- The offseason runs `playoffs → startOffseason (progression, expiry, carousel) → freeAgency (4-day market) → draft → regular`.
- `character.js` (Claude) already derives personality, `moodFor`, `contractStance`, `tradeFallout`, `wantsOut`, `faPreferences` and a fog-aware `personalityView`. Reuse all of it.
- `gameEngine.js` (Claude, K11) is snap-by-snap, with `buildOffense`/`buildDefense` probability terms, game-day `form`, `pbp` and `scoringLog`. It is the natural home for ability hooks.
- `owner.js`, `legacy.js`, `rivalries.js`, `franchiseLore.js`, `weeklyExperience.js` and `gameStory.js` are callback points.
- Save size was already 2.2 MB at week 4 of season 1. Every new field must justify its bytes.

---

## 3. Shared foundations (build first)

### F1. Offseason calendar — `engine/offseasonCalendar.js`
Replace the three-phase jump with an explicit, resumable stage machine. Each stage defines
`enter(state)`, `autoResolve(state, delegation)`, `canAdvance(state)`, a *headline* and a UI panel.

```
SEASON END ─► Awards night ─► Black Monday (carousel) ─► Re-sign & Tag window ─► Combine
   ─► Free Agency (4 days) ─► Pro days & visits ─► DRAFT (3 nights) ─► UDFA scramble
   ─► Camp reveal ─► Cut-down day ─► Week 1
IN SEASON: weekly scouting assignments · college Saturdays · trade window (deadline day wk 11)
```
- `phase` stays for compatibility. The new field is `offseason: { stage, stageData }`, and old saves map `offseason → resign`, `freeAgency → fa`, `draft → draft`.
- Each stage has a **headline card** ("Black Monday: 6 head coaches fired, your OC interviewing in Denver") so advancing feels like an event, not a menu.
- *Advance* on any stage runs `autoResolve` for everything left undone, using the delegation settings.

### F2. One value model — `engine/assetValue.js`
- **One pick chart** for the draft desk, trades and CPU logic. Future picks are valued at the *projected* slot (from current team strength), discounted 15% per year out, with a variance premium for picks from bad teams.
- **Surplus value** = on-field value over the contract years − cap cost. Cheap good players are the most valuable assets, which makes rebuilds interesting.
- **Team mode**: `contend | retool | rebuild`, derived weekly from age curve, QB, cap, record and owner archetype.
- **Perceived value** `value(asset, forTeam)` = base × need fit × scheme fit (F4) × mode weight × X-Factor premium (§11) × knowledge discount (a team pays less for a player it hasn't scouted).
- Replaces `getPlayerValue`/`getPickValue`/`pickValue`, with thin re-exports kept for one release.

### F3. Contract model v2 — `engine/contracts.js`
- `contract: { salary, years, yearsLeft, guaranteed, bonus, signedYear, type }`, where `type` ∈ `rookie | veteran | tag | minimum | tender`.
- Cap hit = salary + prorated bonus. **Dead money** on a cut or trade = remaining proration + remaining guarantee, stored in `deadCap[teamId][year]`.
- Rookie scale by slot, a **5th-year option** for 1st-rounders, **franchise/transition tags**, **RFA tenders**, and **incentives** (one per deal: "+$2M if 10+ sacks"). Incentives count against next year's cap only if earned.
- Old saves default `guaranteed = 0, bonus = 0, type = 'veteran'`. Cap math is unchanged until the player signs a new deal.

### F4. Scheme identity — `engine/schemes.js`
- 4 offensive schemes (Air Raid, West Coast, Power Run, Spread Option) and 4 defensive (4-3 Over, 3-4 Two-Gap, Nickel Press, Cover-2 Zone). Each has per-position attribute weights and a small in-game tilt through `gamePlan.js`.
- `schemeFit(player, scheme) → 0–100` drives the prospect Fit column, trade perceived value, FA interest, player-card role text and some X-Factor ability eligibility.
- A team's scheme comes from its HC, OC and DC (F5). **Hiring a coordinator is a roster decision.**

### F5. People registry — `engine/people.js`
One lightweight shape for coaches, scouts, GMs and agents:
`{ id, name, role, teamId, age, rep, traits[], scheme?, mentorId, history[] }`, with faces through `PlayerFace`.
CPU GMs have archetypes (Aggressive trader, Draft-and-develop, Analytics, Old school, Big spender, Cap hawk) that parameterize their draft, trade and FA AI. A handful of **agents** represent free agents and add a negotiation personality.

### F6. Storyline engine — `engine/storyArcs.js`
Generalizes `weeklyExperience.js` arcs. An **arc template** has `eligible(state) → subjects`, `beats[]`
(each with a trigger, a text builder and an optional decision with costs), `adapt(event)` for
trade/injury/cut, and `resolve`. Active arc = `{ templateId, subjects, beat, choices, openedWeek }`.
It powers college stories (§4), draft-night drama (§6), trade requests and holdouts (§7–8), coaching
reunions (§9), player-card status (§10) and X-Factor awakening arcs (§11).
Rules: at most 2 active user-facing arcs, at most 1 decision per stage, and each arc resolves exactly once across reloads.

### F7. Front-office phone — `engine/inbox.js` + `components/frontOffice/Phone.jsx`
One inbox for everything that wants your attention: trade calls, agent calls, scout alerts, coach
interview requests and arc decisions. Each item has a priority, an expiry and one-tap actions, and can be
answered by the assistant when delegated. This replaces scattered modals (`pendingTradeOffer`, story popups)
with a queue you can clear in one sitting.

---

## 4. College storylines — "Saturdays"

**Goal:** you *know* next year's draft class before it's a draft class, and following a kid feels
like fandom with stakes.

### Mechanics
- **Schools & conferences**: ~96 fictional schools in 8 conferences with prestige, scheme, colour and mascot. These are derived (`franchiseLore` style, zero bytes). Prospects are on real rosters, so teammates exist: QB–WR connections, a stacked D-line, and pro reunions later.
- **Lightweight college season**: team strength = top prospects' readyOvr + prestige, with one result row per game (~4 bytes). This gives conference standings, a **Top-25 poll**, rivalry weeks, conference title games, a **12-team playoff** and a national champion. Prospect production already exists per game; it now scales with opponent strength, so big-game performances are real.
- **Awards**: a weekly **Heisman ladder**, position awards and All-Americans. They feed draft stock and bios.
- **Draft stock ticker**: each prospect gets a weekly **stock** (−3…+3) from production vs expectation, awards and arc beats. It moves consensus (§6), not truth. Your scouts may disagree.
- **Arc templates** (F6), ~24 at launch. Each changes hidden truth *and* public perception, not always in the same direction:
  *Breakout sophomore · Injury comeback · Transfer portal · QB battle · Small-school dominator ·
  Character concern · Position switch · Bloodlines* (a relative is a `franchiseLore` legend) *· Senior Bowl riser ·
  Workout warrior · Tape darling (bad testing) · Declares early · Returns for senior year · Team captain ·
  Walk-on to starter · Coach's son · Two-way player · Late-season collapse · Bowl-game MVP ·
  Scheme mismatch (production down, talent unchanged) · Medical redshirt · Hometown hero · Big-stage flop ·
  Generational hype* (X-Factor potential, §11).
- **Your choices on Saturday** (optional, one per week, auto-filled by delegation):
  - **Attend a game** with your GM (big knowledge boost on 2–4 prospects from both rosters, and it's visible to rivals as a signal).
  - **Send a scout to a bowl or all-star game** (conference-wide knowledge).
  - **Build rapport**: following and attending raise a small hidden `rapport`, which later improves interviews, UDFA recruiting and rookie-contract mood.
- **Early declarations**: after the college playoff, juniors with high stock may declare (~25–40 a year), so class size and strength vary. A **Class strength forecast** (Weak / Average / Deep at QB, etc.) lets rebuilds plan tanking or trading into future years.
- **Transfers**: 3–5% of underclassmen transfer each spring, changing role, school and scheme.
- Stats are stored per season. Drafted cohorts compact to career lines (the existing `packCollege`).

### UI — Saturdays screen (replaces Campus Watch)
```
┌ SATURDAYS · Week 9 ───────────────────────────────────────────── [Delegate ▾] ┐
│ TOP 25 strip:  #1 Ridgeline 9-0 ▸ W 38-14 │ #2 Coastal 8-1 ▸ L 20-23 │ …  ⟶    │
├──────────────────────────────┬────────────────────────────────────────────────┤
│ YOUR PROSPECTS PLAYED  (6)   │ HEISMAN LADDER            │ THIS SATURDAY       │
│ ● J. Okafor QB  24/31 342 3TD│ 1 ▲ J. Okafor  QB Ridgel. │ Attend: Ridgeline @ │
│   Stock ▲2 · "Arm talent is  │ 2 ▼ M. Reyes   RB Coastal │ Coastal (4 of your  │
│   real" — K. Lund (area)     │ 3 ▲ …                     │ board players)  [Go]│
│ ● T. Banks EDGE 2 sacks …    │                           │ Scouts: 3/3 assigned│
├──────────────────────────────┴────────────────────────────────────────────────┤
│ STORYLINES  ▸ "Transfer portal: D. Hale leaves Pinecrest for Ridgeline"       │
│             ▸ "Bloodlines: grandson of your 1998 MVP commits to Lakeshore"    │
└───────────────────────────────────────────────────────────────────────────────┘
Tabs: This week · Classes · Schools · Storylines · Awards
```
- **Classes**: a virtualized table `Name · Pos · School · Yr · Tier · Stock ▲▼ · Your grade (range bar) · Confidence · Flags`, with saved filters. **Following = adding to your board.**
- **Schools**: a conference standings grid and a school page (roster of prospects, schedule, results, colours).
- **Prospect page** (shared with Draft, §10 prospect variant): story timeline, position-aware stat table, scouting notes by author, and a teammates strip.
- Hub gets one "Saturday recap" card, 3 lines max, only about players you follow.

---

## 5. Scouting — "The Department"

**Goal:** turn the binary 10-point reveal into a year-round resource game with people, bias and payoff.

### Mechanics
- **Knowledge** `k ∈ 0–100` per prospect, stored sparsely (`{id: k}`, touched prospects only). The displayed rating = `truth + noise(id, teamId, scoutBias) × (1 − k/100)`. Noise is hash-derived, so it costs zero bytes, stays stable, and differs per team (CPU boards differ too).
- **Range** = ± 12 × (1 − k/100), with a ±2 floor until the player's first pro snap. This fixes the leak.
- **Perceived grade** is computed from perceived ratings. The true grade never leaves the engine.
- **Knowledge decays** slowly (−2/month) for players you stop watching, so re-checks matter late.
- **Scouts** (F5): a Director, 3 area scouts (regions = conferences) and 1 national scout, each with `eye` (noise reduction), `bias` ("loves speed", "position blind spot", "small-school skeptic"), `region`, `rep` and `salary` (the staff budget, §9). **Hit rate** comes from how their top grades turned out 3 years later. Scouts can be hired, fired and poached.
- **Weekly assignments (in season)**: 1 per scout per week: *Watch player* (+k on one), *Cover conference* (+small k on many), *Cross-check* (the Director re-grades and removes one scout's bias) or *Pro scouting* (see below). Assignments auto-fill from your board, so there's no weekly chore unless you want it.
- **Offseason events** with budgets:
  - **Combine**: measurables and **medicals** become public for everyone. Athletic truth is revealed; football truth isn't. It generates "combine riser/faller" news.
  - **Interviews** (15 slots): reveal personality (the full `character.js` view) and surface character arcs. Rapport (§4) improves results.
  - **Pro days / private workouts** (10 visits): a big k gain on one player. Rivals see your visits, and CPU GMs react (a smokescreen has value).
- **War-room disagreement**: for top prospects, 2–3 scout opinions side by side ("Area: R1 — *'fluid hips'*; Director: R3 — *'tight in space'*"). The disagreement *is* information.
- **Pro comps & sleeper alerts**: each report compares the prospect to a real current league player ("Plays like your LB D. Ward"), and scouts flag 3–5 sleepers a year that CPU consensus has undervalued.
- **Pro personnel (light)**: pro players' OVR stays public, but **hidden trajectory** (early decline, late bloom) and **injury proneness** are revealed only by pro-scouting assignments. This matters in trades and free agency ("Our pro scout thinks he falls off a cliff at 30").
- **Camp reveal** (F1 stage): after camp, your rookies' true ratings appear next to what you believed. Each gets a "Scout was right / wrong" verdict that updates scout rep. It's one of the best moments in the offseason, so it gets a proper reveal animation.

### UI
**Big Board** (the main scouting surface, also used live in the Draft Room)
```
┌ BIG BOARD · 2027 class · Deep at EDGE, thin at QB ──────── [Auto-rank] [Mocks] ┐
│ Tiers:  BLUE (6) │ RED (14) │ GREEN (31) │ WATCH │ DO NOT DRAFT                  │
│ #  Player            Pos  Your grade          Fit  Need  k%   Cons.  Flags      │
│ 1  J. Okafor   ⚡pot  QB   ▕━━━━━██━━━━▏ 78–86  92   ●●●  71%  #3    🩺 ok      │
│ 2  T. Banks          EDGE ▕━━━━━━━███━━▏ 80–84  88   ●●○  89%  #9    ⚑ sleeper  │
│ 3  …                                                                          │
└─ drag rows to re-rank · ⇧-click to tier · range bar narrows as k rises ────────┘
```
- The range bar is the core feedback loop: it visibly tightens with every assignment.
- The "Cons." column (consensus mock slot) next to your grade shows where your edge is.
- A **"Where do we disagree?"** filter shows prospects where scouts differ, or where you differ from consensus.
- **Scouting Office** tab: scout cards (face, region map, bias, hit rate, assignment dropdown) and one-click *Auto-assign from board*.
- **Combine** tab: a sortable measurables table with position percentiles and a spider chart on hover.

---

## 6. The Draft — "Draft Weekend"

**Goal:** a tense, fast, three-night event where preparation pays off, rivals behave like people, and every pick has a story.

### Mechanics
- **Three nights**: R1 pick-by-pick with drama; R2–3 fast; R4–7 "sim to my pick" with a best-available auto-list.
- **Real CPU boards**: each CPU team drafts from its *own* perceived grades (derived noise + its scouts + GM archetype + scheme fit + needs + mode). Reaches and steals emerge naturally.
- **Consensus mock**: the average of CPU boards, updated weekly in the offseason and during the draft. Each prospect has a projected range ("picks 8–15"). The gap between your grade and consensus is the opportunity.
- **Future picks** (next 2 years) are tradeable everywhere. `draftPickOwners` becomes `{year, round, originalTeamId}` (Codex migration).
- **Trade up**: choose a target slot; the owner returns 1–3 real packages from *its* perspective ("they want your 2028 2nd").
- **Trade down**: while you're on the clock, 0–3 incoming calls in the Phone (F7) from CPU teams whose target is still on the board.
- **Conditional picks** (in draft and trades): "2028 3rd → 2nd if he plays 50% of snaps", evaluated at season end.
- **Clock**: runs only on your pick. On expiry it takes *your board's* top player (fixes the true-OVR auto-pick).
- **Moments** (F6 beats, ~6 per draft): position runs, a green-room faller, a rival taking your guy one pick earlier (named GM), a trade-up bombshell, a hometown/bloodlines pick, "Mr. Irrelevant" and an X-Factor-potential prospect coming off the board.
- **UDFA scramble**: 90 seconds bidding on the top 60 undrafted players with a small bonus pool and "roster spot promise" chips (a broken promise hurts rapport and the agent relationship).
- **Rookie contracts**: slotted and auto-signed. The **5th-year option** decision appears 3 years later.
- **Grades, honestly**: a night-of **Media grade** (consensus-based, delivered by 2 named analysts with opposite takes), then a **3-year re-grade** in Draft History using real value. Scout rep updates from the re-grade.

### UI — Draft Room
```
┌ DRAFT NIGHT 1 · Pick 11 · YOU'RE ON THE CLOCK  01:12 ──────── [Trade] [Auto] ┐
├─ TICKER ──────────┬─ YOUR BOARD ───────────────────────┬─ ON THE CLOCK ───────┤
│ 10 DEN  T. Banks  │  1 ~~J. Okafor~~ (#3 CLE)          │ [crest] YOU           │
│   EDGE · "a reach │  2 ~~T. Banks~~  (#10 DEN) 😤      │ Needs: CB ●●● OL ●●○  │
│   by 8 spots"     │  3 R. Mills   CB  81–85  fit 90 ◀  │ Best fit: R. Mills    │
│   Your board: #2  │  4 A. Cole    OL  79–85  fit 76    │ 📞 2 calls waiting    │
│ 9  LV  …          │  5 …                               │  · SEA: #19 + #52     │
│                   │  [Best available ▾] [By need ▾]    │  · NYG: #14 + '28 R3  │
└───────────────────┴────────────────────────────────────┴───────────────────────┘
```
- Ticker (left): the last 5 picks, an analyst one-liner each, and a "your board" delta ("took #2 on your board").
- Board (centre): your Big Board live, with drafted players struck through, plus "best available by need".
- On-the-clock (right): team, GM face and archetype, their needs, a rumour ("hearing they love OL"), and waiting calls.
- **Draft Card ceremony** on your pick: a full-screen card (face, school colours, the scout quote you trusted, projected role). Confirm is one click; it can be turned off in Settings.
- **Recap**: the class grade (media) and a "Your haul" strip of compact player cards, with a Camp-reveal teaser.
- Mobile: Board / Ticker / Clock become tabs, with the clock card sticky.
- `Draft.jsx` is split into `draft/DraftRoom.jsx`, `BigBoard.jsx`, `DraftTicker.jsx`, `OnTheClock.jsx`, `DraftTradeSheet.jsx`, `DraftCard.jsx` and `DraftRecap.jsx`.

---

## 7. Trades — "The Phones"

**Goal:** trades feel like negotiating with people who have goals, and spam-clicking never wins.

### Mechanics
- **Deterministic acceptance**: willingness = F2 perceived value ratio vs a hidden per-GM threshold seeded per (GM, week). Same offer, same week, same answer.
- **Counter-offers**: a rejection returns the smallest change that would work ("Add your 2028 3rd", "Swap Smith for Jones"), found by a bounded search over your non-core assets. **A counter proposed as-is is always accepted.**
- **"What would it take?"**: select any rival player and get their asking package in one click.
- **Trade block & shopping**: put players on your block (optionally "quietly"). CPU teams respond during the week via the Phone (F7). Up to 3 open offers, each with an expiry.
- **Team modes make the market**: contenders buy at the deadline and rebuilders sell veterans for picks. **Deadline Day** (week 11) is an event with a countdown, rumours, a live league-wide trade ticker and 3–6 CPU↔CPU deals with real pick exchanges.
- **Legality**: cap-legal after the trade (fixes `executeTrade`), dead money shown before you accept, roster 46–53 enforced, and no trading a player within 1 week of signing him.
- **Player agency**: `wantsOut` generates **trade-request arcs** (F6) with a deadline and a *public vs private* choice. Going public drops his value (leverage) and morale if ignored. `tradeFallout` morale is already built.
- **GM relationships**: each CPU GM keeps `trust` with you. Lopsided deals lower it and fair ones raise it. Low trust raises their threshold and makes them stop calling. A former staffer who's now a GM (F5) starts friendly.
- **Rumours & leaks**: shopping a star publicly creates a rumour. If he has the Loyal trait and hears it, his mood drops. Keep "quiet" shopping for a higher-trust partner.
- **League trades**: mode-driven multi-asset deals from the same engine, capped per week, in a Transactions feed.

### UI — Trade Machine
```
┌ TRADE MACHINE · with [crest] Denver Pikas · REBUILD · GM R. Voss "Analytics" 🤝 62 ┐
│ YOU SEND                          │ YOU GET                                       │
│ [card] M. Ortiz WR 84 · $14M ×2   │ [card] 2028 R1 (DEN) · proj. #4–9             │
│ [chip] 2027 R3 (own)              │ [card] K. Lowe  CB 74 · $2M ×3 · age 23       │
│ + Add from: Block · Surplus · Picks│ + Add from their roster · picks              │
├──────────────────────────────────────────────────────────────────────────────────┤
│ THEY SEE  ░░░░░░░░░░▓▓▓▓▓▓│░░  CLOSE  (band, not a number)                        │
│ CAP  You $188M → $176M ✓ · Dead money $0 · Roster 53 → 53 ✓                       │
│ LOCKER ROOM  Ortiz is a captain: team morale −3 · owner trust −1                  │
│                                              [ What would it take? ] [ PROPOSE ] │
└──────────────────────────────────────────────────────────────────────────────────┘
```
- The value meter is a **band from the partner's perspective** (*Insulting · Needs work · Close · Accept*). It gives feedback without an exact oracle.
- The partner header shows mode, top needs, GM face and archetype, and trust.
- The response plays as a short phone call with the counter inline: **Accept counter** in one click, or *Keep talking*.
- The **Offers** tab is the Phone filtered to trades, each row with value band, fit and fallout preview.

---

## 8. Free agency & re-signing — "The Market"

**Goal:** keep K6's 4-day market (it works) and add the decisions that make the NFL offseason tense.

### Mechanics
- **Re-sign & Tag window** (the F1 stage before FA): expiring players with their `contractStance`, ask, market projection, pro-scouting trajectory (§5) and a recommendation: *re-sign · tag · tender · test market · let walk · trade before the window closes*. Unsigned players reach the market and can still be re-signed there, in competition with rivals.
- **Contract structure** (F3): salary + years + guaranteed % + signing bonus + one incentive. Players value guarantees through `faPreferences` (greed/security axes), so structure matters, not only AAV.
- **Tags, RFA/ERFA tenders and compensatory picks** (net FA losses award R3–R7 picks next year).
- **Agents** (F5): each FA has an agent with a style (*Hardball*, *Relationship*, *Fast mover*). Agent memory is tracked: lowballing a Hardball agent's clients raises their floors for a year.
- **Visits & pitch**: on day 1 you host 3 visits. A visit reveals his priorities (money / winning / role / scheme fit / hometown / X-Factor spotlight). Your **pitch** picks 2 of 5 selling points (Contender, Scheme fit, Starting role, Coach's reputation, Hometown), and truthful pitches only: "starting role" becomes a promise tracked in an F6 arc.
- **Market dynamics**: a day-1 frenzy (the top 10 sign on days 1–2 at a premium), day-4 bargains and late **ring-chasers** (veterans taking the minimum to join contenders). CPU GM archetypes shape spending, and CPU teams stay cap-legal including dead money (Codex).
- **Holdouts**: an underpaid star with a Greedy trait can start a holdout arc in camp (skip camp, lose practice development). Options: extend, trade, or wait (morale and owner cost).
- **Retire `freeAgencyLogic.evaluateOffer`**; route everything through `faMarket.assessOffer`.

### UI
- **Re-sign window**: one table, with decision chips per row and a sticky **cap waterfall** at the top (current → after decisions → projected FA room). **Apply recommendations** in one click.
- **Market**: keep the day stepper. Add a **Shortlist** column that persists across days, a **position heat map** (supply vs how many teams need it), an offer builder with structure sliders and a likelihood band, and the Wire as a live ticker.
- A **Cap Chart** (5 years, stacked by player, dead money hatched) is shared with Roster and the Trade Machine.

---

## 9. Coaching trees — "The Staff"

**Goal:** coaches become characters whose careers you shape, whose schemes shape your roster, and whose tree becomes your legacy.

### Mechanics
- **Richer coaches** (F5): age, scheme (F4), three ratings (**Offense, Defense, Development**) replacing flat skill points, and traits (*Players' coach, Disciplinarian, Innovator, Recruiter, Loyal, Ambitious, QB whisperer, Aggressive play-caller*). Play-caller traits feed `gamePlan.js` defaults (4th-down appetite, pass tilt). Old saves' `skills` map onto the ratings.
- **Staff depth**: HC, OC, DC, ST coordinator, QB coach, Development coach (a progression bonus by position group through a Codex `progression.js` hook), and the Scouting Director plus scouts (§5).
- **Staff budget**: owner-set, separate from the cap, and growing with owner trust. The tradeoff is real: an elite OC or two more scouts.
- **Grooming**: mark one assistant as your **successor-in-training**. He gains rating faster, becomes Ambitious sooner, and is likelier to be poached.
- **Poaching both ways**: after the season, successful user coordinators get HC interviews. *Block* (Ambitious coaches sour, rating −) or *let go* (you gain **Tree prestige** and a friendly GM/HC, and they take your scheme). You may request interviews with rival coordinators (they can deny).
- **The Tree**: `mentorId` becomes a full lineage. **Tree prestige** = your descendants' success. It increases hiring pull, feeds `legacy.js` achievements ("Coaching tree: 5 head coaches"), and raises the rivalry level when a protégé beats you.
- **Hiring is an event**: a vacancy opens a 2-round flow. A shortlist of 5 (scheme, ratings, ask, and "% of your starters who fit"), then interviews: 2 questions each that reveal hidden traits. CPU teams hire at the same time, so a candidate can take another job while you deliberate.
- **Carousel as a show**: Black Monday firings, a hiring ticker, "Your former OC hired by X". Coaches age and retire (65–72) into TV analysts, who become the voices of Media draft grades (§6).
- **Scheme transition cost**: switching schemes gives one season of reduced fit, and low-fit players may request trades (F6).
- **User career**: the user HC gets the same ratings. Owner review (K1) can fire you and **job offers** consider your tree prestige.

### UI — Staff screen
- **Org chart**: staff cards (face, scheme icon, 3 rating pips, contract, mood, and a *Successor* ribbon). The staff budget bar sits on top.
- **Coaching Tree**: an interactive, collapsible SVG tree rooted at you. Nodes are faces, with rings coloured by current role (HC / coordinator / assistant / retired). Hovering shows the record and current team. There's also a *League trees* tab with the 5 biggest trees.
- **Market & interviews**: a candidate table, then an interview modal (2 questions and a reveal).
- The **Carousel** feed appears in the Command Center during Black Monday.

---

## 10. Player card overhaul — "Status first"

**Goal:** one glance tells you *what's going on with this player and what to do about it*. Everything else is one tap away.

### Problems today (`PlayerModal.jsx`)
6–10 chips appear before any content (dev trait, mood, every public trait, "🔒 +N unknown"). Injury,
depth role, walk year, holdout and trade request are missing from the header. The accent colour comes
from OVR rarity, not situation. There are no actions. The default tab is Character even when you
only want to know if he's healthy. There's no compact variant, so rows, trade chips and draft cards
re-implement fragments.

### Status engine — `engine/playerStatus.js` (pure, derived, zero bytes)
`playerStatus(player, ctx) → { primary, secondary[], tone, headline, actions[] }`.
It ranks every applicable status by priority, and the card shows **one primary status** plus at most 2 secondary.

| Priority | Status | Tone | Headline example | Quick actions |
|---|---|---|---|---|
| 1 | **Injured** (out / questionable) | danger | "Hamstring · out 3 wks (back wk 12)" | Move to IR · Sign replacement |
| 2 | **Holdout / wants out** | danger | "Requested a trade — deadline wk 9" | Talk · Shop him · Ignore |
| 3 | **In the zone** (X-Factor, live) | xfactor | "⚡ Zone active: 'Okafor Overdrive'" | View ability |
| 4 | **Walk year / expiring** | warning | "Final year · asks $18M/yr" | Extend · Tag later |
| 5 | **Hot / slumping** (last 3 games vs his baseline) | positive / warning | "3 straight 100-yd games" | — |
| 6 | **Rookie / camp reveal** | info | "Rookie · better than we graded (+4)" | Set role |
| 7 | **Position battle** | info | "Competing with D. Ward for LB2" | Decide |
| 8 | **Unhappy** (mood < 40, from `moodFor`) | warning | "Frustrated with his role" | Talk |
| 9 | **Starter / rotation / backup** (default) | neutral | "Starting LT · 98% of snaps" | Depth chart |

Rival players show only public statuses (injury, trade request if public, X-Factor, hot/slump). Prospects show only prospect statuses (Stock ▲, Medical flag, Sleeper, Character concern).

### Layout (full card — modal on desktop, bottom sheet on mobile)
```
┌──────────────────────────────────────────────────────────────────────┐
│ [face]  MARCUS ORTIZ  #11                               ╭────╮       │
│         WR · Houston Apollos · 27 · 6'1" 196            │ 84 │ ▲2    │
│  ┃ ⚠ WALK YEAR · asks $18M/yr                           ╰────╯ OVR   │
│  ┃ [ Extend ]  [ Shop ]                    Starter · Hot 🔥          │
├──────────────────────────────────────────────────────────────────────┤
│  ROLE           CONTRACT              FORM (last 5)                  │
│  WR1 · 91% snaps  $14M · 1 yr left    ▁▃▆█▇  86 ypg                  │
├──────────────────────────────────────────────────────────────────────┤
│ Overview │ Ratings │ Career │ Contract │ Personality                 │
│  Overview: 3 key attributes vs position avg · season line ·          │
│            2 public traits (+2 more ▸) · latest storyline beat       │
└──────────────────────────────────────────────────────────────────────┘
```
- **Status band**: a left rule and background tint from the **status tone**, not OVR rarity. The OVR ring keeps the rarity colour, so quality and situation are both readable without competing.
- **Three vitals only**: Role · Contract · Form. POT appears in Ratings (as a range if not fully known). Mood lives in Personality, unless it *is* the primary status.
- **Chips collapse**: at most 2 trait chips, plus a "+N more" drawer. The dev trait moves into the OVR ring as a small corner mark (★ Star, ★★ Superstar, ⚡ X-Factor).
- **Tabs** (Overview default): *Overview* (the essentials), *Ratings* (grouped bars vs position average, with fog ranges for rivals and prospects, and the editable-mode toggle kept for custom leagues), *Career* (season table, awards, transactions timeline, college career), *Contract* (structure, cap chart, dead money if cut, and a stance/ask for your own players), *Personality* (the existing Character tab content: axes, traits, mood reasons).
- The **X-Factor** variant adds a foil frame and an **Ability panel** in Overview (§11).

### Variants (one component family — `components/player/`)
| Variant | Where | Shows |
|---|---|---|
| `PlayerCard` full | modal/sheet from anywhere | the layout above |
| `PlayerCardCompact` | trade chips, FA shortlist, draft haul, hub leaders | face, name, pos, OVR ring, primary status dot + 1-line headline |
| `PlayerRow` | roster / tables | same data in a row; status dot column; hover → compact card |
| `ProspectCard` | Big Board, Saturdays, Draft Card | range bar instead of OVR, stock ▲▼, fit, k%, scout quote |
| `PlayerCardMini` | play-by-play, broadcast, X-Factor toasts | face + name + ⚡ when in zone |

`PlayerModal.jsx` becomes a thin wrapper over `PlayerCard`, so existing callers keep working.
Accessibility: status is always text + icon (never colour alone), the sheet is focus-trapped, and the tab order goes status → actions → tabs.

---

## 11. X-Factor tier — "One of one"

**Goal:** a tiny group of players (≤ 1% of the league, roughly 10–16 at a time) with **abilities unique
to each of them**. The abilities visibly change games, have counters, and create the moments people remember.

### 11.1 Earning and losing the tier
- **Eligibility**: OVR ≥ 88 **and** a qualifying season (All-Pro, or a top-3 position stat line, or a playoff hero game score). Or, rarely, a Generational prospect with *X-Factor potential* who meets a rookie-year milestone.
- **League cap**: at most 16 active. When more qualify, the best composite (OVR + season + age curve) wins, and the rest are **"X-Factor candidates"** (a hint on the card that feeds the story).
- **Awakening arc** (F6): a candidate's card shows "⚡ Awakening 2/3" with the milestone left ("1 more 150-yd game"). Reaching it fires a full-screen **Awakening** moment with the ability reveal.
- **Losing it**: two straight seasons below the bar, OVR < 85, or age decline. **Dormant** state: the ability is kept but inactive, and can be reawakened once. Retired X-Factors enter the franchise record book (`legacy.js`).
- **Prospects**: scouting (§5) can reveal "X-Factor potential" on Generational college players. It's a hint, never a guarantee.

### 11.2 A unique ability for every player
Each ability is assembled deterministically from `hashSeed(player.id)` out of four parts, then checked
against a league **registry** so no two active players share the same trigger + effect pair. On a
collision the seed advances. Storage: `xFactor: { since, level, seedBump, dormant }` (~20 bytes). The ability itself is derived.

1. **Trigger** (when it can fire), filtered by position family:
   *3rd down · Red zone · 4th quarter · Two-minute drill · Trailing by 8+ · Opening drive · After a turnover ·
   Backed up inside own 20 · Road game · Primetime/playoffs · Versus a rival (from `rivalries.js`) · Goal-to-go ·
   When double-teamed (defense) · Opponent in hurry-up*
2. **Effect** (what the sim changes), mapped to a real `gameEngine` hook (§11.3):
   *Completion ↑ · Sack avoidance ↑ · Deep-shot success ↑ · YAC/breakaway ↑ · Broken-tackle ↑ · Contested catch ↑ ·
   Drop rate ↓ · Pressure rate ↑ · Strip-sack chance ↑ · INT chance ↑ (DB) · Run-stuff rate ↑ · Pass-block win ↑ ·
   FG range + accuracy ↑ · Return breakaway ↑ · Opponent QB accuracy ↓ (aura)*
3. **Activation rule** (the in-game "zone"): each ability needs to be **earned inside the game** before it's live:
   *2 straight completions of 15+ · a 20+ yd run · 2 catches in a drive · a sack · a pass breakup ·
   3 straight successful blocks on a drive · a made 45+ FG*. It **deactivates** on a counter event (sacked twice, a drop, a penalty, a TD allowed) or after N drives.
4. **Signature twist** (flavour and a small extra): *Momentum* (a zone-activation TD gives the team a +form bump for the next drive) ·
   *Aura* (the opponent's play-caller gets more conservative) · *Lockdown* (targets shift away from his receiver) ·
   *Ice* (the effect doubles in the final 2 minutes) · *Teammate spark* (one teammate gets +half the effect) ·
   *Showman* (bigger fan and owner reaction in recaps).

With ~14 triggers × ~15 effects × ~7 activations × 6 twists (filtered by position), there are thousands
of combinations for ~16 active players, so uniqueness is cheap to guarantee.

**Naming**: a derived signature name from the player's name, position and effect ("*Okafor Overdrive*",
"*The Banks Vault*", "*Lowe Tide*"), with a fallback template list. The one-line description is generated from the parts:
> ⚡ **Okafor Overdrive** — *In the 4th quarter, once he completes two 15+ yd passes in a row, his completion rate jumps (+7%) until he's sacked. Momentum: a zone TD fires up the offense for a drive.*

**Levels** (1 → 3: *Awakened, Mastered, Legendary*): milestones (zone TDs, playoff wins in the zone)
raise the magnitude by one step and unlock a second trigger at Legendary. Level 3 is legacy-worthy.

### 11.3 Sim integration (the rules that keep it fair)
- `engine/xFactor.js` (Claude): `abilityFor(player, registry)`, `xFactorsInLineup(team)`, and a small per-game state machine `{ armed, active, drivesLeft, activations[] }`.
- `gameEngine.js` gets **one hook point per effect family** (pass, rush, protection, rush-D, coverage, kicking, return) that multiplies the existing probability terms (`pCmp`, `pSack`, breakaway, etc.) only while the player is on the field **and** active **and** the trigger condition holds.
- **Magnitude caps**: a single effect is at most ±7% relative on its probability term (L1 ±4%, L2 ±5.5%, L3 ±7%). At most 2 X-Factors per team per game can be active at once.
- **Calibration targets** (`tests/xFactor.mjs` + `calibration.mjs`): a team with one X-Factor gains **+0.3 to +0.8 points/game** on average and 1–2% win probability. League scoring moves by less than 0.3 ppg. Across 10k sims, no single ability family dominates (max/min family value ratio < 2).
- **Counters**:
  - Defensive X-Factors cancel or shorten offensive zones in direct matchups (e.g. a *Lockdown* CB vs an X-Factor WR: whoever activates first suppresses the other's activation).
  - Weekly prep (`weeklyExperience.js` / MatchupPreview) adds a **"Scheme for him"** option against an opposing X-Factor. It delays his activation by 1 trigger but costs a small coverage or run-fit penalty elsewhere, so it's a real tradeoff.
  - The opponent's X-Factor appears in MatchupPreview with his ability line and last-3-games activation rate.
- **Determinism**: the ability and its state use the game's seeded RNG, so watch mode and sim mode match (per the K11 guarantee).
- **Logging**: the play log (`pbp`) records `xf: { id, event: 'armed' | 'active' | 'fired' | 'off' }`, and `gameStory.js` picks up "X-Factor moments" for recaps.

### 11.4 Where it shows up (UI)
- **Player card**: a foil frame (a CSS gradient border, animated only when `prefers-reduced-motion` allows), a ⚡ mark in the OVR ring, and an **Ability panel**: name, one-line rule, level pips, activation rate this season, a "Signature moments" list and a counter hint for rival players.
- **Broadcast** (`GameBroadcast.jsx`): a gold ⚡ **ZONE** banner when active, an ability-name toast when it fires, and a zone meter beside the scorebug.
- **WeekLoadingScreen / scoreboard**: a small ⚡ on the tile when an X-Factor fired in that game.
- **Recap** (`GameSummaryModal`): an "X-Factor moment" row with the play, and "Zone: 2 activations, 1 TD".
- **League → X-Factors** page: a gallery of the ≤ 16 active (card grid, filter by team or position), candidates close to awakening, and a history of retired and dormant X-Factors. It's a fun browse page and a trade shopping list.
- **Economy**: X-Factor adds a trade premium (replacing the dead `'Superstar X-Factor'` string in `getPlayerValue`), an FA ask premium, owner/fan excitement, and an achievement set ("Drafted a future X-Factor").

---

## 12. Cross-system web

| Trigger | Consequence |
|---|---|
| You let your OC take a HC job | He takes your scheme. In FA he targets your ex-players who fit it. His board shares your scout's biases. Rival flavour when you meet |
| A scout's favourite becomes a Pro Bowler or X-Factor | Scout rep ↑, better scouts want to join you, achievement |
| You draft a college teammate of your QB | A small chemistry bonus and a storyline beat |
| A *Bloodlines* prospect (relative of a franchise legend) | An owner goal appears ("draft him"), and the Draft Card gets a crowd reaction |
| You trade a fan favourite or an X-Factor | `tradeFallout` morale + owner trust. Revenge-game flavour in `gameStory`; his zone gets +1 activation chance vs you in the first meeting (the *Revenge* twist) |
| Heavy dead money | An owner goal to fix the cap; limits FA day-1 bids |
| Rebuild mode + extra future picks | The class-strength forecast (§4) becomes an active tanking or trading decision |
| A protégé beats you in the playoffs | Rivalry level +1 (`rivalries.js`) and a tree-prestige line in the recap |
| An X-Factor enters a walk year | The status band becomes the #1 decision on your Hub; rival GMs start calling the Phone |
| Camp reveal: rookie better than graded | Scout rep ↑, a rookie arc opens ("earn a role"), the card shows "Rookie · +4 vs our grade" |

## 13. UI information architecture

- A new nav section, **Front Office** (replaces `office`): `Command Center · Big Board · Draft Room (seasonal) · Trade Machine · Market · Staff · Saturdays`. League gains **X-Factors**. `navigation.js` keeps old screen ids as aliases.
- The **Command Center** is the offseason timeline stepper, the current stage panel, and a **Needs your decision** queue (max 3, from the Phone). In season it becomes a weekly front-office summary: scouting assignments, trade offers, a college recap and player-status alerts.
- **Shared components** (Claude): the `components/player/*` family (§10), `RangeBar`, `ValueBand`, `CapChart`, `CapWaterfall`, `PersonChip` (coach/scout/GM/agent with face), `Ticker`, `DecisionQueue`, `VirtualTable`, `StageStepper`, `FoilFrame`. All use tokens and the `ui` barrel.
- **Motion budget**: celebratory moments (Draft Card, Awakening, Camp reveal, Deadline Day ticker) respect the sim-speed preference and `prefers-reduced-motion`, and are skippable everywhere.
- **Delegation everywhere**: each stage header has `Delegate ▾ / Recommend / Manual`, extending the Front Office Assistant settings.
- **Performance**: virtualized tables (1,400 college rows, 350 prospects), memoized selectors, and no full-class re-sorts per draft tick.

## 14. Onboarding

- First time in each new screen: a 3-step coach mark ("This range bar is your scouts' confidence…"), dismissible and stored as a per-device pref (`components/preferences.js`).
- The first offseason runs **Recommend** mode by default, so a new player sees good defaults and can intervene.

## 15. Save & performance budget

| Data | Strategy | Target |
|---|---|---|
| Scouting knowledge | sparse `{id: k}` for touched prospects; noise derived | ≤ 15 KB |
| College schools/teams | derived; only current-season results stored | ≤ 25 KB |
| College arcs | `{templateId, beat}` for prospects with an arc; text derived | ≤ 40 KB |
| CPU boards | never stored; recomputed at draft time | 0 |
| People (coaches, scouts, GMs, agents) | ~400 records, compact history `[year, teamId, roleCode]` | ≤ 90 KB |
| Future + conditional picks | `{y, r, o, c?}` tuples | ≤ 12 KB |
| Contracts v2 | 3–4 extra numbers per player | ≤ 40 KB |
| X-Factor | `{since, level, seedBump, dormant}` × ≤ 16 + history ≤ 60 | ≤ 4 KB |
| Player status | derived | 0 |
| **Total new** | | **≤ 250 KB**, plus a season-10 soak under the 5 MB quota |

## 16. Test plan (new files, all seeded through `tests/helpers/seededRandom.mjs`)

`scouting.mjs` (noise determinism, no truth leaks through any exported UI helper, monotone range) ·
`draftWeekend.mjs` (per-team boards, trade up/down legality, conditional picks, UDFA, pick migration) ·
`assetValue.mjs` · `contracts.mjs` (dead money, tags, options, old-save defaults) ·
`tradeNegotiation.mjs` (determinism, counter acceptability, cap legality) ·
`collegeSeason.mjs` (standings consistency, declarations, arc exactly-once) ·
`coachingTree.mjs` (lineage, poaching, retirement, prestige) ·
`offseasonCalendar.mjs` (resume after reload at every stage; full delegation completes the offseason) ·
`playerStatus.mjs` (priority order, fog for rivals, every status reachable) ·
`xFactor.mjs` (uniqueness across 50 seeded leagues, cap ≤ 16, magnitude caps, calibration bands, watch = sim determinism, counters reduce activation).

## 17. Roadmap & ownership (per `AGENTS.md`)

Each milestone ships on its own, keeps old saves loading, and ends green on `npm test`, `npm run lint` and `npm run build`.

| # | Milestone | Codex (engine/store/tests) | Claude (new modules + UI) | Done when |
|---|---|---|---|---|
| **M0** | Quick fixes | Deterministic trade acceptance; cap and roster checks in `executeTrade`/`acceptTradeOffer`; timer auto-pick uses the board; remove the random `freeAgencyLogic` path; one pick chart | Fix the `getOvrRange` leak (`hashSeed(id)`); show perceived grade unscouted | A regression test per fix |
| **M1** | Foundations | `contracts.js` + dead cap + migration; future picks + migration; `assetValue.js` | `offseasonCalendar.js` + Command Center shell; `people.js`; `schemes.js`; `inbox.js` + Phone | Old save loads mid-season, in FA and mid-draft; 5-season soak with no cap drift |
| **M2** | **Player card** | Expose depth-chart role, injury ETA and snap share as pure selectors | `playerStatus.js`; `components/player/*` family; `PlayerModal` becomes a wrapper; swap in rows, trade, FA, hub | Every status reachable in tests; no header shows > 3 chips; browser check on 1024 px and mobile |
| **M3** | Scouting | Medicals/injury-proneness truth in progression | `scouting.js` (knowledge, scouts, assignments, combine, interviews, visits, pro personnel, camp reveal); Big Board + Scouting Office | Perceived ≠ true at k=0; range shrinks monotonically; CPU boards differ (Kendall τ < 0.9) |
| **M4** | Draft Weekend | `cpuMakePick` on per-team boards; draft trade engine; conditional picks; UDFA; 5th-year option; comp picks | Draft Room split, ticker, moments, Draft Card, trade sheet, 3-year re-grade | ≥ 5 R1 picks more than 8 slots off consensus; a full draft sims in < 1 s |
| **M5** | **X-Factor** | Eligibility and loss inside `progression.js` season end (calls Claude's `xFactor.js`); calibration soak | `xFactor.js` (generator, registry, per-game state); `gameEngine.js` hook points; card foil and Ability panel; Broadcast zone UI; X-Factors page; MatchupPreview "Scheme for him" | Calibration bands in §11.3 hold over 10k games; 50 leagues never duplicate an ability; watch = sim |
| **M6** | Saturdays | College season sim, early declarations, transfers | `storyArcs.js` + 24 college arcs, Heisman ladder, stock ticker, Saturday choices, Saturdays UI | Class size varies; arcs resolve exactly once across reloads; no stat contradictions |
| **M7** | The Phones | Mode-driven CPU↔CPU trades; Deadline Day; GM trust storage | Counter search, "what would it take", trade block, Trade Machine, trade-request arcs, rumours | Same offer gives the same answer; counters are always acceptable |
| **M8** | The Market | CPU FA with dead money and GM spending; RFA tenders; holdout effects on camp development | Re-sign window, tags, structure, agents, visits & pitch, Cap Chart / Waterfall | No over-cap CPU teams in the soak; structure moves acceptance per `faPreferences` |
| **M9** | The Staff | Carousel v2 (ages, retirement, poaching both ways), staff budget, development-coach hook | Coach ratings/traits/contracts, successor grooming, interview flow, Coaching Tree SVG, prestige + legacy | A 10-season sim yields trees with ≥ 3 HC descendants; a user coordinator is poached at least once in a strong run |
| **M10** | The web & polish | 10-season × 5-seed balance soak; save-budget test | §12 triggers, delegation for every stage, onboarding, mobile pass, empty/error states | Save growth ≤ 250 KB; median fully-delegated offseason ≤ 90 s of clicks |

M2 (player card) moved early because every later milestone renders players through it.
M5 (X-Factor) needs only M0–M2 and can run in parallel with M3–M4.
Board protocol: one `CLAIM` line per agent per milestone listing files. Cross-agent APIs are posted as signatures before either side builds. `gameEngine.js` edits (M5) stay Claude-owned per K11.

## 18. Open questions for the user

1. **College sim scope**: lightweight results-and-poll (planned), or watchable college games through `gameEngine`? The second is much bigger.
2. **Fog difficulty**: should the starting range width be a setting?
3. **Staff budget**: a second budget alongside the cap, or free staff limited by headcount?
4. **X-Factor count**: is 16 league-wide right (≈ 0.9%), or should it be even rarer (8–10)? Should the user be able to see *exactly* how an opponent's ability triggers, or only after facing him once (fog)?
5. **Milestone order**: the plan now goes player card → scouting → draft → X-Factor in parallel. If trades are the bigger pain today, M7 can move up; it needs only M0–M1.

---

## 19. Implementation status (built 2026-09-27)

Everything below ships on branch `claude/sleepy-carson-lml1e4`. `npm test` runs 14 suites including the new `tests/xFactor.mjs` and `tests/frontOffice.mjs`; `node tests/frontOfficeSoak.mjs` (not in `npm test`, ~45 s) plays four full franchise years with every stage auto-resolved.

**Decisions taken on the open questions (§18):** lightweight college sim (results, poll, playoff); no fog-difficulty setting yet; a staff budget shared by coaches and scouts; 16 X-Factors league-wide, with rival abilities visible (they are public reputation); milestone order as planned.

| Area | Where | What shipped |
|---|---|---|
| M0 fixes | `scouting.js`, `collegePipeline.js`, `tradeTalks.js`, store | No truth leaks (per-team derived noise; visible grade is perceived); deterministic trade answers; cap checks in every trade path; timer auto-pick uses your board; one pick chart (`assetValue.pickNumberValue`) |
| Foundations | `assetValue.js`, `contracts.js`, `schemes.js`, `people.js`, `picks.js`, `inbox.js`, `offseasonCalendar.js`, `store/frontOfficeSlice.js` | Team modes, surplus value, future picks (2 drafts) + comp picks, dead money on cuts/trades, tags, tenders, 5th-year options, holdouts, 8 schemes + fit, derived GMs/agents/scouts, the Phone inbox, 8 offseason stages with Advance |
| Player card | `components/player/*`, `engine/playerStatus.js` | Status-first card (one primary status + actions, 3 vitals, 5 tabs), compact card, status dots/pills, roster rows lead with status; `PlayerModal` is a wrapper |
| Scouting | `scouting.js`, `screens/frontOffice/BigBoard.jsx` | Knowledge + range bars, scouts with eye/bias/hit rates, weekly assignments, pro scouting (trajectory, medicals), combine, 15 interviews, 10 visits, sleepers, pro comps, war-room opinions, camp reveal, draft history re-grades |
| Draft | `screens/draft/DraftRoom.jsx`, `projection.js` | CPU clubs draft from their own boards; deterministic mock draft (median miss 3–4 picks in R1); three nights, ticker with reaches/steals/runs, trade up/down calls, Draft Card, UDFA scramble, media grade |
| X-Factor | `xFactor.js`, `gameEngine.js` hooks, card/broadcast/matchup/recap/X-Factors page | Unique abilities (trigger, effect, activation, counter, twist), ≤16 active, awakenings/dormancy/levels, zone state machine in the play-by-play engine, "Scheme for him"; calibrated to about +0.6 points/game (see `tests/xFactor.mjs`) |
| Saturdays | `collegeSeason.js`, `screens/frontOffice/Saturdays.jsx` | 96 fictional schools, 8 conferences, weekly results, Top 25, title games, 12-team playoff, Heisman, stock, 24 story arcs (stored as tiny markers), early declarations, transfers, attend-a-game |
| Trades | `tradeTalks.js`, `TradeMachine.jsx` | Value band from the partner's side, counters (always acceptable as proposed), what-would-it-take (≤5 pieces), trade block offers, unsolicited calls, trade requests, GM trust, mode-driven league deals, deadline day |
| Free agency | `faMarket.js`, `FreeAgency.jsx`, `Contracts.jsx` | Re-sign & tag window with advice, guarantees/bonus, agents, 3 visits + honest pitch, position heat map, 5-year cap chart, dead-money view |
| Staff | `staffCareers.js`, `Staff.jsx` | Derived age/scheme/traits/ratings, QB and Development coaches (real progression effects), staff budget, interviews, successor, poaching decisions (block/let go), retirements, SVG tree, tree prestige, league trees; coordinator schemes lean play-calling |

**Not built, or simplified (honest list):**
- Incentives only change how attractive an offer is; they are never paid out or charged to the cap.
- No transition tag and no RFA offer sheets or matching: tenders are simple one-year deals.
- Dead money applies to the user's team only; CPU releases don't create dead money.
- Scouting knowledge doesn't decay; it is pruned once prospects leave the pipeline.
- Agent grudges, tree prestige as hiring pull, the Revenge twist, teammate chemistry and the Bloodlines owner goal from §12 are not wired.
- No onboarding coach marks (§14).
- The app's existing small-screen gate stays; new screens are desktop-first, and the player card is responsive.
- The schedule generator (Codex's `schedule.js`) can rarely give up; `finalizeDraft` now retries so a season never starts empty.
