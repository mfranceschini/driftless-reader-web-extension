import { describe, expect, it, vi } from 'vitest';
import { Narrator, type SpeakRequest, type SpeechPort } from './narrator';

/** A manual port: tests decide when words are spoken and utterances end. */
function manualPort() {
  const spoken: SpeakRequest[] = [];
  const port: SpeechPort = { speak: (r) => spoken.push(r), cancel: vi.fn() };
  return { port, spoken, last: () => spoken[spoken.length - 1]! };
}

const sentences = [{ text: 'One.' }, { text: 'Two words.' }, { text: 'Three.' }];

describe('Narrator', () => {
  it('speaks sentences in order and ends', () => {
    const { port, spoken, last } = manualPort();
    const onState = vi.fn();
    const n = new Narrator(port, { sentences, rate: 1, voice: null, onState });
    n.play();
    expect(last().text).toBe('One.');
    last().onEnd();
    expect(last().text).toBe('Two words.');
    last().onEnd();
    last().onEnd();
    expect(spoken).toHaveLength(3);
    expect(n.state).toBe('ended');
    expect(onState).toHaveBeenLastCalledWith('ended', 2);
  });

  it('reports words with the sentence index', () => {
    const { port, last } = manualPort();
    const onWord = vi.fn();
    const n = new Narrator(port, { sentences, rate: 1, voice: null, onWord });
    n.play(1);
    last().onBoundary(4, 5);
    expect(onWord).toHaveBeenCalledWith(1, 4, 5);
  });

  it('pauses and resumes from the start of the current sentence', () => {
    const { port, last } = manualPort();
    const n = new Narrator(port, { sentences, rate: 1, voice: null });
    n.play(1);
    const paused = last();
    n.pause();
    expect(n.state).toBe('paused');
    paused.onEnd(); // late event from the cancelled utterance is ignored
    expect(n.index).toBe(1);
    n.toggle();
    expect(n.state).toBe('playing');
    expect(last().text).toBe('Two words.');
  });

  it('jumps with next/prev and clamps at the edges', () => {
    const { port, last } = manualPort();
    const n = new Narrator(port, { sentences, rate: 1, voice: null });
    n.play(0);
    n.prev();
    expect(last().text).toBe('One.');
    n.next();
    n.next();
    n.next();
    expect(last().text).toBe('Three.');
  });

  it('applies a new rate from the next sentence', () => {
    const { port, last } = manualPort();
    const n = new Narrator(port, { sentences, rate: 1, voice: null });
    n.play();
    n.setRate(1.5);
    expect(last().rate).toBe(1);
    last().onEnd();
    expect(last().rate).toBe(1.5);
  });

  it('pauses on a speech error instead of looping', () => {
    const { port, last } = manualPort();
    const n = new Narrator(port, { sentences, rate: 1, voice: null });
    n.play();
    last().onError('synthesis-failed');
    expect(n.state).toBe('paused');
  });
});
