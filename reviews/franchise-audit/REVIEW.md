# Gridiron franchise product review

Reviewed September 19–20, 2026 against the working tree, including its existing uncommitted changes. This is an independent franchise-player assessment, not a claim of personal years spent playing Madden or a consumer research study. No production source was changed for this review.

**Version note — read first:** other work changed the game between browser sessions. The campaign tables and browser observations below describe the original tested snapshot. The current-version retest is summarized immediately below; it supersedes old findings where noted. Source line numbers in historical findings refer to the original snapshot and can shift.

## Current-version revalidation, September 20

| Finding | Current status |
|---|---|
| F01 save size/loss | **Substantially improved; old failure not reproduced in the new single-season model.** Compact box-score player references reduce the measured first-season state to 4,490,434 bytes, schedule 3,355,596 bytes. All 18 weekly writes succeeded in a controlled 5 MiB UTF-8 payload-limit test. New quota fallbacks exist. This is not a browser quota measurement or proof of three-slot/long-term durability; visible failure reporting still needs work. |
| F02 on-field crash | **Feature removed.** `PlayGame.jsx` and `playEngine.js` are absent and entry-point references were removed. Treat this as a historical failure and a product-scope decision, not a current crash. |
| F03 wrong starting QB | **Fixed in the targeted test.** The weak incumbent took zero attempts and the 99-OVR QB took 37. Editable depth-chart control remains a feature opportunity. |
| Draft talent inflation | **Rebalanced.** Ten new classes had 0–5 players at 80+, no players at 90+, and maximum OVR 78–83. The old 93-OVR late-first-round examples are historical. |
| F04 injuries | **Still reproduced:** QB took 26 attempts with seven injury weeks remaining; another current check recorded 44 attempts. |
| F05 minimum extensions | **Still reproduced:** $1M × six years accepted. |
| F07/F08 postseason | **Still reproduced:** missing division winner; 30–30 playoff tie awarded to away team. |
| F09 champion draft slot | **Still reproduced:** champion first overall in the synthetic ordering fixture. |
| F10 history | **Source mismatch remains:** display still reads `winner`/`playoffTeams`, recap still uses `champion`. Browser championship mismatch was observed in the earlier snapshot. |
| F11 story bonuses | **Still reproduced:** no boost, team boost, and win-probability boost produced identical 15–19 scores and stats. |
| F12 progression bounds | **Still reproduced:** synthetic accuracy progressed to 111. |
| F17 trade deadline | **Still reproduced:** screen/export says Week 11; exchange succeeds at Week 9, fails at Weeks 10–11. |
| Current repository tests | **Pass:** regression and newly added simulation/draft calibration suite via `npm test`. These do not cover all failures above. |

The current build also completed a fresh set of three five-season campaigns:

| Current campaign | Team ID | 2024 | 2025 | 2026 | 2027 | 2028 | User roster entering year five |
|---|---|---:|---:|---:|---:|---:|---:|
| Hands-off rebuild | bills | 3–14 | 6–11 | 7–10 | 7–10 | 8–9 | 28 |
| Active rebuild, Legend | cardinals | 5–12 | 7–10 | 8–9 | 7–10 | 8–9 | 41 |
| Win-now, Pro | patriots | 11–6 | 7–10 | 9–8 | 10–7 | 13–4 | 42 |

Every current season completed 272 regular-season games and 224 unique draft selections, with 17 games per team and no detected double bookings. Scoring averaged 20.2–22.4 points per team per game. The initial economy improved to 0–1 over-cap teams, but by year two **18–20 teams exceeded the cap**, with a later peak of **28 of 32**. Year-five league roster ranges were 28–69, 41–64, and 42–65. F06 therefore remains a current, multi-season failure, not just historical evidence.

Current post-draft saves grew from approximately 2.15 MB after year one to 4.87 MB after year five. Those figures come from unconstrained in-memory storage and exclude the next full season's schedule; they do not establish long-term browser durability. Different generated teams and changed calibration mean these cohorts are not controlled before/after win-rate comparisons.

Current evidence is in `results-latest.json`, `run-latest.log`, `current-check.json`, and `probes-latest.json`; historical evidence remains in `results.json` and `probes.json`. The full browser journey was not repeated against the final source changes.

