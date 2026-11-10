import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Send, X } from 'lucide-react';
import { useLocale } from '@/lib/i18n';
import type { NotificationState, NotificationType } from '@/types';
import { DRAFT_COLOR_OPTIONS } from '@studio/components/DraftColorOptions';
import type { DraftColor } from '@studio/types';
import type { HistoryClearResult, HistoryItem } from './historyModel';
import { blurFocusedTopbarAction, QuickPlannerNavigationContext } from './QuickPlannerNavigationContext';
import { useHistoryFilterNavigation } from './useHistoryFilterNavigation';
import { useHistoryImagePreviews } from './useHistoryImagePreviews';
import { useHistoryPostClipboard } from './useHistoryPostClipboard';
import { createHistoryBulkDeleteHandler } from './useHistoryBulkDelete';
import { getHistoryConfirmationText } from './historyConfirmationPresentation';
import { HistorySearchDock } from './HistorySearchDock';
import { HistoryFilterControls } from './HistoryFilterControls';
import { HistoryConfirmationDialogs } from './HistoryConfirmationDialogs';
import { HistoryDetailErrorExplanation } from './HistoryDetailErrorExplanation';
import { HistoryDetailMessage } from './HistoryDetailMessage';
import { HistoryDetailActions } from './HistoryDetailActions';
import { HistoryRecordRow } from './HistoryRecordRow';
import { HistoryDetailHeader } from './HistoryDetailHeader';
import { HistoryFooterActions } from './HistoryFooterActions';
import { HistoryListEmptyState } from './HistoryListEmptyState';
import { HistoryDetailEmptyState } from './HistoryDetailEmptyState';
import { useHistoryRecordSelection } from './useHistoryRecordSelection';
import { useHistoryDraftLoading } from './useHistoryDraftLoading';
import { useHistoryStickyDateLabel } from './useHistoryStickyDateLabel';
import { useHistoryRecords } from './useHistoryRecords';
import {
  isLocalScheduleFailure,
  isQueueCancellationCandidate,
} from './historyErrorPresentation';
import {
  alignHistoryScroll,
  exportHistoryRecords,
  formatDisplayCount,
  formatHistoryCount,
  getAttachmentName,
  getHistoryCategoryLabel,
  isSavedMessagesRecord,
  matchesHistoryStatus,
  scrollHistoryRecordIntoView,
  type HistoryExportFormat,
  type HistoryExportStatus,
  type HistorySourceFilter,
  type HistoryStatusFilter,
} from './historyPresentation';

type HistoryBulkActionSource = HistorySourceFilter;
const HISTORY_TEXT_SIZE_STORAGE_KEY = 'xmsgi-history-text-size';
const HISTORY_DETAIL_TEXT_SIZES = ['small', 'default', 'large'] as const;
type HistoryDetailTextSize = typeof HISTORY_DETAIL_TEXT_SIZES[number];

function loadSavedDetailTextSize(): HistoryDetailTextSize {
  try {
    const savedSize = window.localStorage.getItem(HISTORY_TEXT_SIZE_STORAGE_KEY);
    return HISTORY_DETAIL_TEXT_SIZES.includes(savedSize as HistoryDetailTextSize)
      ? savedSize as HistoryDetailTextSize
      : 'default';
  } catch {
    return 'default';
  }
}

function getAdjacentDetailTextSize(size: HistoryDetailTextSize, direction: -1 | 1): HistoryDetailTextSize {
  const index = HISTORY_DETAIL_TEXT_SIZES.indexOf(size);
  return HISTORY_DETAIL_TEXT_SIZES[Math.max(0, Math.min(HISTORY_DETAIL_TEXT_SIZES.length - 1, index + direction))];
}

