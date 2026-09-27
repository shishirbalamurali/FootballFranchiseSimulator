# Front Office Overhaul — plan

Drafts · scouting · college storylines · trades · free agency · coaching trees.
Status: **plan only, no code yet.** Written 2026-09-27 from a read of the current source.
Coordination follows `AGENTS.md` (file ownership, Board, store fences). Section 13 splits the work.

---

## 0. The pitch in one paragraph

Today these six systems are separate screens with separate rules: you scout by spending
10 points to reveal a number, draft from a list, trade against a value chart you can re-roll,
sign free agents in a 4-day market, and watch a coaching list update once a year. The overhaul
turns them into **one front-office loop that runs all year**. The loop has one currency,
**information**, and one output, **stories you remember**. You follow a sophomore at a small school
because your area scout loves him. He breaks out, declares early, and a rival's GM — your old
coordinator — trades up two spots to take him one pick before you. Three years later he asks
that team for a trade, and your scout was right. Every mechanic below exists to make that sentence possible,
cheap to play (≤ 60–90 s per offseason stage when delegated), and honest about uncertainty.

## 1. Design pillars

1. **Fog of war is the game.** You never see a prospect's or opponent's true ratings. You see
   *your staff's opinion*, with a confidence range that narrows when you invest. Different
   teams believe different things. That is why steals, busts, reaches, and trade-ups happen.
2. **People, not tables.** Scouts, coaches, GMs, and prospects are persistent people with names,
   biases, histories, and relationships (mentor trees, college teammates, former players).
   Every system reads and writes those relationships.
3. **Every choice costs something.** Scouting time is finite. Cap space comes with dead money.
   Trade value is judged by *this* partner's needs and mode. Promoting a coordinator loses him.
   No "click for a free +2".
4. **Honest drama.** Storylines trigger from real state (stats, depth charts, standings),
   resolve exactly once, and adapt when a player is traded, injured, or cut. Nothing contradicts the sim.
5. **Efficient to play.** Every stage has *Delegate*, *Recommend*, and *Do it myself*.
   Batch actions. At most one decision modal per stage. Instant-sim is always available.
6. **Cheap to save.** Derive from ids and seeds (the `character.js` pattern) and store only
   decisions and deltas. Section 8 sets a hard save budget.

## 2. What exists today (verified against the source)

| System | Where | What it does | Main problems |
|---|---|---|---|
| College | `engine/collegePipeline.js`, `collegeProduction.js`, `screens/FranchiseOffice.jsx` `CollegeWatch` | 1,400 players, 4 cohorts, tiers, deterministic game stats, 2 story events per season (wk 12, wk 18) from a 12-way arc hash | Four fixed arc labels (`i % 4`); no schools, conferences, or standings; no awards, early declarations, transfers, or bowl games; stories are one line each; the UI is a paginated card grid showing stats as `KEY: v` strings; follows are disconnected from the draft watchlist |
| Scouting | store `scoutingPoints` / `scoutedProspects`, `Draft.jsx` `getOvrRange` | 10 points, reset at `startFreeAgency`; 1 point reveals exact OVR/POT/attributes | **Leaks truth**: `getOvrRange` seeds on `id.charCodeAt(0)+charCodeAt(2)`, which is the same for every `college-…` id, so every range sits at the same offset from true OVR. `grade` (visible unscouted, sortable) is `ovr*.45 + ceiling*.55`. Scouting is binary, available only in the offseason, and there are no scouts |
| Draft | `engine/draft.js`, `draftExperience.js`, store `startDraft`/`makePick`/`simOneCpuPick`, `Draft.jsx` (943 lines), `DraftTradeDesk.jsx` | 7 rounds, CPU style weights, 18% CPU trade-ups, user pick trades at 103% chart value, 90 s clock | Only current-year picks exist (`draftPickOwners` reset in `finalizeDraft`; `pickKey` has a `year` slot that is never set). Two different pick-value charts (`tradeLogic.getPickValue` vs `draftExperience.pickValue`). Timer auto-pick in the store takes the highest *true* OVR (the UI says "best fit"). CPU boards all share the true grade, so there are no real reaches or steals. No combine or pro day events, no interviews or medicals, no UDFA scramble, no rookie 5th-year option. `draftExperience.collegeProfile` is a leftover `Math.random` path |
| Trades | `screens/tradeLogic.js`, store `executeTrade`/`maybeGenerateCPUTradeOffer`/`acceptTradeOffer`, `engine/leagueTrades.js`, `TradeCenter.jsx` | Value = OVR curve × position × age × dev × contract; CPU accepts at ratio ≥ 0.9 after `0.88–1.06` random variance | **Re-roll exploit**: variance is redrawn on every Propose click. No cap check in `executeTrade`. No future picks, counter-offers, trade block, or "what would it take". Team mode is inferred from overall rating only. Incoming CPU offers pick a random team, target a random 78+ player, run at 18%/week, and allow one pending offer. League trades are 1:1 swaps, max one per week |
| Free agency | `engine/faMarket.js` (Claude, K6), `screens/freeAgencyLogic.js` (legacy), `FreeAgency.jsx` | 4-day market, suitors, floors, `faPreferences` personality weighting | Contracts are `{salary, years}` only: no guarantees, bonus, or dead money, so cutting is free. No franchise tag, RFA/ERFA, or compensatory picks. Re-signing is a separate screen flow with no deadline pressure. Legacy `freeAgencyLogic.evaluateOffer` still exists |
| Coaching trees | `engine/franchiseStaff.js`, store `hireStaff`/`fireStaff`/`upgradeStaff`, `CoachingStaff` UI | 4 roles × 32 teams + market; reputation, 3 skill branches (0–3), `mentorId`, history; yearly carousel | Coaches have no scheme, age, contract, or personality. Bonuses are flat. The tree exists only as `mentorId`: there is no visualization, no tree reputation, and no scheme inheritance. User coordinators are never poached for HC jobs, so there's no "my guy got promoted" moment. No scouting or position staff |

