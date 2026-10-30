import type { Dictionary, DictionaryEntry } from '../types';

let pending: Promise<Dictionary> | undefined;
async function loadDictionary(): Promise<Dictionary> {
  if (!pending)
    pending = fetch('/data/dictionary.json')
      .then(async (response) => {
        if (!response.ok) throw new Error('离线词典加载失败，请重试。');
        return response.json() as Promise<Dictionary>;
      })
      .catch((error) => {
        pending = undefined;
        throw error;
      });
  return pending;
}

export function wordCandidates(input: string): string[] {
  const word = input
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^[^a-z]+|[^a-z]+$/g, '');
  const irregular: Record<string, string> = {
    was: 'be',
    were: 'be',
    is: 'be',
    am: 'be',
    are: 'be',
    been: 'be',
    went: 'go',
    gone: 'go',
    saw: 'see',
    seen: 'see',
    took: 'take',
    taken: 'take',
    thought: 'think',
    children: 'child',
    mice: 'mouse',
    men: 'man',
    women: 'woman',
    better: 'good',
    best: 'good',
    said: 'say',
    had: 'have',
    did: 'do',
    done: 'do',
    felt: 'feel',
    found: 'find',
    knew: 'know',
    known: 'know',
    made: 'make',
    came: 'come',
    could: 'can',
    would: 'will',
    should: 'shall',
    bought: 'buy',
    brought: 'bring',
    feet: 'foot',
    teeth: 'tooth',
    ran: 'run',
    written: 'write',
    wrote: 'write',
  };
  const candidates = [
    word,
    irregular[word],
    word.replace(/'s$/, ''),
    word.replace(/ies$/, 'y'),
    word.replace(/ing$/, ''),
    word.replace(/ing$/, 'e'),
    word.replace(/([a-z])\1ing$/, '$1'),
    word.replace(/ied$/, 'y'),
    word.replace(/ed$/, ''),
    word.replace(/ed$/, 'e'),
    word.replace(/([a-z])\1ed$/, '$1'),
    word.replace(/es$/, ''),
    word.replace(/s$/, ''),
  ];
  return [...new Set(candidates.filter((candidate): candidate is string => Boolean(candidate)))];
}

export async function lookupWord(
  input: string,
): Promise<(DictionaryEntry & { word: string }) | null> {
  const dictionary = await loadDictionary();
  for (const word of wordCandidates(input))
    if (Object.hasOwn(dictionary, word)) return { ...dictionary[word], word };
  return null;
}
