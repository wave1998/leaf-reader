import type { Book } from '../types';

export default function Cover({ book, className = '' }: { book: Book; className?: string }) {
  return (
    <div
      className={`book-cover ${className}`}
      style={{ '--cover': book.color, '--ink': book.accent } as React.CSSProperties}
      aria-label={`${book.title} 封面`}
    >
      <div className="cover-frame" />
      <div className="cover-topline">LEAF CLASSICS</div>
      <div className="cover-title">{book.title}</div>
      <svg
        className={`cover-illustration motif-${book.motif}`}
        viewBox="0 0 160 130"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        aria-hidden="true"
      >
        {book.motif === 'alice' ? (
          <>
            <path d="M32 99C22 60 54 38 80 55c26-17 58 5 48 44M47 69C29 30 43 7 56 16c12 8 7 32 5 40M99 56c-2-24-1-43 11-42s18 27 3 56M47 99c6-18 24-27 33-21 9-6 27 3 33 21M71 79l9 12 9-12M56 104h48" />
            <circle cx="61" cy="72" r="2" />
            <circle cx="100" cy="72" r="2" />
            <path d="M19 116h122M21 37l5-5m106 4 6 5M80 15v13m-6-6h12" />
          </>
        ) : book.motif === 'flower' ? (
          <>
            <path d="M80 118V61M80 93C50 91 43 69 49 61c22 0 32 21 31 32m0 12c27-3 39-17 35-29-19 0-32 17-35 29" />
            <path d="M80 63c-31-4-28-25-16-26-13-19 7-35 16-17 9-18 29-2 16 17 13 1 15 22-16 26Z" />
            <circle cx="80" cy="43" r="9" />
            <path d="M28 117h104M29 42l5 5m93-21-4 7" />
          </>
        ) : book.motif === 'sherlock' ? (
          <>
            <circle cx="74" cy="52" r="34" />
            <circle cx="74" cy="52" r="27" />
            <path d="m98 79 30 32-9 8-31-32M64 40c0-12 22-12 22 0 0 9-12 9-12 18m0 8v3M25 119h113" />
          </>
        ) : book.motif === 'clock' ? (
          <>
            <circle cx="80" cy="63" r="47" />
            <circle cx="80" cy="63" r="40" />
            <path d="M80 29v8m0 51v8M45 63h8m54 0h8M80 63V43m0 20 18 12M70 9h20M80 9v7M19 117h122" />
            <circle cx="80" cy="63" r="3" />
          </>
        ) : book.motif === 'moon' ? (
          <>
            <path d="M100 18a44 44 0 1 0 16 78A45 45 0 0 1 100 18Z" />
            <path d="m49 88 13-21 7 13 13-29 18 44M22 114h116M128 31v12m-6-6h12M34 31v6m-3-3h6" />
          </>
        ) : book.motif === 'compass' ? (
          <>
            <circle cx="80" cy="66" r="43" />
            <path d="m80 24 13 31 30 11-30 12-13 31-13-31-30-12 30-11 13-31Zm0 17v50M54 66h52M80 13v-5m0 116v-5M22 66h-5m126 0h-5" />
            <circle cx="80" cy="66" r="8" />
          </>
        ) : book.motif === 'star' ? (
          <>
            <path d="m80 14 14 34 36 4-28 24 9 36-31-19-31 19 9-36-28-24 36-4 14-34Z" />
            <path d="M80 36v40m-16-21 16 21 17-21M18 24l8 8m108-8-8 8M19 108l8-5m114 5-8-5" />
          </>
        ) : book.motif === 'boat' ? (
          <>
            <path d="M27 90h107l-18 21H46L27 90ZM80 20v70M74 29 39 81h35V29Zm12 11 31 41H86V40ZM17 120q12-9 24 0t24 0 24 0 24 0 24 0" />
          </>
        ) : (
          <>
            <path d="M22 90q20-62 70-41c14 6 22 0 32-16l6 21-17 18c-12 38-54 43-91 18ZM21 91l-7 17 21-9M71 45V24m0 0c-12-13-25-10-26-4m26 4c9-17 23-19 28-13M20 119q12-9 24 0t24 0 24 0 24 0 24 0" />
            <circle cx="99" cy="66" r="2" />
          </>
        )}
      </svg>
      <div className="cover-author">{book.author}</div>
    </div>
  );
}