Other context that shapes the plan:
- The offseason runs `playoffs → startOffseason (progression, expiry, carousel) → freeAgency (4-day market) → draft → regular`.
- `character.js` (Claude) already provides derived personalities, `contractStance`, `tradeFallout`, `wantsOut`, `faPreferences`, and fog-aware `personalityView`. Reuse it; don't rebuild it.
- `owner.js` goals, `legacy.js` achievements, `rivalries.js`, `franchiseLore.js`, and `weeklyExperience.js` are hook points for callbacks.
- Save size was already 2.2 MB at week 4 of season 1 (Board FYI). Every new field must justify its bytes.

## 3. Shared foundations (build first; everything else depends on them)

### F1. Offseason calendar (`engine/offseasonCalendar.js`)
Replace the three-phase jump with an explicit, resumable stage machine. Each stage has
`enter(state)`, `autoResolve(state, delegation)`, `canAdvance(state)` and a UI panel.

```
SEASON END ─► Awards & Carousel ─► Re-sign / Tag window ─► Combine ─► Free Agency (4 days)
          ─► Pro Days & Visits ─► DRAFT (3 nights) ─► UDFA scramble ─► Camp cuts ─► Week 1
In season: weekly scouting assignments · college Saturdays · trade window (deadline wk 11)
```
- `phase` stays for compatibility. The new field is `offseason: { stage, stageData }`, and old saves map `offseason→resign`, `freeAgency→fa`, and `draft→draft`.
- The UI is one **Offseason Command Center** (§11). The top bar's `nextAction` from `navigation.js` points to the current stage.
- *Advance* on any stage runs `autoResolve` for everything left undone, using delegation settings and the Front Office Assistant.

### F2. One value model (`engine/assetValue.js`)
- **One pick chart**, used by the draft desk, trades, and CPU logic. Future picks are valued at the
  *projected* slot (from current team strength), discounted 15% per year out, with a
  variance premium for the next year's picks from bad teams.
- **Player surplus value** = on-field value over the contract years − cap cost. Cheap good players
  are the most valuable assets, and that is what makes rebuilds interesting.
- **Team mode** per club: `contend | retool | rebuild`. Derived from roster age curve, QB situation,
  cap, record, and owner archetype. Stored as one string per team, recomputed weekly.
- **Perceived value**: `value(asset, forTeam)` = base × need fit × scheme fit (F4) × mode weight
  (a rebuilder weights picks and youth ×1.3; a contender weights current OVR ×1.3).
- Replaces `getPlayerValue`/`getPickValue`/`pickValue`; keep thin re-exports for one release.

