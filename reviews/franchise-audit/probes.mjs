import { createServer } from 'vite';
import { writeFileSync, existsSync } from 'node:fs';
globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const log=console.log; console.log=()=>{};
let seed=444; const reset=n=>{seed=n}; Math.random=()=>{seed= (Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296};
const results={};
try {
 const {useGameStore:store}=await server.ssrLoadModule('/src/store/gameStore.js');
 const {simulateGame}=await server.ssrLoadModule('/src/engine/simulation.js');
 const {runSeasonProgression}=await server.ssrLoadModule('/src/engine/progression.js');
 const {generateDraftClass}=await server.ssrLoadModule('/src/engine/draft.js');
 const playEngine=existsSync('src/engine/playEngine.js') ? await server.ssrLoadModule('/src/engine/playEngine.js') : null;
 store.getState().initializeGame('bears');
 const base=structuredClone(Object.fromEntries(Object.entries(store.getState()).filter(([,v])=>typeof v!=='function')));
 const team=base.teams.find(t=>t.id==='bears'),opp=base.teams.find(t=>t.id==='packers');
 const userGame=base.schedule[0].find(g=>[g.homeTeamId,g.awayTeamId].includes('bears'));
 const qb=base.rosters.bears.find(p=>p.position==='QB');
 store.setState({injuries:[{id:'audit',playerId:qb.id,teamId:'bears',weeksRemaining:8,type:'ACL Tear'}]});
 store.getState().simulateWeek();
 results.injuryAvailability={name:qb.name,injuryRemaining:store.getState().injuries.find(i=>i.id==='audit')?.weeksRemaining,attempts:store.getState().rosters.bears.find(p=>p.id===qb.id).stats.season.attempts};
 const weak={...structuredClone(qb),id:'weak',name:'Weak incumbent',ovr:50},strong={...structuredClone(qb),id:'strong',name:'Elite rookie',ovr:99};
 const roster=[weak,...base.rosters.bears.filter(p=>p.position!=='QB'),strong];
 const qresult=simulateGame(team,opp,roster,base.rosters.packers);
 results.qbSelection={weakAttempts:qresult.homePlayerStats.weak?.attempts||0,strongAttempts:qresult.homePlayerStats.strong?.attempts||0};
 const summaries=[];
 for(const boosts of [[],[{type:'team_ovr',value:50,weeksLeft:4}],[{type:'win_prob',value:0.99,weeksLeft:4}]]){
  store.setState(structuredClone(base));store.setState({activeBoosts:boosts});reset(700);store.getState().simulateWeek();
  const g=store.getState().schedule[0].find(g=>g.id===userGame.id);summaries.push({boost:boosts[0]?.type||'none',score:[g.homeScore,g.awayScore],stats:g.playerStats});
 }
 results.storyBoost={scores:summaries.map(({boost,score})=>({boost,score})),identicalStats:JSON.stringify(summaries[0].stats)===JSON.stringify(summaries[1].stats)&&JSON.stringify(summaries[1].stats)===JSON.stringify(summaries[2].stats)};
 store.setState(structuredClone(base));store.getState().simulateToWeek(18);store.getState().generatePlayoffs();
 const serialized=JSON.stringify(Object.fromEntries(Object.entries(store.getState()).filter(([,v])=>typeof v!=='function')));
 results.fullSeasonSave={utf8Bytes:Buffer.byteLength(serialized),scheduleBytes:Buffer.byteLength(JSON.stringify(store.getState().schedule))};
 const bracket=structuredClone(store.getState().playoffBracket);let found=null;
 for(let n=1;n<=2000&&!found;n++){store.setState({playoffBracket:structuredClone(bracket)});reset(n);store.getState().simPlayoffRound();const b=store.getState().playoffBracket;found=[...b.afc.wc,...b.nfc.wc].find(m=>m.homeScore===m.awayScore);if(found)results.tiedPlayoff={seed:n,...found};}
 const customStandings=Object.fromEntries(base.teams.map(t=>[t.id,{wins:t.division==='North'?12:t.division==='South'?5:8,losses:t.division==='North'?5:t.division==='South'?12:9,ties:0,pf:300,pa:200}]));
 store.setState({standings:customStandings});store.getState().generatePlayoffs();
 results.divisionSeeding={afc:store.getState().playoffBracket.afc.seeds.map(id=>({id,division:base.teams.find(t=>t.id===id).division})),southPresent:store.getState().playoffBracket.afc.seeds.some(id=>base.teams.find(t=>t.id===id).division==='South')};
 const {draftTeamOrder}=await server.ssrLoadModule('/src/engine/draftExperience.js');
 const championshipBracket={afc:{seeds:['bears'],wc:[],div:[],conf:[]},nfc:{seeds:[],wc:[],div:[],conf:[]},sb:{homeTeamId:'bears',awayTeamId:'packers',winnerId:'bears',played:true}};
 const orderStandings=structuredClone(base.standings);for(const id in orderStandings)orderStandings[id]={...orderStandings[id],wins:10,losses:7};orderStandings.bears.wins=9;orderStandings.bears.losses=8;
 results.championDraftSlot=draftTeamOrder(base.teams,orderStandings,base.schedule,championshipBracket).indexOf('bears')+1;
 if(playEngine) {
 const {createGameState,updateGame,selectPlay,snapBall}=playEngine;
 const input={userTeam:team,oppTeam:opp,userRoster:base.rosters.bears,oppRoster:base.rosters.packers,userIsHome:true,teamRatings:base.teamRatings};
 const manual=[];
 for(const playIndex of [0,5]){
  reset(1200+playIndex);let gs=createGameState(input),frames=0,plays=0;
  while(gs.phase!=='GAME_OVER'&&frames<1000000){
   if(gs.phase==='PLAY_CALL'){gs=selectPlay(gs,playIndex);gs=snapBall(gs);plays++;}
   gs={...gs,frameCount:gs.frameCount+1};gs=updateGame(gs);frames++;
  }
  manual.push({policy:playIndex===5?'HB Dive every snap':'Hitch without throwing (sack/idle stress)',phase:gs.phase,frames,plays,quarter:gs.quarter,score:[gs.homeScore,gs.awayScore],stats:gs.userStats});
 }
 results.playEngine=manual;
 results.tiedManualEnd=updateGame({...createGameState(input),phase:'RESULT',resultTimer:1,gameClock:0,quarter:4,homeScore:7,awayScore:7}).phase;
 } else results.playEngine={skipped:'On-field engine removed from current working tree'};
 const p={...structuredClone(qb),age:20,ovr:70,pot:99};p.attributes.position.accuracy=99;
 results.progressionAttribute=runSeasonProgression({bears:[p]}).newRosters.bears[0].attributes.position.accuracy;
 const classes=Array.from({length:10},(_,i)=>generateDraftClass(2030+i));
 results.draftTalent=classes.map(c=>({over90:c.filter(p=>p.ovr>=90).length,over80:c.filter(p=>p.ovr>=80).length,top:c[0].ovr,max:Math.max(...c.map(p=>p.ovr))}));
 results.depthShortage={note:'See ratings probe in results.json; no enforceable depth editing found in Roster.jsx'};
 const {TRADE_DEADLINE_WEEK}=await server.ssrLoadModule('/src/screens/tradeLogic.js');
 results.tradeDeadline={uiDeadline:TRADE_DEADLINE_WEEK,attempts:[]};
 for(const week of [9,10,11]) {
  store.setState(structuredClone(base));store.setState({week});
  const result=store.getState().executeTrade([],[6],'packers',[],[7]);
  const moved=store.getState().draftPickOwners.bears.some(p=>p.originalTeamId==='packers'&&p.round===7);
  results.tradeDeadline.attempts.push({week,rejected:result===false,pickMoved:moved});
 }
 writeFileSync('reviews/franchise-audit/probes-latest.json',JSON.stringify(results,null,2));
}finally{console.log=log;await server.close();}
