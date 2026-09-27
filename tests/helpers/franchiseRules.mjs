import assert from 'node:assert/strict';
import { createSeededRandom } from './seededRandom.mjs';

export async function checkFranchiseRules(server, store, teams) {
    const { simulateGame } = await server.ssrLoadModule('/src/engine/simulation.js');
    const { seedConference } = await server.ssrLoadModule('/src/engine/playoffs.js');
    const { draftTeamOrder } = await server.ssrLoadModule('/src/engine/draftExperience.js');
    const { runSeasonProgression } = await server.ssrLoadModule('/src/engine/progression.js');
    const { TRADE_DEADLINE_WEEK } = await server.ssrLoadModule('/src/screens/tradeLogic.js');
    const base = structuredClone(Object.fromEntries(Object.entries(store.getState()).filter(([,v]) => typeof v !== 'function')));
    const uid = base.userTeamId, opponent = teams.find(t => t.id !== uid).id;
    const failures = [], random = Math.random;
    const reset = () => { store.setState(structuredClone(base)); Math.random = createSeededRandom(91); };
    const check = (label, fn) => { reset(); try { fn(); console.log(`PASS rule: ${label}`); } catch(e) { failures.push(`${label}: ${e.message.slice(0,250)}`); } };
    try {
        check('injured starter stays inactive', () => {
            const qb = [...base.rosters[uid]].filter(p => p.position === 'QB').sort((a,b) => b.ovr-a.ovr)[0];
            store.setState({ injuries: [{ id:'rule-injury', playerId:qb.id, teamId:uid, weeksRemaining:8, type:'Ankle' }], phase:'regular',week:1 });
            store.getState().simulateWeek();
            assert.equal(store.getState().rosters[uid].find(p => p.id === qb.id).stats.season.attempts || 0, qb.stats.season.attempts || 0);
            assert.equal(store.getState().injuries.find(i => i.id === 'rule-injury').weeksRemaining,7);
        });
        check('minimum and invalid contract offers rejected without mutation', () => {
            const qb = {...base.rosters[uid][0],ovr:99};
            store.setState({rosters:{...base.rosters,[uid]:[qb]}});
            for (const [salary,years] of [[1,6],[NaN,3],[Infinity,3],[10,0],[10,1.5],[10,99]]) {
                const before = JSON.stringify(store.getState().rosters[uid]);
                assert.equal(store.getState().resignPlayer(uid,qb.id,salary,years).accepted,false,`${salary}/${years}`);
                assert.equal(JSON.stringify(store.getState().rosters[uid]),before);
            }
        });
        check('division winners qualify and ties count in win percentage', () => {
            const standings = Object.fromEntries(teams.map(t => [t.id,{wins:t.division==='North'?12:5,losses:t.division==='North'?5:12,ties:0,pf:300,pa:200}]));
            const seeds = seedConference(teams,standings,'AFC');
            assert.equal(new Set(seeds.slice(0,4).map(id => teams.find(t=>t.id===id).division)).size,4);
            const north = teams.filter(t=>t.conference==='AFC' && t.division==='North');
            for (const t of north) standings[t.id]={wins:3,losses:14};
            standings[north[0].id]={wins:9,losses:8,ties:0};
            standings[north[1].id]={wins:9,losses:7,ties:1};
            assert.ok(seedConference(teams,standings,'AFC').slice(0,4).includes(north[1].id));
        });
        check('postseason overtime always produces a winner', () => {
            let overtime = 0;
            for (let seed=0;seed<100;seed++) {
                Math.random=createSeededRandom(seed);
                const result=simulateGame({id:uid},{id:opponent},base.rosters[uid],base.rosters[opponent],null,null,{allowTie:false});
                assert.notEqual(result.homeScore,result.awayScore);
                if(result.overtime) overtime++;
            }
            assert.ok(overtime>0,'fixture must exercise overtime');
        });
        check('champion and runner-up draft last', () => {
            const bracket={sb:{homeTeamId:uid,awayTeamId:opponent,winnerId:uid,played:true}};
            const order=draftTeamOrder(teams,base.standings,base.schedule,bracket);
            assert.equal(order.at(-1),uid); assert.equal(order.at(-2),opponent);
        });
        check('championship history preserves result and postseason membership', () => {
            store.setState({phase:'playoffs',seasonRecap:null,playoffBracket:{afc:{seeds:[uid]},nfc:{seeds:[opponent]},sb:{homeTeamId:uid,awayTeamId:opponent,winnerId:uid,played:true}}});
            store.getState().concludeSeason();
            const recap=store.getState().seasonHistory.at(-1).seasonRecap;
            assert.equal(recap.winner,uid);assert.equal(recap.finalist,opponent);
            assert.ok(recap.playoffTeams.includes(uid));
            const count=store.getState().seasonHistory.length;
            store.getState().concludeSeason();assert.equal(store.getState().seasonHistory.length,count);
        });
        check('temporary story bonuses affect games', () => {
            const simulate = boosts => {
                reset(); store.setState({phase:'regular',week:1,activeBoosts:boosts}); store.getState().simulateWeek();
                return store.getState().schedule[0].find(g => g.homeTeamId===uid || g.awayTeamId===uid).playerStats;
            };
            assert.notDeepEqual(simulate([]),simulate([{type:'team_ovr',value:50,weeksLeft:3}]));
        });
        check('progression remains finite and bounded at rating floor and ceiling', () => {
            const source=base.rosters[uid].find(p=>p.position==='QB');
            for(const ovr of [40,70,99]) {
                const p=structuredClone(source);p.ovr=ovr;p.pot=99;p.age=20;p.devTrait='Superstar';
                for(const attrs of Object.values(p.attributes)) for(const k of Object.keys(attrs)) attrs[k]=ovr;
                for(let seed=0;seed<10;seed++) {
                    Math.random=createSeededRandom(seed);
                    const next=runSeasonProgression({[uid]:[p]}).newRosters[uid][0];
                    assert.ok(Number.isFinite(next.ovr));
                    for(const attrs of Object.values(next.attributes)) for(const value of Object.values(attrs)) assert.ok(Number.isFinite(value)&&value>=40&&value<=99,`OVR ${ovr}: ${value}`);
                }
            }
        });
        check('trade deadline agrees with displayed week', () => {
            for(const week of [TRADE_DEADLINE_WEEK-1,TRADE_DEADLINE_WEEK,TRADE_DEADLINE_WEEK+1]) {
                reset();store.setState({phase:'regular',week});
                const result=store.getState().executeTrade([],[6],opponent,[],[7]);
                assert.equal(result===false,week>TRADE_DEADLINE_WEEK,`Week ${week}`);
            }
        });
        check('expired CPU trade offers cannot bypass deadline', () => {
            store.setState({phase:'regular',week:TRADE_DEADLINE_WEEK+1,pendingTradeOffer:{fromTeamId:opponent,expiresWeek:TRADE_DEADLINE_WEEK,give:[{...base.rosters[uid][0],type:'player'}],receive:[{...base.rosters[opponent][0],type:'player'}]}});
            const before=JSON.stringify(store.getState().rosters);
            store.getState().acceptTradeOffer();
            assert.ok(JSON.stringify(store.getState().rosters)===before,'Expired trade changed rosters');
        });
    } finally { store.setState(base); Math.random=random; }
    assert.deepEqual(failures,[],`Franchise rule failures:\n${failures.join('\n')}`);
}
