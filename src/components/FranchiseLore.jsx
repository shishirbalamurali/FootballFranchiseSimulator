import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardBody, Badge, PositionTag, cx } from './ui';
import { loreFor, cultureFor, franchiseHistory } from '../engine/franchiseLore';

/** Title years as small trophies; titles won in this save glow. */
function TitleShelf({ titles, saveTitles = [], max = 14 }) {
  if (!titles.length) {
    return <p className="font-editorial text-label italic text-fg-muted">Still waiting on the first one.</p>;
  }
  const shown = titles.slice(-max);
  return (
    <ul className="flex flex-wrap gap-1.5">
      {titles.length > max && (
        <li className="rounded-chip bg-surface-sunken px-2 py-1 text-micro text-fg-faint">+{titles.length - max} earlier</li>
      )}
      {shown.map((y, i) => {
        const mine = saveTitles.includes(y);
        return (
          <motion.li
            key={`${y}-${i}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className={cx(
              'flex items-center gap-1 rounded-chip px-2 py-1 text-micro tabular-nums',
              mine ? 'bg-team text-team-on shadow-[0_0_0_2px_var(--ink)]' : 'bg-warning-bg text-warning-fg',
            )}
            title={mine ? 'Won under you' : undefined}
          >
            <span aria-hidden="true">🏆</span>{y}
          </motion.li>
        );
      })}
    </ul>
  );
}

/** Compact version for the team-select detail pane. */
export function FranchiseLoreSummary({ teamId }) {
  const lore = loreFor(teamId);
  const culture = cultureFor(teamId);
  if (!lore) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-h2" aria-hidden="true">{culture.icon}</span>
        <div className="min-w-0">
          <p className="text-micro uppercase text-fg-faint">Culture</p>
          <p className="font-headline text-h2 font-black uppercase leading-none text-fg">{culture.label}</p>
        </div>
        <span className="ml-auto text-right text-micro uppercase leading-tight text-fg-faint">
          Est. {lore.founded}<br />{lore.titles.length} title{lore.titles.length === 1 ? '' : 's'}
        </span>
      </div>
      <p className="font-editorial text-label leading-relaxed text-fg-secondary">{lore.origin}</p>
    </div>
  );
}

/** Full culture + history card. */
export default function FranchiseLoreCard({ teamId, seasonHistory = [], className = '' }) {
  const lore = loreFor(teamId);
  const culture = cultureFor(teamId);
  const history = useMemo(() => franchiseHistory(teamId, seasonHistory), [teamId, seasonHistory]);
  if (!lore) return null;

  return (
    <Card className={className}>
      <CardHeader title="Franchise history" />
      <CardBody className="flex flex-col gap-5">
        <p className="-mb-2 text-micro uppercase tracking-[0.08em] text-fg-faint">
          Est. {lore.founded} · {lore.stadium} · Fans: {lore.fans}
        </p>
        {/* Culture */}
        <div className="flex items-start gap-3 rounded-card bg-team-8 p-4">
          <span className="text-[32px] leading-none" aria-hidden="true">{culture.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-micro uppercase tracking-[0.12em] text-fg-faint">Team culture</p>
            <p className="font-headline text-h1 font-black uppercase leading-none text-fg">{culture.label}</p>
            <p className="mt-1 text-label text-fg-secondary">{culture.blurb}</p>
            <p className="mt-2 text-micro text-fg-faint">Your story-event decisions are judged against this culture.</p>
          </div>
        </div>

        <p className="font-editorial text-[16px] leading-relaxed text-fg">{lore.origin}</p>

        {/* Titles */}
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="font-headline text-h3 font-black uppercase tracking-[0.08em] text-fg-muted">Championships · {history.titles.length}</p>
            <span className="text-micro uppercase text-fg-faint">
              {history.neverWon ? `${history.drought} years without a title` : history.drought > 0 ? `Last: ${history.lastTitle} · ${history.drought}-yr drought` : `Reigning champions`}
            </span>
          </div>
          <TitleShelf titles={history.titles} saveTitles={history.saveTitles} />
          {(history.saveTitles.length > 0 || history.playoffs > 0) && (
            <p className="mt-2 text-micro text-fg-muted">
              Under you: {history.saveTitles.length} title{history.saveTitles.length === 1 ? '' : 's'}
              {history.saveFinals.length > 0 && `, ${history.saveFinals.length} title-game loss${history.saveFinals.length === 1 ? '' : 'es'}`}
              , {history.playoffs} playoff trip{history.playoffs === 1 ? '' : 's'}
            </p>
          )}
        </div>

        {/* Eras timeline */}
        <div>
          <p className="mb-2 font-headline text-h3 font-black uppercase tracking-[0.08em] text-fg-muted">Eras</p>
          <ol className="relative flex flex-col gap-2 border-l-2 border-line pl-4">
            {lore.eras.map(era => (
              <li key={era.span} className="relative">
                <span aria-hidden="true" className="absolute -left-[22px] top-1.5 size-2.5 rounded-full bg-team shadow-[0_0_0_2px_var(--ink)]" />
                <span className="text-micro tabular-nums text-fg-faint">{era.span}</span>
                <p className="text-label font-bold text-fg">{era.name}</p>
              </li>
            ))}
            {history.saveTitles.length + history.playoffs > 0 && (
              <li className="relative">
                <span aria-hidden="true" className="absolute -left-[22px] top-1.5 size-2.5 animate-pulse rounded-full bg-team-accent shadow-[0_0_0_2px_var(--ink)]" />
                <span className="text-micro tabular-nums text-fg-faint">{seasonHistory[0]?.year ?? 2024}–now</span>
                <p className="text-label font-bold text-fg">Your era</p>
              </li>
            )}
          </ol>
        </div>

        {/* Legends */}
        <div>
          <p className="mb-2 font-headline text-h3 font-black uppercase tracking-[0.08em] text-fg-muted">Ring of honor</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {lore.legends.map(l => (
              <li key={l.name} className="flex items-start gap-2.5 rounded-card bg-surface-sunken px-3 py-2.5">
                {['HC', 'GM'].includes(l.position)
                  ? <Badge tone="solid">{l.position}</Badge>
                  : <PositionTag position={l.position.split('/')[0]} />}
                <div className="min-w-0">
                  <p className="text-label font-bold text-fg">{l.name}</p>
                  <p className="text-micro text-fg-muted">{l.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="flex items-start gap-2 rounded-card border-2 border-dashed border-line px-3 py-2 text-label text-fg-secondary">
          <span aria-hidden="true">📣</span>
          <span><b className="text-fg">Game-day tradition:</b> {lore.tradition}</span>
        </p>
      </CardBody>
    </Card>
  );
}
