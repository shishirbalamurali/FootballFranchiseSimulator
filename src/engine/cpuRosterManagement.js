import { generatePlayer, POSITION_MINIMUMS, ROSTER_COMPOSITION, ROSTER_LIMIT } from './player';

const MIN_SALARY = 1;
export const rosterSalary = roster => roster.reduce((sum, p) => sum + (Number.isFinite(p.contract?.salary) && p.contract.salary > 0 ? p.contract.salary : 2), 0);
const price = p => rosterSalary([p]);
const countsOf = roster => roster.reduce((counts,p) => ({ ...counts, [p.position]: (counts[p.position] || 0) + 1 }), {});
const missingSlots = (roster, target) => {
    const counts = countsOf(roster);
    const positional = Object.entries(POSITION_MINIMUMS).reduce((n,[pos,min]) => n + Math.max(0,min-(counts[pos] || 0)),0);
    return Math.max(positional, target-roster.length);
};
export function rookieReserve(picks = []) {
    // Upper bound within each round; pick trades during the draft are checked
    // again when the post-draft roster is balanced.
    // CLAUDE: clubs now hold future picks; only the next draft costs cap now.
    const next = Math.min(...picks.map(p => p.year ?? Infinity));
    picks = picks.filter(p => (p.year ?? next) === next);
    return picks.reduce((sum,p) => sum + Math.round(Math.max(.8,10/Math.pow(1+((p.round-1)*32)/8,.7))*100)/100,0);
}

// Never changes the user's roster or silently discounts an existing contract.
// Every cap repair is an actual release; every replacement is a signed player.
export function manageCPURosters({ rosters, freeAgents = [], userTeamId, targetSize = 46, reserveByTeam = {} }) {
    const next = { ...rosters }, transactions = [];
    const occupied = new Set(Object.values(rosters).flat().map(p=>p.id));
    let pool = freeAgents.filter(p => !occupied.has(p.id));
    const released = [];
    for (const [teamId, original] of Object.entries(rosters)) {
        if (teamId === userTeamId) continue;
        let roster = [...original];
        const budget = Math.max(targetSize * MIN_SALARY, 200 - (reserveByTeam[teamId] || 0));
        const release = p => {
            roster = roster.filter(x => x.id !== p.id);
            released.push({ ...p, previousTeamId: teamId, teamId: null });
            transactions.push({ type: 'release', teamId, playerId: p.id, name: p.name, salary: price(p) });
        };
        // Remove excess depth first, keeping position minima intact.
        while (roster.length + missingSlots(roster,targetSize) > ROSTER_LIMIT) {
            const counts = countsOf(roster);
            const candidate = roster.filter(p => counts[p.position] > (POSITION_MINIMUMS[p.position] || 0)).sort((a,b) => a.ovr-b.ovr || price(b)-price(a))[0];
            if (!candidate) break;
            release(candidate);
        }
        // Reserve minimum replacement costs before spending a dollar on FAs.
        while (rosterSalary(roster) + missingSlots(roster,targetSize)*MIN_SALARY > budget + 1e-7) {
            const counts = countsOf(roster);
            const candidates = roster.filter(p => price(p)>MIN_SALARY);
            // Expensive depth goes first. If needed, replace a costly starter
            // with a cheaper player rather than claiming an imaginary pay cut.
            const cost = p => price(p) / Math.max(1,p.ovr-45) * (counts[p.position] > POSITION_MINIMUMS[p.position] ? 2 : 1);
            candidates.sort((a,b) => cost(b)-cost(a));
            if (!candidates.length) throw new Error(`Cannot construct a legal CPU roster for ${teamId}`);
            release(candidates[0]);
        }
        while (missingSlots(roster,targetSize)>0) {
            const counts = countsOf(roster);
            const pos = Object.entries(POSITION_MINIMUMS).find(([key,min]) => (counts[key] || 0)<min)?.[0]
                || Object.keys(ROSTER_COMPOSITION).sort((a,b) => (counts[a] || 0)/ROSTER_COMPOSITION[a] - (counts[b] || 0)/ROSTER_COMPOSITION[b])[0];
            const available = budget-rosterSalary(roster)-(missingSlots(roster,targetSize)-1)*MIN_SALARY;
            const candidates = pool.filter(p=>p.position===pos && price(p)<=available+1e-7).sort((a,b)=>b.ovr-a.ovr || price(a)-price(b));
            let player = candidates[0];
            if (player) pool = pool.filter(p=>p.id!==player.id);
            else player = { ...generatePlayer(pos,55+Math.floor(Math.random()*8)), contract:{salary:MIN_SALARY} };
            const salary=price(player), years=player.age>=30?1:2;
            roster.push({ ...player,teamId,previousTeamId:undefined,draftStatus:undefined,contract:{salary,years,yearsLeft:years} });
            transactions.push({type:'sign',teamId,playerId:player.id,name:player.name,salary});
        }
        next[teamId]=roster;
    }
    // Release pool becomes available after the batch, preventing a team from
    // signing its own just-cut contract as a supposed "cap repair".
    const rosterIds = new Set(Object.values(next).flat().map(p=>p.id));
    const remaining = new Map([...pool,...released].filter(p=>!rosterIds.has(p.id)).map(p=>[p.id,p]));
    return {rosters:next,freeAgents:[...remaining.values()],transactions};
}