### F3. Contract model v2 (`engine/contracts.js`)
- `contract: { salary, years, yearsLeft, guaranteed, bonus, signedYear, type }` where `type` ∈
  `rookie | veteran | tag | minimum`. **Cap hit** = salary + prorated bonus. **Dead money** on a cut or trade =
  remaining prorated bonus + remaining guarantee. It goes on `deadCap[teamId][year]`.
- Rookie scale by slot (existing formula); 1st-rounders get a **5th-year option** decision.
- **Franchise tag** (1/team/year, price = average of the position's top 5) and **transition tag**.
- Defaults for old saves: `guaranteed = 0`, `bonus = 0`, `type = 'veteran'`. Cap math is unchanged until a
  player signs a new deal, so there's no economy shock.
- Codex owns the cap enforcement touchpoints (`cpuRosterManagement`, `leagueRules`).

### F4. Scheme identity (`engine/schemes.js`)
- 4 offensive schemes (Air Raid, West Coast, Power Run, Spread Option) and 4 defensive (4-3 Over,
  3-4 Two-Gap, Nickel Press, Cover-2 Zone), each with attribute weights per position.
- `schemeFit(player, scheme) → 0–100`. It drives the prospect "fit" column, trade perceived value,
  FA interest, and a small in-game efficiency modifier through `gamePlan.js` (already Claude's).
- A team's scheme comes from its **HC/OC/DC** (F5), so changing coordinators changes which players fit.
  That makes coaching hires roster decisions.

### F5. People registry (`engine/people.js`)
One lightweight shape for coaches, scouts, and GMs: `{ id, name, role, teamId, age, rep, traits[], scheme?, mentorId, history[] }`.
CPU GMs exist so rival front offices have names and tendencies (aggressive trader, draft-and-develop,
analytics, old-school). GM behavior parameterizes the CPU draft, trade, and FA AI.

### F6. Storyline engine (`engine/storyArcs.js`)
Generalizes `weeklyExperience.js` arcs. An **arc template** has `eligible(state) → subjects`,
`beats[]` (each beat: trigger condition, text builder, optional decision with costs), `adapt(event)`
for trade/injury/cut, and `resolve`. Stored per active arc: `{ templateId, subjects, beat, choices, openedWeek }`.
It powers college storylines (§4), draft-night drama, trade requests, holdouts, and coaching reunions.
Rules: at most 2 active user-facing arcs, at most 1 decision per stage, and each arc resolves exactly once across reloads.

## 4. College storylines — "Saturdays"

**Goal:** you *know* next year's draft class before it's a draft class, and following a kid feels like
fandom with stakes.

Mechanics
- **Schools & conferences**: ~96 fictional schools in 8 conferences, each with prestige, scheme,
  and a derived color and mascot (`franchiseLore` style, zero bytes). Prospects belong to real rosters, so
  teammates exist. This yields QB–WR connections, "two first-rounders from the same D-line," and later
  reunion stories in the pros.
- **College season sim (lightweight)**: team strength = sum of top prospects' readyOvr + school prestige.
  A weekly game results table (1 row per game, bytes: ~4 per game) → conference standings, a Top-25 poll,
  conference title games, a 12-team playoff, and a national champion. Prospect production is already
  deterministic per game; it now scales with opponent strength so **big-game performances** are real.
- **Awards**: Heisman watch (weekly top-5 ladder), position awards, All-American teams. Awards feed
  draft stock and prospect bios ("Heisman finalist").
- **Arc templates** (via F6, replacing the 4 fixed labels), ~20 at launch, for example: *Breakout sophomore*,
  *Injury comeback*, *Transfer portal*, *QB competition*, *Small-school dominator*, *Character concern*
  (off-field incident; interviews matter), *Position switch* (S→LB, changes projection), *Bloodlines*
  (father played for your franchise, from `franchiseLore` legends), *Senior Bowl riser*, *Workout warrior*
  (combine outlier, tape disagrees), *Declares early* (juniors), *Returns for senior year*. Each arc
  changes hidden truth (readyOvr/ceiling/character) *and* what scouts believe, and not always in the same direction.
- **Early declarations**: after the college season, juniors with high stock may declare (≈ 25–40 per
  year). The class size varies year to year. Weak and strong draft years become a strategic factor for tanking
  or trading into the next year.
- **Transfers**: 3–5% of underclassmen transfer each spring (role, school, and scheme change).
- Stats are kept per season, not per game. Old cohorts compact to career lines after the draft (the existing `packCollege`).

UI — **Saturdays** screen (replaces Campus Watch)
- *This week*: the top-25 scoreboard (one strip), a "Your prospects played" feed (followed or assigned players only,
  with one-line game lines), and the Heisman ladder.
- *Classes*: a virtualized table (not paginated cards) with columns `Name · Pos · School · Class · Tier · Stock ▲▼ ·
  Your grade · Confidence`. Saved filters. Following a player is the same action as adding him to the draft board.
- *Prospect page* (shared with Draft, §6): story timeline, season stat table with position-aware columns,
  scouting notes by author, and the school/teammates strip.
- Hub gets one card: "Saturday recap": 3 lines max, only about players you follow.

## 5. Scouting — "The Department"

**Goal:** turn the binary 10-point reveal into a year-round resource game with people, bias, and payoff.

Mechanics
- **Knowledge per prospect** `k ∈ 0–100` (stored only for prospects you've touched, as sparse `{id: k}`).
  The displayed rating is `truth + noise(id, teamId, scoutBias) × (1 − k/100)`. Noise is *derived* (hash-seeded),
  so it costs zero bytes and stays stable across reloads. It also differs per team, so CPU boards differ too.
- The **range** shown = ± (12 × (1 − k/100)), with a floor of ±2 until he's played a pro snap. This fixes the leak (no id-char seeding).
- **Grade becomes perceived**: `grade` is computed from the *perceived* ratings. The true grade never leaves the engine.
- **Scouts (people, F5)**: Director + 3 area scouts (regions map to conferences) + 1 national scout.
  Attributes: `eye` (noise reduction rate), `bias` (e.g. "loves speed", "position blind spot"), `region`,
  `rep`. Scouts gain rep when their top-graded players become starters and lose it on busts. A scout
  **hit-rate card** tracks this. Scouts can be hired, fired, and poached (hooks into §9 coaching market).
- **Weekly assignments (in season)**: each scout gets 1 assignment per week: *Watch player* (+k on one),
  *Cover conference* (+small k on many), or *Cross-check* (the Director re-grades, which removes bias). Default
  assignments auto-fill from your board. There's no weekly chore unless you want one.
- **Offseason events** (F1 stages) with a **visit budget**:
  - *Combine*: measured numbers (40, vert, bench, shuttle, **injury medicals**) are public for everyone.
    Athletic truth is revealed, but football truth isn't.
  - *Interviews* (15 slots): reveal personality (uses `character.js` fog → full view) and flag character arcs.
  - *Pro days / private workouts* (10 visits): large k gain on one player; other teams see that you visited,
    and CPU GMs react ("smokescreen" value).
- **Medicals**: hidden injury-proneness truth; the combine reveals a flag ("knee: minor/major"),
  and the fall-off risk is modeled in progression (Codex).
- **War-room disagreement**: for top prospects, show 2–3 scout opinions side by side ("Area scout: 1st
  round, Director: 3rd, 'hips are stiff'"). The disagreement *is* information.

UI — **Big Board**
- A drag-to-rank personal board (tiers: Blue / Red / Green / Undraftable). The default order is your
  staff's perceived grade, and you can override it.
- Columns: `Rank · Player · Pos · Perceived OVR (range bar) · Ceiling tier · Scheme fit · Need · k% · Flags`.
  The range bar visually tightens as k rises, so the core feedback loop is visible.
- A "Where do the scouts disagree?" filter surfaces the interesting players.
- The **Scouting Office** tab shows scouts, their assignments, hit rates, and a one-click "auto-assign from board".

## 6. The Draft — "Draft Weekend"

**Goal:** a tense, fast, three-night event where your preparation pays off, rivals behave like people,
and every pick has a story.

Mechanics
- **Three nights**: R1 / R2–3 / R4–7. Round 1 is played pick-by-pick with drama; Night 2 is fast;
  Night 3 is "sim to my pick" by default with a best-available auto-list.
- **CPU boards are real boards**: each CPU team drafts from its *own* perceived grades (F5 noise +
  its scouts + GM tendency + scheme fit + needs + mode). Reaches and steals now emerge; they aren't scripted.
- **Mock drafts**: a league consensus mock (average of all CPU boards) updates weekly in the offseason.
  "Projected range: picks 8–15" is shown for each prospect, and the gap between your grade and consensus *is* the opportunity.
- **Trades on the clock**:
  - Future picks (next 2 years) are tradeable everywhere (fixes `pickKey.year`; owners become
    `{year, round, originalTeamId}`; Codex migrates `draftPickOwners`).
  - *Trade up*: pick a target slot and the desk returns 1–3 real packages from the owner's perspective, with a
    "they want your 2027 2nd" style counter.
  - *Trade down*: when you're on the clock, 0–3 incoming calls appear ("Team X offers #19 + #52 for #11"),
    based on CPU teams whose target is on the board.
  - Draft trades use F2 perceived value, not the 103% flat rule.
- **Clock & auto-pick**: the timer runs only on your pick (keep it). Expiry takes *your board's* top player, not true OVR (fixes the store bug).
- **Moments** (F6 beats, max ~6 per draft): a run on a position ("4 corners in 6 picks"), a slider
  (a "green room" faller with a camera cut), a rival taking your guy one pick before you (with the GM's name),
  a trade-up bombshell, "Mr. Irrelevant", and a hometown pick from `franchiseLore`.
- **UDFA scramble** (stage after the draft): 90 seconds of bidding on the top 60 undrafted players with a
  small bonus pool ($ units) and "playing-time promise" chips. Uses `faMarket` resolution with 1 day.
- **Rookie contracts**: slotted and signed automatically. For 1st-rounders, the **5th-year option** decision appears 3 years later.
- **Draft grades, honest version**: the night-of grade is shown as "Media grade" (consensus-based),
  and **Re-grade after 3 seasons** is shown in the Draft History (real AV-style value), with scout rep updating
  from it. This long-tail payoff is the main hook for returning to the draft history screen.

UI — **Draft Room**
- Three zones: left, the *ticker* (last 5 picks with instant analyst one-liners and a "your board" delta: "took #22 on your board");
  center, *your board* with drafted players struck through live and "best available by need" pinned;
  right, *on-the-clock* card (team, GM, their top needs, rumor: "hearing they love OL").
- On your pick: the prospect card expands into a full-screen **Draft Card** ceremony (face, school colors,
  the scout quote you trusted, projected role). One click to confirm; it's skippable in settings.
- A "Trade" button is always visible and opens the desk as a sheet, not a new screen.
- Mobile: board and ticker become tabs; the on-the-clock card stays sticky.
- Existing 943-line `Draft.jsx` is split into `draft/DraftRoom.jsx`, `BigBoard.jsx`, `ProspectCard.jsx`,
  `DraftTicker.jsx`, `DraftTradeSheet.jsx`, and `DraftRecap.jsx`.

## 7. Trades — "The Phones"

**Goal:** trades that feel like negotiating with people who have goals, without the ability to
spam-click until the dice say yes.

Mechanics
- **Deterministic acceptance**: CPU willingness = F2 perceived value ratio vs a *hidden per-GM threshold
  seeded per (GM, week)*. Same offer, same week, same answer. No re-roll exploit.
- **Counter-offers**: a rejection returns the smallest adjustment that would work ("Add your 2027 3rd"
  or "Swap Smith for Jones"), found by a bounded search over your non-core assets. This replaces "Try offering more".
- **"What would it take?"**: select any player and get the partner's asking package in one click.
- **Trade block & shopping**: put players on your block; CPU teams respond over the week with offers in the
  inbox, not a single random pending offer. Up to 3 open offers, each with an expiry.
- **Team modes drive the market** (F2): contenders buy at the deadline and rebuilders sell vets for picks.
  The *Deadline Day* stage (week 11) is a special event: the phones ring, a league-wide trade ticker runs, and
  3–6 CPU↔CPU trades occur with real pick exchanges.
- **Cap & roster legality** in every trade (fixes the missing cap check in `executeTrade`): salary matching
  only when over the cap, dead money shown before you accept, and roster 46–53 enforced post-trade.
- **Player agency**: `character.js` `wantsOut` generates **trade requests** as F6 arcs (with a deadline, a
  public-vs-private choice, and a leverage decline in value if public). `tradeFallout` morale is already built.
- **GM relationships**: each CPU GM keeps a small `trust` score with you (lopsided trades lower it; fair
  ones raise it). Low trust raises their threshold. A former staffer now GM (F5) starts friendly.
- **League trades**: move from 1:1 swaps to mode-driven deals using the same engine, capped per week.
  They appear in a *Transactions* feed.

UI — **Trade Machine**
- Two columns with a live **value meter from the partner's perspective** ("They see: 82% of what they give").
  It shows a band, not a number: *Insulting / Needs work / Close / Accept*. You get feedback without precise
  oracle abuse.
- A partner header shows mode, top 3 needs, GM name/trait, and trust.
- An asset picker with filters (Your block · Surplus depth · Picks by year).
- Cap impact strip: your cap before/after, dead money, and roster count.
- One primary button, **Propose**. The response animates as a phone call with the counter inline, **Accept counter** in one click.
- *Offers* inbox tab: incoming offers, each with value, fit, and fallout preview.

## 8. Free agency & re-signing — "The Market"

**Goal:** keep K6's 4-day market (it works) but add the decisions that make the NFL offseason
tense: tags, guarantees, compensatory picks, and your own players testing the market.

Mechanics
- **Re-sign window** (F1 stage before FA): your expiring players are listed with their `contractStance`
  (already built), ask, market projection, and a recommendation (re-sign / tag / let walk / trade
  before the window closes). Unsigned players hit the market *and can be re-signed there against rivals*.
- **Contract offers v2** (F3): salary + years + guaranteed % + signing bonus. Players value guarantees
  per `faPreferences` (greed/security axes), so structure matters, not only AAV. The Cap tab shows
  future-year cap charts.
- **Tags**: franchise/transition tag in the re-sign window (a tagged player's mood from `moodFor`, and holdout
  arc risk via F6).
- **RFA/ERFA** for players with ≤3 accrued seasons: cheap tenders with pick compensation if another team signs them.
- **Compensatory picks**: net FA losses award extra R3–R7 picks next year. This gives letting players walk a real upside.
- **Visits & recruiting pitch**: on Day 1 you may host 3 visits. A visit reveals his priorities (money / winning / role /
  scheme fit / location) and gives a small preference bonus. Your coaching staff's scheme fit (F4) and team mode are
  visible selling points.
- **Market dynamics**: the first-day frenzy is modeled (top-10 players sign day 1–2 at a premium) and bargains appear on day 4.
  CPU clubs follow GM tendencies (the "big spender" archetype overpays) and must stay cap-legal with dead money included (Codex).
- **Retire `freeAgencyLogic.evaluateOffer`** (random), and route everything through `faMarket.assessOffer`.

UI
- *Re-sign window*: one table with per-row decision chips (Re-sign · Tag · Test market · Let go) and a
  running cap total at the top. **Apply recommendations** is one click.
- *Market*: keep the day stepper. Add a **Shortlist** (your targets across days), an offer builder with
  structure sliders plus a "likelihood" band (not a %), and the **Wire** (existing MarketWire) as a live ticker.
- The cap chart (5 years, stacked by player; dead money in its own color) is shared with Roster.

## 9. Coaching trees — "The Staff"

**Goal:** coaches become characters whose careers you shape, whose schemes shape your roster, and
whose tree becomes your legacy.

Mechanics
- **Richer coaches** (F5): age, scheme (F4), three ratings (Offense, Defense, Development) replacing flat skill
  points, and personality traits (Players' coach, Disciplinarian, Innovator, Recruiter, Loyal, Ambitious).
  Existing `skills` map onto the ratings for old saves.
- **Staff depth**: HC, OC, DC, ST coordinator, QB coach, and a Development coach (position-group bonuses to
  progression via Codex `progression.js` hook), plus the Scouting Director (§5).
- **Contracts & budget**: each staff member has years and salary against a *staff budget* (owner-set,
  separate from the cap, grows with owner trust). This creates a real tradeoff: an expensive OC or two more scouts.
- **Poaching both ways**: after the season, successful user coordinators get HC interviews. You may
  *block* (they get annoyed; an Ambitious coach becomes unhappy and his rating drops) or *let them go*
  (you gain **Tree prestige** and a friendly GM/HC relationship, and they take your scheme with them). You can also
  pursue other teams' coordinators (interview requests, with a denial chance).
- **The Tree**: `mentorId` becomes a full lineage. **Tree prestige** = the sum of your descendants' success.
  It adds hiring pull (better candidates accept), feeds `legacy.js` achievements ("Coaching tree: 5 head coaches"),
  and gives rivalry flavor when a protégé beats you.
- **Hiring as an event**: a vacancy opens a 2-round interview flow: a shortlist of 5 (scheme, ratings, asking
  salary, fit with your roster shown as "% of starters who fit"), then interviews that reveal hidden traits. CPU teams hire simultaneously, so
  a candidate can take another job while you deliberate.
- **Carousel as a show**: Black Monday (firings), a hiring ticker, and "Your former OC hired by X" news.
  Coaches age, retire (65–72), and become consultants or TV analysts (flavor quotes in news).
- **Scheme transition cost**: changing scheme gives 1 season of reduced fit, and players with low fit
  may request trades (F6). Ties the tree to trades and FA.

UI — **Staff** screen
- *Org chart* (top): your staff as cards with face, scheme, ratings, contract, and mood.
- *Coaching Tree* view: an interactive tree (SVG, collapsible) rooted at you, with branches colored by
  current role (HC / coordinator / out of football) and a "league trees" tab showing the 5 biggest trees.
- *Market / Interviews*: candidates in a table, then an interview modal with a 2-question reveal.
- *Carousel* timeline in the offseason command center.

## 10. Cross-system web (what makes it more than six features)

| Trigger | Consequence |
|---|---|
| You let your OC take a HC job | He takes your scheme. In FA he targets your ex-players who fit it. His draft board shares your scout's biases (he learned them). Rival flavor when you meet |
| A scout's favorite becomes a Pro Bowler | Scout rep ↑, better scouts want to join you, achievement |
| You draft a college teammate of your QB | Chemistry bonus for the pair (small), a storyline beat |
| A prospect's *Bloodlines* arc (father was a franchise legend) | Owner goal "draft him" appears; the crowd reaction in the Draft Card |
| You trade a fan favorite | `tradeFallout` morale + owner trust; he gets revenge-game flavor in `gameStory` |
| Heavy dead money | Owner goal "fix the cap"; limits FA day-1 bids |
| Rebuild mode + extra future picks | The weak/strong draft-class forecast (§4 early declarations) becomes an active tanking or trading decision |
| Protégé beats you in the playoffs | Rivalry level +1 (`rivalries.js`), tree-prestige line in the recap |

## 11. UI information architecture

- New nav section **Front Office** (replaces `office`): `Command Center · Big Board · Draft Room (seasonal) ·
  Trade Machine · Market · Staff · Saturdays`. `navigation.js` screen ids are preserved as aliases.
- **Command Center** = offseason timeline (stage stepper across the top), the current stage panel, and a
  "Needs your decision" queue (max 3). In season it becomes the weekly front office summary: scouting
  assignments, trade inbox, and college recap.
- **Shared components** (Claude): `ProspectCard`, `PlayerCard` (pro), `RangeBar`, `ValueMeter`,
  `CapChart`, `PersonChip` (coach/scout/GM with face), `Ticker`, `DecisionQueue`, `VirtualTable`.
  All use tokens and the `ui` barrel.
- **Delegation everywhere**: every stage panel header has `Delegate ▾` (Assistant does it), `Recommend`
  (it pre-fills, you confirm), or manual. Extends the existing Front Office Assistant settings.
- Performance: virtualized tables (1,400 college rows and 350 prospects), memoized selectors, and no full-class
  re-sorts on each tick of the draft.

## 12. Save & performance budget

| Data | Strategy | Target |
|---|---|---|
| Scouting knowledge | sparse `{id: k}` for touched prospects only; noise derived | ≤ 15 KB |
| College schools/teams | derived from seed; store only game results `[w,l,score]` for current season | ≤ 25 KB |
| College arcs | `{templateId, beat}` per prospect with an arc; text derived | ≤ 40 KB |
| CPU boards | never stored; recomputed from derived noise at draft time | 0 |
| People (coaches/scouts/GMs) | ~350 records, compact history (`[year, teamId, roleCode]`) | ≤ 80 KB |
| Future picks | `{y, r, o}` tuples | ≤ 10 KB |
| Contracts v2 | 3 extra numbers per player | ≤ 40 KB |
| **Total new** | | **≤ 250 KB**, plus a soak test at season 10 under the 5 MB quota |

## 13. Roadmap & ownership (per `AGENTS.md`)

Each milestone is independently shippable, keeps old saves loading, and ends green on `npm test`, `npm run lint`, and `npm run build`.

| # | Milestone | Codex (engine/store/tests) | Claude (new modules + UI) | Done when |
|---|---|---|---|---|
| **M0** | Quick fixes | Deterministic trade acceptance (seed per GM/week); cap + roster check in `executeTrade`/`acceptTradeOffer`; timer auto-pick uses board order; remove the `freeAgencyLogic` random path; unify the pick chart | Fix `getOvrRange` leak (derive from `hashSeed(id)`); hide true `grade` unscouted (show perceived grade) | Regression tests for each; no id-char seeding left |
| **M1** | Foundations | `contracts.js` (F3) + dead cap + migration; future picks (`draftPickOwners` with year) + migration; `assetValue.js` (F2) value math | `offseasonCalendar.js` (F1) + Command Center shell; `people.js` (F5); `schemes.js` (F4) data + `schemeFit` | Old save loads mid-season, in FA, and mid-draft; soak 5 seasons with no cap drift |
| **M2** | Scouting | Progression hooks for medicals (injury-proneness truth) | `scouting.js` (knowledge, derived noise, scouts, assignments, combine/interviews/visits); Big Board + Scouting Office UI; `RangeBar` | Perceived ≠ true at k=0 on every prospect; range shrinks monotonically; CPU boards differ (Kendall τ < 0.9 between teams) |
| **M3** | Draft Weekend | `cpuMakePick` on per-team boards; draft trade engine on F2; UDFA resolution; 5th-year option; comp picks | Draft Room split + ticker + moments + Draft Card + trade sheet; Draft History re-grade | Reaches/steals occur (≥ 5 picks per R1 more than 8 slots off consensus); a full draft is simmable in < 1 s |
| **M4** | Saturdays | College season sim (schools, conferences, results, poll, playoff), early declarations, transfers | `storyArcs.js` (F6) + 20 college arc templates, Heisman ladder, Saturdays UI, Hub card | Class size varies year to year; every arc resolves exactly once across reload; no contradictions with stats |
| **M5** | The Phones | Mode-driven CPU↔CPU trades; deadline-day event; GM trust storage | Counter-offer search, "what would it take", trade block + offers inbox, Trade Machine UI, trade-request arcs | Same offer twice gives the same answer; counter is always acceptable if proposed as-is |
| **M6** | The Market | CPU FA with dead money + GM spending tendencies; RFA tenders | Re-sign window, tags, contract structure in `faMarket`, visits, Cap chart | FA soak: no over-cap CPU teams; structure changes acceptance in the direction of `faPreferences` |
| **M7** | The Staff | Carousel v2 (ages, retire, poaching both ways), staff budget enforcement, development-coach progression hook | Coach ratings/traits/contracts, interview flow, Coaching Tree SVG, tree prestige + legacy achievements | 10-season sim yields realistic trees (some coaches with ≥ 3 HC descendants); user coordinator poached at least once in a strong run |
| **M8** | The web & polish | Balance soak (10 seasons × 5 seeds), save budget test | Cross-system triggers (§10), delegation for every stage, mobile pass, empty/error states | Save growth ≤ 250 KB; median offseason with full delegation ≤ 90 s of clicks |

Board protocol: each milestone starts with one `CLAIM` line per agent listing files; APIs between agents
are posted as function signatures before either side builds (as done for K3/C5).

## 14. Test plan (new files)

`tests/scouting.mjs` (noise determinism, no truth leakage through any exported UI helper, monotone range),
`tests/draftWeekend.mjs` (per-team boards, trade-up/down legality, UDFA, future-pick migration),
`tests/assetValue.mjs` (chart monotonicity, surplus value, mode weights),
`tests/contracts.mjs` (dead money on cut/trade, tags, options, old-save defaults),
`tests/tradeNegotiation.mjs` (determinism, counter acceptability, cap legality),
`tests/collegeSeason.mjs` (standings consistency, declarations, arc exactly-once),
`tests/coachingTree.mjs` (lineage, poaching, retirement, prestige),
`tests/offseasonCalendar.mjs` (stage resume after reload at every stage, delegation completes the offseason).
All are seeded through `tests/helpers/seededRandom.mjs`.

## 15. Open questions for the user

1. **Scope of the college sim**: do you want a lightweight results-and-poll model (planned), or watchable college games through `gameEngine`? The second is much bigger.
2. **Difficulty knob for fog**: should "Scouting difficulty" (how wide ranges start) be a setting?
3. **Staff budget**: is a second budget alongside the cap welcome, or should staff be free and limited only by count?
4. **Order of milestones**: the plan leads with scouting → draft (the most visible fun). If trades are the bigger pain point today, M5 can move ahead of M3; it only needs M0–M1.
