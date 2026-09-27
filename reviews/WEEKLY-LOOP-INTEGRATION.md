# Weekly loop: implemented engine and remaining UI

Backend implemented September 25, 2026. UI integration awaits an ownership exception from the user or implementation by Claude under AGENTS.md. The feature is not yet accessible in normal play.

## UI contract

Import `weeklyPreparation`, `WEEKLY_STRATEGIES`, and `positionBattleCandidate` from `src/engine/weeklyExperience.js`. These functions are pure and return null when unavailable. Derive them from subscribed store state; do not put an allocating helper directly inside a Zustand selector.

HomeHub: place a preparation card directly below HeroMatchup. Show the actual opponent and `facts`, followed by the three strategy options. Use `setWeekStrategy(id)` and highlight `weekStrategy`. Display descriptions and the exact rating effects. These adjust rating bonuses; they are not calibrated win-probability percentages. Reuse this card or strategy renderer in MatchupPreview so the two selectors stay consistent.

If `positionBattleCandidate(state)` is non-null, show the young player and veteran with name, position, age and rating. Offer:

- “Give [young player's name] two games”: puts that player first on the QB/RB game-day depth chart, sacrificing the veteran's higher rating for a real evaluation.
- “Back [veteran's name] for two games”: keeps the experienced player first and postpones the prospect's opportunity.

Call `choosePositionBattle('rookie' | 'veteran')`; report `{ ok, reason }` failures. Explain that this is a two-game commitment and carries no automatic rating reward. Choices lock during the evaluation. Injuries/rest of the selected player or either participant leaving the roster end the evaluation safely; byes do not count. Show the stored `positionBattle.games` rows during and after it.

For a current-team/current-year battle with status `complete` or `settled`, allow `resolvePositionBattle('rookie' | 'veteran' | 'auto')`. Chosen starters retain priority while available for the remaining regular season; automatic depth is the default after the trial until the user chooses. Show `summary` and action failures. The user may change a settled choice. The settled choice falls back to normal depth during unavailability and does not affect playoffs or later years.

Show this bulk-simulation policy near preparation: “Sim uses your current plan. Unchosen evaluations keep normal depth order. Active evaluations continue; after two games, normal depth returns until you choose a starter.” There are no new forced dialogs or surprise pauses.

GameSummaryModal: conditionally render `game.weeklyReview` if its teamId matches userTeamId. Show strategyLabel, opponentName, evidence and note. If `battle` exists, show playerName, statLine, and `gameNumber` (null means a retained starter, not an evaluation game). Show interruption when present. Missing weeklyReview in older games hides the section safely. Review snapshots remain unchanged when the next week's strategy changes.

## Validation

`npm test`, `npm run lint`, and `npm run build` pass. New tests cover actual QB snaps and RB carries, transient flags never leaking into saved rosters, two-game resolution, bye weeks, duplicate settlement, injuries/trades/team/season changes, retained starter choices, old-field defaults, save/reload and integration into stored game recaps. Existing test harness emits a sandbox websocket warning; the new test disables its websocket server. Build reports existing bundle-size and browsers-data warnings.

Before calling the complete slice shipped: implement the UI above, run checks again, then inspect a normal week, an active evaluation, its completed decision, a bye, an old save and a game recap in the browser.
