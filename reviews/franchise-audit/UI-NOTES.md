# Browser playtest evidence

Review dates: September 19–20, 2026. All interactions used the local application and the browser UI automation tool. This is a written observation log, not a recording. Existing user franchises were not deliberately advanced, reset, or deleted. Production source was not edited.

## Campaign A: New Jersey Guardians

- Origin: `http://127.0.0.1:5173`. Initially showed coach creation with an existing active-slot setting. This was not a clean-storage test.
- Coach: Review Coach; Defensive Genius; Legend. Selected the rebuilding 75-OVR New Jersey Guardians.
- Roster: 53 players. Initial cap use $103M, $97M space. Nine expiring contracts.
- Hub “Contracts” opened the general roster tab rather than directly selecting Contracts, adding an extra click.
- Opened Anthony Bryant's extension: 77 OVR, age 24, current $5.3M, displayed market approximately $7M.
- Set annual salary slider to $1M and length to six years. Confirmation toast: “Anthony Bryant re-signed for 6 years at $1M.” Under-contract row showed $1M and six years; cap space rose to $102M.
- Hub → Play game → Conservative → Play it yourself. Full-page error: `ReferenceError: Cannot access 'canvasPos' before initialization`.
- ErrorBoundary Reload returned to coach creation. Browser console recorded repeated `Save failed QuotaExceededError` for `gridiron_save_slot_1` at `gameStore.js:75`. No save error was shown in the game UI.
- Read-only visit to `localhost:5173` showed an existing Chicago franchise. Did not advance it. Moved testing to a separate origin.

## Campaign B: Baltimore Nevermores, fresh origin

- Origin: `http://127.0.0.1:5189`. First load visibly showed three empty save slots.
- Started slot 1, generated rosters, coach Audit Two, Offensive Mastermind, Rookie.
- Selected 87-OVR Baltimore: 87 offense, 85 defense. Initial cap use $224M against $200M.
- Simulated Week 1 without correcting cap: beat Las Vegas 42–30, moved to Week 2 at 1–0.
- Postgame flow required scoreboard Continue, detailed-result Continue, then milestone dismissal/Skip remaining.
- Hub's Player of the Week card named Christian Floyd; the news feed called Cameron Gonzalez Player of the Week. This discrepancy was observed but not independently traced in the final priority list.
- Simulated to playoffs: 14–3. Still $24M over cap. Hub displayed injured players, including an ACL tear.
- Entered playoffs: Baltimore #1 seed/bye. NFC bracket placed both Philadelphia and New Jersey among seeds 1–4.
- Sim to the end completed all rounds and showed New York Rockets as champions. Loading presentation called the postseason “Regular Season / Week 1.”
- Begin offseason opened free agency: 341 available, $35M cap space. Offered 99-OVR Jeremiah Jackson $20M for one year; after the response interval he remained listed. No claim of acceptance is made.
- Sim rival signings reduced pool to 283 and disabled the button. Entered draft, opened war room; Rockets appeared at #14 despite winning the title. Baltimore at #31.
- Tried scouting at narrow window width; no visible result. Prospect elements existed in the DOM, but later visual inspection showed list layout was inaccessible at that width.
- Browser session interruption/reopening restored the franchise to **Week 2, 1–0**, losing the season, offseason, and draft progress.

## Campaign B replay and completed draft

- Resumed Week 2 and simulated to playoffs again: 12–5.
- Console again showed `QuotaExceededError` saving `gridiron_save_slot_0` on the otherwise fresh test origin.
- Simulated postseason: **Baltimore Nevermores won the championship**, with recap text “That is your franchise.”
- Began offseason and opened Hub: Season history read **“2024 — Missed the playoffs.”**
- Free agency: 331 available, $35M cap room. Rival signings reduced pool to 276.
- Opened draft: Baltimore pick #31, Tampa Bay #32, despite Baltimore winning the final.
- Paused timer. At approximately 884px-wide window, screenshot showed only the empty prospect-detail pane and team needs; the prospect list was absent visually.
- Temporarily tested desktop breakpoint 1440 × 1000. List appeared; scouting Kyle Baker revealed **93 OVR** and reduced scouting points 10 → 9.
- Sim to My Pick worked. Kyle Baker remained available at #31. Drafted him.
- At #63, Chris Sims still had an unscouted range 88–99; selected LB Kyrie Green instead.
- Completed all seven user picks, using position filters for roster needs. Draft completion screen: class B+, seven picks, two Superstar players, one Star player, top OVR 93.

| Round / pick | Player | Position | Revealed OVR |
|---|---|---|---:|
| 1 / 31 | Kyle Baker | QB | 93 |
| 2 / 63 | Kyrie Green | LB | 85 |
| 3 / 95 | Amari Griffin | K | 79 |
| 4 / 127 | Riley Turner | WR | 55 |
| 5 / 159 | Isaiah Williams | OL | 67 |
| 6 / 191 | Adrian Baker | CB | 53 |
| 7 / 223 | Chris Owens | RB | 83 |

- Clicked “Head to Training Camp” and reached **Season 2 · 2025 · Regular Season · Week 1**, with 0–0 record, 84 overall, 87 offense, 81 defense. There was no intervening training-camp screen.
- Opened Trade Center: “Deadline after week 11 · 11 weeks left,” $23M cap space. Selected Green Bay; displayed needs included DE, LT, K, P. Opened own Add asset roster picker. Did not submit a UI trade before the next browser interruption.
- Restored the viewport override to its original dimensions after testing.

## Scope boundary

There were two browser franchise starts, one completed browser season-to-next-season transition, plus a previous completed season/postseason that rolled back. The 15 additional completed seasons were executed through real game-store actions in the isolated harness. No claim is made that 15 seasons were manually played in the browser, that an on-field browser game completed, or that a user-interface trade succeeded.
