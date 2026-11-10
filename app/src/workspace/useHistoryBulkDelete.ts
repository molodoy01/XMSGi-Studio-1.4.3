import type { Dispatch, SetStateAction } from 'react';
import type { Locale } from '@/lib/i18n';
import type { NotificationType } from '@/types';
import type { HistoryClearResult, HistoryItem } from './historyModel';
import {
  formatHistoryCount,
  isSavedMessagesRecord,
  matchesHistoryStatus,
  type HistorySourceFilter,
  type HistoryTranslate,
} from './historyPresentation';
import { isLocalScheduleFailure, isQueueCancellationCandidate } from './historyErrorPresentation';

export type HistoryBulkDeleteCategory = 'scheduled' | 'sent' | 'drafts' | 'notes' | 'errors' | null;

export function createHistoryBulkDeleteHandler({
  filteredRecords,
  historyItems,
  queueCancellableRecords,
  localScheduleFailureRecords,
  selectedDraftColor,
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
}: {
  filteredRecords: HistoryItem[];
  historyItems: HistoryItem[];
  queueCancellableRecords: HistoryItem[];
  localScheduleFailureRecords: HistoryItem[];
  selectedDraftColor: string | null;
  sourceFilter: HistorySourceFilter;
  bulkDeleteCategory: HistoryBulkDeleteCategory;
  bulkDeleteRecord: HistoryItem | null;
  bulkDeleteSelection: HistoryItem[];
  bulkDeleteStopRequestedRef: { current: boolean };
  locale: Locale;
  t: HistoryTranslate;
  onCancel: (record: HistoryItem) => void;
  onDelete: (record: HistoryItem, suppressNotification?: boolean) => void | Promise<boolean>;
  onClearSent: (source: HistorySourceFilter) => Promise<HistoryClearResult>;
  onShowNotification?: (message: string, type: NotificationType, title: string) => void;
  onClearDrafts?: (source: HistorySourceFilter) => Promise<boolean>;
  onCancelQueue?: (records: HistoryItem[]) => Promise<boolean>;
  setBulkDeleteCategory: Dispatch<SetStateAction<HistoryBulkDeleteCategory>>;
  setBulkDeleteRecordId: Dispatch<SetStateAction<string | null>>;
  setBulkDeleteBusy: Dispatch<SetStateAction<boolean>>;
  setBulkDeleteError: Dispatch<SetStateAction<string>>;
  setBulkDraftDeleteProgress: Dispatch<SetStateAction<{ deleted: number; total: number } | null>>;
  setBulkDeleteCanStop: Dispatch<SetStateAction<boolean>>;
  setBulkDeleteStopRequested: Dispatch<SetStateAction<boolean>>;
  setBulkDeleteStoppedProgress: Dispatch<SetStateAction<{ processed: number; total: number } | null>>;
  setDraftItems: Dispatch<SetStateAction<HistoryItem[]>>;
  setSelectedRecord: Dispatch<SetStateAction<HistoryItem | null>>;
  setSelectedRecordIds: Dispatch<SetStateAction<string[]>>;
  setBulkDeleteSelection: Dispatch<SetStateAction<HistoryItem[]>>;
}) {
  const showDeleteResult = (deleted: number, failed: number, stopped = false, sent = false) => {
    if (!onShowNotification || (deleted === 0 && failed === 0 && !stopped)) return;
    let message: string;
    let type: NotificationType;
    if (stopped && failed > 0) {
      message = t('history.bulkDeleteStoppedPartial', {
        deleted: formatHistoryCount(deleted, locale),
        failed: formatHistoryCount(failed, locale),
      });
      type = 'warning';
    } else if (stopped) {
      message = t('history.bulkDeleteStopped', { count: formatHistoryCount(deleted, locale) });
      type = 'warning';
    } else if (deleted > 0 && failed > 0) {
      message = t('history.bulkDeletePartial', {
        deleted: formatHistoryCount(deleted, locale),
        failed: formatHistoryCount(failed, locale),
      });
      type = 'warning';
    } else if (deleted > 0) {
      message = t(sent ? 'history.bulkSentDeleteSuccess' : 'history.bulkDeleteSuccess', {
        count: formatHistoryCount(deleted, locale),
      });
      type = 'success';
    } else {
      message = t('history.bulkDeleteFailure', { count: formatHistoryCount(failed, locale) });
      type = 'error';
    }
    onShowNotification(message, type, t('history.title'));
  };

  const confirmCategoryDelete = async () => {
    if (!bulkDeleteCategory) return;
    setBulkDeleteBusy(true);
    setBulkDeleteError('');
    setBulkDeleteStoppedProgress(null);
    setBulkDeleteCanStop(false);
    setBulkDeleteStopRequested(false);
    setBulkDraftDeleteProgress(null);
    bulkDeleteStopRequestedRef.current = false;

    let bulkActionProcessed = 0;
    let bulkActionTotal = 0;
    const startBulkAction = (total: number) => {
      bulkActionProcessed = 0;
      bulkActionTotal = total;
      if (total > 1) setBulkDeleteCanStop(true);
    };
    const finishBulkAction = () => {
      const stopped = bulkDeleteStopRequestedRef.current && bulkActionProcessed < bulkActionTotal;
      setBulkDeleteCanStop(false);
      setBulkDeleteStopRequested(false);
      if (stopped) {
        setBulkDeleteStoppedProgress({ processed: bulkActionProcessed, total: bulkActionTotal });
      }
      return stopped;
    };

    try {
      if (bulkDeleteSelection.length > 0) {
        startBulkAction(bulkDeleteSelection.length);
        setBulkDraftDeleteProgress({ deleted: 0, total: bulkDeleteSelection.length });
        const processedIds = new Set<string>();
        const failedRecords: HistoryItem[] = [];
        let deletedCount = 0;

        for (const record of bulkDeleteSelection) {
          if (bulkDeleteStopRequestedRef.current) break;
          try {
            let succeeded: boolean;
            if (record.status === 'scheduled') {
              if (isLocalScheduleFailure(record)) {
                succeeded = (await onDelete(record, true)) !== false;
              } else if (isQueueCancellationCandidate(record)) {
                succeeded = Boolean(onCancelQueue && await onCancelQueue([record]));
              } else {
                onCancel(record);
                succeeded = true;
              }
            } else {
              const result = await onDelete(record, true);
              succeeded = record.status === 'draft' ? result === true : result !== false;
            }
            if (succeeded) deletedCount += 1;
            else failedRecords.push(record);
          } catch (error) {
            console.error(`Failed to delete selected history record "${record.id}".`, error);
            failedRecords.push(record);
          } finally {
            processedIds.add(record.id);
            bulkActionProcessed += 1;
            setBulkDraftDeleteProgress({ deleted: deletedCount, total: bulkDeleteSelection.length });
          }
        }

        const stopped = finishBulkAction();
        const remainingRecords = bulkDeleteSelection.filter((record) => (
          failedRecords.some((failed) => failed.id === record.id) || !processedIds.has(record.id)
        ));
        showDeleteResult(
          deletedCount,
          failedRecords.length,
          stopped,
          bulkDeleteSelection.every((record) => record.status === 'sent'),
        );
        setSelectedRecordIds(remainingRecords.map((record) => record.id));
        setBulkDeleteSelection(remainingRecords);
        setSelectedRecord(null);
        setBulkDeleteRecordId(null);
        if (stopped || failedRecords.length > 0) {
          if (failedRecords.length > 0) {
            setBulkDeleteError(t('history.deleteFailedCount', {
              count: formatHistoryCount(failedRecords.length, locale),
            }));
          }
          return;
        }
        setBulkDeleteCategory(null);
        return;
      }

      if (bulkDeleteRecord) {
        if (bulkDeleteCategory === 'notes'
          && bulkDeleteRecord.original.kind === 'scheduled'
          && bulkDeleteRecord.status === 'scheduled') {
          if (isQueueCancellationCandidate(bulkDeleteRecord)) {
            if (!onCancelQueue || !await onCancelQueue([bulkDeleteRecord])) {
              setBulkDeleteError(t('history.cancelFailed'));
              showDeleteResult(0, 1);
              return;
            }
          } else {
            onCancel(bulkDeleteRecord);
          }
          setBulkDeleteRecordId(null);
          setBulkDeleteCategory(null);
          showDeleteResult(1, 0);
          return;
        }

        if (bulkDeleteCategory === 'scheduled') {
          if (isLocalScheduleFailure(bulkDeleteRecord)) {
            const deleted = await onDelete(bulkDeleteRecord, true);
            showDeleteResult(deleted === false ? 0 : 1, deleted === false ? 1 : 0);
            setSelectedRecord(null);
            setBulkDeleteRecordId(null);
            setBulkDeleteCategory(null);
            return;
          }
          if (!onCancelQueue || !await onCancelQueue([bulkDeleteRecord])) {
            setBulkDeleteError(t('history.cancelFailed'));
            showDeleteResult(0, 1);
            return;
          }
          setSelectedRecord(null);
          setBulkDeleteRecordId(null);
          setBulkDeleteCategory(null);
          showDeleteResult(1, 0);
          return;
        }

        const deletionResult = await onDelete(bulkDeleteRecord, true);
        if (bulkDeleteRecord.status === 'draft' && deletionResult !== true) {
          setBulkDeleteError(t('history.deleteDraftFailed'));
          showDeleteResult(0, 1);
          return;
        }
        if (bulkDeleteCategory === 'notes'
          && bulkDeleteRecord.status === 'sent'
          && bulkDeleteRecord.original.kind === 'scheduled'
          && isSavedMessagesRecord(bulkDeleteRecord)
          && (bulkDeleteRecord.original.message.telegramMessageId != null
            || (bulkDeleteRecord.original.message.telegramMessageIds ?? []).some((id) => id != null))
          && deletionResult !== true) {
          setBulkDeleteError(t('history.deleteNoteFailed'));
          showDeleteResult(0, 1);
          return;
        }
        const deletionSucceeded = deletionResult !== false;
        showDeleteResult(deletionSucceeded ? 1 : 0, deletionSucceeded ? 0 : 1);
        if (bulkDeleteRecord.status === 'draft') {
          setDraftItems((current) => current.filter((record) => record.id !== bulkDeleteRecord.id));
        }
        setSelectedRecord(null);
        setBulkDeleteRecordId(null);
        setBulkDeleteCategory(null);
        return;
      }

      if (bulkDeleteCategory === 'scheduled') {
        startBulkAction(localScheduleFailureRecords.length + queueCancellableRecords.length);
        const failedCancellations: HistoryItem[] = [];
        for (const record of localScheduleFailureRecords) {
          if (bulkDeleteStopRequestedRef.current) break;
          try {
            if (await onDelete(record, true) === false) failedCancellations.push(record);
          } catch (error) {
            console.error(`Failed to delete scheduled record "${record.id}".`, error);
            failedCancellations.push(record);
          } finally {
            bulkActionProcessed += 1;
          }
        }

        for (const record of queueCancellableRecords) {
          if (bulkDeleteStopRequestedRef.current) break;
          try {
            if (!onCancelQueue || !await onCancelQueue([record])) failedCancellations.push(record);
          } catch (error) {
            console.error(`Failed to cancel scheduled record "${record.id}".`, error);
            failedCancellations.push(record);
          } finally {
            bulkActionProcessed += 1;
          }
        }

        const stopped = finishBulkAction();
        const deletedCount = bulkActionProcessed - failedCancellations.length;
        showDeleteResult(deletedCount, failedCancellations.length, stopped);
        if (failedCancellations.length > 0) {
          setBulkDeleteError(t(localScheduleFailureRecords.length > 0
            ? 'history.cancelPartialWithErrors'
            : 'history.cancelPartial'));
        }
        if (stopped || failedCancellations.length > 0) return;
        setBulkDeleteCategory(null);
        setBulkDeleteRecordId(null);
        return;
      }

      if (bulkDeleteCategory === 'errors') {
        const failedRecords = historyItems.filter((record) => (
          matchesHistoryStatus(record, 'errors')
          && (sourceFilter === 'all' || record.source === sourceFilter)
        ));
        const failedToDelete: HistoryItem[] = [];
        startBulkAction(failedRecords.length);
        for (const record of failedRecords) {
          if (bulkDeleteStopRequestedRef.current) break;
          try {
            if (await onDelete(record, true) === false) failedToDelete.push(record);
          } catch (error) {
            console.error(`Failed to delete history record "${record.id}".`, error);
            failedToDelete.push(record);
          } finally {
            bulkActionProcessed += 1;
          }
        }
        const stopped = finishBulkAction();
        showDeleteResult(bulkActionProcessed - failedToDelete.length, failedToDelete.length, stopped);
        if (failedToDelete.length > 0) {
          setBulkDeleteError(t('history.deleteFailedCount', { count: formatHistoryCount(failedToDelete.length, locale) }));
        }
        if (stopped || failedToDelete.length > 0) return;
        setSelectedRecord(null);
        setBulkDeleteRecordId(null);
        setBulkDeleteCategory(null);
        return;
      }

      if (bulkDeleteCategory === 'sent') {
        const result = await onClearSent(sourceFilter);
        showDeleteResult(result.deleted, result.failed, false, true);
        setBulkDeleteRecordId(null);
        setBulkDeleteCategory(null);
        return;
      }

      if (bulkDeleteCategory === 'notes') {
        const noteRecords = historyItems.filter((record) => matchesHistoryStatus(record, 'notes'));
        const failedRecords: HistoryItem[] = [];
        startBulkAction(noteRecords.length);

        for (const record of noteRecords) {
          if (bulkDeleteStopRequestedRef.current) break;
          try {
            if (record.original.kind === 'scheduled' && record.status === 'scheduled') {
              if (isQueueCancellationCandidate(record)) {
                if (!onCancelQueue || !await onCancelQueue([record])) failedRecords.push(record);
              } else {
                onCancel(record);
              }
              continue;
            }

            const deletionResult = await onDelete(record, true);
            const requiresTelegramDelete = record.status === 'sent'
              && record.original.kind === 'scheduled'
              && isSavedMessagesRecord(record)
              && (record.original.message.telegramMessageId != null
                || (record.original.message.telegramMessageIds ?? []).some((id) => id != null));
            const succeeded = requiresTelegramDelete
              ? deletionResult === true
              : deletionResult !== false;
            if (!succeeded) failedRecords.push(record);
          } catch (error) {
            console.error(`Failed to delete note "${record.id}".`, error);
            failedRecords.push(record);
          } finally {
            bulkActionProcessed += 1;
          }
        }

        const stopped = finishBulkAction();
        showDeleteResult(bulkActionProcessed - failedRecords.length, failedRecords.length, stopped);
        setSelectedRecord(null);
        setBulkDeleteRecordId(null);
        if (failedRecords.length > 0) {
          setBulkDeleteError(t('history.deleteFailedCount', { count: formatHistoryCount(failedRecords.length, locale) }));
        }
        if (stopped || failedRecords.length > 0) return;

        setBulkDeleteCategory(null);
        return;
      }

      const draftsToDelete = filteredRecords.filter((record) => record.status === 'draft'
        && (!selectedDraftColor || record.draftColor === selectedDraftColor));
      if (draftsToDelete.length === 0) {
        if (selectedDraftColor === null) {
          if (!onClearDrafts || !await onClearDrafts(sourceFilter)) {
            setBulkDeleteError(t('history.deleteDraftsFailed'));
            onShowNotification?.(t('history.bulkDeleteFailed'), 'error', t('history.title'));
            return;
          }
          onShowNotification?.(t('history.bulkDeleteCompleted'), 'success', t('history.title'));
        }

        setSelectedRecord(null);
        setBulkDeleteRecordId(null);
        setBulkDeleteCategory(null);
        return;
      }

      startBulkAction(draftsToDelete.length);
      setBulkDraftDeleteProgress({ deleted: 0, total: draftsToDelete.length });
      const failedDrafts: HistoryItem[] = [];
      const deletedDraftIds = new Set<string>();

      for (const draft of draftsToDelete) {
        if (bulkDeleteStopRequestedRef.current) break;
        try {
          if (await onDelete(draft, true) === true) {
            deletedDraftIds.add(draft.id);
            setBulkDraftDeleteProgress((progress) => progress
              ? { ...progress, deleted: progress.deleted + 1 }
              : progress);
          } else {
            failedDrafts.push(draft);
          }
        } catch (error) {
          console.error(`Failed to delete draft "${draft.id}".`, error);
          failedDrafts.push(draft);
        } finally {
          bulkActionProcessed += 1;
        }
      }

      const stopped = finishBulkAction();
      if (deletedDraftIds.size > 0) {
        setDraftItems((current) => current.filter((draft) => !deletedDraftIds.has(draft.id)));
      }

      setSelectedRecord(null);
      setBulkDeleteRecordId(null);
      showDeleteResult(deletedDraftIds.size, failedDrafts.length, stopped);
      if (failedDrafts.length > 0) {
        setBulkDeleteError(t('history.deleteFailedCount', { count: formatHistoryCount(failedDrafts.length, locale) }));
      }
      if (stopped || failedDrafts.length > 0) return;

      setBulkDeleteCategory(null);
    } catch (error) {
      console.error('Failed to complete history bulk delete.', error);
      setBulkDeleteError(error instanceof Error ? error.message : t('history.deleteCategoryFailed'));
      showDeleteResult(0, 1, false, bulkDeleteCategory === 'sent');
    } finally {
      setBulkDeleteBusy(false);
    }
  };

  return confirmCategoryDelete;
}
