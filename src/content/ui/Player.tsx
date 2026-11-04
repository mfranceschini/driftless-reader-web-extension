import type { ReadAloudState } from './useReadAloud';

interface PlayerProps {
  state: ReadAloudState;
  rate: number;
  onToggle(): void;
  onPrev(): void;
  onNext(): void;
  onFollow(): void;
  onSlower(): void;
  onFaster(): void;
  onClose(): void;
}

export function Player({
  state,
  rate,
  onToggle,
  onPrev,
  onNext,
  onFollow,
  onSlower,
  onFaster,
  onClose,
}: PlayerProps) {
  const playing = state.status === 'playing';
  return (
    <div className="player" role="region" aria-label="Read Aloud">
      <button type="button" className="icon-btn" onClick={onPrev} aria-label="Previous sentence">
        ⏮
      </button>
      <button
        type="button"
        className="icon-btn play"
        onClick={onToggle}
        aria-label={playing ? 'Pause' : state.status === 'ended' ? 'Replay' : 'Play'}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <button type="button" className="icon-btn" onClick={onNext} aria-label="Next sentence">
        ⏭
      </button>
      <span className="player-sep" aria-hidden="true" />
      <button type="button" className="icon-btn" onClick={onSlower} aria-label="Slower">
        −
      </button>
      <span className="player-rate" aria-label={`Speed ${rate.toFixed(1)} times`}>
        {rate.toFixed(1)}×
      </span>
      <button type="button" className="icon-btn" onClick={onFaster} aria-label="Faster">
        +
      </button>
      {!state.following && (
        <button type="button" className="btn follow" onClick={onFollow}>
          Follow voice
        </button>
      )}
      <span className="player-pos" aria-live="off">
        {state.status === 'ended' ? 'Done' : `${state.index + 1} / ${state.total}`}
      </span>
      <button type="button" className="icon-btn" onClick={onClose} aria-label="Stop Read Aloud">
        ✕
      </button>
    </div>
  );
}
