import type { Dispatch, SetStateAction } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatDisplayCount, type HistorySourceFilter, type HistoryStatusFilter, type HistoryTranslate } from './historyPresentation';

type HistoryCounts = {
  source: Record<HistorySourceFilter, number>;
  status: Record<HistoryStatusFilter, number>;
};

export function HistoryFilterControls({
  statusFilter,
  sourceFilter,
  historyCounts,
  historyDataReady,
  isAutoCategoryPending,
  isSourceMenuOpen,
  statusFiltersRef,
  sourceMenuRef,
  sourceMenuButtonRef,
  sourceMenuItemsRef,
  setIsSourceMenuOpen,
  selectStatusFilter,
  selectSourceFilter,
  selectErrorsFilter,
  onStatusChange,
  onSourceChange,
  locale,
  t,
}: {
  statusFilter: HistoryStatusFilter;
  sourceFilter: HistorySourceFilter;
  historyCounts: HistoryCounts;
  historyDataReady: boolean;
  isAutoCategoryPending: boolean;
  isSourceMenuOpen: boolean;
  statusFiltersRef: { current: HTMLDivElement | null };
  sourceMenuRef: { current: HTMLDivElement | null };
  sourceMenuButtonRef: { current: HTMLButtonElement | null };
  sourceMenuItemsRef: { current: HTMLDivElement | null };
  setIsSourceMenuOpen: Dispatch<SetStateAction<boolean>>;
  selectStatusFilter: (filter: HistoryStatusFilter) => void;
  selectSourceFilter: (filter: HistorySourceFilter) => void;
  selectErrorsFilter: () => void;
  onStatusChange: (status: HistoryStatusFilter) => void;
  onSourceChange: () => void;
  locale: 'ru' | 'en';
  t: HistoryTranslate;
}) {
  const visibleStatusFilters: HistoryStatusFilter[] = ['scheduled', 'sent', 'drafts'];
  const sourceLabels: Record<HistorySourceFilter, string> = {
    all: t('history.sourceAll'),
    workspace: t('history.sourceStudio'),
    personal: t('history.sourcePersonal'),
  };
  const historyStatusFilters = (
    <div
      className={`history-status-filters${statusFilter === 'errors' ? ' is-errors-filter' : ''}`}
      ref={statusFiltersRef}
      role="tablist"
      aria-label={t('history.statuses')}
    >
      {visibleStatusFilters.map((item) => {
        const labelKey = item === 'scheduled'
          ? 'history.categoryScheduled'
          : item === 'sent'
            ? 'history.categorySent'
            : item === 'errors'
              ? 'history.categoryErrors'
              : item === 'notes'
                ? 'history.categoryNotes'
                : 'history.categoryDrafts';
        const compactLabelKey = item === 'scheduled'
          ? 'history.categoryScheduledCompact'
          : item === 'sent'
            ? 'history.categorySentCompact'
            : item === 'errors'
              ? 'history.categoryErrorsCompact'
              : item === 'notes'
                ? 'history.categoryNotesCompact'
                : 'history.categoryDraftsCompact';

        return (
          <button
            key={item}
            type="button"
            data-history-filter={item}
            disabled={!historyDataReady}
            tabIndex={statusFilter === item ? 0 : -1}
            onClick={() => {
              selectStatusFilter(item);
              onStatusChange(item);
            }}
            onKeyDown={(event) => {
              const tabs = statusFiltersRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
              if (!tabs?.length) return;
              const currentIndex = Array.from(tabs).indexOf(event.currentTarget);
              let nextIndex: number;

              if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
              else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
              else if (event.key === 'Home') nextIndex = 0;
              else if (event.key === 'End') nextIndex = tabs.length - 1;
              else return;

              event.preventDefault();
              const nextTab = tabs[nextIndex];
              nextTab.focus();
              nextTab.click();
            }}
            className={`history-status-tab${statusFilter === item && !isAutoCategoryPending ? ' is-active' : ''}`}
            role="tab"
            aria-selected={statusFilter === item}
            aria-label={t(labelKey)}
            title={t(labelKey)}
          >
            <span className="history-status-label">{t(labelKey)}</span>
            <span className="history-status-label-compact">{t(compactLabelKey)}</span>
            <span className={`history-filter-count${historyDataReady && historyCounts.status[item] === 0 ? ' is-zero' : ''}`} aria-hidden="true">
              {historyDataReady ? formatDisplayCount(historyCounts.status[item], locale) : '…'}
            </span>
          </button>
        );
      })}
    </div>
  );
  const historySourceFilters = (
    <div className="history-source-filters" role="group" aria-label={t('history.sources')}>
      {(['all', 'workspace', 'personal'] as const).map((item) => (
        <button
          key={item}
          type="button"
          data-history-filter={item}
          onClick={() => {
            selectSourceFilter(item);
            onSourceChange();
          }}
          className={`history-filter${sourceFilter === item && statusFilter !== 'errors' ? ' is-active' : ''}`}
          aria-pressed={sourceFilter === item && statusFilter !== 'errors'}
          aria-label={sourceLabels[item]}
        >
          <span>{sourceLabels[item]}</span>
          <span className="history-filter-count" aria-hidden="true">{formatDisplayCount(historyCounts.source[item], locale)}</span>
        </button>
      ))}
      <button
        type="button"
        data-history-filter="errors"
        onClick={() => {
          selectErrorsFilter();
          onSourceChange();
        }}
        className={`history-filter${statusFilter === 'errors' ? ' is-active' : ''}`}
        aria-pressed={statusFilter === 'errors'}
        aria-label={t('history.categoryErrors')}
      >
        <span>{t('history.categoryErrors')}</span>
        <span className="history-filter-count" aria-hidden="true">{formatDisplayCount(historyCounts.status.errors, locale)}</span>
      </button>
    </div>
  );
  const historySourceMenu = isSourceMenuOpen && (
    <div
      className="history-source-menu"
      ref={sourceMenuItemsRef}
      role="menu"
      aria-label={t('history.sources')}
    >
      {(['all', 'workspace', 'personal'] as const).map((item) => (
        <button
          key={item}
          type="button"
          role="menuitemradio"
          data-history-filter={item}
          aria-checked={sourceFilter === item && statusFilter !== 'errors'}
          className="history-source-option"
          onClick={() => {
            selectSourceFilter(item);
            onSourceChange();
            setIsSourceMenuOpen(false);
            sourceMenuButtonRef.current?.focus();
          }}
          onKeyDown={(event) => {
            const options = sourceMenuItemsRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
            if (!options?.length) return;
            const currentIndex = Array.from(options).indexOf(event.currentTarget);
            let nextIndex: number;
            if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % options.length;
            else if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + options.length) % options.length;
            else if (event.key === 'Home') nextIndex = 0;
            else if (event.key === 'End') nextIndex = options.length - 1;
            else return;
            event.preventDefault();
            options[nextIndex].focus();
          }}
        >
          <span>{sourceLabels[item]}</span>
          <span className="history-filter-count" aria-hidden="true">{formatDisplayCount(historyCounts.source[item], locale)}</span>
        </button>
      ))}
      <button
        type="button"
        role="menuitemradio"
        data-history-filter="errors"
        aria-checked={statusFilter === 'errors'}
        className="history-source-option history-source-option--errors"
        onClick={() => {
          selectErrorsFilter();
          onSourceChange();
          setIsSourceMenuOpen(false);
          sourceMenuButtonRef.current?.focus();
        }}
        onKeyDown={(event) => {
          const options = sourceMenuItemsRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
          if (!options?.length) return;
          const currentIndex = Array.from(options).indexOf(event.currentTarget);
          let nextIndex: number;
          if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % options.length;
          else if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + options.length) % options.length;
          else if (event.key === 'Home') nextIndex = 0;
          else if (event.key === 'End') nextIndex = options.length - 1;
          else return;
          event.preventDefault();
          options[nextIndex].focus();
        }}
      >
        <span>{t('history.categoryErrors')}</span>
        <span className="history-filter-count" aria-hidden="true">{formatDisplayCount(historyCounts.status.errors, locale)}</span>
      </button>
    </div>
  );
  const historySourceSelect = (
    <div className={`history-source-filters${isSourceMenuOpen ? ' is-open' : ''}`} ref={sourceMenuRef} role="group" aria-label={t('history.sources')}>
      <button
        ref={sourceMenuButtonRef}
        type="button"
        className="history-source-select"
        onClick={() => setIsSourceMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isSourceMenuOpen}
        aria-label={`${t('history.sourceCaption')}: ${statusFilter === 'errors' ? t('history.categoryErrors') : sourceLabels[sourceFilter]}${statusFilter === 'errors' ? '' : ` ${formatDisplayCount(historyCounts.source[sourceFilter], locale)}`}`}
      >
        <span>{statusFilter === 'errors' ? t('history.categoryErrors') : sourceLabels[sourceFilter]}</span>
        {statusFilter !== 'errors' && (
          <span className="history-source-select-count" aria-hidden="true">
            {formatDisplayCount(historyCounts.source[sourceFilter], locale)}
          </span>
        )}
        <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {historySourceMenu}
    </div>
  );

  return { historyStatusFilters, historySourceFilters, historySourceSelect };
}
