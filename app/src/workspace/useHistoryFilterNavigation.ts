import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { matchesHistoryStatus, type HistorySourceFilter, type HistoryStatusFilter } from './historyPresentation';
import type { HistoryItem } from './historyModel';

const HISTORY_FILTER_STORAGE_KEY = 'xmsgi-history-filters';
const AUTO_SELECTABLE_STATUSES = ['scheduled', 'sent', 'drafts'] as const;
type AutoSelectableStatus = typeof AUTO_SELECTABLE_STATUSES[number];
type StoredHistoryFilters = {
  sourceFilter: HistorySourceFilter;
  sourceFilterPinned: boolean;
  statusFilter: AutoSelectableStatus;
};

function loadSavedHistoryFilters(): StoredHistoryFilters {
  try {
    const saved = JSON.parse(window.localStorage.getItem(HISTORY_FILTER_STORAGE_KEY) || 'null') as {
      sourceFilter?: unknown;
      sourceFilterPinned?: unknown;
      statusFilter?: unknown;
    } | null;
    const sourceFilter: HistorySourceFilter = saved?.sourceFilter === 'workspace' || saved?.sourceFilter === 'personal'
      ? saved.sourceFilter
      : 'all';
    const storedStatus = saved?.statusFilter;
    const statusFilter: AutoSelectableStatus = storedStatus === 'sent' || storedStatus === 'drafts'
      ? storedStatus
      : 'scheduled';
    const sourceFilterPinned = saved?.sourceFilterPinned === true
      || (saved?.sourceFilterPinned !== false && (sourceFilter === 'workspace' || sourceFilter === 'personal'));

    return {
      sourceFilter,
      sourceFilterPinned,
      statusFilter,
    };
  } catch {
    return { sourceFilter: 'all', sourceFilterPinned: false, statusFilter: 'scheduled' };
  }
}

export interface HistoryFilterNavigationOptions {
  isOpen: boolean;
  pageMode: boolean;
  sourceFilterOnOpen?: HistorySourceFilter;
  sourceFilterOnOpenMode: 'initial' | 'temporary';
  statusFilterOnOpen?: Exclude<HistoryStatusFilter, 'notes'>;
  historyRecordsReady: boolean;
  draftsLoaded: boolean;
  draftsLoading: boolean;
  draftsLoadCycle: number;
  draftLoadFailed: boolean;
  records: HistoryItem[];
  draftItems: HistoryItem[];
}

