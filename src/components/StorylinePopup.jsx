import { Modal, Button, Badge, PositionTag, RarityChip } from './ui';

// Tone per storyline type. Was six hardcoded colour pairs.
const TONE = {
  DEV_UPGRADE:  { tone: 'positive', eyebrow: 'Development' },
  BREAKOUT:     { tone: 'positive', eyebrow: 'Breakout' },
  INJURY:       { tone: 'negative', eyebrow: 'Injury' },
  FA_SIGNING:   { tone: 'info',     eyebrow: 'Signing' },
  RETIREMENT:   { tone: 'neutral',  eyebrow: 'Retirement' },
  CHAMPIONSHIP: { tone: 'warning',  eyebrow: 'Championship' },
  LOCKER_ROOM:  { tone: 'warning',  eyebrow: 'Locker room' },
};

export default function StorylinePopup({ storyline, onDismiss, onDismissAll, remainingCount = 0 }) {
  if (!storyline) return null;
  const meta = TONE[storyline.type] || TONE.BREAKOUT;

  return (
    <Modal
      open
      onClose={onDismiss}
      size="md"
      eyebrow={meta.eyebrow}
      title={storyline.headline}
      footer={
        <>
          {remainingCount > 0 && onDismissAll && (
            <Button variant="ghost" onClick={onDismissAll}>Skip remaining</Button>
          )}
          <Button variant="primary" onClick={onDismiss}>
            {remainingCount > 0 ? `Next (${remainingCount} more)` : 'Got it'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {storyline.playerName && (
          <div className="flex items-center gap-3 rounded-card bg-surface-sunken px-4 py-3">
            {storyline.icon && <span className="text-h2" aria-hidden="true">{storyline.icon}</span>}
            {storyline.position && <PositionTag position={storyline.position} />}
            <span className="min-w-0 flex-1 truncate text-h3 text-fg">{storyline.playerName}</span>
            {storyline.ovr != null && <RarityChip ovr={storyline.ovr} />}
          </div>
        )}
        {storyline.subtext && (
          <p className="text-body text-fg-secondary">{storyline.subtext}</p>
        )}
        {storyline.severity && <Badge tone={meta.tone}>{storyline.severity}</Badge>}
      </div>
    </Modal>
  );
}