**Verdict: a promising franchise prototype, but not ready to sell as a dependable long-term franchise game.** The hub, roster presentation, quick simulation, fictional team identities, and draft presentation give it a credible foundation. The current save-size, starter-selection, and calibration improvements are substantial. Still-active injury, contract, postseason, and history defects undermine the meaning of roster building and winning. The highest-value next work is making decisions and history trustworthy.

## What was actually tested

| Coverage | Method and limits |
|---|---|
| Six five-season campaigns across two source snapshots, 2024–2028 | Actual Zustand store actions, seeded randomness, isolated in-memory saves. **30 complete regular seasons, postseasons, offseasons, and seven-round drafts:** three campaigns on the initial build, then three on the updated build. These were automated simulation playthroughs, not 30 manually played browser seasons or one continuous 30-year franchise. |
| Hands-off rebuild | Weakest generated team, Pro, no user free-agent signings or extensions; best-player-available draft heuristic. This intentionally tests the consequences of neglect; it is not evidence that an automation assistant exists. |
| Active rebuild | Weakest generated team, Legend, conservative strategy, weekly youth training, affordable retention, needs-based free agency/draft. |
| Win-now | Strongest generated team, Pro, aggressive strategy, retention, training, needs-based free agency, best-player-available draft. |
| Browser campaign A | New Jersey, Defensive Genius, Legend: onboarding, roster/contracts, minimum extension exploit, attempted on-field game, crash and reload. |
| Browser campaign B | Baltimore, Offensive Mastermind, Rookie: new origin with empty slots, week simulation while over cap, full regular season, postseason, free agency, draft/scouting. First run went 14–3; after reopening, it had rolled back to Week 2. Replay went 12–5, won the championship, completed all seven rounds through the UI, and reached Season 2, Week 1. Trade asset selection was inspected there; no UI trade was submitted. |
| Targeted engine probes | Injury availability, QB selection, temporary bonuses, tied playoff, division seeding, champion draft placement, progression bounds, save size, two complete on-field engine stress games, ten generated draft classes. Synthetic setups are explicitly identified below. |
| Existing checks | `node tests/regression.mjs` passed; production build passed. Vite's test-side websocket listener emitted sandbox permission warnings, but the scripts completed. Build warned about a large bundle. |

The active automated campaigns call the signing action directly, so they bypass the UI's random offer rejection. They also invoke the existing offseason unit-training action, for which no current UI entry point was found. Their win totals are diagnostic examples, not fair difficulty comparisons or proof of an optimal consumer strategy. Seeds control random choices; timestamp-generated player IDs and environment differences can prevent byte-for-byte reproduction.

The original browser's on-field mode could not be evaluated for real input feel because entering it crashed; the current build removes that mode. Engine-only stress games do not replace a human-controller playtest. CSV import, controller support, cross-browser compatibility, multiplayer, and 30-year longevity were not validated.

## Original-snapshot campaign results

| Campaign | Team ID | 2024 | 2025 | 2026 | 2027 | 2028 | User roster at start of year five |
|---|---|---:|---:|---:|---:|---:|---:|
| Hands-off rebuild | bills | 8–9 | 5–12 | 7–9–1 | 9–8 | 9–8 | 28 |
| Active rebuild, Legend | ravens | 8–9 | 8–9 | 11–6 | 5–12 | 7–10 | 45 |
| Win-now, Pro | dolphins | 9–8 | 10–7 | 3–14 | 7–10 | 10–7 | 42 |

All 15 seasons completed **272 regular-season games and 224 unique draft selections**, with 17 scheduled games per team and no detected same-week double bookings. That is a useful foundation. Team scoring averaged approximately 20.0–24.1 points per game across these seasons; this does not establish position-stat or matchup calibration.

The league economy is less stable: 8 of 32 teams began each campaign over the $200M cap. In the second season, 22–25 teams were over; one later season reached 27. Rosters ranged from 34 to 67 in one active-rebuild season. No minimum squad or maximum roster gate stopped advancement. Even the neglected 28-player user team went 9–8. Missing-player rating behavior makes that especially concerning.

## Prioritized defects

P0 means the feature or player's save cannot be trusted. P1 means core franchise outcomes or meaningful management are wrong. P2 means a material quality, balance, or usability issue.

