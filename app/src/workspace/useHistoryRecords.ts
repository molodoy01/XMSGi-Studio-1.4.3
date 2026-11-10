import { useMemo } from 'react';
import type { HistoryItem } from './historyModel';
import { sortHistoryItems } from './historyModel';
import {
  getHistoryMonthKey,
  getHistoryOrderingTimestamp,
  getHistoryTimestamp,
  matchesHistoryQuery,
  matchesHistoryStatus,
  type HistorySourceFilter,
  type HistoryStatusFilter,
} from './historyPresentation';
import type { HistoryTranslate } from './historyPresentation';
import { useHistoryDraftColorFilter } from './useHistoryDraftColorFilter';

export function useHistoryRecords({
  historyItems,
  draftItems,
  query,
  locale,
  t,
  sourceFilter,
  statusFilter,
  historyDataReady,
  pageMode,
}: {
  historyItems: HistoryItem[];
  draftItems: HistoryItem[];
  query: string;
  locale: 'ru' | 'en';
  t: HistoryTranslate;
  sourceFilter: HistorySourceFilter;
  statusFilter: HistoryStatusFilter;
  historyDataReady: boolean;
  pageMode: boolean;
}) {
  const categoryRecords = useMemo(() => {
    const isGlobalSearch = Boolean(query.trim());
    const matchingRecords = [...historyItems, ...draftItems]
      .filter((record) => {
        if (statusFilter === 'errors' && record.status !== 'failed') return false;
        if (statusFilter === 'drafts' && record.status === 'failed') return false;
        if (statusFilter !== 'errors' && record.status === 'failed' && sourceFilter !== 'all') return false;
        if (sourceFilter !== 'all' && record.source !== sourceFilter) return false;
        if (!isGlobalSearch && statusFilter !== 'errors' && record.status !== 'failed' && !matchesHistoryStatus(record, statusFilter)) return false;

        return matchesHistoryQuery(record, query, locale, t);
      });
    if (!isGlobalSearch && statusFilter === 'scheduled') {
      return matchingRecords.sort((left, right) => (
        (Date.parse(getHistoryTimestamp(left)) || 0) - (Date.parse(getHistoryTimestamp(right)) || 0)
      ));
    }

    const sortedRecords = sortHistoryItems(matchingRecords, isGlobalSearch || statusFilter === 'notes' ? 'sent' : statusFilter);
    if (isGlobalSearch) {
      return sortedRecords.sort((left, right) => (
        (Date.parse(getHistoryTimestamp(right)) || 0) - (Date.parse(getHistoryTimestamp(left)) || 0)
      ));
    }
    if (sourceFilter !== 'all') return sortedRecords;

    return sortedRecords.sort((left, right) => {
      const leftTime = Date.parse(getHistoryOrderingTimestamp(left, statusFilter)) || 0;
      const rightTime = Date.parse(getHistoryOrderingTimestamp(right, statusFilter)) || 0;
      return rightTime - leftTime;
    });
  }, [draftItems, historyItems, locale, query, sourceFilter, statusFilter, t]);

  const {
    selectedDraftColor,
    draftColorCounts,
    filteredRecords,
    toggleDraftColor,
    clearDraftColorFilter,
  } = useHistoryDraftColorFilter({
    enabled: statusFilter === 'drafts' && sourceFilter === 'workspace',
    ready: historyDataReady,
    query,
    records: categoryRecords,
  });

  const stickyDateRecords = statusFilter === 'drafts' && sourceFilter === 'workspace' && selectedDraftColor && !query.trim()
    ? categoryRecords
    : filteredRecords;
  const showsMonthStrip = pageMode
    && !query.trim()
    && (statusFilter === 'scheduled' || statusFilter === 'sent')
    && new Set(filteredRecords.map((record) => getHistoryMonthKey(getHistoryTimestamp(record))).filter(Boolean)).size > 1;
  const historyTagFilters = useMemo(() => {
    const tagCounts = new Map<string, { tag: string; count: number }>();
    for (const record of [...historyItems, ...draftItems]) {
      if (sourceFilter !== 'all' && record.source !== sourceFilter) continue;
      const tags = new Set(record.text.match(/#[\p{L}\p{N}_][\p{L}\p{N}\p{M}_]*/gu) ?? []);
      for (const tag of tags) {
        const key = tag.toLocaleLowerCase(locale);
        const current = tagCounts.get(key);
        if (current) current.count += 1;
        else tagCounts.set(key, { tag, count: 1 });
      }
    }

    return [...tagCounts.values()]
      .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag, locale))
      .slice(0, 8);
  }, [draftItems, historyItems, locale, sourceFilter]);

  return {
    categoryRecords,
    filteredRecords,
    selectedDraftColor,
    draftColorCounts,
    toggleDraftColor,
    clearDraftColorFilter,
    stickyDateRecords,
    showsMonthStrip,
    historyTagFilters,
  };
}
