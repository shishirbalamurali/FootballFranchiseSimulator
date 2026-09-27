import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { installTestRandomness } from './helpers/seededRandom.mjs';
installTestRandomness(20260927);
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
    const { createCollegePipeline, updateCollege, nextCollegeYear, collegeDraftClass } = await server.ssrLoadModule('/src/engine/collegePipeline.js');
    const pipeline = createCollegePipeline(2024);
    let weekly = pipeline;
    for (let week = 2; week <= 18; week++) {
        const next = updateCollege(weekly, 2024, week);
        for (let i = 0; i < weekly.length; i++) {
            const before = weekly[i].seasons.find(s => s.year === 2024);
            const after = next[i].seasons.find(s => s.year === 2024);
            assert.ok(after.games >= before.games);
            for (const key of Object.keys(before.stats)) assert.ok(after.stats[key] >= before.stats[key], `${key} cannot erase recorded production`);
        }
        weekly = next;
    }
    assert.deepEqual(weekly, updateCollege(pipeline, 2024, 18), 'weekly and fast-forward produce identical careers');
    assert.deepEqual(updateCollege(weekly, 2024, 99), weekly, 'postseason weeks cannot revise completed college years');
    for (const p of weekly) for (const row of p.seasons) {
        const s = row.stats;
        assert.ok(row.games >= 0 && row.games <= 12);
        assert.ok(Object.values(s).every(v => Number.isFinite(v) && v >= 0));
        if (!row.games) assert.ok(Object.values(s).every(v => v === 0));
        if (p.position === 'QB') { assert.ok(s.CMP <= s.ATT); assert.ok(s.INT <= s.ATT - s.CMP); assert.ok(s.TD <= s.CMP); }
        if (['WR', 'TE'].includes(p.position)) { assert.ok(s.REC <= s.TGT); assert.ok(s.TD <= s.REC); }
        if (p.position === 'K') { assert.ok(s.FGM <= s.FGA); assert.ok(s.XPM <= s.XPA); assert.ok(s.FGM || !s.LONG); }
        if (['DL','LB','CB','S'].includes(p.position)) assert.ok(s.SACKS <= s.TFL && s.TFL <= s.TKL);
    }
    const juniors = weekly.filter(p => p.entryYear === 2024);
    const before = structuredClone(juniors);
    let careers = juniors;
    for (let y = 2025; y <= 2027; y++) careers = updateCollege(careers, y, 18);
    for (let i = 0; i < careers.length; i++) assert.deepEqual(careers[i].seasons[0], before[i].seasons[0], 'later development cannot rewrite freshman year');
    const graduates = collegeDraftClass(careers, 2028);
    for (const p of graduates) assert.equal(p.collegeProfile.seasons.length, 4);
    const oldQB = { ...pipeline.find(p => p.position === 'QB'), seasons: [{ year: 2024, school: 'Test', games: 4, throughWeek: 6, stats: { YDS: 900, TD: 7, INT: 3 } }] };
    const migrated = updateCollege([oldQB], 2024, 12)[0].seasons.at(-1);
    assert.ok(migrated.stats.YDS >= 900);
    assert.equal(migrated.stats.ATT, undefined, 'old seasons must not mix partial attempt counts with complete yardage');
    const next = nextCollegeYear(weekly, 2025);
    assert.deepEqual(nextCollegeYear(next, 2025), next, 'repeated rollover does not create duplicate incoming recruits');
    assert.equal(new Set(next.map(p => p.id)).size, next.length);
    const qbs = weekly.filter(p => p.position === 'QB').map(p => p.seasons.at(-1).stats.ATT);
    assert.ok(new Set(qbs).size > qbs.length / 2, 'prospects have distinct opportunity, form, and weekly outcomes');
    console.log('PASS: college statistical identities, monotonic weekly totals, fast-forward equivalence, career preservation, distinct opportunity, and idempotent cohorts.');
} finally { await server.close(); }
