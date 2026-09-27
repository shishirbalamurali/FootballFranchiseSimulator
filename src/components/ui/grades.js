// One letter-grade scale. There were three separate ladders with three
// different colour sets — DraftPickPopup, GameSummaryModal and the Hub's
// roster grades — so the same "B+" rendered green in one place and blue in
// another.

/** Colour token for a letter grade. */
export function gradeColor(letter) {
  const l = String(letter || '');
  if (l.startsWith('A')) return 'var(--positive-fg)';
  if (l.startsWith('B')) return 'var(--info-fg)';
  if (l.startsWith('C')) return 'var(--warning-fg)';
  return 'var(--negative-fg)';
}

/** Map a 0–100 score onto a letter grade + colour. */
export function scoreToGrade(score) {
  const letter =
    score >= 90 ? 'A+' : score >= 82 ? 'A'  : score >= 74 ? 'B+' :
    score >= 65 ? 'B'  : score >= 55 ? 'C+' : score >= 45 ? 'C'  :
    score >= 35 ? 'D'  : 'F';
  return { letter, color: gradeColor(letter) };
}

/** Map a player OVR onto the draft-grade ladder. */
export function ovrToGrade(ovr) {
  const letter =
    ovr >= 95 ? 'A+' : ovr >= 90 ? 'A'  : ovr >= 85 ? 'B+' :
    ovr >= 80 ? 'B'  : ovr >= 75 ? 'B-' : ovr >= 70 ? 'C+' :
    ovr >= 65 ? 'C'  : 'C-';
  return { letter, color: gradeColor(letter) };
}