export function useHistoryFilterNavigation({
  isOpen,
  pageMode,
  sourceFilterOnOpen,
  sourceFilterOnOpenMode,
  statusFilterOnOpen,
  historyRecordsReady,
  draftsLoaded,
  draftsLoading,
  draftsLoadCycle,
  draftLoadFailed,
  records,
  draftItems,
}: HistoryFilterNavigationOptions) {
  const [savedFilters] = useState(loadSavedHistoryFilters);
  const [sourceFilter, setSourceFilter] = useState<HistorySourceFilter>(savedFilters.sourceFilter);
  const [sourceFilterPinned, setSourceFilterPinned] = useState(savedFilters.sourceFilterPinned);
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>(savedFilters.statusFilter);
  const regularStatusBeforeErrorsRef = useRef<Exclude<HistoryStatusFilter, 'errors'> | null>(null);
  const sourceFilterBeforeOverrideRef = useRef<HistorySourceFilter | null>(null);
  const sourceFilterOverrideChangedRef = useRef(false);
  const initialSourceAppliedRef = useRef(false);
  const statusFilterBeforeOverrideRef = useRef<HistoryStatusFilter | null>(null);
  const statusFilterOverrideChangedRef = useRef(false);
  const autoCategorySignatureRef = useRef('');
  const historyCounts = useMemo(() => {
    const counts = {
      total: 0,
      source: { all: 0, workspace: 0, personal: 0 },
      status: { scheduled: 0, sent: 0, drafts: 0, notes: 0, errors: 0 },
    };

    for (const record of [...records, ...draftItems]) {
      counts.total += 1;
      counts.source.all += 1;

      if (matchesHistoryStatus(record, 'errors')) {
        counts.status.errors += 1;
        continue;
      }

      counts.source[record.source] += 1;
      if (sourceFilter !== 'all' && record.source !== sourceFilter) continue;

      if (matchesHistoryStatus(record, 'scheduled')) counts.status.scheduled += 1;
      else if (matchesHistoryStatus(record, 'sent')) counts.status.sent += 1;
      else if (matchesHistoryStatus(record, 'drafts')) counts.status.drafts += 1;
      if (matchesHistoryStatus(record, 'notes')) counts.status.notes += 1;
    }

    return counts;
  }, [draftItems, records, sourceFilter]);

  useLayoutEffect(() => {
    if (isOpen && sourceFilterOnOpen && sourceFilterOnOpenMode === 'initial' && !initialSourceAppliedRef.current) {
      initialSourceAppliedRef.current = true;
      sourceFilterBeforeOverrideRef.current = null;
      sourceFilterOverrideChangedRef.current = false;
      setSourceFilter(sourceFilterOnOpen);
      setSourceFilterPinned(true);
      return;
    }

    if (isOpen && sourceFilterOnOpen && sourceFilterOnOpenMode === 'temporary' && !sourceFilterPinned && !sourceFilterOverrideChangedRef.current) {
      if (sourceFilterBeforeOverrideRef.current === null) {
        sourceFilterBeforeOverrideRef.current = sourceFilter;
        sourceFilterOverrideChangedRef.current = false;
      }
      setSourceFilter(sourceFilterOnOpen);
      return;
    }

    if (!isOpen && sourceFilterBeforeOverrideRef.current !== null) {
      const previousSourceFilter = sourceFilterBeforeOverrideRef.current;
      const sourceFilterWasChanged = sourceFilterOverrideChangedRef.current;
      sourceFilterBeforeOverrideRef.current = null;
      sourceFilterOverrideChangedRef.current = false;
      if (!sourceFilterWasChanged) setSourceFilter(previousSourceFilter);
    }

    if (!isOpen) initialSourceAppliedRef.current = false;
  }, [isOpen, sourceFilter, sourceFilterOnOpen, sourceFilterOnOpenMode, sourceFilterPinned]);

  useLayoutEffect(() => {
    if (isOpen && statusFilterOnOpen && !statusFilterOverrideChangedRef.current) {
      if (statusFilterBeforeOverrideRef.current === null) {
        statusFilterBeforeOverrideRef.current = statusFilter;
      }
      if (statusFilter !== statusFilterOnOpen) setStatusFilter(statusFilterOnOpen);
      return;
    }

    if (!isOpen && statusFilterBeforeOverrideRef.current !== null) {
      const previousStatusFilter = statusFilterBeforeOverrideRef.current;
      const statusFilterWasChanged = statusFilterOverrideChangedRef.current;
      statusFilterBeforeOverrideRef.current = null;
      statusFilterOverrideChangedRef.current = false;
      if (!statusFilterWasChanged) setStatusFilter(previousStatusFilter);
    }
  }, [isOpen, statusFilter, statusFilterOnOpen]);

  useEffect(() => {
    try {
      const savedSourceFilter = sourceFilterBeforeOverrideRef.current !== null && !sourceFilterOverrideChangedRef.current
        ? sourceFilterBeforeOverrideRef.current
        : sourceFilter;
      const savedStatusFilter = statusFilterBeforeOverrideRef.current !== null && !statusFilterOverrideChangedRef.current
        ? statusFilterBeforeOverrideRef.current
        : statusFilter;
      window.localStorage.setItem(HISTORY_FILTER_STORAGE_KEY, JSON.stringify({
        sourceFilter: savedSourceFilter,
        sourceFilterPinned,
        statusFilter: savedStatusFilter,
      }));
    } catch {
      // Keep Posts usable when local storage is unavailable.
    }
  }, [sourceFilter, sourceFilterPinned, statusFilter]);

  const selectStatusFilter = useCallback((nextStatus: HistoryStatusFilter) => {
    if (statusFilter === 'errors') {
      setSourceFilter('all');
      setSourceFilterPinned(true);
      regularStatusBeforeErrorsRef.current = null;
    }
    if (statusFilter !== nextStatus) {
      if (statusFilterBeforeOverrideRef.current !== null) statusFilterOverrideChangedRef.current = true;
      setStatusFilter(nextStatus);
    }
  }, [statusFilter]);

  const selectSourceFilter = useCallback((nextSource: HistorySourceFilter) => {
    setSourceFilterPinned(true);
    if (sourceFilterBeforeOverrideRef.current !== null) sourceFilterOverrideChangedRef.current = true;
    if (sourceFilter !== nextSource) setSourceFilter(nextSource);

    if (statusFilter === 'errors') {
      const previousStatus = regularStatusBeforeErrorsRef.current ?? 'scheduled';
      setStatusFilter(nextSource !== 'personal' && previousStatus === 'notes' ? 'scheduled' : previousStatus);
      regularStatusBeforeErrorsRef.current = null;
    } else if (nextSource !== 'personal' && statusFilter === 'notes') {
      setStatusFilter('scheduled');
    }
  }, [sourceFilter, statusFilter]);

  const selectErrorsFilter = useCallback(() => {
    setSourceFilter('all');
    setSourceFilterPinned(true);
    if (statusFilter !== 'errors') {
      regularStatusBeforeErrorsRef.current = statusFilter;
      if (statusFilterBeforeOverrideRef.current !== null) statusFilterOverrideChangedRef.current = true;
      setStatusFilter('errors');
    }
  }, [statusFilter]);

  const historyDataReady = !pageMode || (historyRecordsReady && draftsLoaded && !draftsLoading);
  const autoCategorySignature = [
    draftsLoadCycle,
    sourceFilter,
    historyCounts.status.scheduled,
    historyCounts.status.sent,
    historyCounts.status.drafts,
    historyCounts.status.errors,
  ].join(':');
  const nextAutoCategory = pageMode
    && statusFilter !== 'errors'
    && historyDataReady
    && !draftLoadFailed
    && historyCounts.status[statusFilter] === 0
    ? AUTO_SELECTABLE_STATUSES.find((status) => historyCounts.status[status] > 0)
    : undefined;
  const isAutoCategoryPending = pageMode && (
    !historyDataReady
    || (nextAutoCategory !== undefined && autoCategorySignatureRef.current !== autoCategorySignature)
  );

  useLayoutEffect(() => {
    if (!pageMode || !historyDataReady || draftLoadFailed) return;
    if (autoCategorySignatureRef.current === autoCategorySignature) return;
    autoCategorySignatureRef.current = autoCategorySignature;
    if (nextAutoCategory) {
      if (statusFilterBeforeOverrideRef.current !== null) statusFilterOverrideChangedRef.current = true;
      setStatusFilter(nextAutoCategory);
    }
  }, [autoCategorySignature, draftLoadFailed, historyDataReady, nextAutoCategory, pageMode]);

  return {
    sourceFilter,
    statusFilter,
    historyCounts,
    historyDataReady,
    isAutoCategoryPending,
    selectStatusFilter,
    selectSourceFilter,
    selectErrorsFilter,
  };
}
