// ── Rarity ladder ───────────────────────────────────────────────────────────
// The collectible-card spine of the UI. An OVR maps to exactly one tier, and
// that tier drives frame, chip and glow everywhere a player is shown.
//
// Replaces the four different OVR_COLOR() ladders that were copy-pasted into
// PlayerCard, Development, Roster and Stats with slightly different cutoffs.

export const RARITY_TIERS = [
  { id: 'legend', min: 94, label: 'Legend', varName: '--rarity-legend' },
  { id: 'elite',  min: 88, label: 'Elite',  varName: '--rarity-elite'  },
  { id: 'gold',   min: 80, label: 'Gold',   varName: '--rarity-gold'   },
  { id: 'silver', min: 70, label: 'Silver', varName: '--rarity-silver' },
  { id: 'bronze', min: 0,  label: 'Bronze', varName: '--rarity-bronze' },
];

/** @returns {{id:string,label:string,color:string,wash:string,min:number}} */
export function getRarity(ovr) {
  const tier = RARITY_TIERS.find(t => (ovr ?? 0) >= t.min) ?? RARITY_TIERS[RARITY_TIERS.length - 1];
  return {
    ...tier,
    color: `var(${tier.varName})`,
    wash: `var(${tier.varName}-wash)`,
  };
}

/** Inline style for a card/chip frame at a given rarity. */
export function rarityFrame(ovr) {
  const { color, wash } = getRarity(ovr);
  return {
    '--r-color': color,
    '--r-wash': wash,
    borderColor: color,
    background: `linear-gradient(160deg, ${wash} 0%, transparent 62%)`,
  };
}

export default getRarity;
