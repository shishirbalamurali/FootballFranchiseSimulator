import { generateDraftClass, generateScoutReport } from './draft';
import { generatePlayer, devTraitForPotential } from './player';
import { collegeProfile } from './draftExperience';
import { collegeProduction, collegeSeasonArc } from './collegeProduction';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
function hash(value) { let n = 0; for (const c of value) n = (n * 31 + c.charCodeAt(0)) >>> 0; return n; }
export const collegeTier = ceiling => ceiling >= 97 ? 'Generational' : ceiling >= 90 ? 'Elite' : ceiling >= 80 ? 'Good' : 'Normal';
function cohort(draftYear) {
    return generateDraftClass(draftYear).map((p, i) => {
        const rare = Math.random() < 0.002;
        const ceiling = rare ? 98 : Math.min(96, p.pot);
        return { id: `college-${draftYear}-${i}`, name: p.name, position: p.position,
            school: p.college, entryYear: draftYear - 4, draftYear, ceiling,
            readyOvr: rare ? 81 : p.ovr, tier: collegeTier(ceiling), seasons: [],
            arc: ['Late bloomer', 'Hometown recruit', 'Film-room student', 'Under the spotlight'][i % 4],
            events: [{ year: draftYear - 4, week: 1, text: `Arrived at ${p.college} as ${collegeTier(ceiling) === 'Elite' ? 'an' : 'a'} ${collegeTier(ceiling).toLowerCase()} recruiting prospect. A projection, not a guarantee.` }] };
    });
}
export function updateCollege(pipeline, year, week) {
    week = clamp(Math.floor(week), 0, 18);
    return pipeline.map(p => {
        if (year < p.entryYear || year >= p.draftYear) return p;
        const previous = p.seasons.find(s => s.year === year);
        const row = collegeProduction(p, year, week, previous);
        if (previous && (previous.throughWeek || 0) >= week) return p;
        const events = [...p.events];
        let readyOvr = p.readyOvr;
        const arc = collegeSeasonArc(p, year);
        if (week >= 12 && !events.some(e => e.year === year && e.week === 12)) {
            const text = arc === 0 ? `Missed two games with an ankle injury at ${p.school}. Evaluators want to see his recovery.` : arc <= 2 ? `Won a larger role at ${p.school}; his development is outpacing expectations.` : arc === 3 ? `Struggled with consistency at ${p.school}; scouts are lowering his readiness projection.` : `Built another season of film at ${p.school}; ${year === p.draftYear - 1 ? 'the final college audition is underway.' : 'evaluators want to see the next step.'}`;
            events.push({ year, week: 12, text });
        }
        if (week >= 18 && !events.some(e => e.year === year && e.week === 18)) {
            readyOvr = clamp(p.readyOvr + (arc <= 2 && arc > 0 ? 2 : arc === 0 || arc === 3 ? -2 : 0), 40, Math.min(85, p.ceiling));
            events.push({ year, week: 18, text: year === p.draftYear - 1 ? 'College career complete. Entering the professional draft with four seasons of film.' : 'Returning to campus for another season of development.' });
        }
        return { ...p, readyOvr, seasons: [...p.seasons.filter(s => s.year !== year), row], events };
    });
}
export function createCollegePipeline(year) {
    let pipeline = [1,2,3,4].flatMap(offset => cohort(year + offset));
    for (let y = year - 3; y < year; y++) pipeline = updateCollege(pipeline, y, 18);
    return updateCollege(pipeline, year, 1);
}
export function nextCollegeYear(pipeline, year) {
    const remaining = pipeline.filter(p => p.draftYear > year);
    const incoming = remaining.some(p => p.draftYear === year + 4) ? [] : cohort(year + 4);
    return updateCollege([...remaining, ...incoming], year, 1);
}
export function collegeDraftClass(pipeline, draftYear) {
    const prospects = pipeline.filter(p => p.draftYear === draftYear).map(p => {
        const variation = hash(`${p.id}-development`) % 5 - 2;
        const player = generatePlayer(p.position, clamp(p.readyOvr + variation, 40, 85), 22);
        const profile = collegeProfile(player, draftYear, hash(p.id));
        return { ...player, id: p.id, collegeId: p.id, name: p.name, pot: Math.max(player.ovr, p.ceiling), devTrait: devTraitForPotential(p.ceiling),
            college: p.school, collegeRecruitTier: p.tier, collegeStory: p.events,
            collegeProfile: { ...profile, school: p.school, seasons: p.seasons.map(({ year, games, stats }) => ({ year, games, ...stats })), headline: p.arc, story: p.events.map(e => `${e.year}: ${e.text}`).join(' ') },
            experience: 0, contract: null, draftStatus: 'available',
            grade: Math.round(player.ovr * .45 + p.ceiling * .55), scoutReport: generateScoutReport(player),
            combineSpeed: Math.max(4.25, 5.5 - (player.attributes?.universal?.speed || 60) * .012).toFixed(2),
            combineVert: Math.round(20 + (player.attributes?.universal?.acceleration || 60) * .18),
            combineStrength: Math.round(8 + (player.attributes?.universal?.strength || 60) * .25) };
    });
    return prospects.sort((a,b) => b.grade-a.grade).map((p,i) => ({ ...p, draftRank: i+1 }));
}
