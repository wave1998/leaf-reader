import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import {
  ArrowDownToLine,
  ArrowRight,
  BookMarked,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Leaf,
  List,
  LoaderCircle,
  Moon,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Timer,
  Trash2,
  Volume2,
  UserRound,
  WifiOff,
  X,
} from 'lucide-react';
import Cover from './components/Cover';
import VoicePicker from './components/VoicePicker';
import packageInfo from '../package.json';
import {
  getLibrary,
  getProgress,
  importBook,
  loadBook,
  paginate,
  removeBook,
  saveProgress,
} from './lib/books';
import { lookupWord } from './lib/dictionary';
import {
  chooseVoice,
  getEnglishVoices,
  installVoice,
  speak,
  speechChunks,
  stopSpeech,
  voiceAccent,
} from './lib/speech';
import type { Book, Chapter, DictionaryEntry, Preferences, ReaderVoice } from './types';

type Tab = 'shelf' | 'read' | 'listen' | 'mine';
type LoadedBook = Book & { chapters: Chapter[] };
type WordResult = {
  selected: string;
  entry: (DictionaryEntry & { word: string }) | null;
  loading: boolean;
  error?: string;
};
const initialPreferences: Preferences = { fontSize: 20, theme: 'paper', rate: 1, voiceId: '' };
function readPreferences(): Preferences {
  try {
    return {
      ...initialPreferences,
      ...JSON.parse(localStorage.getItem('leaf-preferences') || '{}'),
    };
  } catch {
    return initialPreferences;
  }
}

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [tab, setTab] = useState<Tab>('shelf');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<
    'import' | 'settings' | 'chapters' | 'about' | 'voices' | null
  >(null);
  const [current, setCurrent] = useState<LoadedBook | null>(null);
  const [chapter, setChapter] = useState(0);
  const [page, setPage] = useState(0);
  const [prefs, setPrefs] = useState<Preferences>(readPreferences);
  const [word, setWord] = useState<WordResult | null>(null);
  const [savedWords, setSavedWords] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('leaf-words') || '[]');
    } catch {
      return [];
    }
  });
  const [playing, setPlaying] = useState(false);
  const [speechPosition, setSpeechPosition] = useState(0);
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [voices, setVoices] = useState<ReaderVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [previewing, setPreviewing] = useState('');
  const [menuBook, setMenuBook] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const generation = useRef(0);
  const wordRequest = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const readingArea = useRef<HTMLElement>(null);

  const notify = useCallback((message: string) => setNotice(message), []);
  const halt = useCallback(async () => {
    generation.current += 1;
    setPlaying(false);
    setPreviewing('');
    await stopSpeech().catch(() => undefined);
  }, []);

  const refreshVoices = useCallback(async () => {
    setVoicesLoading(true);
    setVoiceError('');
    try {
      setVoices(await getEnglishVoices());
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : '音色读取失败，请重试。');
    } finally {
      setVoicesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'listen' || modal === 'voices') void refreshVoices();
  }, [tab, modal, refreshVoices]);
  useEffect(() => {
    if (modal !== 'voices' && previewing) void halt();
  }, [modal, previewing, halt]);
  const selectedVoice = chooseVoice(voices, prefs.voiceId);

  async function previewVoice(voice: ReaderVoice) {
    const wasPreviewing = previewing === voice.id;
    await halt();
    if (wasPreviewing) return;
    const token = ++generation.current;
    setPreviewing(voice.id);
    try {
      await speak(
        'The garden was quiet in the morning. Every page is the beginning of a new adventure.',
        prefs.rate,
        voice.id,
        () => token === generation.current,
      );
    } catch (error) {
      if (token === generation.current) notify(error instanceof Error ? error.message : '试听失败');
    } finally {
      if (token === generation.current) setPreviewing('');
    }
  }

  useEffect(() => {
    let live = true;
    getLibrary()
      .then((library) => {
        if (live) setBooks(library);
      })
      .catch((error) => notify(String(error.message)))
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [notify]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    localStorage.setItem('leaf-preferences', JSON.stringify(prefs));
  }, [prefs]);
  useEffect(() => {
    localStorage.setItem('leaf-words', JSON.stringify(savedWords));
  }, [savedWords]);
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModal(null);
        setWord(null);
        setDeleteId(null);
        setMenuBook(null);
        wordRequest.current++;
      }
    };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, []);
  useEffect(() => {
    if (current) saveProgress(current.id, chapter, page);
    readingArea.current?.scrollTo({ top: 0 });
    setWord(null);
  }, [current, chapter, page]);
  useEffect(() => {
    if (!playing || !timerMinutes) return;
    const timer = setTimeout(() => {
      void halt();
      notify('定时结束，已暂停朗读。');
      setTimerMinutes(0);
    }, timerMinutes * 60_000);
    return () => clearTimeout(timer);
  }, [playing, timerMinutes, halt, notify]);
  useEffect(() => {
    const listener = () => {
      if (document.hidden) void halt();
    };
    document.addEventListener('visibilitychange', listener);
    const nativeStateListener = Capacitor.isNativePlatform()
      ? NativeApp.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) void halt();
        })
      : null;
    // Foreground-only TTS is intentional until a native media foreground service is added.
    return () => {
      document.removeEventListener('visibilitychange', listener);
      void nativeStateListener?.then((handle) => handle.remove());
      void halt();
    };
  }, [halt]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = NativeApp.addListener('backButton', () => {
      if (word) setWord(null);
      else if (modal) setModal(null);
      else if (tab !== 'shelf') {
        void halt();
        setTab('shelf');
      } else void NativeApp.exitApp();
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [tab, modal, word, halt]);

  const pages = useMemo(
    () => (current ? paginate(current.chapters[chapter] ?? current.chapters[0]) : []),
    [current, chapter],
  );
  const pageParagraphs = pages[Math.min(page, pages.length - 1)] ?? [];
  const chunks = useMemo(() => speechChunks(pageParagraphs.join(' ')), [pageParagraphs]);
  const recentBook = useMemo(() => {
    const lastId = localStorage.getItem('leaf-current-book');
    return books.find((book) => book.id === lastId) ?? books[0];
  }, [books, current]);
  const visibleBooks = books.filter(
    (book) =>
      (filter === 'all' ||
        (filter === 'imported'
          ? book.source === 'imported'
          : getProgress(book.id).updatedAt > 0)) &&
      `${book.title} ${book.subtitle} ${book.author}`.toLowerCase().includes(query.toLowerCase()),
  );
  const chapterPageCounts = useMemo(
    () => current?.chapters.map((item) => paginate(item).length) ?? [],
    [current],
  );
  const totalPages = chapterPageCounts.reduce((sum, count) => sum + count, 0);
  const passedPages =
    chapterPageCounts.slice(0, chapter).reduce((sum, count) => sum + count, 0) + page;
  const progressPercent =
    totalPages > 1 ? Math.min(100, Math.round((passedPages / (totalPages - 1)) * 100)) : 0;

  async function openBook(book: Book, target: Tab = 'read') {
    await halt();
    setBusy(true);
    setSpeechPosition(0);
    try {
      const loaded = await loadBook(book);
      const progress = getProgress(book.id);
      const firstStory =
        !progress.updatedAt && loaded.chapters.length > 1 && loaded.chapters[0].title === '开篇'
          ? 1
          : progress.chapter;
      const safeChapter = Math.min(Math.max(0, firstStory), loaded.chapters.length - 1);
      const safePage = Math.min(
        Math.max(0, progress.page),
        paginate(loaded.chapters[safeChapter]).length - 1,
      );
      setCurrent(loaded);
      setChapter(safeChapter);
      setPage(safePage);
      setTab(target);
    } catch (error) {
      notify(error instanceof Error ? error.message : '书籍读取失败');
    } finally {
      setBusy(false);
    }
  }

  async function navigateTab(next: Tab) {
    setWord(null);
    if (next === 'shelf' || next === 'mine') {
      setTab(next);
      return;
    }
    if (!current && recentBook) await openBook(recentBook, next);
    else setTab(next);
  }

  async function consumeFile(name: string, data: ArrayBuffer) {
    setBusy(true);
    try {
      const book = await importBook(name, data);
      setBooks((library) => [...library.filter((item) => item.id !== book.id), book]);
      setModal(null);
      setFilter('imported');
      notify(`已将《${book.title}》加入书架，文件仅保存在本机。`);
    } catch (error) {
      notify(error instanceof Error ? error.message : '导入失败，请重试。');
    } finally {
      setBusy(false);
    }
  }

  async function chooseFile() {
    if (!Capacitor.isNativePlatform()) {
      fileInput.current?.click();
      return;
    }
    setBusy(true);
    try {
      const result = await FilePicker.pickFiles({
        types: ['text/plain', 'application/epub+zip', 'application/octet-stream'],
        limit: 1,
        readData: true,
      });
      const file = result.files[0];
      if (!file) return;
      if (file.size > 15 * 1024 * 1024) throw new Error('请选择 15 MB 以内的书籍。');
      if (!file.data) throw new Error('未能读取文件，请重新选择。');
      const bytes = Uint8Array.from(atob(file.data), (char) => char.charCodeAt(0));
      await consumeFile(file.name, bytes.buffer);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/cancel/i.test(message)) notify(message);
    } finally {
      setBusy(false);
    }
  }

  async function translate(selected: string) {
    if (!/[a-zA-Z]/.test(selected)) return;
    const request = ++wordRequest.current;
    setWord({ selected, entry: null, loading: true });
    try {
      const entry = await lookupWord(selected);
      if (request === wordRequest.current) setWord({ selected, entry, loading: false });
    } catch (error) {
      if (request === wordRequest.current)
        setWord({
          selected,
          entry: null,
          loading: false,
          error: error instanceof Error ? error.message : '查词失败',
        });
    }
  }

  async function movePage(direction: number) {
    await halt();
    setSpeechPosition(0);
    if (direction > 0) {
      if (page + 1 < pages.length) setPage(page + 1);
      else if (current && chapter + 1 < current.chapters.length) {
        setChapter(chapter + 1);
        setPage(0);
      } else notify('这本书已经读完了，下一本故事在等你。');
    } else if (page > 0) setPage(page - 1);
    else if (current && chapter > 0) {
      setChapter(chapter - 1);
      setPage(paginate(current.chapters[chapter - 1]).length - 1);
    }
  }

  async function playPause() {
    if (playing) {
      await halt();
      return;
    }
    if (!current || !chunks.length) return;
    await halt();
    const token = ++generation.current;
    setPlaying(true);
    // Capture one page. At its end advance to the next page, while keeping the playback loop alive.
    let ch = chapter,
      pg = page,
      position = speechPosition;
    try {
      while (token === generation.current) {
        const localPages = paginate(current.chapters[ch]);
        const localChunks = speechChunks(localPages[pg].join(' '));
        for (let index = position; index < localChunks.length; index++) {
          if (token !== generation.current) return;
          setSpeechPosition(index);
          await speak(
            localChunks[index],
            prefs.rate,
            prefs.voiceId,
            () => token === generation.current,
          );
        }
        if (token !== generation.current) return;
        if (pg + 1 < localPages.length) pg++;
        else if (ch + 1 < current.chapters.length) {
          ch++;
          pg = 0;
        } else {
          setPlaying(false);
          setSpeechPosition(0);
          notify('全书朗读完成。');
          return;
        }
        position = 0;
        setChapter(ch);
        setPage(pg);
        setSpeechPosition(0);
      }
    } catch (error) {
      if (token === generation.current) {
        setPlaying(false);
        notify(error instanceof Error ? error.message : '朗读失败');
      }
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await removeBook(deleteId);
      if (current?.id === deleteId) {
        await halt();
        setCurrent(null);
        setTab('shelf');
      }
      setBooks((library) => library.filter((book) => book.id !== deleteId));
      setDeleteId(null);
      setMenuBook(null);
      notify('已从本机书架删除。');
    } catch {
      notify('删除失败，请重试。');
    }
  }

  function renderWords(paragraph: string, index: number) {
    return (
      <p key={index}>
        {paragraph.split(/([A-Za-z]+(?:[’'-][A-Za-z]+)*)/g).map((part, tokenIndex) =>
          /^[A-Za-z]/.test(part) ? (
            <button
              className={`word-token ${word?.selected === part ? 'selected' : ''}`}
              key={tokenIndex}
              onClick={() => void translate(part)}
            >
              {part}
            </button>
          ) : (
            part
          ),
        )}
      </p>
    );
  }

  const navItems = [
    { id: 'shelf' as const, label: '书架', icon: BookMarked },
    { id: 'read' as const, label: '阅读', icon: BookOpen },
    { id: 'listen' as const, label: '听书', icon: Headphones },
    { id: 'mine' as const, label: '我的', icon: UserRound },
  ];

  return (
    <div className={`app theme-${prefs.theme} ${tab === 'read' ? 'reading-mode' : ''}`}>
      <header className="app-header">
        <button className="brand" onClick={() => void navigateTab('shelf')} aria-label="叶读首页">
          <span className="brand-mark">
            <Leaf size={23} strokeWidth={1.6} />
          </span>
          <span>
            叶读<span className="brand-english">LEAF READER</span>
          </span>
        </button>
        <nav className="desktop-nav" aria-label="主导航">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? 'active' : ''}
              onClick={() => void navigateTab(item.id)}
            >
              <item.icon size={17} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <span className="offline-badge">
            <span />
            离线也能读
          </span>
          <button className="icon-button" onClick={() => setModal('about')} aria-label="关于与隐私">
            <ShieldCheck size={21} />
          </button>
        </div>
      </header>

      {loading ? (
        <main className="loading-view">
          <LoaderCircle className="spin" />
          正在整理你的书架…
        </main>
      ) : tab === 'shelf' ? (
        <main className="shelf-main">
          <section className="shelf-heading">
            <div>
              <div className="eyebrow">A LITTLE READING, EVERY DAY</div>
              <h1>
                让故事，慢慢发生<span className="title-dot">。</span>
              </h1>
              <p>读一页原文，听一段故事，遇见更大的世界。</p>
            </div>
            <button className="primary-button" onClick={() => setModal('import')}>
              <Plus size={18} />
              导入书籍
            </button>
          </section>

          {recentBook && (
            <section className="continue-card">
              <div className="continue-content">
                <div className="eyebrow">
                  <span className="small-line" />
                  {getProgress(recentBook.id).updatedAt
                    ? 'CONTINUE YOUR STORY'
                    : 'YOUR FIRST CHAPTER'}
                </div>
                <h2>{recentBook.title}</h2>
                <p className="continue-author">
                  {recentBook.author}
                  <span>·</span>
                  {recentBook.subtitle}
                </p>
                <p className="continue-copy">
                  {getProgress(recentBook.id).updatedAt
                    ? '书签已为你留好，接着上次的故事。'
                    : '从一场奇遇开始，让英语阅读成为日常。'}
                </p>
                <div className="continue-buttons">
                  <button className="primary-button" onClick={() => void openBook(recentBook)}>
                    <BookOpen size={17} />
                    {getProgress(recentBook.id).updatedAt ? '继续阅读' : '开始阅读'}
                    <ArrowRight size={16} />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => void openBook(recentBook, 'listen')}
                  >
                    <Headphones size={17} />
                    听这本书
                  </button>
                </div>
              </div>
              <div className="continue-art">
                <div className="art-ring ring-one" />
                <div className="art-ring ring-two" />
                <span className="art-star star-one">✧</span>
                <span className="art-star star-two">✧</span>
                <Cover book={recentBook} className="hero-cover" />
                <span className="art-caption">ONE PAGE AT A TIME</span>
              </div>
            </section>
          )}

          <section className="library-section">
            <div className="library-heading">
              <div className="library-title">
                <h2>我的书架</h2>
                <span>{books.length} 本藏书</span>
              </div>
              <label className="search-field">
                <Search size={17} />
                <input
                  aria-label="搜索书籍"
                  placeholder="搜索书名、作者"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                  <button onClick={() => setQuery('')} aria-label="清空搜索">
                    <X size={15} />
                  </button>
                )}
              </label>
            </div>
            <div className="library-filters">
              <div className="filter-tabs">
                {[
                  { id: 'all', label: '全部书籍' },
                  { id: 'reading', label: '正在阅读' },
                  { id: 'imported', label: '本地导入' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setFilter(item.id)}
                    className={filter === item.id ? 'active' : ''}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <span className="library-note">
                <WifiOff size={14} />
                藏书仅保存在本机
              </span>
            </div>
            <div className="book-grid">
              {visibleBooks.map((book) => (
                <article className="book-item" key={book.id}>
                  <button className="cover-button" onClick={() => void openBook(book)}>
                    <Cover book={book} />
                    {getProgress(book.id).updatedAt > 0 && (
                      <span className="reading-ribbon">
                        <BookOpen size={11} />
                        阅读中
                      </span>
                    )}
                  </button>
                  <div className="book-meta">
                    <button className="book-title" onClick={() => void openBook(book)}>
                      {book.title}
                    </button>
                    <p>{book.author}</p>
                    <div className="book-bottom">
                      <span>
                        {book.source === 'builtin'
                          ? book.subtitle
                          : '本地导入 · ' +
                            (book.filename?.split('.').pop()?.toUpperCase() ?? 'TXT')}
                      </span>
                      {book.source === 'imported' && (
                        <div className="book-menu-wrap">
                          <button
                            className="icon-button tiny"
                            onClick={() => setMenuBook(menuBook === book.id ? null : book.id)}
                            aria-label={`管理 ${book.title}`}
                          >
                            <MoreHorizontal size={18} />
                          </button>
                          {menuBook === book.id && (
                            <button className="delete-menu" onClick={() => setDeleteId(book.id)}>
                              <Trash2 size={14} />
                              删除书籍
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {!visibleBooks.length && (
              <div className="empty-state">
                <BookOpen size={36} />
                <h3>
                  {query
                    ? '没有找到这本书'
                    : filter === 'imported'
                      ? '带一本自己的书来'
                      : '故事从第一页开始'}
                </h3>
                <p>
                  {query
                    ? '试试其他书名或作者。'
                    : filter === 'imported'
                      ? '导入 TXT 或 EPUB，就能离线阅读和查词。'
                      : '打开一本书，它就会出现在这里。'}
                </p>
                {filter === 'imported' && !query && (
                  <button className="primary-button" onClick={() => setModal('import')}>
                    <Plus size={16} />
                    导入第一本书
                  </button>
                )}
              </div>
            )}
          </section>
          <footer className="shelf-footer">
            <Leaf size={17} />
            <span>把世界装进书架，把时间留给阅读。</span>
            <button onClick={() => setModal('about')}>关于叶读</button>
          </footer>
        </main>
      ) : tab === 'mine' ? (
        <main className="mine-main">
          <div className="eyebrow">YOUR WORD COLLECTION</div>
          <h1>我的单词本</h1>
          <p className="mine-intro">每一个收藏的单词，都是你读过的故事。</p>
          <div className="mine-summary">
            <BookMarked size={20} />
            <span>收藏的单词</span>
            <strong>{savedWords.length}</strong>
          </div>
          {savedWords.length ? (
            <div className="saved-word-list">
              {[...savedWords].reverse().map((item) => (
                <button
                  key={item}
                  onClick={() => void translate(item)}
                  aria-label={`查看 ${item} 的释义`}
                >
                  <span>{item}</span>
                  <span>
                    查看释义 <ChevronRight size={16} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <BookMarked size={36} />
              <h3>还没有收藏的单词</h3>
              <p>阅读时点击英文单词，再点击“收藏单词”，就会出现在这里。</p>
              <button className="primary-button" onClick={() => void navigateTab('shelf')}>
                去书架看看
              </button>
            </div>
          )}
          <p className="mine-note">
            <ShieldCheck size={15} />
            单词保存在本机，清除应用数据或卸载后将被移除。
          </p>
        </main>
      ) : current ? (
        <main className={tab === 'read' ? 'reader-main' : 'listen-main'}>
          <div className="reader-toolbar">
            <button className="text-button" onClick={() => setTab('shelf')}>
              <ChevronLeft size={18} />
              书架
            </button>
            <span>{current.subtitle}</span>
            <div>
              <button
                className="icon-button"
                aria-label="章节目录"
                onClick={() => setModal('chapters')}
              >
                <List size={21} />
              </button>
              <button
                className="icon-button"
                aria-label="阅读设置"
                onClick={() => setModal('settings')}
              >
                <Settings2 size={21} />
              </button>
            </div>
          </div>
          {tab === 'read' ? (
            <>
              <div className="reader-book-heading">
                <div className="eyebrow">{current.author}</div>
                <h1>{current.title}</h1>
                <div className="reader-info">
                  <span>{current.chapters[chapter]?.title}</span>
                  <span>
                    <span className="status-dot" />
                    点击英文单词，即可查词
                  </span>
                </div>
              </div>
              <article
                className="reading-area"
                ref={readingArea}
                style={{ fontSize: prefs.fontSize }}
              >
                {pageParagraphs.map(renderWords)}
              </article>
              <div className="page-controls">
                <button
                  className="text-button"
                  disabled={chapter === 0 && page === 0}
                  onClick={() => void movePage(-1)}
                >
                  <ChevronLeft size={18} />
                  上一页
                </button>
                <span>
                  {page + 1} / {pages.length}
                  <small>本章页数</small>
                </span>
                <button
                  className="text-button"
                  disabled={chapter === current.chapters.length - 1 && page === pages.length - 1}
                  onClick={() => void movePage(1)}
                >
                  下一页
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="reader-progress">
                <span style={{ width: `${Math.max(1, progressPercent)}%` }} />
              </div>
              <div className="reader-footnote">
                <span>全书进度 {progressPercent}%</span>
                <button onClick={() => setTab('listen')}>
                  <Headphones size={15} />
                  换一种方式，听故事
                </button>
              </div>
            </>
          ) : (
            <section className="player">
              <div className="eyebrow">LET THE STORY COME TO YOU</div>
              <div className={`player-cover-wrap ${playing ? 'is-playing' : ''}`}>
                <div className="player-halo" />
                <Cover book={current} className="player-cover" />
              </div>
              <h1>{current.title}</h1>
              <p className="player-author">{current.author}</p>
              <button className="chapter-selector" onClick={() => setModal('chapters')}>
                {current.chapters[chapter]?.title}
                <ChevronDown size={15} />
              </button>
              <div className="player-progress">
                <div>
                  <span
                    style={{
                      width: `${chunks.length ? (speechPosition / chunks.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p>
                  <span>
                    本页第 {Math.min(speechPosition + 1, chunks.length)} / {chunks.length} 段
                  </span>
                  <span>全书 {progressPercent}%</span>
                </p>
              </div>
              <div className="player-controls">
                <button
                  aria-label="上一页"
                  onClick={() => void movePage(-1)}
                  disabled={chapter === 0 && page === 0}
                >
                  <SkipBack size={25} />
                </button>
                <button
                  className="play-button"
                  aria-label={playing ? '暂停朗读' : '开始朗读'}
                  onClick={() => void playPause()}
                >
                  {playing ? (
                    <Pause size={30} fill="currentColor" />
                  ) : (
                    <Play size={30} fill="currentColor" />
                  )}
                </button>
                <button
                  aria-label="下一页"
                  onClick={() => void movePage(1)}
                  disabled={chapter === current.chapters.length - 1 && page === pages.length - 1}
                >
                  <SkipForward size={25} />
                </button>
              </div>
              <button
                className="current-voice"
                aria-label="选择朗读音色"
                onClick={() => setModal('voices')}
              >
                <Volume2 size={17} />
                <span>
                  <strong>
                    {selectedVoice?.name || (voicesLoading ? '正在读取音色…' : '选择英文音色')}
                  </strong>
                  <small>
                    {selectedVoice
                      ? `${voiceAccent(selectedVoice.lang)} · 本机离线`
                      : '支持切换和试听'}
                  </small>
                </span>
                <ChevronDown size={15} />
              </button>
              <div className="player-options">
                <label>
                  <Volume2 size={18} />
                  <select
                    aria-label="朗读语速"
                    value={prefs.rate}
                    onChange={(event) => {
                      void halt();
                      setPrefs({ ...prefs, rate: Number(event.target.value) });
                    }}
                  >
                    <option value="0.7">0.7× 慢速</option>
                    <option value="0.85">0.85×</option>
                    <option value="1">1.0× 语速</option>
                    <option value="1.2">1.2×</option>
                    <option value="1.5">1.5× 快速</option>
                  </select>
                </label>
                <label>
                  <Timer size={18} />
                  <select
                    aria-label="定时停止"
                    value={timerMinutes}
                    onChange={(event) => setTimerMinutes(Number(event.target.value))}
                  >
                    <option value="0">定时关闭</option>
                    <option value="15">15 分钟后</option>
                    <option value="30">30 分钟后</option>
                    <option value="60">60 分钟后</option>
                  </select>
                </label>
              </div>
              <p className="player-hint">
                <ShieldCheck size={14} />
                Android 使用本机离线英文语音，不上传书籍
              </p>
              <p className="player-caveat">首版支持前台朗读，切后台或锁屏会暂停。</p>
              <button
                className="text-button voice-settings"
                onClick={() => void installVoice().catch((error) => notify(error.message))}
              >
                安装 / 检查英文语音
              </button>
            </section>
          )}
        </main>
      ) : (
        <main className="empty-state">
          <BookOpen size={38} />
          <h2>先选一本书吧</h2>
          <button className="primary-button" onClick={() => setTab('shelf')}>
            回到书架
          </button>
        </main>
      )}

      {playing && tab !== 'listen' && current && (
        <div className="mini-player">
          <button onClick={() => setTab('listen')}>
            <Headphones size={19} />
            <span>
              {current.title}
              <small>正在朗读 · 点击打开播放器</small>
            </span>
          </button>
          <button aria-label="暂停朗读" onClick={() => void halt()}>
            <Pause size={20} />
          </button>
        </div>
      )}
      <nav className="mobile-nav" aria-label="底部导航">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? 'active' : ''}
            onClick={() => void navigateTab(item.id)}
          >
            <item.icon size={22} strokeWidth={tab === item.id ? 2 : 1.6} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {word && (
        <div
          className="word-overlay"
          onClick={() => {
            wordRequest.current++;
            setWord(null);
          }}
        >
          <section
            className="word-card"
            role="dialog"
            aria-label="单词释义"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="icon-button word-close"
              aria-label="关闭查词"
              onClick={() => {
                wordRequest.current++;
                setWord(null);
              }}
            >
              <X size={19} />
            </button>
            <div className="eyebrow">YOUR POCKET DICTIONARY</div>
            <h2>
              {word.selected}
              <button
                aria-label="朗读单词"
                className="icon-button"
                disabled={playing}
                onClick={() =>
                  void speak(word.selected, 0.85, prefs.voiceId).catch((error) =>
                    notify(error.message),
                  )
                }
              >
                <Volume2 size={20} />
              </button>
            </h2>
            {word.loading ? (
              <p>
                <LoaderCircle size={17} className="spin" />
                正在查词…
              </p>
            ) : word.error ? (
              <p>{word.error}</p>
            ) : word.entry ? (
              <>
                <p className="phonetic">
                  {word.entry.phonetic && `/${word.entry.phonetic}/`}
                  {word.entry.word !== word.selected.toLowerCase() && (
                    <span>原形 {word.entry.word}</span>
                  )}
                </p>
                <p className="definition">{word.entry.translation}</p>
                <button
                  className={`save-word ${savedWords.includes(word.entry.word) ? 'saved' : ''}`}
                  onClick={() =>
                    setSavedWords((list) =>
                      list.includes(word.entry!.word)
                        ? list.filter((item) => item !== word.entry!.word)
                        : [...list, word.entry!.word],
                    )
                  }
                >
                  {savedWords.includes(word.entry.word) ? <Check size={16} /> : <Plus size={16} />}
                  {savedWords.includes(word.entry.word) ? '已收藏 · 再点取消' : '收藏单词'}
                </button>
              </>
            ) : (
              <p className="definition">离线词典暂未收录这个词，可能是专有名词或少见词形。</p>
            )}
            <footer>
              <WifiOff size={13} />
              离线词典 · 词义不随上下文变化
            </footer>
          </section>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <section
            className={`modal ${modal === 'chapters' ? 'chapters-modal' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === 'import'
                ? '导入书籍'
                : modal === 'settings'
                  ? '阅读设置'
                  : modal === 'chapters'
                    ? '章节目录'
                    : modal === 'voices'
                      ? '朗读音色'
                      : '关于叶读'
            }
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="icon-button modal-close"
              aria-label="关闭弹窗"
              onClick={() => setModal(null)}
            >
              <X size={21} />
            </button>
            {modal === 'voices' ? (
              <VoicePicker
                voices={voices}
                selectedId={selectedVoice?.id || ''}
                previewing={previewing}
                loading={voicesLoading}
                error={voiceError}
                onRefresh={() => void refreshVoices()}
                onSelect={(voice) => {
                  void halt();
                  setPrefs((previous) => ({ ...previous, voiceId: voice.id }));
                }}
                onPreview={(voice) => void previewVoice(voice)}
              />
            ) : modal === 'import' ? (
              <>
                <span className="modal-symbol">
                  <BookMarked size={29} />
                </span>
                <div className="eyebrow">MAKE ROOM FOR YOUR STORIES</div>
                <h2>带一本自己的书来</h2>
                <p>把喜欢的英文书放进口袋，随时读，也随时听。</p>
                <button className="upload-zone" disabled={busy} onClick={() => void chooseFile()}>
                  <ArrowDownToLine size={30} />
                  <strong>{busy ? '正在整理书籍…' : '选择本地书籍'}</strong>
                  <span>TXT / EPUB · 最大 15 MB</span>
                </button>
                <div className="import-notes">
                  <p>
                    <ShieldCheck size={16} />
                    文件仅保存在本机，不上传到服务器
                  </p>
                  <p>
                    <BookOpen size={16} />
                    支持文字 EPUB，暂不支持 PDF、扫描版和 DRM
                  </p>
                  <p>
                    <WifiOff size={16} />
                    导入后无需网络，即可阅读与查词
                  </p>
                </div>
                <p className="small-print">
                  请导入你有权使用的书籍。卸载 App 或清除数据会移除本地藏书，请保留原文件。
                </p>
              </>
            ) : modal === 'settings' ? (
              <>
                <div className="eyebrow">YOUR READING SPACE</div>
                <h2>读起来，刚刚好</h2>
                <div className="setting-row">
                  <span>文字大小</span>
                  <div className="font-controls">
                    <button
                      aria-label="减小字号"
                      disabled={prefs.fontSize <= 16}
                      onClick={() => setPrefs({ ...prefs, fontSize: prefs.fontSize - 1 })}
                    >
                      A−
                    </button>
                    <span>{prefs.fontSize}</span>
                    <button
                      aria-label="增大字号"
                      disabled={prefs.fontSize >= 28}
                      onClick={() => setPrefs({ ...prefs, fontSize: prefs.fontSize + 1 })}
                    >
                      A+
                    </button>
                  </div>
                </div>
                <div className="setting-row">
                  <span>阅读背景</span>
                  <div className="theme-options">
                    {(['paper', 'sage', 'night'] as const).map((theme) => (
                      <button
                        key={theme}
                        aria-label={{ paper: '纸白', sage: '青绿', night: '夜间' }[theme]}
                        className={`${theme} ${prefs.theme === theme ? 'chosen' : ''}`}
                        onClick={() => setPrefs({ ...prefs, theme })}
                      >
                        {theme === 'night' ? (
                          <Moon size={17} />
                        ) : prefs.theme === theme ? (
                          <Check size={17} />
                        ) : (
                          'Aa'
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="small-print">阅读设置会自动保存到本机。</p>
              </>
            ) : modal === 'chapters' ? (
              <>
                <div className="eyebrow">TABLE OF CONTENTS</div>
                <h2>故事的每一站</h2>
                <p>{current?.title}</p>
                <div className="chapter-list">
                  {current?.chapters.map((item, index) => (
                    <button
                      className={chapter === index ? 'active' : ''}
                      key={index}
                      onClick={() => {
                        void halt();
                        setChapter(index);
                        setPage(0);
                        setSpeechPosition(0);
                        setModal(null);
                      }}
                    >
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <strong>{item.title}</strong>
                      {chapter === index && <BookOpen size={15} />}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <span className="modal-symbol">
                  <Leaf size={30} />
                </span>
                <div className="eyebrow">A SMALL APP, A BIGGER WORLD</div>
                <h2>叶读 · Leaf Reader</h2>
                <p>一个安静的英文阅读角落。书架、阅读、听书，让每一页都更亲近。</p>
                <div className="about-details">
                  <p>
                    <strong>本地优先</strong>
                    书籍、进度和收藏存在本机。当前版本没有账号、广告、追踪或付费接口。
                  </p>
                  <p>
                    <strong>阅读与听书</strong>离线词典提供基础释义；Android
                    需安装英文离线语音包。首版仅支持前台朗读，切后台或锁屏会暂停。
                  </p>
                  <p>
                    <strong>内容来源</strong>内置十本原版全文来自 Project
                    Gutenberg；原文件保留其许可声明。正式发行前应按发行地区核实具体版本、类目和资质。
                  </p>
                  <p>
                    <strong>词典许可</strong>ECDICT 精选词库（MIT）。
                    <a href="/licenses/ECDICT-MIT.txt" target="_blank" rel="noreferrer">
                      查看许可
                    </a>
                  </p>
                  <p>
                    <strong>你的收藏</strong>
                    {savedWords.length ? savedWords.join(' · ') : '在阅读时点击单词，即可收藏。'}
                  </p>
                </div>
                <span className="version">
                  VERSION {packageInfo.version} · MADE FOR SLOW READING
                </span>
              </>
            )}
          </section>
        </div>
      )}
      {deleteId && (
        <div className="modal-overlay">
          <section className="modal" role="alertdialog" aria-label="删除书籍">
            <h2>从书架移除？</h2>
            <p>会删除这本本地书籍及阅读进度。原始文件不会被修改。</p>
            <div className="confirm-actions">
              <button className="text-button" onClick={() => setDeleteId(null)}>
                取消
              </button>
              <button className="danger-button" onClick={() => void confirmDelete()}>
                <Trash2 size={16} />
                确认删除
              </button>
            </div>
          </section>
        </div>
      )}
      <input
        ref={fileInput}
        type="file"
        accept=".txt,.epub,text/plain,application/epub+zip"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            if (file.size > 15 * 1024 * 1024) notify('请选择 15 MB 以内的书籍。');
            else
              void file
                .arrayBuffer()
                .then((data) => consumeFile(file.name, data))
                .catch(() => notify('文件读取失败'));
          }
          event.target.value = '';
        }}
      />
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
        </div>
      )}
      {busy && !modal && (
        <div className="busy-indicator" role="status">
          <LoaderCircle className="spin" size={17} />
          正在打开书籍
        </div>
      )}
    </div>
  );
}
