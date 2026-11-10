import type { Dispatch, SetStateAction } from 'react';
import { CalendarDays, CalendarOff, Check, Copy, Ellipsis, ExternalLink, Eye } from 'lucide-react';
import type { HistoryItem } from './historyModel';
import type { HistoryTranslate } from './historyPresentation';

type ConfirmActionType = 'cancel' | 'delete' | 'send-now';

export function HistoryDetailActions({
  record,
  previewMode,
  copyFeedback,
  detailActionMenuOpen,
  detailActionMenuRef,
  onToggleActionMenu,
  onOpenPreview,
  onCopy,
  onReschedule,
  onCancel,
  onUseDraft,
  onDeleteDraft,
  onConfirm,
  t,
}: {
  record: HistoryItem;
  previewMode: 'details' | 'preview';
  copyFeedback: 'copied' | 'failed' | null;
  detailActionMenuOpen: boolean;
  detailActionMenuRef: { current: HTMLDivElement | null };
  onToggleActionMenu: Dispatch<SetStateAction<boolean>>;
  onOpenPreview: () => void;
  onCopy: () => void;
  onReschedule: (record: HistoryItem) => void;
  onCancel: (record: HistoryItem) => void;
  onUseDraft?: (record: HistoryItem, destination: 'studio') => void;
  onDeleteDraft: (record: HistoryItem) => void;
  onConfirm: (type: ConfirmActionType, record: HistoryItem) => void;
  t: HistoryTranslate;
}) {
  const scheduleMessage = record.original.kind === 'scheduled' ? record.original.message : null;
  const canDeleteSentRecord = (record.status === 'sent' || record.status === 'failed')
    && Boolean(scheduleMessage);
  const copyLabel = copyFeedback === 'copied'
    ? 'history.copied'
    : copyFeedback === 'failed'
      ? 'history.copyFailed'
      : 'history.copy';

  return (
    <div
      className={`history-detail-actions${previewMode === 'preview' ? ' is-preview-open' : ''}`}
      aria-label={t('history.actionsPanel')}
    >
      <div className="history-detail-toolbar" ref={detailActionMenuRef}>
        {record.status !== 'failed' && (
          <>
            <button
              type="button"
              className="history-detail-tool-button is-preview"
              onClick={onOpenPreview}
              aria-label={t('history.preview')}
              title={t('history.preview')}
              aria-pressed={previewMode !== 'details'}
            >
              <span className="history-detail-tool-icon">
                <Eye size={26} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span>{t('history.preview')}</span>
            </button>
            {record.status !== 'scheduled' && (
              <button
                type="button"
                className={`history-detail-tool-button${copyFeedback === 'failed' ? ' is-error' : ''}`}
                onClick={onCopy}
                disabled={!record.text && record.attachments.length === 0}
                aria-label={t(copyLabel)}
                title={t(copyLabel)}
              >
                <span className="history-detail-tool-icon">
                  {copyFeedback === 'copied'
                    ? <Check size={23} strokeWidth={2} aria-hidden="true" />
                    : <Copy size={23} strokeWidth={1.8} aria-hidden="true" />}
                </span>
                <span>{t(copyLabel)}</span>
              </button>
            )}
          </>
        )}
        {record.status === 'scheduled' && scheduleMessage && (
          <button
            type="button"
            className="history-detail-tool-button"
            onClick={() => onReschedule(record)}
            aria-label={t('history.edit')}
            title={t('history.edit')}
          >
            <span className="history-detail-tool-icon">
              <CalendarDays size={23} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span>{t('history.edit')}</span>
          </button>
        )}
        {record.status === 'scheduled' && scheduleMessage && (
          <button
            type="button"
            className="history-detail-tool-button is-error"
            onClick={() => onCancel(record)}
            aria-label={t('history.cancel')}
            title={t('history.cancel')}
          >
            <span className="history-detail-tool-icon">
              <CalendarOff size={23} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span>{t('history.cancel')}</span>
          </button>
        )}
        {record.status === 'failed' && onUseDraft && (
          <button
            type="button"
            className="history-detail-tool-button is-use-text"
            onClick={() => onUseDraft(record, 'studio')}
            disabled={!record.text && record.attachments.length === 0}
            aria-label={t('history.openInEditor')}
            title={t('history.openInEditor')}
          >
            <span className="history-detail-tool-icon">
              <ExternalLink size={23} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span>{t('history.openInEditor')}</span>
          </button>
        )}
        {(record.status === 'draft' || record.status === 'sent') && onUseDraft && (
          <button
            type="button"
            className="history-detail-tool-button is-use-text"
            onClick={() => onUseDraft(record, 'studio')}
            disabled={!record.text && record.attachments.length === 0}
            aria-label={t('history.useText')}
            title={t('history.useText')}
          >
            <span className="history-detail-tool-icon">
              <ExternalLink size={23} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span>{t('history.useText')}</span>
          </button>
        )}
        <button
          type="button"
          className="history-detail-tool-button is-more"
          onClick={() => onToggleActionMenu((open) => !open)}
          aria-label={t('history.more')}
          title={t('history.more')}
          aria-expanded={detailActionMenuOpen}
          aria-haspopup="menu"
        >
          <span className="history-detail-tool-icon">
            <Ellipsis size={24} strokeWidth={2} aria-hidden="true" />
          </span>
          <span>{t('history.more')}</span>
        </button>
        {detailActionMenuOpen && (
          <div className="history-detail-action-menu" role="menu" aria-label={t('history.actionsPanel')}>
            {record.status === 'draft' && (
              <button
                type="button"
                role="menuitem"
                className="history-detail-menu-item is-danger"
                onClick={() => onDeleteDraft(record)}
              >
                {t('history.delete')}
              </button>
            )}
            {record.status === 'scheduled' && scheduleMessage && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className="history-detail-menu-item"
                  onClick={() => onConfirm('send-now', record)}
                >
                  {t('history.sendNow')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="history-detail-menu-item is-danger"
                  onClick={() => onConfirm('cancel', record)}
                >
                  {t('history.cancel')}
                </button>
              </>
            )}
            {canDeleteSentRecord && (
              <button
                type="button"
                role="menuitem"
                className="history-detail-menu-item is-danger"
                onClick={() => onConfirm('delete', record)}
              >
                {t('history.delete')}
              </button>
            )}
            {record.status === 'sending' && (
              <button type="button" role="menuitem" className="history-detail-menu-item" disabled>
                {t('history.sending')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
