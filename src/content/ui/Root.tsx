import { useEffect, useState } from 'react';
import { extractArticle, type Article } from '@/src/content/extract';
import { NoArticlePill } from './NoArticlePill';
import { ReaderApp } from './ReaderApp';
import { PageFocusBand } from './PageFocusBand';

export interface RootProps {
  initialArticle: Article | null;
  onClose(): void;
}

/** Locks the page's own scrolling while Focus View covers it. */
function usePageScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const html = document.documentElement;
    const previous = html.style.getPropertyValue('overflow');
    const priority = html.style.getPropertyPriority('overflow');
    html.style.setProperty('overflow', 'hidden', 'important');
    return () => {
      if (previous) html.style.setProperty('overflow', previous, priority);
      else html.style.removeProperty('overflow');
    };
  }, [locked]);
}

export function Root({ initialArticle, onClose }: RootProps) {
  const [article, setArticle] = useState<Article | null>(initialArticle);
  const [failed, setFailed] = useState(false);
  const [pageBand, setPageBand] = useState(false);
  usePageScrollLock(article !== null);

  if (article) return <ReaderApp article={article} onClose={onClose} />;

  if (pageBand) return <PageFocusBand onClose={onClose} />;

  if (failed) {
    return (
      <div className="pill" role="alert">
        <span className="dot" aria-hidden="true" />
        <span>Couldn&apos;t find readable text here.</span>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <NoArticlePill
      onClose={onClose}
      onFocusBand={() => setPageBand(true)}
      onTryAnyway={() => {
        const forced = extractArticle(document);
        if (forced) setArticle(forced);
        else setFailed(true);
      }}
    />
  );
}
