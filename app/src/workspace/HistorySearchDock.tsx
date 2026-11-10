import type { Dispatch, Ref, SetStateAction } from 'react';
import { Search, X } from 'lucide-react';
import type { HistoryTranslate } from './historyPresentation';

export function HistorySearchDock({
  query,
  setQuery,
  historyTagFilters,
  locale,
  historySearchInputRef,
  historyResultCountLabel,
  historySelectionCountLabel,
  historyMultiSelectHintLabel,
  historyMultiSelectHintTitle,
  onSelectTag,
  t,
}: {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  historyTagFilters: { tag: string; count: number }[];
  locale: 'ru' | 'en';
  historySearchInputRef: Ref<HTMLInputElement>;
  historyResultCountLabel: string;
  historySelectionCountLabel: string | null;
  historyMultiSelectHintLabel: string | null;
  historyMultiSelectHintTitle: string;
  onSelectTag: (tag: string) => void;
  t: HistoryTranslate;
}) {
  const selectionStatusLabels = [historySelectionCountLabel, historyMultiSelectHintLabel].filter(Boolean);
  const selectionStatusLabel = selectionStatusLabels.join('. ');
  const resultCountAccessibleLabel = [historyResultCountLabel, selectionStatusLabel].filter(Boolean).join('. ');
  const resultCountTitle = [
    historyResultCountLabel,
    historySelectionCountLabel,
    historyMultiSelectHintLabel ? historyMultiSelectHintTitle : null,
  ].filter(Boolean).join('. ');

  return (
    <div className="history-search-dock">
      <div className="history-search" role="search">
        <Search size={18} strokeWidth={1.7} aria-hidden="true" />
        <div className="history-search-entry">
          <input
            ref={historySearchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('history.searchPlaceholderHint')}
            aria-label={t('history.searchPlaceholder')}
            title={t('history.searchHelp')}
          />
          <button
            type="button"
            className={`history-search-clear${query.length > 0 ? '' : ' is-reserved'}`}
            onClick={() => setQuery('')}
            disabled={query.length === 0}
            aria-label={t('history.clearSearch')}
          >
            <X size={15} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
        <div
          className={`history-result-count${selectionStatusLabel ? ' has-selection-status' : ''}`}
          role="status"
          aria-live="polite"
          aria-label={resultCountAccessibleLabel}
          title={resultCountTitle}
        >
          <span className="history-result-count-label">{historyResultCountLabel}</span>
          {historySelectionCountLabel && (
            <span className="history-selection-status">{historySelectionCountLabel}</span>
          )}
          {historyMultiSelectHintLabel && (
            <span className="history-selection-status">{historyMultiSelectHintLabel}</span>
          )}
        </div>
      </div>
      {!query.trim() && historyTagFilters.length > 0 && (
        <div className="history-search-tags" role="group" aria-label={t('history.tagFilters')}>
          <span className="history-search-tag-label">{t('history.tagFilters')}</span>
          {historyTagFilters.map(({ tag, count }) => (
            <button
              key={tag.toLocaleLowerCase(locale)}
              type="button"
              className="history-search-tag"
              title={`${tag} (${count})`}
              onClick={() => onSelectTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
