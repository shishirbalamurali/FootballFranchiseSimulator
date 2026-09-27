# Make the franchise worth playing

This is a source-based design audit, not an observed playtest. Findings below are verified against the current code; proposed improvements are hypotheses to validate with players. No gameplay implementation is included in this pass.

## Diagnosis

The strongest opportunity is the regular-season loop: understand a football problem, make a consequential choice, anticipate the result, and see what that choice meant. The game already has owner pressure, achievements, rivalries, college scouting, staff, trades and a four-day free-agent market. Connect those systems to this loop before adding more parallel systems.

| Observed behavior | Why it may feel flat | Relevant source |
| --- | --- | --- |
| Several story choices offer a free boost versus no benefit. Mentorship is +2 rookie OVR versus no change. | The player collects a reward instead of making a judgment. | `src/engine/progression.js`, `EVENT_POOL` |
| Event generation takes roster and week; opponent names are selected from a fixed list. Rival week has no opponent eligibility check. | Stories can contradict the actual season, weakening attachment and trust. | `generateWeeklyEvent` |
| Training grants +1 or +2 OVR per use. | Repeatedly training one favorite can become a compulsory weekly chore with little uncertainty or specialization. | `src/store/gameStore.js`, `devTrainPlayer` |
| Weekly objectives rotate using week-number arithmetic. | A rebuilding team and a contender receive the same generic scoring goals. | `src/screens/hub/hubData.js`, `getWeekObjectives` |
| The loading screen scales final scores with elapsed animation time; commentary is a fixed sequence. | It cannot convey real comebacks, pivotal turnovers or suspense from the actual game. | `src/components/WeekLoadingScreen.jsx` |
| The recap's “play of the game” is inferred from aggregate player stats. | It describes a performance rather than a specific remembered moment. | `src/screens/hub/GameSummaryModal.jsx` |
| Aggressive/conservative strategy is available in MatchupPreview and applies fixed rating bonuses. | The existing lever could become a stronger opponent-specific decision with a visible postgame evaluation. | `src/components/MatchupPreview.jsx`, `userGameBonuses` |
| Story resolution applies effects and clears the event without a choice-history record in that action. | Choices lack an explicit foundation for later callbacks and consequences. | `resolveStoryEvent` |

## The target experience

“I started my rookie against our rival. He struggled, but I stuck with him. Now I need to protect him better, and next week's opponent just lost its best corner.”

That is a reason to play another week even after a loss. Aim for a normal week taking roughly 60–120 seconds, with optional deeper roster work and instant sim always available. These are proposed pacing targets, not measured results.

1. **Monday: show what changed.** One main headline, one developing player story, one upcoming football problem. Keep detailed stats available behind those summaries.
2. **Preparation: make one important call.** Show the opponent's relevant strength, two or three plausible responses, and the cost of each. Remember the previous plan and allow delegation.
3. **Sunday: reveal the game.** Offer instant results or a short, skippable highlights mode backed by actual simulation events. Let pivotal games breathe.
4. **Afterward: connect action to evidence.** Show the chosen plan, observed result, a player development update, and the next unresolved issue. Avoid claiming that one decision caused a win when the model cannot establish that.

## Build priorities

### 1. Weekly game plan and useful postgame feedback

Put the decision beside the Sim button. Start with the existing strategy options, describe their actual effects honestly, and add opponent context. Then develop specific football tradeoffs: quick passing reduces exposure to pressure but sacrifices deep attempts; extra run support leaves coverage weaker; rookie reps trade current reliability for development opportunity.

Every new plan must modify the relevant simulation mechanism and have a disadvantage. Do not simply award a universal bonus for clicking a card. Postgame feedback should report evidence such as sacks allowed, explosive passes and rushing efficiency, with a clear distinction between observed performance and model-estimated plan effects.

**Success:** a player can explain their choice before the game and say what they learned afterward. Across varied opponents, no single plan should consistently dominate.

### 2. Persistent player stories with real tradeoffs

Begin with three reusable arcs: rookie versus veteran, extension versus cap flexibility, and a slump versus a change in role. Trigger them from actual roster, schedule and performance state. Keep at most two active arcs and offer at most one major decision per week.

Example: start the rookie for a two-game evaluation, retain the veteran for a division race, or use a limited package. Each option has an immediate football cost and a later checkpoint. A promise only affects trust when it is explicitly made; never secretly punish ordinary roster management.

