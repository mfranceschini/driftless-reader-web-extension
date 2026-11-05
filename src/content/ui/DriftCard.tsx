import { formatDuration, lastSentence } from '@/src/lib/recap';
import type { DriftCardState } from './useDriftGuard';

interface DriftCardProps {
  card: DriftCardState;
  onRewind(): void;
  onDismiss(): void;
  onMuteSkimming(): void;
}

/** The gentle "welcome back" / "skimming?" card. Calm by design: no sounds, no red. */
export function DriftCard({ card, onRewind, onDismiss, onMuteSkimming }: DriftCardProps) {
  const { recap } = card;
  const isHeading = recap.section !== null && recap.text.trim() === recap.section;
  const quote = isHeading ? null : lastSentence(recap.text);

  const title =
    card.kind === 'skimming'
      ? 'Skimming ahead?'
      : card.reason === 'away'
        ? `Welcome back — you were away ${formatDuration(card.awayMs)}`
        : 'Welcome back';

  const lead =
    card.kind === 'skimming'
      ? 'Your anchor is still where you last read:'
      : isHeading
        ? 'You were just starting:'
        : 'The last thing you read:';

  return (
    <div className="card drift" role="dialog" aria-live="polite" aria-label="Drift Guard">
      <p className="card-title">{title}</p>
      <p className="card-body">{lead}</p>
      {recap.section && !isHeading && <p className="drift-section">{recap.section}</p>}
      {quote ? (
        <blockquote className="drift-quote">{quote}</blockquote>
      ) : (
        <p className="drift-section">{recap.section}</p>
      )}
      <div className="card-actions">
        {/* No autoFocus: the card can appear while you're pressing Space to
            move through chunks, and must not turn that press into "Rewind". */}
        <button type="button" className="btn primary" onClick={onRewind}>
          {card.kind === 'skimming' ? 'Back to anchor' : 'Rewind to there'}
        </button>
        {card.kind === 'skimming' ? (
          <button type="button" className="btn" onClick={onMuteSkimming}>
            Skimming on purpose
          </button>
        ) : (
          <button type="button" className="btn" onClick={onDismiss}>
            Keep going
          </button>
        )}
      </div>
      <button
        type="button"
        className="icon-btn card-close"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        ✕
      </button>
    </div>
  );
}
