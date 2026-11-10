import { formatDraftCount, formatHistoryCount, type HistoryTranslate } from './historyPresentation';
import { getRetryActionLabel, isLocalScheduleFailure } from './historyErrorPresentation';
import type { HistoryItem } from './historyModel';
import type { HistoryBulkDeleteCategory } from './useHistoryBulkDelete';

type HistoryConfirmAction = { type: 'cancel' | 'delete' | 'send-now'; recordId: string } | null;

export function getHistoryConfirmationText({
  confirmAction,
  confirmActionRecord,
  bulkDeleteRecord,
  bulkDeleteCategory,
  bulkDeleteCount,
  bulkDeleteBusy,
  bulkDraftDeleteProgress,
  queueCancellableCount,
  localScheduleFailureCount,
  scheduleCleanupLabel,
  locale,
  t,
}: {
  confirmAction: HistoryConfirmAction;
  confirmActionRecord: HistoryItem | null;
  bulkDeleteRecord: HistoryItem | null;
  bulkDeleteCategory: HistoryBulkDeleteCategory;
  bulkDeleteCount: number;
  bulkDeleteBusy: boolean;
  bulkDraftDeleteProgress: { deleted: number; total: number } | null;
  queueCancellableCount: number;
  localScheduleFailureCount: number;
  scheduleCleanupLabel: string;
  locale: 'ru' | 'en';
  t: HistoryTranslate;
}) {
  const confirmActionPrompt = confirmAction && confirmActionRecord
    ? confirmAction.type === 'cancel'
      ? t('history.cancelSchedulePrompt', { title: confirmActionRecord.title })
      : confirmAction.type === 'send-now'
        ? t('history.sendPrompt', {
          action: confirmActionRecord.status === 'failed' ? getRetryActionLabel(confirmActionRecord, t) : t('history.sendAction'),
          title: confirmActionRecord.title,
        })
        : confirmActionRecord.status === 'failed'
          ? t('history.deleteFailedPrompt')
          : confirmActionRecord.status === 'draft'
            ? t('history.deleteDraftPrompt', { title: confirmActionRecord.title })
            : t('history.deleteRecordFromHistory', { title: confirmActionRecord.title })
    : '';

  const bulkDeletePrompt = bulkDeleteRecord
    ? bulkDeleteCategory === 'errors'
      ? t('history.deleteFailedPrompt')
      : bulkDeleteRecord.status === 'scheduled'
        ? t('history.cancelSchedulePrompt', { title: bulkDeleteRecord.title })
        : isLocalScheduleFailure(bulkDeleteRecord)
          ? t('history.deleteErrorRecordPrompt', { title: bulkDeleteRecord.title })
          : bulkDeleteRecord.status === 'failed' && bulkDeleteRecord.retryAction === 'cancel'
            ? t('history.retryCancelPrompt', { title: bulkDeleteRecord.title })
            : bulkDeleteRecord.status === 'sent'
              ? t('history.deleteRecordFromHistory', { title: bulkDeleteRecord.title })
              : t('history.deleteDraftPrompt', { title: bulkDeleteRecord.title })
    : bulkDeleteCategory === 'errors'
      ? t('history.deleteErrorsPrompt', { count: bulkDeleteCount })
      : bulkDeleteCategory === 'notes'
        ? t('history.deleteNotesPrompt', { count: formatHistoryCount(bulkDeleteCount, locale) })
        : bulkDeleteCategory === 'sent'
          ? t('history.deleteSentPrompt', { count: formatHistoryCount(bulkDeleteCount, locale) })
          : bulkDeleteCategory === 'drafts'
            ? bulkDeleteBusy && bulkDraftDeleteProgress
              ? t('history.deletingDraftsPrompt', {
                count: formatDraftCount(bulkDraftDeleteProgress.total - bulkDraftDeleteProgress.deleted, locale),
              })
              : t('history.deleteDraftsPrompt', { count: formatDraftCount(bulkDeleteCount, locale) })
            : queueCancellableCount > 0 && localScheduleFailureCount > 0
              ? t('history.cancelAndDeleteErrorsPrompt', {
                cancelCount: formatHistoryCount(queueCancellableCount, locale),
                errorCount: localScheduleFailureCount,
              })
              : queueCancellableCount > 0
                ? t('history.cancelQueuePrompt', { count: formatHistoryCount(queueCancellableCount, locale) })
                : t('history.deleteErrorsPrompt', { count: localScheduleFailureCount });

  const bulkDeleteActionLabel = bulkDeleteRecord
    ? bulkDeleteCategory === 'errors'
      ? t('history.deleteErrorAction')
      : bulkDeleteRecord.status === 'scheduled'
        ? t('history.unscheduleAction')
        : isLocalScheduleFailure(bulkDeleteRecord)
          ? t('history.deleteErrorAction')
          : bulkDeleteRecord.status === 'failed' && bulkDeleteRecord.retryAction === 'cancel'
            ? t('history.retryCancelAction')
            : bulkDeleteRecord.status === 'draft'
              ? t('history.deleteDraftAction')
              : t('history.deleteRecordAction')
    : bulkDeleteCategory === 'scheduled'
      ? scheduleCleanupLabel
      : bulkDeleteCategory === 'errors'
        ? t('history.deleteErrors', { count: bulkDeleteCount })
        : bulkDeleteCategory === 'notes'
          ? t('history.deleteNotesAction', { count: formatHistoryCount(bulkDeleteCount, locale) })
          : t('history.deleteCount', {
            count: bulkDeleteCategory === 'sent'
              ? formatHistoryCount(bulkDeleteCount, locale)
              : formatDraftCount(bulkDeleteCount, locale),
          });

  return { confirmActionPrompt, bulkDeletePrompt, bulkDeleteActionLabel };
}
