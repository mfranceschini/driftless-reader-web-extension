interface ChunkNavProps {
  index: number;
  total: number;
  onPrev(): void;
  onNext(): void;
}

export function ChunkNav({ index, total, onPrev, onNext }: ChunkNavProps) {
  if (total === 0) return null;
  return (
    <div className="chunk-nav" role="group" aria-label="Chunk mode">
      <button
        type="button"
        className="icon-btn"
        onClick={onPrev}
        disabled={index <= 0}
        aria-label="Previous chunk (Shift+Space)"
      >
        ↑
      </button>
      <span className="chunk-pos" aria-live="polite">
        {index + 1} / {total}
      </span>
      <button
        type="button"
        className="icon-btn"
        onClick={onNext}
        disabled={index >= total - 1}
        aria-label="Next chunk (Space)"
      >
        ↓
      </button>
    </div>
  );
}
