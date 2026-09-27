// Independent review harness. Uses real store actions, isolated memory saves.
// Run: node reviews/franchise-audit/playthroughs.mjs
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
const saves = new Map();
globalThis.localStorage = { getItem: k => saves.get(k) ?? null, setItem: (k,v) => saves.set(k,v), removeItem:k=>saves.delete(k) };
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType:'custom' });
const log = console.log;
console.log = () => {};
let seed = 1;
Math.random = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const report = { methodology:'Three independent seeded five-season store-action playthroughs; not browser-completed seasons. In-memory localStorage. User strategies are heuristics, not optimal play.', runs:[], probes:{} };
try {
 const { useGameStore:store } = await server.ssrLoadModule('/src/store/gameStore.js');
 const { calculateTeamRatings } = await server.ssrLoadModule('/src/engine/ratings.js');
 const { simulateGame } = await server.ssrLoadModule('/src/engine/simulation.js');
 const initial = structuredClone(Object.fromEntries(Object.entries(store.getState()).filter(([,v])=>typeof v!=='function')));
 const cap = r => r.reduce((a,p)=>a+(p.contract?.salary||2),0);
 const needs = {QB:2,RB:3,WR:5,TE:2,OL:8,DL:6,LB:5,CB:5,S:4,K:1,P:1};
 for (const [idx,style] of ['autopilot','rebuild','win-now'].entries()) {
  seed = 101 + idx; store.setState(structuredClone(initial)); store.getState().generateLeague();
  const ranked = Object.entries(store.getState().teamRatings).sort((a,b)=>a[1].overall-b[1].overall);
  const tid = ranked[style==='win-now'?ranked.length-1:0][0];
  store.getState().selectTeam(tid,{name:`Audit ${style}`,style:'balanced',bonus:{},difficulty:style==='rebuild'?'legend':'pro',difficultyBonus:style==='rebuild'?-3:0,seasonGoal:'Make the Playoffs'});
  const run = {style,seed:101+idx,team:tid,initialRating:store.getState().teamRatings[tid].overall,seasons:[]};
  report.runs.push(run);
  for(let year=0;year<5;year++) {
   const start = store.getState();
   const row = {year:start.year,rosterStart:start.rosters[tid].length,capStart:+cap(start.rosters[tid]).toFixed(2),ratingStart:calculateTeamRatings(start.rosters[tid]).overall};
   const rosterSizes = Object.values(start.rosters).map(r=>r.length);
   row.leagueRosterMin=Math.min(...rosterSizes); row.leagueRosterMax=Math.max(...rosterSizes);
   row.teamsOverCap=Object.values(start.rosters).filter(r=>cap(r)>200).length;
   row.teamsMissingQB=Object.values(start.rosters).filter(r=>!r.some(p=>p.position==='QB')).length;
   row.teamsUnder22=rosterSizes.filter(n=>n<22).length;
   row.scheduleErrors=[];
   for(const team of start.teams) {
    const games=start.schedule.flat().filter(g=>[g.homeTeamId,g.awayTeamId].includes(team.id));
    if(games.length!==17)row.scheduleErrors.push(`${team.id}: ${games.length} games`);
    if(start.schedule.some(w=>w.filter(g=>[g.homeTeamId,g.awayTeamId].includes(team.id)).length>1))row.scheduleErrors.push(`${team.id}: double booked`);
   }
   if(style!=='autopilot') {
    for(const p of [...start.rosters[tid]].filter(p=>p.contract?.yearsLeft===1 && p.ovr>=75).sort((a,b)=>b.ovr-a.ovr)) {
     const salary=Math.max(2,Math.round(p.contract.salary*(0.9+p.ovr/200)));
     if(cap(store.getState().rosters[tid])-p.contract.salary+salary<195)store.getState().resignPlayer(tid,p.id,salary,3);
    }
   }
   for(let w=1;w<=18;w++) {
    if(style!=='autopilot') {
     const candidates=store.getState().rosters[tid].filter(p=>p.age<=26 && p.ovr<95).sort((a,b)=>(b.position==='QB')-(a.position==='QB')||b.pot-a.pot);
     if(candidates[0])store.getState().devTrainPlayer(candidates[0].id,'awareness');
     store.getState().setWeekStrategy(style==='win-now'?'aggressive':'conservative');
    }
    store.getState().simulateWeek();
   }
   const end=store.getState(); row.record={...end.standings[tid]}; row.playedGames=end.schedule.flat().filter(g=>g.played).length;
   row.pointsPerTeamGame=+(end.schedule.flat().reduce((a,g)=>a+g.homeScore+g.awayScore,0)/544).toFixed(2);
   const qb=end.rosters[tid].filter(p=>p.position==='QB').sort((a,b)=>b.ovr-a.ovr)[0];
   row.qb=qb?{name:qb.name,ovr:qb.ovr,stats:qb.stats}:null;
   store.getState().generatePlayoffs();
   row.madePlayoffs=[...store.getState().playoffBracket.afc.seeds,...store.getState().playoffBracket.nfc.seeds].includes(tid);
   for(let r=0;r<4;r++)store.getState().simPlayoffRound();
   row.champion=store.getState().playoffBracket.sb.winnerId;
   store.getState().concludeSeason(); await sleep(550);
   row.offseasonRoster=store.getState().rosters[tid].length;
   row.staleRatings=Object.entries(store.getState().rosters).filter(([id,r])=>calculateTeamRatings(r).overall!==store.getState().teamRatings[id].overall).length;
   store.getState().startFreeAgency();
   if(style!=='autopilot') {
    store.getState().trainRoster(style==='rebuild'?'OL':'WR');
    for(const p of [...store.getState().freeAgents].sort((a,b)=>b.ovr-a.ovr)) {
     const roster=store.getState().rosters[tid]; const at=roster.filter(x=>x.position===p.position);
     if(at.length<(needs[p.position]||2) && cap(roster)+(p.contract?.salary||2)<190)store.getState().signFreeAgent(p.id,tid,{salary:p.contract?.salary||2,years:2,yearsLeft:2});
    }
   }
   store.getState().simCPUSignings(); store.getState().generateDraftPreview(); store.getState().startDraft();
   while(store.getState().currentPickIndex<224) {
    const s=store.getState();
    if(s.onClockTeamId!==tid) { s.simOneCpuPick(); continue; }
    let candidates=[...s.draftClass];
    if(style==='rebuild')candidates.sort((a,b)=>((needs[b.position]||2)-s.rosters[tid].filter(p=>p.position===b.position).length)*10+b.ovr-(((needs[a.position]||2)-s.rosters[tid].filter(p=>p.position===a.position).length)*10+a.ovr));
    else candidates.sort((a,b)=>b.ovr-a.ovr);
    s.makePick(candidates[0].id);
   }
   row.draftPicks=store.getState().draftHistory.length;
   row.uniqueDraftPlayers=new Set(store.getState().draftHistory.map(p=>p.player.id)).size;
   store.getState().finalizeDraft(); await sleep(300);
   row.saveBytes=Buffer.byteLength(saves.get('gridiron_save_slot_0')||'');
   run.seasons.push(row); log(`${style} ${row.year}: ${row.record.wins}-${row.record.losses}-${row.record.ties}; roster ${row.rosterStart}; CPU range ${row.leagueRosterMin}-${row.leagueRosterMax}; over cap ${row.teamsOverCap}`);
  }
 }
 const s=store.getState(); const tid=s.userTeamId;
 const exp=s.rosters[tid].find(p=>p.contract?.yearsLeft===1)||s.rosters[tid][0];
 const oldContract=structuredClone(exp.contract); s.resignPlayer(tid,exp.id,1,6);
 report.probes.minimumExtension={player:exp.name,ovr:exp.ovr,before:oldContract,after:store.getState().rosters[tid].find(p=>p.id===exp.id).contract};
 const starter=store.getState().rosters[tid].filter(p=>p.position==='QB').sort((a,b)=>b.ovr-a.ovr)[0];
 if(starter){const pre=starter.ovr;for(let i=0;i<5;i++)store.getState().trainRoster('QB');report.probes.repeatedOffseasonTraining={before:pre,after:store.getState().rosters[tid].find(p=>p.id===starter.id).ovr,note:'store-only; UI reachability must be checked'};}
 const injuredRoster=structuredClone(store.getState().rosters[tid]); const injured=injuredRoster.filter(p=>p.position==='QB').sort((a,b)=>b.ovr-a.ovr)[0];
 if(injured){injured.injured=true;injured.injury={weeksRemaining:10};const opp=s.teams.find(t=>t.id!==tid);const result=simulateGame(s.teams.find(t=>t.id===tid),opp,injuredRoster,s.rosters[opp.id]);report.probes.injuredQB={id:injured.id,stat:result.homePlayerStats?.[injured.id]};}
 const fakeRoster=[{id:'one',position:'OL',ovr:99}];report.probes.missingLineRating={oneLineman:calculateTeamRatings(fakeRoster).offense.ol,fiveLineman:calculateTeamRatings(Array.from({length:5},(_,i)=>({...fakeRoster[0],id:String(i)}))).offense.ol};
 writeFileSync(process.env.AUDIT_RESULTS || 'reviews/franchise-audit/results-latest.json',JSON.stringify(report,null,2));
} finally { console.log=log; await server.close(); }
