import { useRef, useState } from 'react';
import { buildRostersFromCSV, getCSVPreviewStats } from '../engine/csvRosterImport';
import { TEAMS } from '../data/teams';
import {
  Card, CardHeader, CardBody, Button, Badge, Stat, TeamCrest,
  RarityChip, PositionTag, EmptyState, IconArrowRight,
} from './ui';

export default function ModeSelectScreen({ onModeSelected }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState('select'); // select | parsing | preview | error
  const [preview, setPreview] = useState(null);
  const [parsedRosters, setParsedRosters] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStep('parsing');

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const stats = getCSVPreviewStats(text);
        if (stats.teamsFound < 20) {
          setErrorMsg(`Only ${stats.teamsFound} teams were found in that file. It needs to be the full Madden 26 ratings export.`);
          setStep('error');
          return;
        }
        setPreview(stats);
        setParsedRosters(buildRostersFromCSV(text));
        setStep('preview');
      } catch (err) {
        setErrorMsg(`That file could not be read as a ratings CSV. ${err.message}`);
        setStep('error');
      }
    };
    reader.onerror = () => { setErrorMsg('The file could not be read. Try again.'); setStep('error'); };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-12">
      <div
        aria-hidden="true"
        className="toon-rays pointer-events-none absolute left-1/2 top-0 size-[140vmax] -translate-x-1/2 -translate-y-1/2 animate-[spin_120s_linear_infinite] text-team"
      />

      <div className="relative mb-10 text-center">
        <h1 className="toon-title font-display text-[clamp(52px,8vw,96px)] uppercase leading-none text-team-accent">
          Gridiron
        </h1>
        <p className="mt-3 inline-block -rotate-1 rounded-full bg-ink px-4 py-1 font-display text-h3 uppercase tracking-[0.2em] text-nav-fg">Franchise Simulator</p>
      </div>

      {/* ── Choose a roster source ── */}
      {step === 'select' && (
        <div className="relative w-full max-w-3xl animate-fade-up">
          <div className="mb-6 text-center">
            <h2 className="font-display text-display uppercase text-fg">How should the league be built?</h2>
            <p className="mt-1 text-body text-fg-muted">You can change this later by starting a new save.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onModeSelected('generated', null)}
              className="toon-lift group flex flex-col gap-3 rounded-panel bg-surface-raised p-6 text-left shadow-1"
            >
              <span className="grid size-14 place-items-center rounded-full bg-team-accent text-h1 shadow-1 transition-transform duration-base ease-bounce group-hover:-rotate-12 group-hover:scale-110" aria-hidden="true">🎲</span>
              <span className="font-display text-h1 uppercase text-fg">Generated rosters</span>
              <span className="text-body text-fg-muted">
                Procedurally generated players with balanced league-wide talent. A clean, fictional world to build in.
              </span>
              <span className="mt-auto flex items-center gap-1.5 pt-2 text-label font-bold text-team-ink">
                Start classic mode <IconArrowRight size={14} />
              </span>
            </button>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="toon-lift group flex flex-col gap-3 rounded-panel bg-surface-raised p-6 text-left shadow-1"
            >
              <span className="grid size-14 place-items-center rounded-full bg-team-accent text-h1 shadow-1 transition-transform duration-base ease-bounce group-hover:-rotate-12 group-hover:scale-110" aria-hidden="true">🏈</span>
              <span className="flex items-center gap-2 font-display text-h1 uppercase text-fg">
                Imported rosters <Badge tone="info">CSV</Badge>
              </span>
              <span className="text-body text-fg-muted">
                Load a Madden 26 ratings export to play with real players and accurate attribute ratings.
              </span>
              <span className="mt-auto flex items-center gap-1.5 pt-2 text-label font-bold text-team-ink">
                Upload a CSV <IconArrowRight size={14} />
              </span>
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload a ratings CSV"
          />
        </div>
      )}

      {/* ── Parsing ── */}
      {step === 'parsing' && (
        <Card className="relative w-full max-w-md animate-fade-up">
          <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="size-8 animate-spin rounded-full border-4 border-team border-r-transparent" />
            <p className="text-h3 text-fg">Reading your ratings file</p>
            <p className="text-label text-fg-muted">Building 32 rosters…</p>
          </CardBody>
        </Card>
      )}

      {/* ── Preview ── */}
      {step === 'preview' && preview && (
        <div className="relative w-full max-w-2xl animate-fade-up">
          <Card className="mb-4">
            <CardBody className="flex flex-wrap items-center gap-8">
              <Stat value={preview.totalPlayers.toLocaleString()} label="Players" size="sm" />
              <Stat value={preview.teamsFound} label="Teams found" size="sm" />
              <Badge tone="positive">Valid ratings file</Badge>
              <span className="ml-auto text-micro uppercase text-fg-faint">Madden 26 export</span>
            </CardBody>
          </Card>

          <Card className="mb-4">
            <CardHeader title="Top rated players" eyebrow="A sample of what was imported" />
            <ul>
              {preview.topPlayers.map((p, i) => (
                <li key={i} className="flex items-center gap-3 border-b border-line-subtle px-4 py-2.5 last:border-0">
                  <span className="w-4 shrink-0 text-label tabular-nums text-fg-faint">{i + 1}</span>
                  <TeamCrest teamId={p.teamId} size="xs" decorative />
                  <PositionTag position={p.position} />
                  <span className="min-w-0 flex-1 truncate text-label font-semibold text-fg">{p.name}</span>
                  <RarityChip ovr={p.ovr} />
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => { setStep('select'); setParsedRosters(null); setPreview(null); }}>
              Back
            </Button>
            <Button
              variant="primary" size="lg" className="flex-1"
              iconRight={<IconArrowRight size={16} />}
              onClick={() => onModeSelected('csv', parsedRosters)}
            >
              Use these rosters
            </Button>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {step === 'error' && (
        <Card className="relative w-full max-w-md animate-fade-up">
          <EmptyState
            icon="⚠"
            title="That import did not work"
            body={errorMsg}
          />
          <div className="flex justify-center gap-3 border-t border-line-subtle px-4 py-4">
            <Button variant="ghost" onClick={() => setStep('select')}>Back</Button>
            <Button variant="primary" onClick={() => { setStep('select'); fileRef.current?.click(); }}>
              Try another file
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
