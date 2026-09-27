# K12 — Sim & broadcast fun overhaul (plan)

User request (2026-09-27): make broadcast games more fun to watch, show the players
making big plays, add more archetypes, make it more intuitive, and have sims reflect
witching hours, divisional upsets and "way more".

Builds on K11 (gameEngine.js / gameStory.js / gamePlan.js / GameBroadcast.jsx, all
Claude-owned). **No existing store action is edited**: `gamePlans(state, home, away)`
already receives full state at both sim call sites, so game context rides along with
the coaching plans. League calibration (tests/calibration.mjs) must stay green.

## 1. Game context — new `src/engine/gameContext.js`
Pure `gameContext(state, homeId, awayId)` → what makes this game *this* game:
- **Stage**: regular / Wild Card / Divisional / Conference / Championship.
- **Division game / rivalry level** (via Codex's `rivalryFor`).
- **Prime-time slot**: Thursday, Sunday and Monday night, picked deterministically per week
  (TNF by hash, SNF/MNF go to the best records). `weekSlots(state, week)` for the UI.
- **Point spread** from team ratings + home field → favorite / underdog.
- **Stakes** late in the season: playoff bubble, eliminated, clinched and resting.
- **Trap game**: a big favorite facing a losing team with a big game next week.
- Storyline tags for the UI ("Division clash", "Upset watch", "Sunday Night", ...).

Engine effects (all neutral when no context, so calibration is untouched):
- **Any given Sunday**: familiarity in division, rivalry and playoff games gives the
  underdog a form bump proportional to the spread, so division upsets happen more.
- **Big-stage variance**: prime time, rivalry and playoff games widen game-day form.
- **Short week (TNF)**: sloppier football, with more turnovers and fewer points.
- **Loud building**: rivalry, prime-time and playoff crowds add home edge.
- **Stakes**: eliminated teams fade on D; clinched teams rest starters in Week 18;
  trap-game favorites come out flat.

## 2. The Witching Hour and in-game drama (`gameEngine.js`)
- **Witching Hour**: the final 5:00 of a one-score game, plus all of OT. Every snap is flagged.
  Composure decides who delivers. Clutch players get more completions, fewer picks, better FG%
  and fewer fumbles, and volatile ones wilt. Chaos also rises (bigger plays, more bounces).
  Clutch players making a big play get a CLUTCH flag.
- **Momentum**: turnovers, 4th-down stops, TDs and big plays give a short-lived,
  decaying edge (amplified at home). Swings make runs, and runs make comebacks.
- **Hot hand / rattled**: a receiver who is cooking gets fed. A volatile QB with 2 picks presses.
- **Trick plays & special teams**: flea-flickers, fake punts and fake FGs (aggressive staffs
  call more), blocked punts and FGs, including returns for TDs.

## 3. More archetypes — "play styles", new `src/engine/playStyles.js`
~40 signature play styles derived from each player's archetype and attributes. Nothing is stored,
so old saves get them immediately. Examples: QB Field General / Gunslinger / Dual Threat /
Improviser / Cannon / Surgeon / Game Manager; RB Bell Cow / Home-Run Hitter / Goal-Line
Hammer / Scatback / Third-Down Back; WR Burner / Contested-Catch / YAC Monster / Route
Technician / Possession / Slot Weapon; TE Seam Stretcher / Red-Zone Mismatch / Y Blocker;
DL Edge Bender / Bull Rusher / Nose Anchor / Interior Wrecker; LB Thumper / Sideline
Hunter / Blitz Specialist / Coverage Backer; CB Shutdown / Ballhawk / Press Bully / Zone
Robber; S Centerfielder / Box Enforcer / Ballhawk; K Big Leg / Ice Veins; P Boomer / Coffin Corner.
Each one changes how the player plays in the engine, for example Burners catch bombs,
Edge Benders get strip-sacks, Ballhawks jump routes and Hammers finish at the goal line.
Each also gets its own broadcast call lines.

## 4. Story layer (`gameStory.js`)
- **Win probability** per snap. Play of the game = biggest swing.
- **Two-voice booth**: play-by-play plus an analyst colour line on big plays. The lines are
  context-aware ("his 3rd sack today", "crosses 100 yards", "hat trick", "the Burner",
  "Witching Hour", "upset alert", "fake punt!"). Wording varies and is seeded, so replays are stable.
- **Three stars** of the game.
- `classifyGame` learns: Upset, Division upset, Witching Hour thriller, Trap game, Playoff classic.

## 5. Broadcast UI (`GameBroadcast.jsx`)
- **Pre-game "tale of the tape"**: storyline chips (division, rivalry, prime time, stakes,
  spread and upset watch) and players to watch, with faces and play-style badges.
- **Player spotlight**: every big play slides in a card with the player's face, number, name,
  play style and running line. Defensive plays show the defender.
- **Situation banners**: RED ZONE, TWO-MINUTE DRILL, WITCHING HOUR (the field goes to
  night), UPSET ALERT, and 4TH & GOAL.
- **Win-probability chart** in place of the plain margin strip.
- **Controls**: pause/play, 1×/2×/4× speed, "next big play", skip, plus keyboard shortcuts
  (space, → and S).
- **Final card**: three stars with faces, play of the game, and story tags.

## 6. Around the league
- WeekLoadingScreen: UPSET, DIV UPSET and WITCHING HOUR chips on league scores.
- GameSummaryModal: context tags + play of the game.
- MatchupPreview: storylines, spread and prime-time slot before kickoff.
- PlayerModal: play-style badge + what it does.

## Touch points outside Claude files
- `simulation.js` (K11 ownership exception, re-announced): forward `options.context` to
  `playGame` and return the resolved `context` on the result (2 lines).
- `gamePlan.js#gamePlans` also returns `context`; `gameDetailFields` stores a compact
  `ctx` (~30 bytes) on every game row so upsets can be labelled league-wide.

## Tests
New `tests/gameContext.mjs` covers context derivation, the division-upset lift, Witching Hour flags,
clutch effects, play-style assignment coverage, trick plays and WP bounds.
`gameEngine.mjs`, `calibration.mjs` and `simulation-models.mjs` must stay green.
