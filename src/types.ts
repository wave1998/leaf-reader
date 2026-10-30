export interface Chapter {
  title: string;
  paragraphs: string[];
}
export interface Book {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  color: string;
  accent: string;
  motif: string;
  source: 'builtin' | 'imported';
  filename?: string;
  gutenbergId?: number;
  wordCount?: number;
  chapters?: Chapter[];
}
export interface Progress {
  chapter: number;
  page: number;
  updatedAt: number;
}
export interface Preferences {
  fontSize: number;
  theme: 'paper' | 'night' | 'sage';
  rate: number;
  voiceId: string;
}
export interface ReaderVoice {
  id: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
  nativeIndex?: number;
}
export interface DictionaryEntry {
  translation: string;
  phonetic: string;
  lemma?: string;
}
export type Dictionary = Record<string, DictionaryEntry>;
