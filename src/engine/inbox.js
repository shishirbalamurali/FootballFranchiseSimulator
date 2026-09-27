// Front-office phone (Claude-owned): one queue for everything that wants the
// user's attention. Pure helpers; the store resolves actions by `kind`.

export const INBOX_MAX = 40;
export const KINDS = {
    trade: { icon: '📞', label: 'Trade call' },
    poach: { icon: '🎓', label: 'Coaching' },
    tradeRequest: { icon: '🧳', label: 'Trade request' },
    holdout: { icon: '✋', label: 'Holdout' },
    xfactor: { icon: '⚡', label: 'X-Factor' },
    scout: { icon: '🔭', label: 'Scouting' },
    college: { icon: '🏈', label: 'Saturdays' },
    camp: { icon: '🔍', label: 'Camp' },
    deadline: { icon: '⏰', label: 'Deadline' },
    agent: { icon: '💼', label: 'Agent' },
    news: { icon: '📰', label: 'League' },
};

let counter = 0;
export function makeItem(kind, fields, { year, week }) {
    counter = (counter + 1) % 1e6;
    return { id: `${kind}-${year}-${week}-${Date.now().toString(36)}-${counter}`, kind, priority: 2, created: { year, week }, actions: [], ...fields };
}

/** Add items, dropping expired ones and duplicates by `key`. Newest first. */
export function pushItems(inbox = [], items = [], { year, week, phase } = {}) {
    const keys = new Set(items.map(i => i.key).filter(Boolean));
    const alive = inbox.filter(i => !(i.key && keys.has(i.key)) && !isExpired(i, { year, week, phase }));
    return [...items, ...alive].slice(0, INBOX_MAX);
}

export function isExpired(item, { year, week, phase }) {
    const e = item.expires;
    if (!e) return false;
    if (e.phase && phase && e.phase !== phase) return true;
    if (e.year != null && year > e.year) return true;
    return e.year === year && e.week != null && week > e.week && (!e.phase || e.phase === phase);
}

export const removeItem = (inbox = [], id) => inbox.filter(i => i.id !== id);
export const openItems = (inbox = []) => inbox.filter(i => !i.resolved);
export const needsDecision = (inbox = []) => openItems(inbox).filter(i => i.actions?.length).sort((a, b) => a.priority - b.priority);
