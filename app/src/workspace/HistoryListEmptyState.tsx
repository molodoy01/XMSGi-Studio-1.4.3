import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { DraftColor } from '@studio/types';
import type { HistoryStatusFilter, HistorySourceFilter, HistoryTranslate } from './historyPresentation';

const EMPTY_COPY_DELAY_MS = 350;
const LOADING_SPINNER_DELAY_MS = 350;

function HistoryLoadingSpinner() {
  const [animationDelay] = useState(() => -Math.random() * 800);

  return (
    <svg
      className="history-loading-spinner"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="history-loading-spinner-track" cx="11" cy="11" r="8" />
      <circle
        className="history-loading-spinner-arc"
        cx="11"
        cy="11"
        r="8"
        style={{ animationDelay: `${animationDelay}ms` }}
      />
    </svg>
  );
}

export function HistoryListEmptyState({
  pageMode,
  historyDataReady,
  draftsLoading,
  draftLoadFailed,
  query,
  statusFilter,
  sourceFilter,
  selectedDraftColor = null,
  onResetSearch,
  onCreateInStudio,
  onCreateInPlanner,
  t,
}: {
  pageMode: boolean;
  historyDataReady: boolean;
  draftsLoading: boolean;
  draftLoadFailed: boolean;
  query: string;
  statusFilter: HistoryStatusFilter;
  sourceFilter: HistorySourceFilter;
  selectedDraftColor?: DraftColor | null;
  onResetSearch: () => void;
  onCreateInStudio: () => void;
  onCreateInPlanner: () => void;
  t: HistoryTranslate;
}) {
  const isDraftLoading = draftsLoading && statusFilter === 'drafts' && !query.trim();
  const isDraftLoadFailed = draftLoadFailed && statusFilter === 'drafts' && !query.trim();
  const title = isDraftLoading
    ? t('history.draftsLoading')
    : isDraftLoadFailed
      ? t('history.draftsLoadFailed')
      : query ? t('history.noResults') : t('history.emptyCategory');
  const text = isDraftLoading
    ? t('history.draftsLoadingHint')
    : isDraftLoadFailed
      ? t('history.draftsLoadFailedHint')
      : query
        ? t('history.changeSearch')
        : statusFilter === 'errors'
          ? t('history.errorsEmpty')
          : sourceFilter === 'personal' && statusFilter === 'notes'
            ? t('history.appNotesHint')
            : sourceFilter === 'personal'
              ? t('history.personalEmpty')
              : t('history.generalEmpty');
  const copyKey = [title, text, query.trim(), statusFilter, sourceFilter].join('\u0000');
  const [visibleCopyKey, setVisibleCopyKey] = useState<string | null>(null);
  const [keepLoadingSpinnerVisible, setKeepLoadingSpinnerVisible] = useState(false);
  const [selectionSpinnerVisible, setSelectionSpinnerVisible] = useState(false);
  const loadingStartedAt = useRef<number | null>(null);
  const emptySelectionSpinnerKey = pageMode
    && !query.trim()
    && (statusFilter === 'scheduled'
      || statusFilter === 'sent'
      || statusFilter === 'errors'
      || sourceFilter !== 'all'
      || (statusFilter === 'drafts' && selectedDraftColor !== null))
    ? `${statusFilter}\u0000${sourceFilter}\u0000${selectedDraftColor ?? ''}`
    : null;

  useLayoutEffect(() => {
    if (!pageMode) {
      loadingStartedAt.current = null;
      setKeepLoadingSpinnerVisible(false);
      return undefined;
    }

    if (!historyDataReady) {
      loadingStartedAt.current ??= Date.now();
      setKeepLoadingSpinnerVisible(false);
      return undefined;
    }

    const startedAt = loadingStartedAt.current;
    if (startedAt === null) {
      setKeepLoadingSpinnerVisible(false);
      return undefined;
    }

    const remainingDelay = LOADING_SPINNER_DELAY_MS - (Date.now() - startedAt);
    if (remainingDelay <= 0) {
      loadingStartedAt.current = null;
      setKeepLoadingSpinnerVisible(false);
      return undefined;
    }

    setKeepLoadingSpinnerVisible(true);
    const timeout = window.setTimeout(() => {
      loadingStartedAt.current = null;
      setKeepLoadingSpinnerVisible(false);
    }, remainingDelay);
    return () => window.clearTimeout(timeout);
  }, [historyDataReady, pageMode]);

  useEffect(() => {
    if (!emptySelectionSpinnerKey) {
      setSelectionSpinnerVisible(false);
      return undefined;
    }

    setSelectionSpinnerVisible(true);
    const timeout = window.setTimeout(() => setSelectionSpinnerVisible(false), LOADING_SPINNER_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [emptySelectionSpinnerKey]);

  useEffect(() => {
    if (!pageMode) {
      setVisibleCopyKey(copyKey);
      return undefined;
    }

    if (!historyDataReady) {
      setVisibleCopyKey(null);
      return undefined;
    }

    const timeout = window.setTimeout(() => setVisibleCopyKey(copyKey), EMPTY_COPY_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [copyKey, historyDataReady, pageMode]);

  const showCopy = historyDataReady && (!pageMode || visibleCopyKey === copyKey);
  const artwork = pageMode ? (
    <div className="history-empty-art" aria-hidden="true">
      <span className="history-empty-art-orbit history-empty-art-orbit--outer" />
      <span className="history-empty-art-orbit history-empty-art-orbit--inner" />
      <span className="history-empty-art-spark history-empty-art-spark--left" />
      <span className="history-empty-art-spark history-empty-art-spark--right" />
      <span className="history-empty-art-icon">
        {historyDataReady && !keepLoadingSpinnerVisible && !selectionSpinnerVisible
          ? <Search size={26} strokeWidth={1.8} />
          : <HistoryLoadingSpinner key={emptySelectionSpinnerKey ?? (historyDataReady ? 'settled' : 'loading')} />}
      </span>
    </div>
  ) : <Search size={21} strokeWidth={1.5} aria-hidden="true" />;

  return (
    <div
      className={`history-empty${pageMode ? ' is-page-empty' : ''}`}
      role="status"
      {...(!historyDataReady ? { 'aria-live': 'polite', 'aria-label': t('history.loading') } : {})}
    >
      <div className={`history-empty-content${pageMode ? ' is-page-empty-content' : ''}`}>
        {artwork}
        {historyDataReady && (
          <div
            className={`history-empty-page-copy${showCopy ? ' is-visible' : ''}`}
            aria-hidden={!showCopy}
          >
            <strong>{title}</strong>
            <span>{text}</span>
            {query && <button type="button" onClick={onResetSearch} disabled={!showCopy}>{t('history.resetSearch')}</button>}
            {pageMode && !draftsLoading && !draftLoadFailed && !query.trim() && statusFilter !== 'sent' && (
              <div className="history-empty-create-actions">
                {sourceFilter !== 'personal' && statusFilter !== 'notes' && (
                  <button type="button" onClick={onCreateInStudio} disabled={!showCopy}>
                    <Plus size={14} aria-hidden="true" />
                    {t('history.createInStudio')}
                  </button>
                )}
                {sourceFilter !== 'workspace' && (
                  <button type="button" onClick={onCreateInPlanner} disabled={!showCopy}>
                    <Plus size={14} aria-hidden="true" />
                    {t('history.createInPlanner')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