### F01 — Historical P0, now improved: saving failed silently and reload discarded progress

**Browser-confirmed twice, with a clean-origin reproduction.** On `127.0.0.1:5173`, saving a new franchise logged `QuotaExceededError` and reload returned to coach creation. That origin had pre-existing storage, so it was not used as the sole reproduction. On a fresh `127.0.0.1:5189` origin, all three slots were initially empty. After taking Baltimore through the season, postseason, and into the draft, reopening restored Week 2, 1–0. The replay again logged quota failure for slot 0. No visible save-failure warning appeared.

The size probe measured **43,559,284 UTF-8 bytes** for one completed first-season state; the schedule alone was **41,598,782 bytes**. Post-draft snapshots shrink because the schedule resets, but grew from roughly 2.57 MB after year one to 4.98–5.01 MB after year five. These are serialization measurements, not a claimed universal browser quota threshold.

`gameStore.js:65–79` serializes the entire state into localStorage and only logs failures. Game box scores embed full player objects, making the schedule very large. Three save slots share the origin's storage budget.

**Fix:** use an appropriate durable store such as IndexedDB; normalize player references and box scores; separate immutable history from active state; version saves; keep a last-known-good recovery checkpoint. Surface saving/saved/failed status and offer export/import. Never tell a player a save succeeded before durable completion.

**Acceptance:** play, close, and reopen at Week 18, during draft, and after ten seasons in each of three slots. Verify exact state restoration. Inject storage failure and confirm a visible error plus a recoverable prior checkpoint.

### F02 — Historical P0, feature now removed: “Play it yourself” crashed immediately

**Browser-confirmed.** Hub → Play game → Play it yourself produces `ReferenceError: Cannot access 'canvasPos' before initialization`. `PlayGame.jsx:652` evaluates a hook dependency array referring to callbacks declared later (`canvasPos` at line 702). `handleContinue` in that same array also needs ordering review.

**Fix:** order callbacks before use and audit effect dependencies. Add a component-entry smoke check and complete one actual game through the UI. Build success alone does not catch this.

### F03 — Historical P1, targeted retest now passes: displayed depth chart and simulated starting QB disagreed

**Controlled engine reproduction plus source confirmation.** A 50-OVR QB first in the roster took 35 attempts; a 99-OVR QB appended later took zero. `simulation.js:144` selects the first QB with `.find()`, while the visible depth chart sorts by OVR (`Roster.jsx:273`). Free agents and rookies are appended to rosters. A newly acquired franchise QB can therefore look like the starter and never play.

**Fix:** one explicit depth-chart/availability resolver shared by simulation, on-field play, ratings, and UI. Let the user assign starters, backup roles, and formation substitutions. Do not infer the depth chart from array order.

### F04 — P1: injured players continue playing

**Store-action reproduction.** Put the starting QB in the actual `injuries` collection with eight weeks remaining, then simulate: 37 pass attempts, with seven injury weeks still remaining. The simulation receives the full roster without excluding injured players. Injury UI therefore creates an apparent roster-management problem without corresponding availability consequences.

**Fix:** derive eligible players before every game; enforce IR/inactive rules and replacement decisions; use the same eligibility in both game modes. Injury duration labels should match the intended realism level; the current injury table gives an ACL tear four weeks.

### F05 — P1: all contract extensions accept minimum offers

**Browser-confirmed.** Roster → Contracts → Anthony Bryant, 77 OVR, approximately $7M displayed market value → $1M annual salary, six years → accepted immediately. Current cap usage fell from $103M to $98M. A separate action probe retained a 99-OVR player for $1M × six years. The screen says a low offer risks the player walking, but `Roster.jsx:487` calls an unconditional `resignPlayer` action (`gameStore.js:1557`). There is no rejection or cap check in that path.

**Fix:** real acceptance rules with player priorities, offer limits, current versus future cap accounting, and shared validation. An extension should not silently replace the economics of the existing season unless it is explicitly a renegotiation.

### F06 — P1: salary cap and roster legality are not enforced consistently

**Browser and multi-season confirmed.** Baltimore began $24M over the cap, then simulated a full season and postseason without resolving it. CPU free agency signs 1–3 players without checking cap or positional needs (`gameStore.js:1779`). Rookie additions, extensions, and roster movement need the same rules. Active-campaign rosters could exceed 53; depleted rosters could continue playing.

