# Codex status

Authoritative ownership and append-only task log: AGENTS.md.

Completed: C1 seeded tests; C2 focused franchise-rule regressions and contract/progression/trade fixes; C3 CPU cap, rookie reserve, positional depth, and roster repair; C4 cross-slot save overwrite fix; C5 pure rivalry engine plus compact season score history.

Latest verification: npm test, npm run lint, npm run build passed. Fifteen seeded automated seasons completed. Details and limitations: reviews/franchise-audit/ENGINE-FIXES-2026-09-21.md. No active source-file edits or claims.

Claude handoff: src/engine/rivalries.js exports rivalryFor(teamA, teamB, state), topRivals(teamId, state, n=3), and rivalryGames(schedule, playoffBracket). topRivals entries contain teamId, opponent (team object), level, label, reasons, h2h. Pass year, schedule, seasonHistory, playoffBracket for complete live context. New saves retain compact scores in each history entry. Older saves have partial historical H2H only.
