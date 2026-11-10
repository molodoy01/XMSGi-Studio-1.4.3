import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';

const DETAIL_EMPTY_COPY_DELAY_MS = 350;

export function HistoryDetailEmptyState({
  title,
  text,
  ready,
}: {
  title: string;
  text: string;
  ready: boolean;
}) {
  const [displayedCopy, setDisplayedCopy] = useState<{ title: string; text: string } | null>(null);

  useEffect(() => {
    if (!ready) {
      setDisplayedCopy(null);
      return undefined;
    }

    const timeout = window.setTimeout(() => setDisplayedCopy({ title, text }), DETAIL_EMPTY_COPY_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [ready, text, title]);

  const showCopy = ready
    && displayedCopy?.title === title
    && displayedCopy.text === text;

  return (
    <div className="history-detail-empty">
      <div className="history-detail-empty-content">
        <div className={`history-detail-empty-art${showCopy ? ' is-visible' : ''}`} aria-hidden="true">
          <span className="history-detail-empty-art-orbit history-detail-empty-art-orbit--outer" />
          <span className="history-detail-empty-art-orbit history-detail-empty-art-orbit--inner" />
          <span className="history-detail-empty-art-spark history-detail-empty-art-spark--left" />
          <span className="history-detail-empty-art-spark history-detail-empty-art-spark--right" />
          <span className="history-detail-empty-art-icon">
            <Send size={28} strokeWidth={1.8} />
          </span>
        </div>
        <div
          className={`history-detail-empty-copy${showCopy ? ' is-visible' : ''}`}
          aria-hidden={!showCopy}
        >
          <h2>{displayedCopy?.title ?? title}</h2>
          <p>{displayedCopy?.text ?? text}</p>
        </div>
      </div>
    </div>
  );
}