**Fix:** central transaction validation; projected cap and rookie reserve; legal roster deadlines; position minima; CPU cuts, replacement signings, and cap repair. If relaxed rules are desired, expose them as explicit league settings and apply them equally to the user and CPU.

### F07 — P1: playoff seeding ignores division winners and ties

**Source, synthetic fixture, and browser bracket evidence.** `gameStore.js:1048` selects the seven highest-win teams in each conference, sorting tied wins by point differential. It does not reserve seeds 1–4 for division winners or incorporate ties into win percentage. The fixture produced four AFC North teams in seeds 1–4 and no AFC South representative. The browser also showed two NFC East teams among seeds 1–4.

An existing division-aware helper in `engine/playoffs.js` is not the store's implementation. Duplicated rules have diverged.

**Fix:** one playoff eligibility/seeding implementation, explicit tie-break explanation, and tests where a weak division winner qualifies ahead of stronger wild-card candidates. Document intentional deviations from the chosen league rules.

### F08 — P1: tied playoff games automatically award the away team

**Seeded reproduction.** Chargers–Titans ended 24–24; the bracket marked Titans the winner. `simulateGame` allows a tied OT result, while both playoff actions use `homeScore > awayScore ? home : away`.

**Fix:** postseason overtime must produce a winner through a valid scoring outcome. Never resolve a tie with a comparison fallback. Test tied regulation and repeated tied overtime.

### F09 — P1: postseason finish is ignored in draft order

**Browser and synthetic fixture confirmed.** The browser's first champion, the New York Rockets, appeared at draft position 14. On the replay, champion Baltimore held pick 31 and runner-up Tampa Bay pick 32. The synthetic fixture put the champion first overall.

`draftExperience.js:5` reads `wildCard`, `divisional`, `championship`, and `superBowl`; the store produces `wc`, `div`, `conf`, and `sb`. No playoff stage is recognized. The existing regression only checks order length, so it passes despite this.

**Fix:** one bracket schema and postseason-aware draft ordering. Verify champion last, runner-up next, playoff elimination groups, ties, and traded original-team ownership.

### F10 — P1: franchise history says a champion missed the playoffs

**Browser-confirmed.** Baltimore won the championship; Hub → Season history displayed “2024 — Missed the playoffs.” `SeasonHistoryCard` in `screens/hub/widgets.jsx:355` expects `seasonRecap.winner` and `playoffTeams`. `concludeSeason` stores `champion` and awards, without those fields.

**Fix:** archive team record, seed, postseason result, champion, awards, and draft/transaction links in a documented season-summary model. A title should remain visible forever.

### F11 — P1: several story choices have no gameplay effect

**Controlled identical-seed reproduction.** No bonus, a +50 team bonus, and a very large win-probability bonus each produced the same 42–17 result and identical player-stat objects. These large synthetic values isolate wiring, not realistic balance. `resolveStoryEvent` stores temporary effects, but weekly simulation only decays `activeBoosts`; it never applies them. The `rest_player` choice is not handled by the resolver at all.

**Fix:** support every advertised effect or remove the promise. Record the affected player/unit, remaining duration, actual applied change, and outcome. Test each event type independently.

### F12 — P2: progression can create attributes above the rating scale

**Synthetic reproduction:** a young 70-OVR prospect with a 99 accuracy attribute progressed to **113 accuracy**. The five-season output also contained ordinary evolved players with attributes over 99. `applyOvrChange` in `progression.js` bounds OVR but scales attributes without an upper cap.

**Fix:** a consistent attribute domain and progression model, enforced after development, edits, imports, and offseason changes. Validate every player after a 30-year soak.

### F13 — P2: depleted position groups can receive full-strength ratings

**Engine reproduction:** one 99-OVR offensive lineman yields the same 99 line rating as five 99-OVR linemen. The weighted average ignores missing slots. Combined with absent roster gates, this rewards shedding necessary depth and understates the cost of roster neglect.

**Fix:** rate the actual required lineup, include replacement-level players or invalid-lineup status for missing slots, and distinguish starter quality from depth resilience.

### F14 — P2: offseason roster ratings become stale

