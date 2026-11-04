interface ResumeCardProps {
  percent: number;
  onContinue(): void;
  onStartOver(): void;
  onDismiss(): void;
}

/** Offered when you reopen an article you didn't finish. */
export function ResumeCard({ percent, onContinue, onStartOver, onDismiss }: ResumeCardProps) {
  return (
    <div className="card resume" role="dialog" aria-label="Resume reading">
      <p className="card-title">Pick up where you left off?</p>
      <p className="card-body">You were {percent}% through this article.</p>
      <div className="card-actions">
        <button type="button" className="btn primary" onClick={onContinue} autoFocus>
          Continue
        </button>
        <button type="button" className="btn" onClick={onStartOver}>
          Start over
        </button>
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

interface AnchorButtonProps {
  direction: 'above' | 'below';
  onClick(): void;
}

/** Floating shortcut back to the last paragraph you actually read. */
export function AnchorButton({ direction, onClick }: AnchorButtonProps) {
  return (
    <button type="button" className="anchor-btn" onClick={onClick}>
      <span className="anchor-dot" aria-hidden="true" />
      {direction === 'above' ? '↑ Back to where you were' : '↓ Jump to where you were'}
    </button>
  );
}
