# Engine repairs and multi-season verification — September 21, 2026

This update covers Codex's engine work alongside Claude's owner, legacy, and UI work. The earlier REVIEW.md is historical evidence, not the current bug status.

## Implemented

- CPU offseason roster management now budgets for rookie contracts and required positional depth, releases contracts when necessary, and fills affordable replacements. Targets are 46 before the draft and 53 after it. Existing retained salaries are unchanged; the user's roster is untouched.
- Contract extensions reject nonfinite salaries and invalid contract lengths. Existing market-value rejection is regression-tested.
- Trade rules share the displayed Week 11 deadline; expired CPU offers cannot execute.
- Development from OVR 40 no longer divides by zero and corrupts attributes.
- Save writes bind to the loaded franchise slot. Switching slots flushes the old pending save before a new franchise can take over. An external tab changing its selected slot cannot redirect this tab's save into another franchise.
- Rivalry engine supports division rivalry, close-game heat, playoff eliminations, and head-to-head records. Compact score rows are archived with each completed season. Older saves count only their known championship meetings; unrecorded historical results are not invented. Claude owns the UI integration.

## Verification

`npm test`, `npm run lint`, and `npm run build` passed after integration. Lint has zero warnings; build retains the large-bundle advisory. New tests reproduce the contract, progression, trade, CPU-cap, and save-slot defects and verify their repairs. Existing injury, story-effect, playoff seeding/tie, draft-order, and championship-history fixes also pass focused regression checks. Rivalry tests cover reversed perspective, historical records, old-save fallback, and avoiding double-counting a completed season.

Three seeded five-season store-action campaigns completed: autopilot, rebuild, and win-now (15 seasons, 2024–2028). All seasons had 272 regular-season games, no schedule-count/double-booking errors, and complete 224-player drafts. These are automated engine playthroughs, not 15 browser playthroughs. Results: results-cpu-repair.json.

The report's legacy `leagueRosterMin/Max` and `teamsOverCap` metrics include the human team despite the console's misleading “CPU range” label. Do not interpret them as CPU-only measurements. Targeted tests separately assert all 31 CPU teams' post-draft cap and 53-player roster compliance, and stressed offseason compliance including rookie reserves.

## Remaining findings

- Manual user teams still need roster/cap enforcement: autopilot fell to 28 players by year five; rebuild reached 55 players, and some user teams exceeded $200M. CPU management deliberately does not silently manage user contracts.
- One first-year rebuild league contained an over-cap CPU team before its first offseason repair. Initial league generation needs the same budget discipline.
- Rivalry results predating this version cannot be reconstructed beyond championship results retained in old saves.
- The save-slot fix prevents cross-slot overwrites; simultaneous edits to the same franchise in multiple tabs still need conflict handling.
- Rivalry UI integration remains Claude's task. These engine changes do not establish that the entire game is release-ready.
