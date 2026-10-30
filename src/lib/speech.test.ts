// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseVoice, getEnglishVoices, rankEnglishVoices, speak, speechChunks } from './speech';
import type { ReaderVoice } from '../types';

const voice = (name: string, lang = 'en-US', extra: Partial<ReaderVoice> = {}): ReaderVoice => ({
  id: name,
  name,
  lang,
  localService: true,
  default: false,
  ...extra,
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('narrator selection', () => {
  it('does not pick the first novelty voice from an alphabetic macOS voice list', () => {
    const voices = [
      'Albert',
      'Bad News',
      'Bahh',
      'Bells',
      'Boing',
      'Daniel',
      'Samantha',
      'Zarvox',
    ].map((name) => voice(name));
    expect(chooseVoice(voices)?.name).toBe('Samantha');
    expect(rankEnglishVoices(voices).map((item) => item.name)).toEqual(['Samantha', 'Daniel']);
  });
  it('honors a saved narrator and preserves the original Android voice index', () => {
    const voices = [
      voice('Daniel', 'en-GB', { nativeIndex: 7 }),
      voice('Samantha', 'en-US', { nativeIndex: 2 }),
    ];
    expect(chooseVoice(voices, 'Daniel')).toMatchObject({ lang: 'en-GB', nativeIndex: 7 });
  });
  it('prefers enhanced voices while excluding remote voices and non-English fallback', () => {
    const voices = [
      voice('Samantha'),
      voice('Daniel Enhanced', 'en-GB'),
      voice('Cloud Natural', 'en-US', { localService: false }),
      voice('中文', 'zh-CN'),
    ];
    expect(chooseVoice(voices)?.name).toBe('Daniel Enhanced');
    expect(chooseVoice([voice('中文', 'zh-CN')])).toBeUndefined();
    expect(chooseVoice([voice('Albert')])).toBeUndefined();
  });
  it('recovers from a saved voice that is missing on the current device', () => {
    expect(chooseVoice([voice('Samantha')], 'old-phone-voice')?.name).toBe('Samantha');
  });
});

function mockBrowserVoices(initial: ReaderVoice[]) {
  let available = initial.map((item) => ({ ...item, voiceURI: item.id })) as SpeechSynthesisVoice[];
  const synth = Object.assign(new EventTarget(), {
    getVoices: () => available,
    speak: vi.fn((utterance: SpeechSynthesisUtterance) =>
      queueMicrotask(() => utterance.onend?.call(utterance, {} as SpeechSynthesisEvent)),
    ),
    cancel: vi.fn(),
  });
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      constructor(public text: string) {}
    },
  );
  return {
    synth,
    update: (voices: ReaderVoice[]) => {
      available = voices.map((item) => ({ ...item, voiceURI: item.id })) as SpeechSynthesisVoice[];
      synth.dispatchEvent(new Event('voiceschanged'));
    },
  };
}

describe('speech engine integration', () => {
  it('waits for asynchronous browser voices instead of using an unspecified default', async () => {
    const mock = mockBrowserVoices([]);
    const pending = getEnglishVoices();
    mock.update([voice('Albert'), voice('Samantha')]);
    expect((await pending).map((item) => item.name)).toEqual(['Samantha']);
  });
  it('passes the selected voice and its actual accent to the browser engine', async () => {
    const { synth } = mockBrowserVoices([
      voice('Albert'),
      voice('Daniel', 'en-GB'),
      voice('Samantha'),
    ]);
    await speak('A quiet morning.', 0.85, 'Daniel');
    expect(synth.speak).toHaveBeenCalledOnce();
    const utterance = synth.speak.mock.calls[0][0];
    expect(utterance.lang).toBe('en-GB');
    expect(utterance.voice?.name).toBe('Daniel');
    expect(utterance.rate).toBe(0.85);
  });
  it('does not start audio after the user stopped while voice discovery was pending', async () => {
    const mock = mockBrowserVoices([]);
    let active = true;
    const pending = speak('Do not read this.', 1, '', () => active);
    active = false;
    mock.update([voice('Samantha')]);
    await pending;
    expect(mock.synth.speak).not.toHaveBeenCalled();
  });
});

describe('natural reading segments', () => {
  it('keeps short paragraphs together rather than restarting after every sentence', () => {
    const paragraph =
      'Dr. Smith opened the book. It was a quiet morning. The garden was beautiful.';
    expect(speechChunks(paragraph)).toEqual([paragraph]);
  });
  it('does not speak Gutenberg emphasis markers and illustration placeholders', () => {
    expect(speechChunks('[Illustration] Alice was _very_ curious.')).toEqual([
      'Alice was very curious.',
    ]);
  });
});