export function HistoryDrawer({
  isOpen,
  pageMode = false,
  sourceFilterOnOpen,
  sourceFilterOnOpenMode = 'temporary',
  statusFilterOnOpen,
  historyRecordsReady = true,
  notification,
  onClose,
  records,
  onCancel,
  onReschedule,
  onSendNow,
  onDelete,
  onUseDraft,
  draftDestination = 'studio',
  onClearSent,
  onShowNotification,
  onClearDrafts,
  onCancelQueue,
}: {
  isOpen: boolean;
  pageMode?: boolean;
  sourceFilterOnOpen?: HistorySourceFilter;
  sourceFilterOnOpenMode?: 'initial' | 'temporary';
  statusFilterOnOpen?: Exclude<HistoryStatusFilter, 'notes'>;
  historyRecordsReady?: boolean;
  notification?: NotificationState;
  onClose: (restorePreviousView?: boolean) => void;
  records: HistoryItem[];
  onCancel: (record: HistoryItem) => void;
  onReschedule: (record: HistoryItem) => void;
  onSendNow: (record: HistoryItem) => void;
  onDelete: (record: HistoryItem, suppressNotification?: boolean) => void | Promise<boolean>;
  onOpenDraft: (record: HistoryItem) => void;
  onUseDraft?: (record: HistoryItem, destination?: 'planner' | 'studio') => boolean | void | Promise<boolean | void>;
  draftDestination?: 'planner' | 'studio';
  onClearSent: (source: HistoryBulkActionSource) => Promise<HistoryClearResult>;
  onShowNotification?: (message: string, type: NotificationType, title: string) => void;
  onClearDrafts?: (source: HistoryBulkActionSource) => Promise<boolean>;
  onCancelQueue?: (records: HistoryItem[]) => Promise<boolean>;
}) {
  const { locale, t } = useLocale();
  const navigation = useContext(QuickPlannerNavigationContext);
  const [previewDraftColor, setPreviewDraftColor] = useState<DraftColor | null>(null);
  const [query, setQuery] = useState('');
  const isGlobalSearch = Boolean(query.trim());
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HistoryItem | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [isPreviewRecordHighlightSuppressed, setIsPreviewRecordHighlightSuppressed] = useState(false);
  const [isMultiSelectModifierPressed, setIsMultiSelectModifierPressed] = useState(false);
  const [hoverSuppressedRecordId, setHoverSuppressedRecordId] = useState<string | null>(null);
  const {
    draftItems,
    setDraftItems,
    draftsLoading,
    draftsLoaded,
    draftsLoadCycle,
    draftLoadFailed,
  } = useHistoryDraftLoading(isOpen);
  const historyItems = records;
  const allHistoryRecords = useMemo(() => [...historyItems, ...draftItems], [draftItems, historyItems]);
  const {
    sourceFilter,
    statusFilter,
    historyCounts,
    historyDataReady,
    isAutoCategoryPending,
    selectStatusFilter,
    selectSourceFilter,
    selectErrorsFilter,
  } = useHistoryFilterNavigation({
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
    records: historyItems,
    draftItems,
  });
  const [confirmAction, setConfirmAction] = useState<{ type: 'cancel' | 'delete' | 'send-now'; recordId: string } | null>(null);
  const [bulkDeleteCategory, setBulkDeleteCategory] = useState<'scheduled' | 'sent' | 'drafts' | 'notes' | 'errors' | null>(null);
  const [bulkDeleteRecordId, setBulkDeleteRecordId] = useState<string | null>(null);
  const [bulkDeleteSelection, setBulkDeleteSelection] = useState<HistoryItem[]>([]);
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState('');
  const [bulkDraftDeleteProgress, setBulkDraftDeleteProgress] = useState<{ deleted: number; total: number } | null>(null);
  const [bulkDeleteCanStop, setBulkDeleteCanStop] = useState(false);
  const [bulkDeleteStopRequested, setBulkDeleteStopRequested] = useState(false);
  const [bulkDeleteStoppedProgress, setBulkDeleteStoppedProgress] = useState<{ processed: number; total: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<{
    status: 'success' | 'partial' | 'error';
    message: string;
  } | null>(null);
  const bulkDeleteStopRequestedRef = useRef(false);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);
  const [detailActionMenuOpen, setDetailActionMenuOpen] = useState(false);
  const [detailPreviewMode, setDetailPreviewMode] = useState<'details' | 'preview'>('details');
  const [detailTextSize, setDetailTextSize] = useState<HistoryDetailTextSize>(loadSavedDetailTextSize);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const sourceMenuRef = useRef<HTMLDivElement | null>(null);
  const sourceMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const sourceMenuItemsRef = useRef<HTMLDivElement | null>(null);
  const statusFiltersRef = useRef<HTMLDivElement | null>(null);
  const historyRecordListRef = useRef<HTMLDivElement | null>(null);
  const historySearchInputRef = useRef<HTMLInputElement | null>(null);
  const expandedRecordRef = useRef<HTMLElement | null>(null);
  const detailBackButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const detailActionMenuRef = useRef<HTMLDivElement | null>(null);
  const detailPreviewRef = useRef<HTMLDivElement | null>(null);
  const preExpansionScrollTopRef = useRef<number | null>(null);
  const {
    imagePreviewSources,
    previewImagePath,
    previewImagePosition,
    closeImagePreview,
    getDisplayedAttachmentUrl,
    openImagePreview,
  } = useHistoryImagePreviews({ isOpen, records, draftItems });

  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_TEXT_SIZE_STORAGE_KEY, detailTextSize);
    } catch (error) {
      console.error('Failed to save the Posts text size preference.', error);
    }
  }, [detailTextSize]);

  const toggleExpandedRecord = (record: HistoryItem, isExpanded: boolean) => {
    if (isExpanded) {
      setSelectedRecord(null);
      return;
    }
    preExpansionScrollTopRef.current = historyRecordListRef.current?.scrollTop ?? null;
    setSelectedRecord(record);
  };

  const applyHistoryDraft = (record: HistoryItem, destination?: 'planner' | 'studio') => {
    if (!onUseDraft) return;
    const result = onUseDraft(record, destination ?? draftDestination);
    void Promise.resolve(result).then((used) => {
      if (used === false) return;
      onClose(false);
    }).catch((error: unknown) => {
      console.error('Failed to use a draft from Posts.', error);
    });
  };

  const handleConfirmationKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter') return;
    if (event.target instanceof HTMLElement && event.target.closest('.history-record-confirmation-action.is-secondary')) return;

    const confirmButton = event.currentTarget.querySelector<HTMLButtonElement>(
      '.history-record-confirmation-action.is-primary:not(:disabled)',
    );
    if (!confirmButton) return;
    event.preventDefault();
    event.stopPropagation();
    confirmButton.click();
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    const list = historyRecordListRef.current;
    if (!selectedRecord) {
      if (list && preExpansionScrollTopRef.current !== null) {
        list.scrollTop = preExpansionScrollTopRef.current;
      }
      preExpansionScrollTopRef.current = null;
      return;
    }
    const expandedRecord = expandedRecordRef.current;
    if (list && expandedRecord) return alignHistoryScroll(list, expandedRecord);
  }, [isOpen, selectedRecord]);

  useLayoutEffect(() => {
    if (!isOpen || !pageMode) return;
    const list = historyRecordListRef.current;
    if (list) list.scrollTop = 0;
  }, [isOpen, pageMode, query, sourceFilter, statusFilter]);

  useLayoutEffect(() => {
    if (!isOpen || !actionMenuOpenId) return;
    const list = historyRecordListRef.current;
    const actionMenu = actionMenuRef.current;
    if (list && actionMenu) return alignHistoryScroll(list, actionMenu);
  }, [actionMenuOpenId, isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedRecord) return;
    const list = historyRecordListRef.current;
    const expandedRecord = expandedRecordRef.current;
    if (!list || !expandedRecord || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => scrollHistoryRecordIntoView(list, expandedRecord));
    observer.observe(list);
    observer.observe(expandedRecord);
    return () => observer.disconnect();
  }, [isOpen, selectedRecord]);

  useEffect(() => {
    if (!isOpen || !pageMode || !selectedRecord || typeof window.matchMedia !== 'function') return;
    if (window.matchMedia('(max-width: 900px)').matches) detailBackButtonRef.current?.focus();
  }, [isOpen, pageMode, selectedRecord]);

  useEffect(() => {
    if (!isOpen) {
      setConfirmAction(null);
      setIsExportMenuOpen(false);
      setIsSourceMenuOpen(false);
      setActionMenuOpenId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const focusSearch = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'f') return;
      event.preventDefault();
      historySearchInputRef.current?.focus();
      historySearchInputRef.current?.select();
    };

    document.addEventListener('keydown', focusSearch);
    return () => document.removeEventListener('keydown', focusSearch);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (previewImagePath) {
        event.preventDefault();
        closeImagePreview();
      } else if (confirmAction) {
        event.preventDefault();
        setConfirmAction(null);
      } else if (bulkDeleteCategory && !bulkDeleteBusy) {
        event.preventDefault();
        setBulkDeleteCategory(null);
        setBulkDeleteRecordId(null);
        setBulkDeleteError('');
      } else if (isExportMenuOpen) {
        event.preventDefault();
        setIsExportMenuOpen(false);
      } else if (isSourceMenuOpen) {
        event.preventDefault();
        setIsSourceMenuOpen(false);
        sourceMenuButtonRef.current?.focus();
      } else if (detailActionMenuOpen) {
        event.preventDefault();
        setDetailActionMenuOpen(false);
      } else if (actionMenuOpenId) {
        event.preventDefault();
        setActionMenuOpenId(null);
      } else if (selectedRecord && !pageMode) {
        event.preventDefault();
        setSelectedRecord(null);
      } else if (!bulkDeleteBusy) {
        event.preventDefault();
        blurFocusedTopbarAction();
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    if (!pageMode) document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      if (!pageMode) document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [actionMenuOpenId, bulkDeleteBusy, bulkDeleteCategory, closeImagePreview, confirmAction, detailActionMenuOpen, isExportMenuOpen, isOpen, isSourceMenuOpen, onClose, pageMode, previewImagePath, selectedRecord]);

  useEffect(() => {
    if (!isOpen || !detailActionMenuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!detailActionMenuRef.current?.contains(event.target as Node)) setDetailActionMenuOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [detailActionMenuOpen, isOpen]);

  useEffect(() => {
    if (!isOpen || !isExportMenuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!exportMenuRef.current?.contains(event.target as Node)) setIsExportMenuOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
    };
  }, [isExportMenuOpen, isOpen]);

  useEffect(() => {
    if (!exportFeedback || isExporting) return;

    const timeout = window.setTimeout(() => setExportFeedback(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [exportFeedback, isExporting]);

  useEffect(() => {
    if (!isOpen || !isSourceMenuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!sourceMenuRef.current?.contains(event.target as Node)) setIsSourceMenuOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isOpen, isSourceMenuOpen]);

  useEffect(() => {
    if (isSourceMenuOpen) {
      sourceMenuItemsRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    }
  }, [isSourceMenuOpen]);

  const {
    filteredRecords,
    selectedDraftColor,
    draftColorCounts,
    toggleDraftColor,
    clearDraftColorFilter,
    stickyDateRecords,
    showsMonthStrip,
    historyTagFilters,
  } = useHistoryRecords({
    historyItems,
    draftItems,
    query,
    locale,
    t,
    sourceFilter,
    statusFilter,
    historyDataReady,
    pageMode,
  });
  const selectedRecordIdSet = useMemo(() => new Set(selectedRecordIds), [selectedRecordIds]);
  const multiSelectedRecords = filteredRecords.filter((record) => selectedRecordIdSet.has(record.id));

  useEffect(() => {
    if (!isOpen || !pageMode) {
      setIsMultiSelectModifierPressed(false);
      return;
    }

    const updateModifierState = (event: KeyboardEvent) => {
      if (event.key === 'Control' || event.key === 'Meta') {
        setIsMultiSelectModifierPressed(event.type === 'keydown' || event.ctrlKey || event.metaKey);
      }
    };
    const clearModifierState = () => setIsMultiSelectModifierPressed(false);

    window.addEventListener('keydown', updateModifierState);
    window.addEventListener('keyup', updateModifierState);
    window.addEventListener('blur', clearModifierState);
    return () => {
      window.removeEventListener('keydown', updateModifierState);
      window.removeEventListener('keyup', updateModifierState);
      window.removeEventListener('blur', clearModifierState);
    };
  }, [isOpen, pageMode]);

  useEffect(() => {
    if (!isOpen || !pageMode) {
      setSelectedRecordIds([]);
      return;
    }
    if (!historyDataReady) return;
    setSelectedRecordIds((current) => current.filter((id) => filteredRecords.some((record) => record.id === id)));
  }, [filteredRecords, historyDataReady, isOpen, pageMode]);
  const displayedDraftColor = previewDraftColor ?? selectedDraftColor;
  const hasDraftColorFilters = statusFilter === 'drafts'
    && sourceFilter === 'workspace'
    && !query.trim()
    && [...draftColorCounts.values()].some((count) => count > 0);
  const draftColorFilters = hasDraftColorFilters && (
    <div className="workspace-page-draft-color-filters history-draft-color-filters" role="group" aria-label={t('studio.savedDraftColor')}>
      {displayedDraftColor && (
        <span className="workspace-page-draft-selected-color" data-color={displayedDraftColor}>
          {t(DRAFT_COLOR_OPTIONS.find((option) => option.value === displayedDraftColor)?.labelKey ?? 'studio.colorGray')}
        </span>
      )}
      {DRAFT_COLOR_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="workspace-page-draft-color-filter"
          aria-label={t('studio.colorOption', { color: t(option.labelKey) })}
          aria-pressed={selectedDraftColor === option.value}
          title={t('studio.colorOption', { color: t(option.labelKey) })}
          onMouseEnter={() => setPreviewDraftColor(option.value)}
          onMouseLeave={() => setPreviewDraftColor(null)}
          onFocus={() => setPreviewDraftColor(option.value)}
          onBlur={() => setPreviewDraftColor(null)}
          onClick={() => toggleDraftColor(option.value)}
        >
          <span
            className={`workspace-page-draft-color-dot${selectedDraftColor === option.value ? ' is-selected' : ''}`}
            data-color={option.value}
            style={{ borderRadius: '50%' }}
            aria-hidden="true"
          />
          <span className="workspace-page-draft-color-count">
            {formatDisplayCount(draftColorCounts.get(option.value) ?? 0, locale)}
          </span>
        </button>
      ))}
    </div>
  );
  const { stickyDateLabel, updateStickyDateLabel } = useHistoryStickyDateLabel({
    pageMode,
    records: stickyDateRecords,
    locale,
    t,
    listRef: historyRecordListRef,
  });
  const hasStickyDateLabel = Boolean(stickyDateLabel && filteredRecords.length > 0);
  const reserveHistoryDateSpace = pageMode && !historyDataReady && !hasStickyDateLabel && !hasDraftColorFilters;
  const hideEmptyHistoryDateStrip = pageMode && historyDataReady && filteredRecords.length === 0 && !hasDraftColorFilters;

  useEffect(() => {
    if (filteredRecords.length === 0) setIsExportMenuOpen(false);
  }, [filteredRecords.length]);

  useHistoryRecordSelection({
    pageMode,
    historyDataReady,
    allHistoryRecords,
    filteredRecords,
    selectedRecord,
    setSelectedRecord,
  });

  useEffect(() => {
    if (confirmAction && !filteredRecords.some((record) => record.id === confirmAction.recordId)) {
      setConfirmAction(null);
    }
  }, [confirmAction, filteredRecords]);

  const selectedRecordIndex = selectedRecord
    ? filteredRecords.findIndex((record) => record.id === selectedRecord.id)
    : -1;
  const activeSelectedRecord = selectedRecordIndex >= 0
    ? filteredRecords[selectedRecordIndex]
    : null;
  const { copyFeedback, copySelectedPost } = useHistoryPostClipboard({
    isOpen,
    record: activeSelectedRecord,
    imagePreviewSources,
  });

  useLayoutEffect(() => {
    const previewBody = detailPreviewRef.current;
    if (detailPreviewMode !== 'preview' || !previewBody) return;
    previewBody.scrollTop = Math.max(0, previewBody.scrollHeight - previewBody.clientHeight);
  }, [activeSelectedRecord?.id, detailPreviewMode, detailTextSize]);
  useEffect(() => {
    setDetailPreviewMode('details');
    setDetailActionMenuOpen(false);
  }, [activeSelectedRecord?.id, isOpen]);

  const openSelectedPreview = () => {
    const record = activeSelectedRecord;
    if (!record) return;
    if (detailPreviewMode !== 'details') {
      setDetailPreviewMode('details');
      return;
    }

    setDetailPreviewMode('preview');
  };

  const queueCancellableRecords = filteredRecords.filter((record) => (
    isQueueCancellationCandidate(record)
  ));
  const localScheduleFailureRecords = filteredRecords.filter(isLocalScheduleFailure);
  const scheduleCleanupCount = queueCancellableRecords.length + localScheduleFailureRecords.length;
  const scheduleCleanupLabel = queueCancellableRecords.length > 0 && localScheduleFailureRecords.length > 0
    ? t('history.cleanupAndCancel')
    : queueCancellableRecords.length > 0
      ? t('history.cancelCount', { count: formatHistoryCount(queueCancellableRecords.length, locale) })
      : t('history.deleteErrors', { count: localScheduleFailureRecords.length });
  const scheduleCleanupAriaLabel = queueCancellableRecords.length > 0 && localScheduleFailureRecords.length > 0
    ? t('history.cancelAndRemoveErrors')
    : queueCancellableRecords.length > 0
      ? t('history.cancelScheduled')
      : t('history.deleteScheduleErrors');
  const scheduleCleanupTitle = queueCancellableRecords.length > 0 && localScheduleFailureRecords.length > 0
    ? t('history.cancelAndRemoveErrors')
    : queueCancellableRecords.length > 0
      ? t('history.cancelScheduled')
      : t('history.deleteScheduleErrors');
  const visibleRecords = !pageMode && selectedRecordIndex >= 0
    ? filteredRecords.slice(0, selectedRecordIndex + 1)
    : filteredRecords;
  const selectedCategoryLabel = getHistoryCategoryLabel(statusFilter, t);
  const exportMenuScope = multiSelectedRecords.length > 0
    ? t('history.selectedRecordsScope', { count: formatHistoryCount(multiSelectedRecords.length, locale) })
    : selectedRecord
    ? t('history.recordScope', { title: selectedRecord.title })
    : t('history.currentList');
  const isPlannerDraftRecord = selectedRecord?.original.kind === 'planner-draft'
    || selectedRecord?.original.kind === 'saved-planner-draft';
  const exportRecordTitle = selectedRecord && isPlannerDraftRecord
    ? locale === 'en'
      ? selectedRecord.title.replace('Quick ', '')
      : selectedRecord.original.kind === 'saved-planner-draft'
        ? 'Сохранённый черновик планера'
        : 'Черновик планера'
    : selectedRecord?.title;
  const exportMenuHeading = multiSelectedRecords.length > 0
    ? t('history.exportSelectedCount', { count: formatHistoryCount(multiSelectedRecords.length, locale) })
    : selectedRecord
    ? t('history.exporting', { scope: exportRecordTitle ?? selectedRecord.title })
    : isGlobalSearch
      ? t('history.exportSearchResults')
      : t('history.exportCategory', { category: selectedCategoryLabel });
  const selectedRecordMatchesDeleteCategory = Boolean(selectedRecordIndex >= 0 && selectedRecord && (
    statusFilter === 'scheduled'
      ? isQueueCancellationCandidate(selectedRecord) || isLocalScheduleFailure(selectedRecord)
      : statusFilter === 'sent'
        ? selectedRecord.status === 'sent'
        : statusFilter === 'notes'
          ? matchesHistoryStatus(selectedRecord, 'notes')
          : statusFilter === 'errors'
            ? selectedRecord.status === 'failed'
            : selectedRecord.status === 'draft'
  ));
  const canDeleteCurrentCategory = (!isGlobalSearch || selectedRecordMatchesDeleteCategory) && (statusFilter === 'scheduled'
    ? scheduleCleanupCount > 0
    : statusFilter === 'drafts'
      ? filteredRecords.some((record) => record.status === 'draft'
        && (!selectedDraftColor || isGlobalSearch || record.draftColor === selectedDraftColor))
      : historyCounts.status[statusFilter] > 0);
  const bulkDeleteRecord = bulkDeleteRecordId
    ? filteredRecords.find((record) => record.id === bulkDeleteRecordId) ?? null
    : null;
  const confirmActionRecord = confirmAction
    ? filteredRecords.find((record) => record.id === confirmAction.recordId) ?? null
    : null;
  const bulkDeleteCount = bulkDeleteSelection.length > 0
    ? bulkDeleteSelection.length
    : bulkDeleteRecord
    ? 1
    : bulkDeleteCategory === 'scheduled'
      ? scheduleCleanupCount
      : bulkDeleteCategory === 'drafts'
        ? filteredRecords.filter((record) => record.status === 'draft'
          && (!selectedDraftColor || isGlobalSearch || record.draftColor === selectedDraftColor)).length
        : bulkDeleteCategory ? historyCounts.status[bulkDeleteCategory] : 0;
  const { confirmActionPrompt, bulkDeletePrompt: categoryBulkDeletePrompt, bulkDeleteActionLabel: categoryBulkDeleteActionLabel } = getHistoryConfirmationText({
    confirmAction,
    confirmActionRecord,
    bulkDeleteRecord,
    bulkDeleteCategory,
    bulkDeleteCount,
    bulkDeleteBusy,
    bulkDraftDeleteProgress,
    queueCancellableCount: queueCancellableRecords.length,
    localScheduleFailureCount: localScheduleFailureRecords.length,
    scheduleCleanupLabel,
    locale,
    t,
  });
  const bulkDeletePrompt = bulkDeleteSelection.length > 0
    ? t('history.deleteSelectedPrompt', { count: formatHistoryCount(bulkDeleteSelection.length, locale) })
    : categoryBulkDeletePrompt;
  const bulkDeleteActionLabel = bulkDeleteSelection.length > 0
    ? t('history.deleteSelectedCount', { count: formatHistoryCount(bulkDeleteSelection.length, locale) })
    : categoryBulkDeleteActionLabel;
  const exportRecords = async (format: HistoryExportFormat) => {
    const recordsToExport = multiSelectedRecords.length > 0
      ? multiSelectedRecords
      : selectedRecord ? [selectedRecord] : filteredRecords;
    const getExportStatus = (record: HistoryItem): HistoryExportStatus => record.status === 'draft'
      ? 'drafts'
      : record.status === 'failed'
        ? 'errors'
        : record.status === 'sent'
          ? isSavedMessagesRecord(record) ? 'notes' : 'sent'
          : 'scheduled';
    const selectedExportStatuses = new Set(recordsToExport.map(getExportStatus));
    const exportStatus: HistoryExportStatus = multiSelectedRecords.length > 0
      ? selectedExportStatuses.size === 1 ? [...selectedExportStatuses][0] : 'all'
      : selectedRecord
      ? selectedRecord.status === 'draft'
        ? 'drafts'
        : selectedRecord.status === 'failed'
          ? 'errors'
        : selectedRecord.status === 'sent'
          ? isSavedMessagesRecord(selectedRecord) ? 'notes' : 'sent'
          : 'scheduled'
      : isGlobalSearch ? 'all' : statusFilter;
    if (format === 'zip') {
      setExportFeedback(null);
      setIsExporting(true);
      setIsExportMenuOpen(false);
      try {
        const exportBackup = window.draftStorage?.exportHistoryBackup;
        if (!exportBackup) throw new Error('Posts backup export is unavailable.');
        const selectedSources = new Set(recordsToExport.map((record) => record.source));
        const exportSource = multiSelectedRecords.length > 0
          ? selectedSources.size === 1 ? recordsToExport[0].source : 'all'
          : selectedRecord?.source ?? sourceFilter;
        const result = await exportBackup({
          records: recordsToExport,
          filters: { source: exportSource, status: exportStatus, query: multiSelectedRecords.length > 0 ? '' : query.trim() },
        });
        if (result.cancelled) return;
        if (!result.success) throw new Error(result.error || 'Posts backup export failed.');
        const missingCount = result.missingAttachments ?? 0;
        setExportFeedback(missingCount > 0
          ? { status: 'partial', message: t('history.archiveSavedWithMissing', { count: missingCount }) }
          : { status: 'success', message: t('history.archiveSaved') });
      } catch (error) {
        console.error('Failed to export Posts with attachments.', error);
        setExportFeedback({ status: 'error', message: t('history.archiveFailed') });
      } finally {
        setIsExporting(false);
      }
      return;
    }
    exportHistoryRecords(
      recordsToExport,
      exportStatus,
      multiSelectedRecords.length > 0
        ? new Set(recordsToExport.map((record) => record.source)).size === 1 ? recordsToExport[0].source : 'all'
        : selectedRecord?.source ?? sourceFilter,
      multiSelectedRecords.length > 0 ? '' : query,
      format,
      locale,
      t,
      multiSelectedRecords.length > 0 ? undefined : selectedRecord?.title,
    );
    setExportFeedback(null);
    setIsExportMenuOpen(false);
  };
  const confirmCategoryDelete = createHistoryBulkDeleteHandler({
    filteredRecords,
    historyItems,
    queueCancellableRecords,
    localScheduleFailureRecords,
    selectedDraftColor: isGlobalSearch ? null : selectedDraftColor,
    sourceFilter,
    bulkDeleteCategory,
    bulkDeleteRecord,
    bulkDeleteSelection,
    bulkDeleteStopRequestedRef,
    locale,
    t,
    onCancel,
    onDelete,
    onClearSent,
    onShowNotification,
    onClearDrafts,
    onCancelQueue,
    setBulkDeleteCategory,
    setBulkDeleteRecordId,
    setBulkDeleteBusy,
    setBulkDeleteError,
    setBulkDraftDeleteProgress,
    setBulkDeleteCanStop,
    setBulkDeleteStopRequested,
    setBulkDeleteStoppedProgress,
    setDraftItems,
    setSelectedRecord,
    setSelectedRecordIds,
    setBulkDeleteSelection,
  });


  useEffect(() => {
    if (bulkDeleteCategory && ((Boolean(query.trim()) && bulkDeleteRecordId === null)
      || (statusFilter !== bulkDeleteCategory || historyCounts.status[bulkDeleteCategory] === 0)
      || (bulkDeleteRecordId !== null && bulkDeleteRecord?.id !== bulkDeleteRecordId))) {
      setBulkDeleteCategory(null);
      setBulkDeleteRecordId(null);
      setBulkDeleteError('');
    }
  }, [bulkDeleteCategory, bulkDeleteRecord?.id, bulkDeleteRecordId, historyCounts.status, query, statusFilter]);

  const globalSearchTotal = historyCounts.status.scheduled + historyCounts.status.sent + historyCounts.status.drafts + historyCounts.status.errors;
  const historyResultCountLabel = t(isGlobalSearch ? 'history.results' : 'history.showingResults', {
    shown: historyDataReady ? formatDisplayCount(filteredRecords.length, locale) : '…',
    total: historyDataReady
      ? formatDisplayCount(isGlobalSearch ? globalSearchTotal : historyCounts.status[statusFilter], locale)
      : '…',
  });
  const historySelectionCountLabel = multiSelectedRecords.length > 0
    ? t('history.selectedCount', { count: formatHistoryCount(multiSelectedRecords.length, locale) })
    : null;
  const historyMultiSelectHintLabel = isMultiSelectModifierPressed && multiSelectedRecords.length === 0
    ? t('history.multiSelectHintShort')
    : null;
  const historySearchControl = (
    <HistorySearchDock
      query={query}
      setQuery={setQuery}
      historyTagFilters={historyTagFilters}
      locale={locale}
      historySearchInputRef={historySearchInputRef}
      historyResultCountLabel={historyResultCountLabel}
      historySelectionCountLabel={historySelectionCountLabel}
      historyMultiSelectHintLabel={historyMultiSelectHintLabel}
      historyMultiSelectHintTitle={t('history.multiSelectHint')}
      onSelectTag={(tag) => {
        setSelectedRecord(null);
        setQuery(tag);
      }}
      t={t}
    />
  );
  const { historyStatusFilters, historySourceFilters, historySourceSelect } = HistoryFilterControls({
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
    onStatusChange: (nextStatus) => {
      if (nextStatus === 'drafts') clearDraftColorFilter();
      setBulkDeleteCategory(null);
      setBulkDeleteRecordId(null);
      setBulkDeleteError('');
      setBulkDeleteStoppedProgress(null);
    },
    onSourceChange: () => {
      setBulkDeleteCategory(null);
      setBulkDeleteRecordId(null);
      setBulkDeleteError('');
    },
    locale,
    t,
  });
  const hasRecordsInSelectedCategory = historyCounts.status[statusFilter] > 0;
  const isEmptyHistory = filteredRecords.length === 0 && !hasRecordsInSelectedCategory;
  const detailEmptyTitle = isEmptyHistory
    ? t('history.detailNoPostsTitle')
    : t('history.detailEmptyTitle');
  const detailEmptyText = isEmptyHistory
    ? t('history.detailNoPostsText')
    : t('history.detailEmptyText');
  if (!isOpen) return null;

  return (
    <>
      {!pageMode && (
        <div
          className="history-drawer-backdrop"
          aria-hidden="true"
          onClick={() => onClose()}
        />
      )}

      <aside
        className={`history-drawer${pageMode ? ' is-page' : ''}`}
        role={pageMode ? 'region' : 'dialog'}
        aria-modal={pageMode ? undefined : true}
        aria-label={t('history.title')}
      >
        <header className={`history-drawer-header${pageMode ? ' is-page-header' : ''}`}>
          <div className="history-drawer-heading">
            {!pageMode && (
              <span className="history-drawer-header-icon" aria-hidden="true">
                <Send size={20} strokeWidth={1.8} />
              </span>
            )}
            <h2 aria-label={t('history.title')}>{t('history.title')}</h2>
          </div>
          {pageMode && notification?.visible && (
            <div
              className={`history-page-action-notice is-${notification.type}`}
              title={`${notification.title}: ${notification.message}`}
              role={notification.type === 'error' ? 'alert' : 'status'}
              aria-live={notification.type === 'error' ? 'assertive' : 'polite'}
              aria-atomic="true"
            >
              <span>{notification.title}: {notification.message}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => onClose()}
            aria-label={t('history.close')}
            className={`history-drawer-close${pageMode ? ' history-page-close' : ''}`}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {!pageMode && (
          <div className="history-drawer-controls">
            {historySourceFilters}
          </div>
        )}

        <div className={`history-content${pageMode ? ' is-page' : ''}`} data-has-selection={Boolean(activeSelectedRecord)}>
        <div className="history-list-pane">
        {pageMode && (
          <div className="history-list-status-section">
            <div className="history-list-status-heading">
              <span className="history-page-filter-label">{t('history.statusCaption')}</span>
              {historyStatusFilters}
            </div>
            <div className="history-list-source-row">
              <div className="history-page-filter-section is-source-section">
                <span className="history-list-source-label">{t('history.sourceCaption')}</span>
                {historySourceSelect}
              </div>
            </div>
          </div>
        )}
        {pageMode && (
          <div
            className={`history-date-sticky${reserveHistoryDateSpace ? ' is-layout-reserve' : ''}${hideEmptyHistoryDateStrip ? ' is-empty' : ''}`}
            aria-hidden={reserveHistoryDateSpace || undefined}
          >
            {hasStickyDateLabel && <span className="history-date-sticky-label">{stickyDateLabel}</span>}
            {draftColorFilters}
          </div>
        )}
        <div
          className="history-record-list"
          ref={historyRecordListRef}
          onScroll={updateStickyDateLabel}
          aria-busy={pageMode && !historyDataReady}
        >
          {!historyDataReady || filteredRecords.length === 0 ? (
            <HistoryListEmptyState
              pageMode={pageMode}
              historyDataReady={historyDataReady}
              draftsLoading={draftsLoading}
              draftLoadFailed={draftLoadFailed}
              query={query}
              statusFilter={statusFilter}
              sourceFilter={sourceFilter}
              selectedDraftColor={selectedDraftColor}
              onResetSearch={() => setQuery('')}
              onCreateInStudio={navigation.openStudio}
              onCreateInPlanner={navigation.openQuickPlan}
              t={t}
            />
          ) : (
            visibleRecords.map((record, index) => (
              <HistoryRecordRow
                key={record.id}
                record={record}
                previousRecord={visibleRecords[index - 1]}
                index={index}
                pageMode={pageMode}
                showsMonthStrip={showsMonthStrip}
                isSelected={activeSelectedRecord?.id === record.id && !isPreviewRecordHighlightSuppressed}
                isMultiSelected={selectedRecordIdSet.has(record.id)}
                isExpanded={!pageMode && selectedRecord?.id === record.id}
                isHoverSuppressed={hoverSuppressedRecordId === record.id}
                actionMenuOpen={actionMenuOpenId === record.id}
                expandedRecordRef={expandedRecordRef}
                actionMenuRef={actionMenuRef}
                setActionMenuOpenId={setActionMenuOpenId}
                onSelect={(nextRecord) => {
                  setIsPreviewRecordHighlightSuppressed(false);
                  setSelectedRecordIds([]);
                  setSelectedRecord(selectedRecord?.id === nextRecord.id ? null : nextRecord);
                }}
                onToggleMultiSelect={(nextRecord) => {
                  setIsPreviewRecordHighlightSuppressed(true);
                  setSelectedRecordIds((current) => current.includes(nextRecord.id)
                    ? current.filter((id) => id !== nextRecord.id)
                    : [...current, nextRecord.id]);
                }}
                onToggleExpanded={toggleExpandedRecord}
                onSuppressHover={setHoverSuppressedRecordId}
                onPointerLeaveRecord={(recordId) => setHoverSuppressedRecordId((current) => current === recordId ? null : current)}
                onApplyDraft={applyHistoryDraft}
                onReschedule={(nextRecord) => {
                  onReschedule(nextRecord);
                  onClose(false);
                }}
                onConfirm={(type, nextRecord) => setConfirmAction({ type, recordId: nextRecord.id })}
                onDeleteDraft={(nextRecord) => {
                  setBulkDeleteError('');
                  setBulkDeleteCategory('drafts');
                  setBulkDeleteRecordId(nextRecord.id);
                  setBulkDeleteSelection([]);
                }}
                onImagePointerEnter={openImagePreview}
                onImagePointerLeave={closeImagePreview}
                onExpandedImageLoad={() => {
                  const list = historyRecordListRef.current;
                  const expandedRecord = expandedRecordRef.current;
                  if (list && expandedRecord) scrollHistoryRecordIntoView(list, expandedRecord);
                }}
                getDisplayedAttachmentUrl={getDisplayedAttachmentUrl}
                t={t}
                locale={locale}
              />
            ))
          )}
        </div>
        </div>

        {pageMode && (
          <aside
            className="history-detail-panel"
            data-selected={Boolean(activeSelectedRecord)}
            aria-label={t('history.detailsPanel')}
          >
            {activeSelectedRecord ? (
              <>
                <HistoryDetailHeader
                  record={activeSelectedRecord}
                  previewMode={detailPreviewMode}
                  textSize={detailTextSize}
                  onChangeTextSize={(direction) => setDetailTextSize((size) => getAdjacentDetailTextSize(size, direction))}
                  onBack={() => setSelectedRecord(null)}
                  backButtonRef={detailBackButtonRef}
                  recordListRef={historyRecordListRef}
                  locale={locale}
                  t={t}
                />
                <HistoryDetailErrorExplanation record={activeSelectedRecord} t={t} />
                <HistoryDetailMessage
                  record={activeSelectedRecord}
                  previewMode={detailPreviewMode}
                  textSize={detailTextSize}
                  previewRef={detailPreviewRef}
                  getDisplayedAttachmentUrl={getDisplayedAttachmentUrl}
                  t={t}
                />
                <HistoryDetailActions
                    record={activeSelectedRecord}
                    previewMode={detailPreviewMode}
                    copyFeedback={copyFeedback}
                    detailActionMenuOpen={detailActionMenuOpen}
                    detailActionMenuRef={detailActionMenuRef}
                    onToggleActionMenu={setDetailActionMenuOpen}
                    onOpenPreview={() => void openSelectedPreview()}
                    onCopy={() => void copySelectedPost()}
                    onReschedule={(record) => {
                      onReschedule(record);
                      onClose(false);
                    }}
                    onCancel={(record) => setConfirmAction({ type: 'cancel', recordId: record.id })}
                    onUseDraft={onUseDraft
                      ? (record, destination) => applyHistoryDraft(record, destination)
                      : undefined}
                    onDeleteDraft={(record) => {
                      setBulkDeleteError('');
                      setBulkDeleteCategory('drafts');
                      setBulkDeleteRecordId(record.id);
                      setBulkDeleteSelection([]);
                      setDetailActionMenuOpen(false);
                    }}
                    onConfirm={(type, record) => {
                      setConfirmAction({ type, recordId: record.id });
                      setDetailActionMenuOpen(false);
                    }}
                  t={t}
                />
              </>
            ) : (
              <HistoryDetailEmptyState
                title={detailEmptyTitle}
                text={detailEmptyText}
                ready={historyDataReady}
              />
            )}
          </aside>
        )}
        </div>

        <div className="history-drawer-tools">
          {historySearchControl}
          <HistoryFooterActions
            pageMode={pageMode}
            historyStatusFilters={historyStatusFilters}
            exportMenuRef={exportMenuRef}
            isExportMenuOpen={isExportMenuOpen}
            onToggleExportMenu={() => {
              setBulkDeleteCategory(null);
              setBulkDeleteSelection([]);
              setBulkDeleteError('');
              setExportFeedback(null);
              setIsExportMenuOpen((current) => !current);
            }}
            recordCount={multiSelectedRecords.length > 0 ? multiSelectedRecords.length : filteredRecords.length}
            selectedRecord={multiSelectedRecords.length > 0 ? null : selectedRecord}
            isGlobalSearch={multiSelectedRecords.length > 0 ? false : isGlobalSearch}
            locale={locale}
            exportMenuHeading={exportMenuHeading}
            exportMenuScope={exportMenuScope}
            onExport={exportRecords}
            isExporting={isExporting}
            exportFeedback={exportFeedback}
            canDeleteCurrentCategory={multiSelectedRecords.length > 0 || canDeleteCurrentCategory}
            selectedRecordMatchesDeleteCategory={selectedRecordMatchesDeleteCategory}
            statusFilter={statusFilter}
            scheduleCleanupAriaLabel={scheduleCleanupAriaLabel}
            scheduleCleanupTitle={scheduleCleanupTitle}
            bulkDeleteCategory={bulkDeleteCategory}
            onToggleDelete={() => {
              const category = statusFilter;
              if (multiSelectedRecords.length > 0) {
                setIsExportMenuOpen(false);
                setBulkDeleteError('');
                setBulkDeleteStoppedProgress(null);
                setBulkDeleteCategory(category);
                setBulkDeleteRecordId(null);
                setBulkDeleteSelection(multiSelectedRecords);
                return;
              }
              const recordId = selectedRecordMatchesDeleteCategory && selectedRecord
                ? selectedRecord.id
                : null;
              const isSameTarget = bulkDeleteCategory === category && bulkDeleteRecordId === recordId;
              setIsExportMenuOpen(false);
              setBulkDeleteError('');
              setBulkDeleteStoppedProgress(null);
              setBulkDeleteSelection([]);
              setBulkDeleteCategory(isSameTarget ? null : category);
              setBulkDeleteRecordId(isSameTarget ? null : recordId);
            }}
            t={t}
          />
        </div>
        <HistoryConfirmationDialogs
          confirmAction={confirmAction}
          confirmActionRecord={confirmActionRecord}
          confirmActionPrompt={confirmActionPrompt}
          bulkDeleteCategory={bulkDeleteCategory}
          bulkDeleteRecord={bulkDeleteRecord}
          bulkDeleteSelectionCount={bulkDeleteSelection.length}
          bulkDeletePrompt={bulkDeletePrompt}
          bulkDeleteActionLabel={bulkDeleteActionLabel}
          bulkDeleteBusy={bulkDeleteBusy}
          bulkDeleteError={bulkDeleteError}
          bulkDeleteStoppedProgress={bulkDeleteStoppedProgress}
          bulkDeleteCanStop={bulkDeleteCanStop}
          bulkDeleteStopRequested={bulkDeleteStopRequested}
          bulkDeleteStopRequestedRef={bulkDeleteStopRequestedRef}
          queueCancellableCount={queueCancellableRecords.length}
          localScheduleFailureCount={localScheduleFailureRecords.length}
          onBulkDeleteCategoryChange={setBulkDeleteCategory}
          onBulkDeleteRecordChange={setBulkDeleteRecordId}
          onBulkDeleteSelectionChange={setBulkDeleteSelection}
          onBulkDeleteErrorChange={setBulkDeleteError}
          onBulkDeleteStoppedProgressChange={setBulkDeleteStoppedProgress}
          onBulkDeleteStopRequestedChange={setBulkDeleteStopRequested}
          onConfirmCategoryDelete={() => void confirmCategoryDelete()}
          onConfirmAction={() => {
            if (confirmAction && confirmActionRecord) {
              if (confirmAction.type === 'cancel') {
                onCancel(confirmActionRecord);
              } else if (confirmAction.type === 'send-now') {
                onSendNow(confirmActionRecord);
              } else {
                onDelete(confirmActionRecord);
              }
              setConfirmAction(null);
              if (selectedRecord?.id === confirmActionRecord.id) setSelectedRecord(null);
            }
          }}
          onCloseConfirmAction={() => setConfirmAction(null)}
          onHandleConfirmationKeyDown={handleConfirmationKeyDown}
          t={t}
        />        {previewImagePath && previewImagePosition && createPortal(
          <div
            className="message-attachment-preview"
            style={{ left: `${previewImagePosition.left}px`, top: `${previewImagePosition.top}px` }}
            aria-label={t('history.increasedImage', { name: getAttachmentName(previewImagePath, t) })}
          >
            <img
              src={getDisplayedAttachmentUrl(previewImagePath)}
              alt={getAttachmentName(previewImagePath, t)}
              draggable={false}
            />
          </div>,
          document.body,
        )}
      </aside>
    </>
  );
}
