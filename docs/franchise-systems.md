# Franchise people and delegation

Implemented September 21, 2026.

## Where to play

- **Front Office → Assistants**: independently enable contract renewals and cap management. Both default to off. Set a cap reserve ($0–50M), maximum annual offer ($1–50M), and contract term limit (two or three years). Protect individual players from both assistants. Preview transactions, apply immediately, or let enabled assistants act before weekly simulation and before offseason contract expiry. Reports explain completed work and decisions left for the player.
- **Team → Coaching Staff**: view every club's HC, OC, DC, and senior assistant. Fire and replace your coordinators/assistant from a shared market, including former head coaches. Spend earned points in offense, defense, and leadership branches. Career histories and mentor/protégé relationships persist when coaches change teams.
- **League → Campus Watch**: browse 1,400 college players across four cohorts, filter by draft year, name, school, position, or recruiting tier, and follow favorites. Freshmen have no future stats revealed. Production, setbacks, and breakthroughs unfold as weeks pass. Followed graduates retain a college-career archive.
- **League → Journal**: see coaching changes and followed prospects' stories. The hub also surfaces coaching vacancies, assistant reports, and current campus updates.

## Rules and consequences

Cap assistants preserve the highest-rated players required by positional minimums, explicitly protected players, and a 46-player floor. If the reserve cannot be achieved safely, the assistant leaves the decision to the user. Contract assistants target expiring contributors rated at least 65, offer the existing market acceptance price, and respect salary, term, and reserve limits. They use the existing contract model, which replaces the current salary rather than modeling signing-bonus restructures. Staff compensation is outside the player cap. No assistant trades assets or signs outside free agents.

CPU head coaches are fired after four or fewer wins, or consecutive seasons of six or fewer wins, once at least ten games have been played. Successful coordinators and senior assistants compete with available head coaches for vacancies. A user assistant can leave; their position remains empty until the user hires a replacement. CPU teams refill their vacancies. Original coaching roots remain recorded. Completed seasons earn skill points and change reputation. CPU staff also develop skills. Staff bonuses apply to both regular-season and postseason simulation.

College recruiting tiers are projections: generational, elite, good, and normal, with most players normal. Newly generated cohorts reserve the generational tier for a rare draw. Annual breakthroughs and setbacks adjust readiness; an injury arc removes two games of production. Players spend four years in college and then enter a 350-player draft class with the same identity, school, statistics, and stories. This version does not simulate a playable collegiate league, recruiting control, transfers, or early declarations. Existing saves gain a pipeline and coaching staffs without replacing an ongoing draft.

## Validation

`npm test` includes `tests/franchise-systems.mjs`, alongside the existing regression and calibration suites. Coverage includes optional delegation, protected players, cap limits, a roster floor, repeated execution, CPU firing, user-assistant poaching, vacancy filling, skill effects, four-year prospect continuity, all 224 draft selections, alumni retention, single-use draft finalization, lossless college save compaction, a full 18-week season under a controlled 5 MiB UTF-16 save quota, save flush/reload, and older-save initialization. Draft resume rows are checked for the flat structure expected by the existing UI.

Browser validation on a separate local test save covered contract-plan execution and reports; staff development, firing and hiring; college class filtering, freshman career display, following and journal entries; and reload persistence of staff/skill changes. Browser console showed no errors on the final inspected page. The production build and lint for the new modules/screens passed. Existing build warnings about bundle size remain. College data is stored compactly; the existing quota fallback now correctly trims older box scores when the playoff week counter resets. The controlled quota test used that fallback while retaining the new systems. This is not a new long-term multi-slot storage soak or an end-to-end balance certification.
