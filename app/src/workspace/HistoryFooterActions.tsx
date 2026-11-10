import type { ReactNode } from 'react';
import { Download, Trash2 } from 'lucide-react';
import type { HistoryItem } from './historyModel';
import { isLocalScheduleFailure } from './historyErrorPresentation';
import {
  formatHistoryCount,
  type HistoryExportFormat,
  type HistoryStatusFilter,
  type HistoryTranslate,
} from './historyPresentation';

export function HistoryFooterActions({
  pageMode,
  historyStatusFilters,
  exportMenuRef,
  isExportMenuOpen,
  onToggleExportMenu,
  recordCount,
  selectedRecord,
  isGlobalSearch,
  locale,
  exportMenuHeading,
  exportMenuScope,
  onExport,
  isExporting,
  exportFeedback,
  canDeleteCurrentCategory,
  selectedRecordMatchesDeleteCategory,
  statusFilter,
  scheduleCleanupAriaLabel,
  scheduleCleanupTitle,
  bulkDeleteCategory,
  onToggleDelete,
  t,
}: {
  pageMode: boolean;
  historyStatusFilters: ReactNode;
  exportMenuRef: { current: HTMLDivElement | null };
  isExportMenuOpen: boolean;
  onToggleExportMenu: () => void;
  recordCount: number;
  selectedRecord: HistoryItem | null;
  isGlobalSearch: boolean;
  locale: 'ru' | 'en';
  exportMenuHeading: string;
  exportMenuScope: string;
  onExport: (format: HistoryExportFormat) => void;
  isExporting: boolean;
  exportFeedback: { status: 'success' | 'partial' | 'error'; message: string } | null;
  canDeleteCurrentCategory: boolean;
  selectedRecordMatchesDeleteCategory: boolean;
  statusFilter: HistoryStatusFilter;
  scheduleCleanupAriaLabel: string;
  scheduleCleanupTitle: string;
  bulkDeleteCategory: HistoryStatusFilter | null;
  onToggleDelete: () => void;
  t: HistoryTranslate;
}) {
  const selectedRecordLabel = selectedRecordMatchesDeleteCategory && selectedRecord
    ? statusFilter === 'errors'
      ? t('history.deleteErrorTitle', { title: selectedRecord.title })
      : statusFilter === 'scheduled'
        ? isLocalScheduleFailure(selectedRecord)
          ? t('history.deleteErrorTitle', { title: selectedRecord.title })
          : t('history.cancelTitle', { title: selectedRecord.title })
        : t('history.deleteTitle', { title: selectedRecord.title })
    : null;
  const deleteLabel = selectedRecordLabel ?? (statusFilter === 'scheduled'
    ? scheduleCleanupAriaLabel
    : statusFilter === 'sent'
      ? t('history.deleteSent')
      : statusFilter === 'notes'
        ? t('history.deleteNotes')
        : t('history.deleteDrafts'));
  const selectedRecordTitle = selectedRecordMatchesDeleteCategory && selectedRecord
    ? statusFilter === 'errors'
      ? t('history.deleteErrorFromHistoryTitle', { title: selectedRecord.title })
      : statusFilter === 'scheduled'
        ? isLocalScheduleFailure(selectedRecord)
          ? t('history.deleteErrorFromHistoryTitle', { title: selectedRecord.title })
          : t('history.cancelTelegramTitle', { title: selectedRecord.title })
        : t('history.deleteTitle', { title: selectedRecord.title })
    : null;
  const deleteTitle = selectedRecordTitle ?? (statusFilter === 'scheduled'
    ? scheduleCleanupTitle
    : statusFilter === 'sent'
      ? t('history.deleteSent')
      : statusFilter === 'notes'
        ? t('history.deleteNotesTitle')
        : t('history.deleteDrafts'));

  return (
    <div className="history-drawer-footer" aria-label={t('history.actionsPanel')}>
      <div className="history-status-row">
        {!pageMode && historyStatusFilters}
        <div
          className={`history-export-control${pageMode ? ' is-page-action' : ''}`}
          ref={(element) => {
            exportMenuRef.current = element;
          }}
        >
          <button
            type="button"
            className="history-export-button"
            onClick={onToggleExportMenu}
            disabled={recordCount === 0 || isExporting}
            aria-label={pageMode
              ? t('history.export')
              : selectedRecord
                ? t('history.exportRecord', { title: selectedRecord.title })
                : isGlobalSearch ? t('history.exportSearchResultsAction') : t('history.exportCurrent')}
            aria-haspopup="menu"
            aria-expanded={isExportMenuOpen}
            title={pageMode
              ? undefined
              : selectedRecord
                ? t('history.exportRecord', { title: selectedRecord.title })
                : t(isGlobalSearch ? 'history.exportSearchCount' : 'history.exportCount', {
                  count: formatHistoryCount(recordCount, locale),
                })}
          >
            <Download size={24} strokeWidth={1.8} aria-hidden="true" />
            {!pageMode && <span>{t('history.export')}</span>}
          </button>
          {pageMode && (
            <span className="history-action-label" aria-hidden="true">
              {t('history.export')}
            </span>
          )}
          {isExportMenuOpen && (
            <div className="history-export-menu" role="menu" aria-label={t('history.exportMenu')}>
              <span className="history-export-menu-label">{exportMenuHeading}</span>
              <button
                type="button"
                role="menuitem"
                className="history-export-option"
                aria-label={t('history.exportAsTxt', { scope: exportMenuScope })}
                title={t(selectedRecord ? 'history.saveTxtSingle' : 'history.saveTxtMultiple')}
                disabled={isExporting}
                onClick={() => onExport('txt')}
              >
                <span>{t('history.textFile')}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="history-export-option"
                aria-label={t('history.exportAsJson', { scope: exportMenuScope })}
                title={t(selectedRecord ? 'history.saveJsonSingle' : 'history.saveJsonMultiple')}
                disabled={isExporting}
                onClick={() => onExport('json')}
              >
                <span>{t('history.jsonFile')}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="history-export-option"
                aria-label={t('history.exportWithAttachments', { scope: exportMenuScope })}
                title={t('history.saveArchive')}
                disabled={isExporting}
                onClick={() => onExport('zip')}
              >
                <span>{t('history.archiveFile')}</span>
              </button>
            </div>
          )}
          {exportFeedback && !isExportMenuOpen && (
            <div
              className={`history-export-feedback-panel${exportFeedback?.status === 'error' || exportFeedback?.status === 'partial' ? ' history-bulk-delete-error' : ''}`}
              role={exportFeedback?.status === 'error' ? 'alert' : 'status'}
              aria-live={exportFeedback?.status === 'error' ? 'assertive' : 'polite'}
            >
              {exportFeedback.message}
            </div>
          )}
        </div>
        <div className={`history-delete-action${pageMode ? ' is-page-action' : ''}`}>
          <button
            type="button"
            className="history-delete-button"
            disabled={!canDeleteCurrentCategory}
            aria-label={deleteLabel}
            aria-haspopup="dialog"
            aria-expanded={Boolean(bulkDeleteCategory)}
            title={!pageMode ? deleteTitle : undefined}
            onClick={onToggleDelete}
          >
            <Trash2 size={25} strokeWidth={1.8} aria-hidden="true" />
          </button>
          {pageMode && (
            <span className="history-action-label" aria-hidden="true">
              {t('history.delete')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