**Multi-season confirmed.** After progression/expiration, 16–26 teams per measured offseason had stored overall ratings differing from a fresh calculation. `startOffseason` updates rosters but not teamRatings. Later signing/draft actions repair some or all ratings, so the issue is timing-dependent.

**Fix:** derive ratings or recalculate atomically with every roster/attribute change. Avoid showing old ratings beside new rosters.

### F15 — P2: draft prospect list disappears in a narrower window

**Browser-confirmed at the default approximately 884-pixel window; usable at 1440 × 1000.** The draft displayed the empty detail pane and team needs, while the prospect list was absent visually. Accessibility/DOM still contained prospects, leading to clicks that appeared ineffective or timed out. At desktop width, scouting immediately revealed 93 OVR and spent one point correctly.

The app does warn that a larger screen is preferred and permits “Continue anyway.” That escape path should still preserve core operations. Main navigation buttons also lacked accessible names when their text was hidden at small widths (`AppNav.jsx:65`).

**Fix:** list/detail tabs or a drawer at narrow widths; a visible minimum-width requirement if unsupported; accessible labels independent of visible text. Test laptop split-screen and browser zoom, not just phones.

### F16 — P2: weekly flow interrupts the player repeatedly

**Browser-observed.** One week produced a scoreboard/loading result, a separate detailed game-result dialog, and then a milestone dialog. Advancing required multiple dismissals. Postseason loading also said “Regular Season / Week 1.” The primary navigation's “Play Week” action is wired to a simulation intent, which needs clearer labeling.

**Fix:** one postgame report with optional expansion; milestones as nonblocking items; a fast-sim preference; interrupt only for consequential choices; label “Play,” “Coach,” and “Sim” distinctly.

### F17 — P1: trade deadline display and transaction rules disagree

**Browser text, source, and action fixture.** The trade screen says “Deadline after week 11.” Its exported deadline is 11, but `executeTrade` rejects regular-season trades after Week 9. A valid pick exchange succeeds at Week 9 and is rejected at Weeks 10 and 11. A user following the on-screen deadline can miss their actual opportunity to trade.

**Fix:** one league-calendar source of truth, shared by trade evaluation, execution, CPU activity, navigation, and displayed countdown. Validate transactions immediately before committing them.

## Balance and depth observations

These are design judgments or limited-sample risks, not all confirmed defects.

- **Draft classes are extremely rich.** Ten sampled classes had 42–52 players at 80+ OVR and 1–8 at 90+. In the browser, a scouted 93-OVR QB remained at pick 31; another similarly graded QB remained at pick 63. This may fit an arcade league, but it reduces the scarcity that makes a franchise QB special. Calibrate to an explicit talent distribution and track replacement rates over decades.
- **Scouting reveals too much certainty too quickly.** A point reveals exact OVR and potentially exact potential; development traits are visible before scouting. College production and scouting prose should contain evidence with uncertainty. One prospect's report said multiple years as a starter and also “only one year of starting experience.” Generate reports from coherent underlying player history, not independent random snippets.
- **Position demand needs calibration.** The completed browser class included a 93-OVR QB at #31 and an 83-OVR RB at #223, while the best available WR selected at #127 was 55 OVR. One class is not enough to establish the distribution, but this is a strong reason to audit CPU position weights and scarcity. The trade screen also listed DE and LT as rival needs while generated rosters use grouped DL and OL positions; normalize those taxonomies before assigning need bonuses.
- **Development favors repetitive clicking.** A weekly action adds OVR directly, including for older players, with limited opportunity cost. Make development depend on snaps, coaching, age, workload, scheme learning, and uncertainty. Automation should be available for routine training.
- **Free agency is a user-controlled market.** The user can shop before pressing “Sim rival signings.” Rival interest and contract duration have little mechanical negotiation depth; the offer evaluator takes only salary. Rejection copy can say a player signed elsewhere while they remain available. Use actual timed bidding/rounds and consistent transaction history.
- **Playbook and difficulty incentives are inconsistent across modes.** Regular simulation applies coach, playbook, strategy, and difficulty bonuses, but playoff actions call simulation without those bonuses. Streak morale also overwrites other moraleBoost contributions. A coach's identity should not silently disappear in January.
- **The on-field engine needs separate tuning after the crash is fixed.** Two automated full-game stress policies completed: never throwing from Hitch lost 0–75; HB Dive every snap won 56–46 with 451 rushing yards and eight rushing TDs. A synthetic tied fourth-quarter ending went directly to GAME_OVER. These are smoke/stress results, not a verdict on normal interactive play quality.
- **Long-term memory is shallow.** Current and career player totals exist, but season-by-season player history, enduring retired-player records, historical standings/box scores, and a useful dynasty timeline are not fully represented. Retired players are returned by progression but discarded by the store. A five-year franchise needs ways to remember why it mattered.
- **Phase labels promise content that is not there.** The browser's “Head to Training Camp” button led directly to Season 2, regular-season Week 1. Rename it until camp exists, then make camp about lineup battles and limited development choices.

