// Focused revalidation after concurrent source changes. Explicit simulated quota.
import {createServer} from 'vite';
import {writeFileSync,existsSync} from 'node:fs';
const saved=new Map(),errors=[],warnings=[];
globalThis.localStorage={getItem:k=>saved.get(k)||null,removeItem:k=>saved.delete(k),setItem:(k,v)=>{if(Buffer.byteLength(v)>5*1024*1024){const e=new Error('Audit model: 5 MiB UTF-8 payload limit');e.name='QuotaExceededError';throw e;}saved.set(k,v);}};
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
const original={log:console.log,warn:console.warn,error:console.error};
console.log=()=>{};console.warn=(...a)=>warnings.push(a.map(String).join(' '));console.error=(...a)=>errors.push(a.map(String).join(' '));
const wait=()=>new Promise(r=>setTimeout(r,280));
const result={date:'2026-09-20',quotaModel:'5 MiB UTF-8 payload cap per setItem; controlled failure model, not browser quota measurement',onFieldPresent:existsSync('src/engine/playEngine.js')};
try {
 const {useGameStore:store}=await server.ssrLoadModule('/src/store/gameStore.js');
 const {TRADE_DEADLINE_WEEK}=await server.ssrLoadModule('/src/screens/tradeLogic.js');
 store.getState().initializeGame('bears');
 const base=structuredClone(Object.fromEntries(Object.entries(store.getState()).filter(([,v])=>typeof v!=='function')));
 result.tradeDeadline={displayed:TRADE_DEADLINE_WEEK,weeks:[]};
 for(const week of [9,10,11]){store.setState(structuredClone(base));store.setState({week});const accepted=store.getState().executeTrade([],[6],'packers',[],[7]);result.tradeDeadline.weeks.push({week,rejected:accepted===false,moved:store.getState().draftPickOwners.bears.some(p=>p.originalTeamId==='packers'&&p.round===7)});}
 store.setState(structuredClone(base));const qb=base.rosters.bears.find(p=>p.position==='QB');
 store.setState({injuries:[{id:'audit',playerId:qb.id,teamId:'bears',weeksRemaining:8,type:'ACL Tear'}]});store.getState().simulateWeek();
 result.injuredQBPassAttempts=store.getState().rosters.bears.find(p=>p.id===qb.id).stats.season.attempts;
 store.getState().resignPlayer('bears',qb.id,1,6);result.minimumExtension=store.getState().rosters.bears.find(p=>p.id===qb.id).contract;
 store.setState(structuredClone(base));await wait();result.saveProgress=[];
 for(let w=1;w<=18;w++){store.getState().simulateWeek();await wait();const persisted=JSON.parse(saved.get('gridiron_save_slot_0')||'{}');result.saveProgress.push({afterGameWeek:w,memoryWeek:store.getState().week,memoryPhase:store.getState().phase,savedWeek:persisted.week,savedPhase:persisted.phase});}
 result.saveFailureCount=errors.filter(s=>s.includes('Save failed')).length;
 result.trimWarnings=warnings.filter(s=>s.includes('Save trimmed'));
 result.lastErrors=errors.slice(-3);
 writeFileSync('reviews/franchise-audit/current-check.json',JSON.stringify(result,null,2));
}finally{Object.assign(console,original);await server.close();}
