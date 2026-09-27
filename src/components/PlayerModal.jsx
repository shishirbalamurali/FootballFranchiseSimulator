import { useState } from 'react';
import { TEAMS } from '../data/teams';
import { useGameStore } from '../store/gameStore';
import { characterFor, personalityView, moodFor, teamContext, contractStance } from '../engine/character';
import PlayerFace from './PlayerFace';
import {
  Modal, Tabs, Button, Badge, TeamCrest, PositionTag, RarityChip,
  Stat, StatRow, EmptyState, getRarity, cx,
} from './ui';

const TONE_BADGE = { good: 'positive', bad: 'negative', mixed: 'warning' };
const TONE_BORDER = { good: 'border-positive-border', bad: 'border-negative-border', mixed: 'border-warning-border' };

const prettify = (k) => k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();

function AttributeBar({ label, value, color, editable, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    const n = Math.max(0, Math.min(99, Number(draft)));
    if (!Number.isNaN(n) && n !== value) onCommit(n);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-label text-fg-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full rounded-full transition-[width] duration-base"
             style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      {editing ? (
        <input
          autoFocus
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setDraft(value); setEditing(false); }
          }}
          aria-label={`${label} rating`}
          className="w-12 rounded-chip border border-team bg-surface-sunken px-1 py-0.5 text-right text-label tabular-nums text-fg"
        />
      ) : (
        <button
          type="button"
          disabled={!editable}
          onClick={() => { setDraft(value); setEditing(true); }}
          className={cx(
            'w-12 shrink-0 rounded-chip px-1 py-0.5 text-right text-label tabular-nums text-fg-secondary',
            editable && 'hover:bg-surface-hover hover:text-fg',
          )}
          title={editable ? `Edit ${label}` : undefined}
        >
          {value}
        </button>
      )}
    </div>
  );
}

