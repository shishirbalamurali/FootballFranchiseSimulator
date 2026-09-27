import assert from 'node:assert/strict';
export async function checkCPUEconomy(server,store,teams) {
    const { POSITION_MINIMUMS } = await server.ssrLoadModule('/src/engine/player.js');
    const { rookieReserve } = await server.ssrLoadModule('/src/engine/cpuRosterManagement.js');
    const base=structuredClone(Object.fromEntries(Object.entries(store.getState()).filter(([,v])=>typeof v!=='function')));
    const uid=base.userTeamId;
    const rosterSnapshot=JSON.stringify(base.rosters[uid]);
    const salary=r=>r.reduce((n,p)=>n+(p.contract?.salary||2),0);
    try {
        const rosters=Object.fromEntries(Object.entries(base.rosters).map(([id,r])=>[id,id===uid?r:r.slice(0,25).map(p=>({...p,contract:{salary:12,years:3,yearsLeft:3}}))]));
        store.setState({rosters,phase:'freeAgency',cpuSigningsDone:false});
        store.getState().simCPUSignings();
        for(const team of teams.filter(t=>t.id!==uid)) {
            const r=store.getState().rosters[team.id];
            assert.ok(salary(r)<=200-rookieReserve(store.getState().draftPickOwners[team.id])+1e-7,`${team.id} exceeds cap: ${salary(r)}`);
            assert.ok(r.length>=46&&r.length<=53,`${team.id} illegal roster size: ${r.length}`);
            for(const [pos,min] of Object.entries(POSITION_MINIMUMS)) assert.ok(r.filter(p=>p.position===pos).length>=min,`${team.id} lacks ${pos}`);
        }
        assert.equal(JSON.stringify(store.getState().rosters[uid]),rosterSnapshot,'CPU management must not touch user roster');
        const allRosterIds=Object.values(store.getState().rosters).flat().map(p=>p.id);
        assert.equal(new Set(allRosterIds).size,allRosterIds.length);
        assert.ok(store.getState().freeAgents.every(p=>!allRosterIds.includes(p.id)),'released/signing pool must not duplicate rostered players');
        console.log('PASS: over-cap/depleted CPU teams repaired; cap, positional minima, roster size and asset uniqueness');
    } finally {store.setState(base);}
}
