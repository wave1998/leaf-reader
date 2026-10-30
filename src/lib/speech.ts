import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import type { ReaderVoice } from '../types';

// macOS exposes novelty voices alongside normal narrators. Never pick these for a book.
const EFFECT_VOICES =
  /\b(albert|bad[ -]?news|bahh|bells|boing|bubbles|cellos|wobble|fred|good[ -]?news|jester|junior|kathy|organ|superstar|ralph|trinoids|whisper|zarvox|hysterical|deranged)\b/i;

export function rankEnglishVoices(voices: ReaderVoice[]): ReaderVoice[] {
  function score(voice: ReaderVoice): number {
    const identity = `${voice.name} ${voice.id}`;
    let value = voice.default ? 10 : 0;
    if (/premium|enhanced|neural|natural|高质量|增强/i.test(identity)) value += 100;
    if (/samantha/i.test(identity)) value += 40;
    else if (/daniel/i.test(identity)) value += 35;
    else if (/karen|moira|tessa|ava|allison|tom|serena|susan/i.test(identity)) value += 30;
    if (/^en[-_]US$/i.test(voice.lang)) value += 5;
    return value;
  }
  return voices
    .filter(
      (voice) =>
        /^en(?:[-_]|$)/i.test(voice.lang) &&
        voice.localService &&
        !EFFECT_VOICES.test(`${voice.name} ${voice.id}`),
    )
    .sort(
      (a, b) => score(b) - score(a) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
}

export function chooseVoice(voices: ReaderVoice[], preferredId = ''): ReaderVoice | undefined {
  const ranked = rankEnglishVoices(voices);
  return ranked.find((voice) => voice.id === preferredId) ?? ranked[0];
}

export function voiceAccent(lang: string): string {
  const accents: Record<string, string> = {
    'en-US': '美式英语',
    'en-GB': '英式英语',
    'en-AU': '澳洲英语',
    'en-IE': '爱尔兰英语',
    'en-IN': '印度英语',
    'en-ZA': '南非英语',
  };
  return accents[lang.replace('_', '-')] ?? '英语';
}

function browserVoiceList(): Promise<SpeechSynthesisVoice[]> {
  if (!('speechSynthesis' in window)) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const ready = synth.getVoices();
  if (ready.length) return Promise.resolve(ready);
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      synth.removeEventListener('voiceschanged', changed);
      resolve(synth.getVoices());
    };
    const changed = () => {
      if (synth.getVoices().length) finish();
    };
    const timer = setTimeout(finish, 2000);
    synth.addEventListener('voiceschanged', changed);
    changed();
  });
}

export async function getEnglishVoices(): Promise<ReaderVoice[]> {
  if (Capacitor.isNativePlatform()) {
    const { voices } = await TextToSpeech.getSupportedVoices();
    return rankEnglishVoices(
      voices.map((voice, index) => ({ ...voice, id: voice.voiceURI, nativeIndex: index })),
    );
  }
  const voices = await browserVoiceList();
  return rankEnglishVoices(
    voices.map((voice) => ({
      id: voice.voiceURI,
      name: voice.name,
      lang: voice.lang,
      localService: voice.localService,
      default: voice.default,
    })),
  );
}

export function speechChunks(text: string): string[] {
  let remaining = text
    .replace(/\[(?:illustration|image)(?::[^\]]*)?\]/gi, ' ')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  const chunks: string[] = [];
  while (remaining.length > 400) {
    const sample = remaining.slice(0, 401);
    const sentenceEnds = [...sample.matchAll(/[.!?][”’"']?\s+/g)];
    const lastEnd = sentenceEnds.at(-1);
    const sentenceCut = lastEnd ? lastEnd.index! + lastEnd[0].length : 0;
    const whitespaceCut = sample.lastIndexOf(' ');
    const cut =
      sentenceCut >= 180 && sentenceCut <= 400
        ? sentenceCut
        : whitespaceCut > 0
          ? whitespaceCut
          : 400;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export async function speak(
  text: string,
  rate: number,
  voiceId = '',
  isActive: () => boolean = () => true,
): Promise<void> {
  const voice = chooseVoice(await getEnglishVoices(), voiceId);
  if (!isActive()) return;
  if (!voice)
    throw new Error(
      '未找到适合听书的离线英文音色。请在系统语音设置中下载英文声音，然后点击“刷新音色”。',
    );
  if (Capacitor.isNativePlatform()) {
    const supported = await TextToSpeech.isLanguageSupported({ lang: voice.lang });
    if (!isActive()) return;
    if (!supported.supported) throw new Error('英文语音包尚未就绪，请在系统语音设置中完成下载。');
    await TextToSpeech.speak({
      text,
      lang: voice.lang,
      rate,
      pitch: 1,
      volume: 1,
      voice: voice.nativeIndex,
      queueStrategy: 0,
    });
    return;
  }
  const nativeVoice = window.speechSynthesis.getVoices().find((item) => item.voiceURI === voice.id);
  if (!nativeVoice) throw new Error('所选音色已变更，请刷新音色列表后重试。');
  await new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice.lang;
    utterance.voice = nativeVoice;
    utterance.rate = rate;
    utterance.pitch = 1;
    utterance.onend = () => resolve();
    utterance.onerror = (event) =>
      event.error === 'canceled' || event.error === 'interrupted'
        ? resolve()
        : reject(new Error('朗读暂不可用，请检查设备的英文语音包。'));
    window.speechSynthesis.speak(utterance);
  });
}

export async function stopSpeech(): Promise<void> {
  if (Capacitor.isNativePlatform()) await TextToSpeech.stop();
  else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export async function installVoice(): Promise<void> {
  if (Capacitor.isNativePlatform()) await TextToSpeech.openInstall();
  else
    throw new Error(
      '请在电脑系统的辅助功能语音设置中下载增强版英文音色，再回到这里点击“刷新音色”。',
    );
}
