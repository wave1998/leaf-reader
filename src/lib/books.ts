import JSZip from 'jszip';
import { get, set } from 'idb-keyval';
import type { Book, Chapter, Progress } from '../types';

const IMPORTS_KEY = 'leaf-imported-books-v1';
const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const PAGE_TARGET = 2600;

export function stripGutenberg(text: string): string {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/^[\s\S]*?\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\n/i, '')
    .replace(/\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*$/i, '')
    .trim();
}

export function parseText(text: string): Chapter[] {
  const clean = stripGutenberg(text).replace(/\u0000/g, '');
  if (clean.length < 20) throw new Error('书籍内容太短，或文件不是有效文本。');
  const blocks = clean
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const chapters: Chapter[] = [];
  let current: Chapter = { title: '开篇', paragraphs: [] };
  for (const block of blocks) {
    if (
      block.length < 110 &&
      /^(?:chapter\s+[\divxlc]+(?:[. :—-]|$)|CHAPTER\s+[A-Z]+(?:[. :—-]|$)|book\s+[\divxlc]+(?:[. :—-]|$)|part\s+[\divxlc]+(?:[. :—-]|$))/i.test(
        block,
      )
    ) {
      if (current.paragraphs.length) chapters.push(current);
      current = { title: block, paragraphs: [] };
    } else current.paragraphs.push(block);
  }
  if (current.paragraphs.length) chapters.push(current);
  return chapters.length ? chapters : [{ title: '正文', paragraphs: [clean] }];
}

export function paginate(chapter: Chapter): string[][] {
  const pages: string[][] = [];
  let page: string[] = [],
    size = 0;
  // Split exceptionally long paragraphs too, so malformed books cannot create enormous DOM pages.
  for (const paragraph of chapter.paragraphs) {
    const chunks = paragraph.match(/.{1,2200}(?:\s|$)|.{1,2200}/gs) ?? [paragraph];
    for (const chunk of chunks) {
      if (size + chunk.length > PAGE_TARGET && page.length) {
        pages.push(page);
        page = [];
        size = 0;
      }
      page.push(chunk.trim());
      size += chunk.length;
    }
  }
  if (page.length) pages.push(page);
  return pages.length ? pages : [['本章没有可阅读的文本。']];
}

function xmlByLocalName(document: Document, tag: string): Element[] {
  return Array.from(document.getElementsByTagName('*')).filter((el) => el.localName === tag);
}

function resolveZipPath(base: string, href: string): string {
  const resolved = new URL(href, `https://epub.invalid/${base}`).pathname.slice(1);
  return decodeURIComponent(resolved);
}

