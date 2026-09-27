// Test-only RNG: production randomness stays untouched. Each test script runs
// in its own process. Override TEST_SEED to reproduce/explore another case.
export function createSeededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}
export function installTestRandomness(defaultSeed) {
    const seed = Number(process.env.TEST_SEED ?? defaultSeed);
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) throw new Error('TEST_SEED must be an integer between 0 and 4294967295.');
    const original = Math.random;
    Math.random = createSeededRandom(seed);
    const restore = () => { Math.random = original; };
    process.once('exit', restore);
    console.log(`Test RNG seed: ${seed} (override with TEST_SEED)`);
    return { seed, restore };
}
export function shuffled(values) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
