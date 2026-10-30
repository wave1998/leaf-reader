// @vitest-environment node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseText } from './books';

describe('bundled offline content', () => {
  it('includes ten complete source files matching the provenance manifest', () => {
    const sources = JSON.parse(readFileSync('public/books/sources.json', 'utf8')) as {
      id: number;
      sha256: string;
      bytes: number;
    }[];
    const catalog = JSON.parse(readFileSync('public/books/catalog.json', 'utf8')) as {
      gutenbergId: number;
    }[];
    expect(sources).toHaveLength(10);
    expect(catalog.map((book) => book.gutenbergId)).toEqual(sources.map((book) => book.id));
    for (const source of sources) {
      const raw = readFileSync(`public/books/${source.id}.txt`);
      expect(raw.length).toBe(source.bytes);
      expect(createHash('sha256').update(raw).digest('hex')).toBe(source.sha256);
      const chapters = parseText(raw.toString('utf8'));
      expect(chapters.flatMap((chapter) => chapter.paragraphs).join(' ').length).toBeGreaterThan(
        100000,
      );
      expect(chapters.flatMap((chapter) => chapter.paragraphs).join(' ')).not.toContain(
        'END OF THE PROJECT GUTENBERG',
      );
    }
  });
  it('ships a usable dictionary with common words and real Chinese definitions', () => {
    const dictionary = JSON.parse(readFileSync('public/data/dictionary.json', 'utf8')) as Record<
      string,
      { translation: string }
    >;
    expect(Object.keys(dictionary).length).toBeGreaterThan(40000);
    expect(dictionary.curiosity.translation).toContain('好奇');
    for (const word of ['read', 'book', 'garden', 'adventure', 'wonderful', 'quiet'])
      expect(dictionary[word].translation.length).toBeGreaterThan(1);
  });
});