function AxisBar({ label, low, high, value }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-label font-semibold text-fg">{label}</span>
        <span className="text-label tabular-nums text-fg-muted">{value}</span>
      </div>
      <div className="relative h-2 rounded-full bg-surface-sunken">
        <div className="absolute inset-y-0 left-0 rounded-full bg-team transition-[width] duration-slow"
             style={{ width: `${value}%` }} />
        <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-surface-raised"
              style={{ left: `${value}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-micro uppercase text-fg-faint">
        <span>{low}</span><span>{high}</span>
      </div>
    </div>
  );
}

function MoodSection({ mood, stance }) {
  return (
    <section>
      <h3 className="mb-2.5 text-micro uppercase text-fg-faint">Mood</h3>
      <div className="rounded-card bg-surface-sunken px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-h2 leading-none" aria-hidden="true">{mood.icon}</span>
          <span className="font-display text-h3 uppercase text-fg">{mood.label}</span>
          <span className="ml-auto text-label tabular-nums text-fg-muted">{mood.score}/100</span>
        </div>
        {mood.reasons.length ? (
          <ul className="flex flex-col gap-1">
            {mood.reasons.map(r => (
              <li key={r.text} className="flex items-center gap-2 text-label">
                <span className={cx('w-9 shrink-0 text-right font-semibold tabular-nums', r.delta > 0 ? 'text-positive-fg' : 'text-negative-fg')}>
                  {r.delta > 0 ? '+' : ''}{r.delta}
                </span>
                <span className="text-fg-secondary">{r.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-label text-fg-muted">Nothing on his mind right now.</p>
        )}
        {stance && (
          <p className={cx('mt-3 border-t border-line-subtle pt-2.5 text-label', stance.willing ? 'text-fg-secondary' : 'text-negative-fg')}>
            {stance.willing
              ? <>Extension ask: <strong className="tabular-nums text-fg">${stance.ask}M</strong>/yr{stance.notes.length ? ` · ${stance.notes.join(' · ')}` : ''}</>
              : stance.refusal}
          </p>
        )}
      </div>
    </section>
  );
}

function CharacterTab({ player, view, character, mood, stance }) {
  return (
    <div className="flex flex-col gap-5">
      {mood && <MoodSection mood={mood} stance={stance} />}
      <section>
        <h3 className="mb-2.5 text-micro uppercase text-fg-faint">Personality traits</h3>
        {view.traits.length === 0 && view.hiddenTraits === 0 ? (
          <p className="rounded-card bg-surface-sunken px-4 py-3 text-label text-fg-muted">
            Even-keeled. No strong personality traits — he won't make headlines, good or bad.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {view.traits.map(t => (
              <div key={t.id} className={cx('flex gap-3 rounded-card border-2 bg-surface-raised px-3.5 py-3', TONE_BORDER[t.tone])}>
                <span className="text-h2 leading-none" aria-hidden="true">{t.icon}</span>
                <div className="min-w-0">
                  <p className="font-display text-h3 uppercase leading-tight text-fg">{t.label}</p>
                  <p className="text-label text-fg-muted">{t.effect}</p>
                </div>
              </div>
            ))}
            {view.hiddenTraits > 0 && (
              <div className="flex items-center gap-3 rounded-card border-2 border-dashed border-line px-3.5 py-3">
                <span className="text-h2 leading-none" aria-hidden="true">🔒</span>
                <p className="text-label text-fg-muted">
                  {view.hiddenTraits === 1 ? 'A trait' : `${view.hiddenTraits} traits`} not yet known. Scout him to find out.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2.5 text-micro uppercase text-fg-faint">Makeup</h3>
        {view.axes ? (
          <div className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
            {view.axes.map(a => <AxisBar key={a.id} {...a} />)}
          </div>
        ) : (
          <EmptyState size="sm" icon="🔍" title="Personality unknown"
                      body="Only his public reputation is known. You see your own players' full makeup; scouting reveals everyone else's." />
        )}
      </section>

      <section>
        <h3 className="mb-2.5 text-micro uppercase text-fg-faint">Bio</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
          {[
            ['Hometown', character.hometown],
            ['College', character.college],
            ['Build', `${character.height} · ${character.weightLb} lb`],
            ['Experience', player.experience ? `${player.experience} yr${player.experience === 1 ? '' : 's'}` : 'Rookie'],
            ['Throws', player.handedness ?? 'Right'],
            ['Rating path', (player.ovrHistory || [player.ovr]).slice(-5).join(' → ')],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-micro uppercase text-fg-faint">{k}</dt>
              <dd className="truncate text-label text-fg">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

export default function PlayerModal({ player, teamId, onClose }) {
  const [activeTab, setActiveTab] = useState('character');
  const [editMode, setEditMode] = useState(false);

  const setPlayerOvr = useGameStore(s => s.setPlayerOvr);
  const setPlayerAttr = useGameStore(s => s.setPlayerAttr);
  const userTeamId = useGameStore(s => s.userTeamId);
  const rosters = useGameStore(s => s.rosters);
  const standings = useGameStore(s => s.standings);

  const livePlayer = useGameStore(s => {
    const tid = teamId || player?.teamId;
    if (!tid) return player;
    return s.rosters[tid]?.find(p => p.id === player.id) || player;
  });

  if (!player) return null;

  const { universal, position: positionSpecific } = livePlayer.attributes || player.attributes || {};
  const displayTeamId = teamId || player.teamId || 'FA';
  const team = TEAMS.find(t => t.id === displayTeamId);
  const canEdit = displayTeamId !== 'FA';
  const rarity = getRarity(livePlayer.ovr);
  const character = characterFor(livePlayer);
  const own = displayTeamId === userTeamId;
  const view = personalityView(livePlayer, { own });
  // Mood needs his team's situation; free agents have none, so no reasons.
  const ctx = displayTeamId !== 'FA' && rosters[displayTeamId] ? teamContext({ rosters, standings }, displayTeamId) : null;
  const mood = moodFor(livePlayer, ctx);
  const stance = own && ctx ? contractStance(livePlayer, ctx) : null;

  const ovrChange = livePlayer.ovrHistory?.length > 1
    ? livePlayer.ovr - livePlayer.ovrHistory[livePlayer.ovrHistory.length - 2]
    : 0;

  const groups = [
    { name: 'Position skills', category: 'position', attrs: positionSpecific },
    { name: 'Physical & mental', category: 'universal', attrs: universal },
  ].filter(g => g.attrs && Object.keys(g.attrs).length);

  const season = livePlayer.stats?.season;
  const career = livePlayer.stats?.career;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      eyebrow={team ? `${team.location} ${team.name}` : 'Free agent'}
      title={livePlayer.name}
      footer={
        canEdit ? (
          <>
            <Button variant="ghost" onClick={() => setEditMode(e => !e)}>
              {editMode ? 'Done editing' : 'Edit ratings'}
            </Button>
            <Button variant="primary" onClick={onClose}>Close</Button>
          </>
        ) : (
          <Button variant="primary" onClick={onClose}>Close</Button>
        )
      }
    >
      {/* ── Identity: who he is before what he's rated ── */}
      <div
        className="mb-5 flex items-stretch gap-4 rounded-panel px-4 py-4"
        style={{ background: `linear-gradient(135deg, ${rarity.wash}, transparent 68%)` }}
      >
        <PlayerFace player={livePlayer} teamId={displayTeamId} size={112} variant="portrait" lazy={false}
                    label={`${livePlayer.name}, ${livePlayer.position}`} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-h2 leading-none tabular-nums text-fg-muted">#{character.number}</span>
            <PositionTag position={livePlayer.position} />
            <span className="text-label text-fg-muted">{livePlayer.archetype}</span>
            {livePlayer.devTrait && livePlayer.devTrait !== 'Normal' && (
              <Badge tone={livePlayer.devTrait === 'Superstar' ? 'positive' : 'warning'}>
                {livePlayer.devTrait}
              </Badge>
            )}
          </div>
          <p className="truncate text-label text-fg-secondary">
            {character.height} · {character.weightLb} lb · Age {livePlayer.age} · {character.hometown} · {character.college}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={TONE_BADGE[mood.tone]}>{mood.icon} {mood.label}</Badge>
            {view.traits.map(t => (
              <Badge key={t.id} tone={TONE_BADGE[t.tone]} title={t.effect}>{t.icon} {t.label}</Badge>
            ))}
            {view.hiddenTraits > 0 && <Badge tone="neutral">🔒 +{view.hiddenTraits} unknown</Badge>}
          </div>
          <p className="line-clamp-1 text-label italic text-fg-muted">{character.quote}</p>
          <StatRow className="mt-auto gap-6">
            <Stat size="sm" value={livePlayer.pot ?? livePlayer.ovr} label="Potential" />
            <Stat size="sm" value={`$${livePlayer.contract?.salary ?? livePlayer.salary ?? 2}M`} label="Cap hit" />
            <Stat size="sm" value={`${livePlayer.contract?.yearsLeft ?? 1}yr`} label="Remaining" />
          </StatRow>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-between text-right">
          <div>
            <p className="font-display text-display leading-none tabular-nums" style={{ color: rarity.color }}>
              {livePlayer.ovr}
            </p>
            <div className="mt-1 flex items-center justify-end gap-1.5">
              <RarityChip ovr={livePlayer.ovr} showOvr={false} />
              {ovrChange !== 0 && (
                <span className={cx('text-micro tabular-nums', ovrChange > 0 ? 'text-positive-fg' : 'text-negative-fg')}>
                  {ovrChange > 0 ? '▲' : '▼'}{Math.abs(ovrChange)}
                </span>
              )}
            </div>
          </div>
          {team && <TeamCrest team={team} size="md" decorative />}
        </div>
      </div>

      <Tabs
        className="mb-4"
        value={activeTab}
        onChange={setActiveTab}
        label="Player details"
        items={[
          { id: 'character', label: 'Character' },
          { id: 'attributes', label: 'Attributes' },
          { id: 'stats', label: 'Statistics' },
        ]}
      />

      {activeTab === 'character' && (
        <CharacterTab player={livePlayer} view={view} character={character} mood={own ? mood : null} stance={stance} />
      )}

      {activeTab === 'attributes' && (
        <div className="flex flex-col gap-5">
          {editMode && (
            <p className="rounded-card bg-warning-bg px-3 py-2 text-label text-warning-fg">
              Editing is on — click any number to change it.
            </p>
          )}
          {groups.map(({ name, category, attrs }) => (
            <section key={name}>
              <h3 className="mb-2.5 text-micro uppercase text-fg-faint">{name}</h3>
              <div className="flex flex-col gap-2">
                {Object.entries(attrs)
                  .filter(([, v]) => v != null)
                  .sort(([, a], [, b]) => b - a)
                  .map(([key, value]) => (
                    <AttributeBar
                      key={key}
                      label={prettify(key)}
                      value={value}
                      color={getRarity(value).color}
                      editable={canEdit && editMode}
                      onCommit={(n) => setPlayerAttr(displayTeamId, livePlayer.id, category, key, n)}
                    />
                  ))}
              </div>
            </section>
          ))}
          {canEdit && editMode && (
            <label className="flex items-center gap-3 border-t border-line-subtle pt-4">
              <span className="text-label text-fg-secondary">Overall rating</span>
              <input
                type="number"
                defaultValue={livePlayer.ovr}
                onBlur={e => setPlayerOvr(displayTeamId, livePlayer.id, Math.max(0, Math.min(99, Number(e.target.value))))}
                className="w-16 rounded-chip border border-team bg-surface-sunken px-2 py-1 text-right text-label tabular-nums text-fg"
              />
            </label>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        season || career ? (
          <div className="flex flex-col gap-5">
            {season && (
              <section>
                <h3 className="mb-2.5 text-micro uppercase text-fg-faint">This season</h3>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {Object.entries(season)
                    .filter(([, v]) => typeof v === 'number' && v !== 0)
                    .map(([k, v]) => <Stat key={k} size="sm" value={v} label={prettify(k)} />)}
                </div>
              </section>
            )}
            {career && (
              <section>
                <h3 className="mb-2.5 text-micro uppercase text-fg-faint">Career</h3>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {Object.entries(career)
                    .filter(([, v]) => typeof v === 'number' && v !== 0)
                    .map(([k, v]) => <Stat key={k} size="sm" value={v} label={prettify(k)} />)}
                </div>
              </section>
            )}
          </div>
        ) : (
          <EmptyState icon="📊" title="No statistics yet"
                      body="Stats appear once this player has featured in a game." />
        )
      )}
    </Modal>
  );
}
