interface NoArticlePillProps {
  onTryAnyway(): void;
  onClose(): void;
}

/** Shown when Readability doesn't think the page is an article. */
export function NoArticlePill({ onTryAnyway, onClose }: NoArticlePillProps) {
  return (
    <div className="pill" role="status">
      <span className="dot" aria-hidden="true" />
      <span>No article found on this page.</span>
      <button type="button" className="try-btn" onClick={onTryAnyway}>
        Try anyway
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label="Turn off Driftless Reader"
        title="Close"
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  );
}