## What already works as a product

The team identity, compact hub, roster filters, contract overview, player comparisons, quick season simulation, full seven-round draft, scouting reveal, draft ticker, CPU draft trades, and news feed make this more than a bare simulator. The best moment was identifying a prospect, seeing his college history, scouting him, and making a pick with an immediate reveal. Preserve that short, satisfying decision loop.

The current strengths point toward a **fast, legible general-manager game with optional playable games**. Trying to match Madden's animation, broadcast production, or complete on-field mechanics first would consume effort while the franchise foundation remains fragile.

## Missing features worth building, in order

1. **A real lineup system:** editable depth chart, starter/backup designation, snap-share targets, injury replacement, position changes, and formation roles. Football results must reflect these settings.
2. **A coherent league calendar:** explicit retention window before expiration, free-agency rounds, scouting during the season, draft, camp/preseason, roster cuts, and regular-season deadlines. Include a safe “advance until a decision needs me” mode.
3. **A functioning contract economy:** guarantees/dead money, multi-year cap outlook, rookie reserve, player motivations, counteroffers, franchise options/tags appropriate to the chosen rules, and equal CPU enforcement. Keep an approachable simplified setting.
4. **CPU general managers with plans:** rebuild/contend timelines, positional need, replacement cost, cap forecasts, draft scarcity, trade deadline behavior, and understandable reasons for rejecting trades.
5. **A league memory:** season-by-season player cards, past rosters, champions, awards, retired-player archive, record book, and trade/draft retrospective. Link every outcome back to the decision that produced it.
6. **Persistent staff and relationships:** coordinators, schemes, staff hiring, player roles/promises, morale sources, and owner expectations with consequences. Connect them to actual simulation inputs.
7. **Trust and control tools:** exportable saves, automatic recovery, custom league settings, seeded leagues, clear automation permissions, scouting/draft-class customization, and accessible UI. These increase replay value without needing more animations.

## A credible way to be better than Madden

Do not market generic coaching trees, weekly strategy, holdouts, or contract conversations as unique. EA's official Madden 26 material already describes coaching archetypes and weekly strategy. Its Madden 27 Franchise Deep Dive advertises player personas, holdouts/trade demands, interactive negotiations, expanded contract structures, and coach mode. Those are publisher feature claims, not an independent assessment of their execution. Sources: [Madden 26 franchise overview](https://www.ea.com/games/madden-nfl/madden-nfl-26/features/m26-franchise-mode), [Madden 27 Franchise Deep Dive](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-franchise-mode).

The opportunities below are specific execution targets absent from this build. They are not unverified claims that no Madden version has any related feature.

| Opportunity | Concrete player experience | Why a player would return |
|---|---|---|
| Explainable football outcomes | After a loss, show that the backup tackle allowed pressure, the opponent attacked the weak nickel defender, and fatigue reduced late-game performance. Link to the responsible snaps/inputs. | Losses teach the player what to change; wins feel earned. |
| A ten-year franchise memory | “The fourth-round corner you developed became captain; the receiver you traded beat you in the championship.” Real linked records, not generic headlines. | Players become attached to their own league. |
| Trade and draft decision retrospectives | Revisit the actual players, cap savings, and picks produced by a trade after one, three, and five years. Track the alternatives the user shortlisted without revealing hidden future outcomes in advance. | Each offseason builds a history of meaningful judgment. |
| Meaningful scouting uncertainty | Scouts have track records and biases; workouts, film, production, and scheme fit refine ranges. A miss has an understandable cause. | Discovery and debate replace sorting by visible potential. |
| GM rivals who pursue understandable plans | A rebuilding rival values cheap years and future picks; a contender will rent a veteran. Offer feedback exposes priorities without revealing an exact exploit score. | The league feels active and negotiation becomes a strategy game. |
| Fast, controllable delegation | “Keep $15M for extensions, never trade my QB, stop for an injury to a starter.” Preview the assistant's plan and advance until those boundaries require input. | Players can finish a season in a short session without surrendering important choices. |
| Reproducible shared challenges | A common seed, ruleset, and starting crisis; export the decision log and compare results across rebuild attempts. | Strong replayability without requiring real-time multiplayer infrastructure. |

