import { useGameStore } from '../store/gameStore';
import { TEAMS } from '../data/teams';
import { TeamCrest, Badge } from './ui';

// 13 headline types collapsed onto four semantic tones instead of 13
// hand-picked background/foreground hex pairs.
const NEWS_TONE = {
  STREAK:        { label: 'Streak',       tone: 'warning'  },
  PERFECT:       { label: 'Undefeated',   tone: 'warning'  },
  HIGH_SCORE:    { label: 'Explosion',    tone: 'warning'  },
  COMEBACK:      { label: 'Comeback',     tone: 'positive' },
  DIVISION_LEAD: { label: 'Division',     tone: 'info'     },
  PLAYOFF:       { label: 'Playoffs',     tone: 'info'     },
  GENERIC:       { label: 'League',       tone: 'neutral'  },
  INJURY:        { label: 'Injury',       tone: 'negative' },
  DEV_UPGRADE:   { label: 'Development',  tone: 'positive' },
  FA_SIGNING:    { label: 'Free agency',  tone: 'info'     },
  RETIREMENT:    { label: 'Retirement',   tone: 'neutral'  },
  BREAKOUT:      { label: 'Breakout',     tone: 'positive' },
  QB_WEEK:       { label: 'Air attack',   tone: 'warning'  },
};

const SEED_ITEM = {
  headline: 'The road to glory begins',
  subtext: 'Who rises to the top this season? Play your first week to find out.',
  type: 'GENERIC',
};

export default function LeagueNewsPanel() {
  const weeklyNews = useGameStore(s => s.weeklyNews) || [];
  const items = weeklyNews.length ? weeklyNews : [SEED_ITEM];

  return (
    <ul>
      {items.map((item, idx) => {
        const meta = NEWS_TONE[item.type] || NEWS_TONE.GENERIC;
        const team = item.teamId ? TEAMS.find(t => t.id === item.teamId) : null;
        return (
          <li
            key={idx}
            className="flex gap-3 border-b border-line-subtle px-4 py-3 last:border-0"
            style={team ? { boxShadow: `inset 3px 0 0 ${team.theme?.primary}` } : undefined}
          >
            {team
              ? <TeamCrest team={team} size="sm" decorative className="mt-0.5" />
              : <span className="mt-0.5 text-h3" aria-hidden="true">{item.icon ?? '🏈'}</span>}
            <div className="min-w-0 flex-1">
              <Badge tone={meta.tone} className="mb-1.5">{meta.label}</Badge>
              <p className="text-label font-semibold leading-snug text-fg">{item.headline}</p>
              {item.subtext && (
                <p className="mt-0.5 text-label leading-relaxed text-fg-muted">{item.subtext}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
