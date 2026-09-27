import assert from 'node:assert/strict';
import { checkSaveSlots } from './helpers/saveSlots.mjs';
import { checkCPUEconomy } from './helpers/cpuEconomy.mjs';
import { checkFranchiseRules } from './helpers/franchiseRules.mjs';
import { installTestRandomness } from './helpers/seededRandom.mjs';
installTestRandomness(20260922);
import { createServer } from 'vite';
const values = new Map();
globalThis.localStorage = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
 const { generateDraftClass } = await server.ssrLoadModule('/src/engine/draft.js');
 const { exchangePicks, draftTeamOrder } = await server.ssrLoadModule('/src/engine/draftExperience.js');
 const { TEAMS } = await server.ssrLoadModule('/src/data/teams.js');
 const { useGameStore: store } = await server.ssrLoadModule('/src/store/gameStore.js');
 const cls = generateDraftClass(2030);
 assert.equal(cls.length, 350);
 for (const p of cls) { assert.ok(p.collegeProfile.seasons.length >= 2); assert.equal(p.collegeProfile.seasons.at(-1).year, 2029); assert.equal(p.contract, null); }
 assert.ok(cls.filter(p => p.position === 'OL').every(p => +p.combineSpeed > 4.8));
 const a = { round: 1, originalTeamId: 'a' }, b = { round: 1, originalTeamId: 'b' }, c = { round: 2, originalTeamId: 'a' };
 assert.equal(exchangePicks({a:[a,c],b:[b]}, [], 0, 'a', 'b', [a,a], [b]), null);
 assert.equal(exchangePicks({a:[a,c],b:[b]}, [{...a,teamId:'a'}], 1, 'a','b',[a],[b]),null);
 const change = exchangePicks({a:[a,c],b:[b]}, [{...a,teamId:'a'}, {...b,teamId:'b'}], 0, 'a','b',[a],[b]);
 assert.equal(change.onClockTeamId,'b'); assert.equal(change.draftPickOwners.a.length,2);
 store.getState().generateLeague();
 store.setState({ userTeamId: TEAMS[0].id, initialized: true });
 store.getState().generateDraftPreview();
 const scouted = store.getState().draftClass[0].id;
 store.setState({ scoutedProspects: {[scouted]:true}, draftWatchlist:[scouted], scoutingPoints:7 });
 store.getState().startDraft();
 assert.equal(store.getState().scoutingPoints,7); assert.ok(store.getState().scoutedProspects[scouted]);
 const before = store.getState().rosters[store.getState().onClockTeamId];
 store.getState().makePick(scouted);
 assert.equal(before.length,store.getState().rosters[store.getState().draftHistory[0].teamId].length-1);
 assert.equal(store.getState().draftHistory[0].player.contract.yearsLeft,4);
 while (store.getState().currentPickIndex < 224) {
  const state=store.getState();
  if (state.onClockTeamId===state.userTeamId) state.makePick(state.draftClass[0].id); else state.simOneCpuPick();
 }
 assert.equal(new Set(store.getState().draftHistory.map(p=>p.player.id)).size,224);
 assert.equal(store.getState().draftClass.length,126);
 store.getState().finalizeDraft();
 assert.equal(store.getState().draftArchive.at(-1).picks.length,224);
 // CLAUDE: clubs hold the next two drafts' picks (7 rounds × 32 × 2 years).
 assert.equal(Object.values(store.getState().draftPickOwners).flat().length,448);
 assert.ok(Object.values(store.getState().draftPickOwners).flat().every(p => p.year === store.getState().year + 1 || p.year === store.getState().year + 2));
 for (const t of TEAMS.filter(t => t.id !== store.getState().userTeamId)) {
  const r=store.getState().rosters[t.id];
  assert.equal(r.length,53,`${t.id} post-draft roster`);
  assert.ok(r.reduce((sum,p)=>sum+(p.contract?.salary||2),0)<=200+1e-7,`${t.id} post-draft cap`);
 }
 const schedule=store.getState().schedule;
 for (const t of TEAMS) assert.equal(schedule.flat().filter(g=>g.homeTeamId===t.id||g.awayTeamId===t.id).length,17,`${t.id} games`);
 assert.equal(draftTeamOrder(TEAMS,store.getState().standings,schedule).length,32);
 await checkSaveSlots(server);
 await checkCPUEconomy(server, store, TEAMS);
 await checkFranchiseRules(server, store, TEAMS);
 console.log('PASS: college profiles, combine, exact pick exchange, scouting preservation, rookie contracts, complete draft, archive, 17-game schedule');
} finally { await server.close(); }