Choose two differentiators first: **explainable decisions** and **persistent franchise memory**. Together they create a focused promise: every decision matters, and the game remembers it.

## Delivery roadmap and release gates

| Order | Work | Exit condition |
|---|---|---|
| 1 — Protect the player | Durable saves, recovery/export, normalized history storage; explicit decision on removed on-field mode | No silent rollback; three concurrent ten-year saves survive reloads. If on-field mode returns, one actual UI game completes. |
| 2 — Make football outcomes credible | Shared lineup/injury resolver, seeding/ties, postseason draft order, history schema, bonus wiring | Golden fixtures cover every rule; displayed starters actually play; injured/rested players do not; champions and draft positions agree. |
| 3 — Make rebuilding a game | Cap/roster legality, CPU retention/signings/cuts, contract acceptance, sane progression and draft talent | 30-year multi-seed soak with valid rosters/caps/attributes; no routine minimum-contract or empty-lineup exploit. |
| 4 — Improve the weekly rhythm | Single postgame report, functional narrow-window draft, clear play/sim labels, meaningful offseason calendar | New players can finish a season without assistance or mandatory redundant dialogs. |
| 5 — Earn differentiation | Decision explanations, franchise timeline, draft/trade retrospectives, bounded automation | Players can explain why a decision helped and voluntarily start a second season. |

Avoid adding more decorative events before the existing event effects work. Avoid expanding contract UI before cap accounting is unified. Avoid hiding economics defects behind higher difficulty bonuses.

## Would consumers like it?

**My judgment:** casual sim fans may enjoy the accessible hub and rapid progression immediately. Dedicated franchise players will notice the missing control and inconsistent rules; competitive optimizers will trivialize extensions; players attached to their dynasty will be especially upset by save loss and false history. I would position this as an early prototype for feedback today, not as a finished Madden-franchise alternative.

This is a testable product hypothesis, not evidence of market demand. After the first three roadmap stages, recruit 8–12 franchise players across rebuild, roster-management, and play-every-game styles. Observe onboarding without help, have each finish one season, and invite an optional second season. Measure time to first meaningful decision, abandonment point, assistance needed, save confidence, and whether they can name players they care about. Ask what they would change before asking what they would pay. Track defects separately from feature requests and avoid treating a small qualitative sample as a retention forecast.

## Evidence and rerunning

- `playthroughs.mjs`: three five-season store-action campaigns.
- `results.json`: original campaign records, roster/cap measurements, save sizes, schedule/draft checks, and initial probes.
- `results-latest.json` / `run-latest.log`: completed current-build 15-season retest, bringing total automated coverage to 30 seasons.
- `probes.mjs` / `probes.json`: targeted deterministic fixtures and full-season serialization measurement.
- `probes-latest.json`, `current-check.mjs`, `current-check.json`: current-version checks; the quota model is explicitly simulated.
- `run.log`, `probes-latest.log`, `current-tests.log`: execution output. Some scripts emit a nonfatal sandbox websocket warning. `probes.log` preserves an interrupted revalidation that failed when the on-field engine had been removed; the harness was then adapted and rerun successfully.
- `UI-NOTES.md`: browser observations and explicit coverage limits.

Run from the repository root with `node reviews/franchise-audit/playthroughs.mjs` and `node reviews/franchise-audit/probes.mjs`. New runs write `results-latest.json` and `probes-latest.json`, preserving the historical files. Both use in-memory saves and do not overwrite consumer browser franchises. The review harnesses are diagnostic scripts, not a new passing regression suite; convert the confirmed failures into assertions when fixing the product.