export async function parseEpub(
  data: ArrayBuffer,
): Promise<{ title: string; author: string; chapters: Chapter[] }> {
  const zip = await JSZip.loadAsync(data);
  const entries = Object.values(zip.files);
  if (entries.length > 2000) throw new Error('EPUB 内文件过多，请选择纯文字书籍。');
  // JSZip exposes the ZIP header size before decompression; guard zip bombs before reading entries.
  const expanded = entries.reduce(
    (sum, entry) =>
      sum +
      ((entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ??
        0),
    0,
  );
  if (expanded > 50 * 1024 * 1024) throw new Error('EPUB 解压后超过 50 MB，请使用更小的文字版本。');
  if (zip.file('META-INF/encryption.xml'))
    throw new Error('暂不支持加密或带 DRM 的 EPUB，请导入无加密版本。');
  const parser = new DOMParser();
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw new Error('EPUB 缺少 container.xml，无法读取。');
  const container = parser.parseFromString(await containerFile.async('text'), 'application/xml');
  const opfPath = xmlByLocalName(container, 'rootfile')[0]?.getAttribute('full-path');
  const opfFile = opfPath && zip.file(opfPath);
  if (!opfFile) throw new Error('EPUB 缺少书籍目录文件。');
  const opf = parser.parseFromString(await opfFile.async('text'), 'application/xml');
  const manifest = new Map(xmlByLocalName(opf, 'item').map((el) => [el.getAttribute('id'), el]));
  const chapters: Chapter[] = [];
  for (const ref of xmlByLocalName(opf, 'itemref')) {
    if (ref.getAttribute('linear') === 'no') continue;
    const item = manifest.get(ref.getAttribute('idref'));
    const href = item?.getAttribute('href');
    if (!href) continue;
    const chapterFile = zip.file(resolveZipPath(opfPath, href.split('#')[0]));
    if (!chapterFile) continue;
    // Parse EPUB XHTML as inert XML: never load a book's remote images, frames or styles.
    const doc = parser.parseFromString(await chapterFile.async('text'), 'application/xhtml+xml');
    if (doc.getElementsByTagName('parsererror').length) {
      throw new Error('EPUB 章节不是有效 XHTML，请重新导出为标准 EPUB 或 TXT。');
    }
    doc.querySelectorAll('script,style,nav,iframe,object,svg').forEach((el) => el.remove());
    const body = xmlByLocalName(doc, 'body')[0] ?? doc.documentElement;
    const title =
      doc.querySelector('h1,h2,h3')?.textContent?.trim() || `第 ${chapters.length + 1} 节`;
    const blocks = Array.from(body.querySelectorAll('p,h1,h2,h3,li,blockquote,pre'))
      .filter((el) => !el.parentElement?.closest('p,li,blockquote,pre'))
      .map((el) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter(Boolean);
    const paragraphs = blocks.length
      ? blocks
      : [body.textContent?.replace(/\s+/g, ' ').trim() || ''];
    if (paragraphs.join('').length > 15) chapters.push({ title, paragraphs });
  }
  if (!chapters.length) throw new Error('这本 EPUB 没有可读取的文字内容，暂不支持扫描版。');
  return {
    title: xmlByLocalName(opf, 'title')[0]?.textContent || '',
    author: xmlByLocalName(opf, 'creator')[0]?.textContent || '未知作者',
    chapters,
  };
}

export async function importBook(name: string, data: ArrayBuffer): Promise<Book> {
  if (data.byteLength > MAX_FILE_BYTES) throw new Error('请选择 15 MB 以内的 TXT 或 EPUB。');
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension !== 'txt' && extension !== 'epub')
    throw new Error('目前支持 TXT 和无 DRM 的 EPUB 文件。');
  let parsed: { title: string; author: string; chapters: Chapter[] };
  if (extension === 'epub') parsed = await parseEpub(data);
  else {
    let text = new TextDecoder('utf-8', { fatal: false }).decode(data);
    if ((text.match(/\uFFFD/g)?.length ?? 0) > text.length * 0.005)
      text = new TextDecoder('gb18030').decode(data);
    parsed = { title: name.replace(/\.txt$/i, ''), author: '本地导入', chapters: parseText(text) };
  }
  const digest = await crypto.subtle.digest('SHA-256', data);
  const id =
    'local-' +
    Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 24);
  const book: Book = {
    id,
    title: parsed.title || name.replace(/\.[^.]+$/, ''),
    subtitle: '我的本地藏书',
    author: parsed.author,
    chapters: parsed.chapters,
    wordCount: parsed.chapters.reduce(
      (sum, ch) => sum + ch.paragraphs.join(' ').split(/\s+/).length,
      0,
    ),
    source: 'imported',
    filename: name,
    color: '#766a80',
    accent: '#eee2c9',
    motif: 'flower',
  };
  const imported = (await get<Book[]>(IMPORTS_KEY)) ?? [];
  await set(IMPORTS_KEY, [book, ...imported.filter((item) => item.id !== id)]);
  return book;
}

export async function getLibrary(): Promise<Book[]> {
  const response = await fetch('/books/catalog.json');
  if (!response.ok) throw new Error('内置书目加载失败，请刷新重试。');
  const builtin = (await response.json()) as Book[];
  const imported = (await get<Book[]>(IMPORTS_KEY)) ?? [];
  return [...builtin, ...imported];
}

const bookCache = new Map<string, Book>();
export async function loadBook(book: Book): Promise<Book & { chapters: Chapter[] }> {
  if (book.chapters) return book as Book & { chapters: Chapter[] };
  const cached = bookCache.get(book.id);
  if (cached?.chapters) return cached as Book & { chapters: Chapter[] };
  const response = await fetch(`/books/${book.gutenbergId}.txt`);
  if (!response.ok) throw new Error('书籍文件读取失败，请重试。');
  const chapters = parseText(await response.text());
  const loaded = {
    ...book,
    chapters,
    wordCount: chapters.reduce((sum, ch) => sum + ch.paragraphs.join(' ').split(/\s+/).length, 0),
  };
  bookCache.set(book.id, loaded);
  return loaded;
}

export async function removeBook(id: string): Promise<void> {
  await set(
    IMPORTS_KEY,
    ((await get<Book[]>(IMPORTS_KEY)) ?? []).filter((book) => book.id !== id),
  );
  bookCache.delete(id);
  localStorage.removeItem(`leaf-progress:${id}`);
}

export function getProgress(id: string): Progress {
  try {
    return (
      JSON.parse(localStorage.getItem(`leaf-progress:${id}`) || 'null') ?? {
        chapter: 0,
        page: 0,
        updatedAt: 0,
      }
    );
  } catch {
    return { chapter: 0, page: 0, updatedAt: 0 };
  }
}
export function saveProgress(id: string, chapter: number, page: number): void {
  localStorage.setItem(
    `leaf-progress:${id}`,
    JSON.stringify({ chapter, page, updatedAt: Date.now() }),
  );
  localStorage.setItem('leaf-current-book', id);
}
