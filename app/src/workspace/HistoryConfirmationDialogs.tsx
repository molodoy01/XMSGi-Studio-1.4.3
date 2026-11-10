import { CalendarOff, Send, Trash2, X } from 'lucide-react';
import type { HistoryItem } from './historyModel';
import type { HistoryBulkDeleteCategory } from './useHistoryBulkDelete';
import type { HistoryTranslate } from './historyPresentation';
import { isLocalScheduleFailure } from './historyErrorPresentation';

type ConfirmAction = { type: 'cancel' | 'delete' | 'send-now'; recordId: string };

export function HistoryConfirmationDialogs({
  confirmAction,
  confirmActionRecord,
  confirmActionPrompt,
  bulkDeleteCategory,
  bulkDeleteRecord,
  bulkDeleteSelectionCount,
  bulkDeletePrompt,
  bulkDeleteActionLabel,
  bulkDeleteBusy,
  bulkDeleteError,
  bulkDeleteStoppedProgress,
  bulkDeleteCanStop,
  bulkDeleteStopRequested,
  bulkDeleteStopRequestedRef,
  queueCancellableCount,
  localScheduleFailureCount,
  onBulkDeleteCategoryChange,
  onBulkDeleteRecordChange,
  onBulkDeleteSelectionChange,
  onBulkDeleteErrorChange,
  onBulkDeleteStoppedProgressChange,
  onBulkDeleteStopRequestedChange,
  onConfirmCategoryDelete,
  onConfirmAction,
  onCloseConfirmAction,
  onHandleConfirmationKeyDown,
  t,
}: {
  confirmAction: ConfirmAction | null;
  confirmActionRecord: HistoryItem | null;
  confirmActionPrompt: string;
  bulkDeleteCategory: HistoryBulkDeleteCategory;
  bulkDeleteRecord: HistoryItem | null;
  bulkDeleteSelectionCount: number;
  bulkDeletePrompt: string;
  bulkDeleteActionLabel: string;
  bulkDeleteBusy: boolean;
  bulkDeleteError: string;
  bulkDeleteStoppedProgress: { processed: number; total: number } | null;
  bulkDeleteCanStop: boolean;
  bulkDeleteStopRequested: boolean;
  bulkDeleteStopRequestedRef: { current: boolean };
  queueCancellableCount: number;
  localScheduleFailureCount: number;
  onBulkDeleteCategoryChange: (category: HistoryBulkDeleteCategory) => void;
  onBulkDeleteRecordChange: (recordId: string | null) => void;
  onBulkDeleteSelectionChange: (records: HistoryItem[]) => void;
  onBulkDeleteErrorChange: (error: string) => void;
  onBulkDeleteStoppedProgressChange: (progress: { processed: number; total: number } | null) => void;
  onBulkDeleteStopRequestedChange: (requested: boolean) => void;
  onConfirmCategoryDelete: () => void;
  onConfirmAction: () => void;
  onCloseConfirmAction: () => void;
  onHandleConfirmationKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  t: HistoryTranslate;
}) {
  return (
    <>
      {confirmAction && confirmActionRecord && (
        <div
          className="history-confirmation-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onCloseConfirmAction();
          }}
        >
          <div
            className="history-confirmation-modal"
            role="alertdialog"
            aria-modal="true"
            onKeyDown={onHandleConfirmationKeyDown}
            aria-label={confirmAction.type === 'cancel'
              ? t('history.confirmCancel')
              : confirmAction.type === 'send-now' ? t('history.confirmSend') : t('history.confirmDelete')}
          >
            <button
              type="button"
              className="history-confirmation-close"
              aria-label={t('common.close')}
              onClick={onCloseConfirmAction}
            >
              <X size={18} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <span className="history-confirmation-icon" aria-hidden="true">
              {confirmAction.type === 'cancel'
                ? <CalendarOff size={24} strokeWidth={1.8} />
                : confirmAction.type === 'send-now'
                  ? <Send size={24} strokeWidth={1.8} />
                  : <Trash2 size={24} strokeWidth={1.8} />}
            </span>
            <h2 className="history-confirmation-title">{confirmActionPrompt}</h2>
            <div className="history-record-confirmation-actions">
              <button
                type="button"
                className="history-record-confirmation-action is-primary"
                autoFocus={confirmAction.type === 'delete'}
                onClick={onConfirmAction}
              >
                {confirmAction.type === 'cancel'
                  ? t('history.cancelAction')
                  : confirmAction.type === 'send-now'
                    ? t('history.sendNow')
                    : confirmActionRecord.status === 'draft' ? t('history.deleteDraftAction') : t('history.deleteRecordAction')}
              </button>
              <button
                type="button"
                className="history-record-confirmation-action is-secondary"
                autoFocus={confirmAction.type !== 'delete'}
                onClick={onCloseConfirmAction}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {bulkDeleteCategory && (
        <div
          className="history-confirmation-backdrop"
          onMouseDown={(event) => {
            if (event.target !== event.currentTarget || bulkDeleteBusy) return;
            onBulkDeleteCategoryChange(null);
            onBulkDeleteRecordChange(null);
            onBulkDeleteSelectionChange([]);
            onBulkDeleteErrorChange('');
            onBulkDeleteStoppedProgressChange(null);
          }}
        >
          <div
            className="history-confirmation-modal"
            role="alertdialog"
            aria-modal="true"
            onKeyDown={onHandleConfirmationKeyDown}
            aria-label={bulkDeleteSelectionCount > 0
              ? t('history.confirmDeleteSelected')
              : bulkDeleteCategory === 'scheduled'
                ? bulkDeleteRecord
                  ? isLocalScheduleFailure(bulkDeleteRecord) ? t('history.confirmDeleteScheduleError') : t('history.confirmCancel')
                  : localScheduleFailureCount > 0 && queueCancellableCount > 0
                    ? t('history.confirmCleanup')
                    : localScheduleFailureCount > 0 ? t('history.confirmDeleteErrors') : t('history.confirmCancelQueue')
                : bulkDeleteCategory === 'notes' && !bulkDeleteRecord
                  ? t('history.confirmDeleteNotes')
                  : bulkDeleteRecord ? t('history.confirmDeleteRecord') : t('history.confirmDeleteCategory')}
          >
            <button
              type="button"
              className="history-confirmation-close"
              aria-label={t('common.close')}
              onClick={() => {
                if (bulkDeleteBusy) return;
                onBulkDeleteCategoryChange(null);
                onBulkDeleteRecordChange(null);
                onBulkDeleteSelectionChange([]);
                onBulkDeleteErrorChange('');
                onBulkDeleteStoppedProgressChange(null);
              }}
            >
              <X size={18} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <span className="history-confirmation-icon" aria-hidden="true">
              <Trash2 size={24} strokeWidth={1.8} />
            </span>
            <h2 className="history-confirmation-title">{bulkDeletePrompt}</h2>
            {bulkDeleteError && <p className="history-bulk-delete-error" role="alert">{bulkDeleteError}</p>}
            {bulkDeleteStoppedProgress && (
              <p className="history-bulk-delete-status" role="status">
                {t('history.bulkStopped', {
                  processed: bulkDeleteStoppedProgress.processed,
                  total: bulkDeleteStoppedProgress.total,
                })}
              </p>
            )}
            <div className="history-record-confirmation-actions">
              <button
                type="button"
                className="history-record-confirmation-action is-primary"
                autoFocus
                onClick={() => {
                  if (bulkDeleteStoppedProgress) {
                    onBulkDeleteCategoryChange(null);
                    onBulkDeleteRecordChange(null);
                    onBulkDeleteSelectionChange([]);
                    onBulkDeleteErrorChange('');
                    onBulkDeleteStoppedProgressChange(null);
                  } else {
                    onConfirmCategoryDelete();
                  }
                }}
                disabled={bulkDeleteBusy}
              >
                {bulkDeleteStoppedProgress
                  ? t('history.closeResult')
                  : bulkDeleteBusy
                    ? bulkDeleteCategory === 'scheduled' ? t('history.cancelling') : t('history.deleting')
                    : bulkDeleteActionLabel}
              </button>
              {!bulkDeleteStoppedProgress && (
                <button
                  type="button"
                  className="history-record-confirmation-action is-secondary"
                  onClick={() => {
                    if (bulkDeleteBusy) {
                      bulkDeleteStopRequestedRef.current = true;
                      onBulkDeleteStopRequestedChange(true);
                      return;
                    }
                    onBulkDeleteCategoryChange(null);
                    onBulkDeleteRecordChange(null);
                    onBulkDeleteSelectionChange([]);
                    onBulkDeleteErrorChange('');
                  }}
                  disabled={bulkDeleteBusy
                    ? !bulkDeleteCanStop || bulkDeleteStopRequested
                    : false}
                >
                  {bulkDeleteBusy && bulkDeleteCanStop
                    ? bulkDeleteStopRequested ? t('history.stoppingAction') : t('history.stopAction')
                    : t('common.cancel')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
