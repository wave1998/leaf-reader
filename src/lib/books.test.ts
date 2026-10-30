// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { paginate, parseEpub, parseText, stripGutenberg } from './books';
import { wordCandidates } from './dictionary';
import { speechChunks } from './speech';

describe('book ingestion', () => {
  it('removes Gutenberg wrapper without cutting story content', () => {
    const text =
      'Title\r\n*** START OF THE PROJECT GUTENBERG EBOOK EXAMPLE ***\r\n\r\nThe actual story.\r\n*** END OF THE PROJECT GUTENBERG EBOOK EXAMPLE ***\r\nLicense';
    expect(stripGutenberg(text)).toBe('The actual story.');
  });
  it('keeps chapter boundaries and handles text without chapters', () => {
    const result = parseText(
      'CHAPTER I. A beginning\n\nAlice was reading a book.\n\nCHAPTER II. Another day\n\nShe opened the garden door.',
    );
    expect(result).toHaveLength(2);
    expect(result[1].paragraphs).toEqual(['She opened the garden door.']);
    expect(parseText('A long enough plain text book without chapter headings.')).toHaveLength(1);
  });
  it('paginates exceptionally long paragraphs without losing content', () => {
    const text = 'Every small word matters. '.repeat(600);
    const pages = paginate({ title: 'Test', paragraphs: [text] });
    expect(pages.length).toBeGreaterThan(3);
    expect(pages.flat().join(' ').replace(/\s+/g, ' ').trim()).toBe(text.trim());
    expect(pages.flat().every((part) => part.length <= 2201)).toBe(true);
  });
  it('reads EPUB in spine order and extracts text without executable markup', async () => {
    const zip = new JSZip();
    zip.file(
      'META-INF/container.xml',
      '<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>',
    );
    zip.file(
      'OPS/book.opf',
      '<package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>My Book</dc:title><dc:creator>Author</dc:creator></metadata><manifest><item id="b" href="chapters/b.xhtml"/><item id="a" href="chapters/a.xhtml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/></spine></package>',
    );
    zip.file(
      'OPS/chapters/a.xhtml',
      '<html><body><h1>First chapter</h1><p>Text with <em>emphasis</em>, safely preserved.</p><script>window.hacked = true</script><img src="https://example.invalid/tracker.png" /></body></html>',
    );
    zip.file(
      'OPS/chapters/b.xhtml',
      '<html><body><h1>Second chapter</h1><p>The book continues with more readable text.</p></body></html>',
    );
    const result = await parseEpub(await zip.generateAsync({ type: 'arraybuffer' }));
    expect(result.title).toBe('My Book');
    expect(result.author).toBe('Author');
    expect(result.chapters.map((ch) => ch.title)).toEqual(['First chapter', 'Second chapter']);
    expect(result.chapters[0].paragraphs.join(' ')).toContain('Text with emphasis');
    expect(JSON.stringify(result)).not.toContain('hacked');
  });
  it('rejects encrypted EPUB instead of silently producing broken books', async () => {
    const zip = new JSZip();
    zip.file('META-INF/encryption.xml', '<encryption/>');
    await expect(parseEpub(await zip.generateAsync({ type: 'arraybuffer' }))).rejects.toThrow(
      'DRM',
    );
  });
});

describe('reading helpers', () => {
  it('finds common inflections and normalizes punctuation', () => {
    expect(wordCandidates('Children!')).toContain('child');
    expect(wordCandidates('running')).toContain('run');
    expect(wordCandidates('studies')).toContain('study');
    expect(wordCandidates('Alice’s')).toContain('alice');
  });
  it('splits long speech into bounded segments without losing words', () => {
    const text = 'Alice had a wonderful adventure. '.repeat(100);
    const chunks = speechChunks(text);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((chunk) => chunk.length <= 401)).toBe(true);
    expect(chunks.join(' ').replace(/\s+/g, ' ').trim()).toBe(text.trim());
  });
});