Persist the participants, decision, deadline and resolution. If a player is traded or injured, adapt or close the arc instead of continuing impossible dialogue. Reuse owner, legacy and rivalry data for callbacks. Several weeks later, recognize the player the user backed.

**Success:** players remember names and decisions, including during losing seasons. Templates must be eligible, avoid repetition and resolve exactly once across reloads.

### 3. Game highlights that earn their drama

Keep instant sim. Add optional “Watch highlights” once the engine produces a real event sequence. The current aggregate model cannot honestly supply possession chronology simply by animating the final score.

First deliver actual scoring events and turning points, reconciled to the final score and box score. Later add an optional coach mode with a few decisions such as fourth down or halftime adjustment. Interactive choices require a resumable simulation whose future changes after the decision; this is a separate, larger engine project.

**Success:** the player remembers a specific moment. Skip and watch modes yield the same outcome for the same seed and preparation when no live decisions are made. Save/reload cannot replay rewards or duplicate games.

### 4. Development projects instead of weekly rating collection

Choose a small number of multiweek projects: improve a young QB's accuracy, develop a receiver's route running, or prepare a backup for a starting role. Tie progress to coaching and suitable playing opportunities, with diminishing returns and visible checkpoints. Give established veterans useful roles too.

Keep feedback frequent, but avoid automatic OVR increases every week. Report concrete attribute progress and readiness. Permit automatic renewal or delegation so the player does not lose progress because they forgot a screen.

**Success:** choosing whom to develop is interesting; repeating the same click is unnecessary. Validate season-long rating distributions before changing growth rates.

### 5. A reason to care at every stage of the season

Make season goals reflect team strength and trajectory: establish a rookie, recover cap flexibility, win the division, or capitalize on an aging core. At the deadline, summarize the buy/sell choice with actual offers and future cap effects. After elimination, emphasize auditions and next year's roster rather than treating the remaining weeks as empty clicks.

Add distinct opening situations after the core loop works: a contender's last chance, a cap-strapped rebuild, and a young roster seeking its identity. Reuse the existing market, college pipeline and legacy systems. Track former players so trades and cuts can produce later reunions.

**Success:** a bad season still produces player-defined progress, and different starts lead to different reasonable decisions.

## First shippable slice

Build **one opponent-aware preparation card, one persistent rookie/veteran arc, and one decision-aware recap**. Include genuine opportunity costs, contextual eligibility and a short history of the choice. Keep the current instant simulation. This tests whether the weekly loop improves before committing to a possession-engine rewrite.

Codex scope: pure context/eligibility functions, decision records, effects, resolution, old-save defaults and regression tests; thin surgical store hooks. Claude scope: Hub preparation card, story presentation, recap and player-history surfaces. Coordinate on the Board before edits under the existing ownership contract.

Acceptance checks:

- Actual opponent and eligible roster members appear in every generated decision.
- Each option has a situation in which it is reasonable; no free upgrade versus nothing.
- Costs and mechanical effects match the displayed promises.
- Decisions survive reload and resolve once; missing fields in old saves default safely.
- Bulk simulation has an explicit delegation policy and pauses only at decisions the player chose to handle.
- The recap retains the choice and relevant observed evidence without inventing causal claims.
- Existing economy and simulation regression suites remain green.

## How to find out whether it is more fun

Playtest the current build and the slice with the same starting situations, counterbalancing which version is played first. Include a contender, a rebuilding team and an injury-disrupted roster. Observe the first six weeks, then a deadline and offseason transition. With a small group, use results directionally rather than claiming statistical certainty.

Ask: “What are you trying to achieve?”, “Why did you choose that?”, “Which player matters to you?”, and “What makes you want to play next week?” Record voluntary continuation, recalled consequences, time spent on meaningful decisions, repeated chores and confusion about results. Longer sessions alone do not establish greater enjoyment.

Defer stadium economies, additional currencies, larger achievement catalogs and more dashboard cards until this slice improves those answers. More forced popups, waiting timers or harsh owner penalties would risk making the experience slower without making decisions richer.

Design reference: Sid Meier's [Interesting Decisions](https://www.gdcvault.com/play/1015756/) frames gameplay around decisions and the information/feedback players need. This audit applies that principle to the code above; it does not establish that any proposed feature is proven fun.
