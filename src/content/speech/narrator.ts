/**
 * Plays a list of sentences through a SpeechPort, one utterance per sentence.
 * Short utterances are more reliable across voices (some stop after ~15s),
 * and make "previous / next sentence" and click-to-start trivial.
 *
 * Pause is implemented as stop-and-remember: resuming restarts the current
 * sentence, which works on every voice and helps re-anchor attention.
 */

export interface SpeakRequest {
  text: string;
  lang?: string;
  rate: number;
  voice: SpeechSynthesisVoice | null;
  onBoundary(charIndex: number, charLength?: number): void;
  onEnd(): void;
  onError(error: string): void;
}

export interface SpeechPort {
  speak(request: SpeakRequest): void;
  cancel(): void;
}

export type NarratorState = 'idle' | 'playing' | 'paused' | 'ended';

export interface NarratorOptions {
  sentences: readonly { text: string }[];
  rate: number;
  voice: SpeechSynthesisVoice | null;
  lang?: string;
  onSentence?(index: number): void;
  onWord?(index: number, charIndex: number, charLength?: number): void;
  onState?(state: NarratorState, index: number): void;
}

export class Narrator {
  private readonly port: SpeechPort;
  private readonly options: NarratorOptions;
  private token = 0;
  private _state: NarratorState = 'idle';
  private _index = 0;
  private rate: number;
  private voice: SpeechSynthesisVoice | null;

  constructor(port: SpeechPort, options: NarratorOptions) {
    this.port = port;
    this.options = options;
    this.rate = options.rate;
    this.voice = options.voice;
  }

  get state(): NarratorState {
    return this._state;
  }

  get index(): number {
    return this._index;
  }

  play(from: number = this._index): void {
    const count = this.options.sentences.length;
    if (count === 0) return;
    this._index = Math.max(0, Math.min(from, count - 1));
    this.setState('playing');
    this.speakCurrent();
  }

  pause(): void {
    if (this._state !== 'playing') return;
    this.token += 1;
    this.port.cancel();
    this.setState('paused');
  }

  toggle(): void {
    if (this._state === 'playing') this.pause();
    else if (this._state === 'ended') this.play(0);
    else this.play();
  }

  next(): void {
    this.jump(this._index + 1);
  }

  prev(): void {
    this.jump(this._index - 1);
  }

  /** Moves to a sentence; keeps playing if playing, otherwise just selects it. */
  jump(index: number): void {
    const count = this.options.sentences.length;
    const target = Math.max(0, Math.min(index, count - 1));
    if (this._state === 'playing') {
      this.play(target);
    } else {
      this._index = target;
      this.options.onSentence?.(target);
      this.setState(this._state === 'idle' || this._state === 'ended' ? 'paused' : this._state);
    }
  }

  /** New rate/voice apply from the next sentence (no jarring restart). */
  setRate(rate: number): void {
    this.rate = rate;
  }

  setVoice(voice: SpeechSynthesisVoice | null): void {
    this.voice = voice;
  }

  stop(): void {
    this.token += 1;
    this.port.cancel();
    this.setState('idle');
  }

  private speakCurrent(): void {
    this.token += 1;
    const token = this.token;
    const index = this._index;
    const sentence = this.options.sentences[index];
    if (!sentence) return;
    this.port.cancel();
    this.options.onSentence?.(index);
    this.port.speak({
      text: sentence.text,
      lang: this.options.lang,
      rate: this.rate,
      voice: this.voice,
      onBoundary: (charIndex, charLength) => {
        if (token === this.token) this.options.onWord?.(index, charIndex, charLength);
      },
      onEnd: () => {
        if (token !== this.token) return;
        if (index + 1 < this.options.sentences.length) {
          this._index = index + 1;
          this.speakCurrent();
        } else {
          this.setState('ended');
        }
      },
      onError: () => {
        if (token === this.token) this.pause();
      },
    });
  }

  private setState(state: NarratorState): void {
    this._state = state;
    this.options.onState?.(state, this._index);
  }
}
