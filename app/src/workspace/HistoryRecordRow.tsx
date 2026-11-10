import type { Dispatch, Ref, SetStateAction } from 'react';
import { Fragment } from 'react';
import { Ellipsis, FileText, Maximize2, Minimize2, Paperclip } from 'lucide-react';
import { richTextToHtml } from '@/lib/richText';
import type { HistoryItem } from './historyModel';
import {
  formatAttachmentCount,
  formatDateLabel,
  formatDisplayCount,
  formatHistoryDayLabel,
  formatHistoryMonthLabel,
  formatTime,
  getHistoryDayKey,
  getHistoryMonthKey,
  getHistoryTimestamp,
  getPlannerReminderType,
  getPlannerReminderTypePresentation,
  getHistoryStatusLabel,
  type HistoryTranslate,
} from './historyPresentation';
import { getAttachmentName } from './historyPresentation';
import { isImageAttachment, toAttachmentUrl } from './historyAttachments';
import { getVisibleHistoryError } from './historyErrorPresentation';

type ConfirmActionType = 'cancel' | 'delete' | 'send-now';

export function HistoryRecordRow({
  record,
  previousRecord,
  index,
  pageMode,
  showsMonthStrip,
  isSelected,
  isMultiSelected,
  isExpanded,
  isHoverSuppressed,
  actionMenuOpen,
  expandedRecordRef,
  actionMenuRef,
  setActionMenuOpenId,
  onSelect,
  onToggleMultiSelect,
  onToggleExpanded,
  onSuppressHover,
  onPointerLeaveRecord,
  onApplyDraft,
  onReschedule,
  onConfirm,
  onDeleteDraft,
  onImagePointerEnter,
  onImagePointerLeave,
  onExpandedImageLoad,
  getDisplayedAttachmentUrl,
  t,
  locale,
}: {
  record: HistoryItem;
  previousRecord: HistoryItem | undefined;
  index: number;
  pageMode: boolean;
  showsMonthStrip: boolean;
  isSelected: boolean;
  isMultiSelected: boolean;
  isExpanded: boolean;
  isHoverSuppressed: boolean;
  actionMenuOpen: boolean;
  expandedRecordRef: Ref<HTMLElement>;
  actionMenuRef: Ref<HTMLDivElement>;
  setActionMenuOpenId: Dispatch<SetStateAction<string | null>>;
  onSelect: (record: HistoryItem) => void;
  onToggleMultiSelect: (record: HistoryItem) => void;
  onToggleExpanded: (record: HistoryItem, isExpanded: boolean) => void;
  onSuppressHover: (recordId: string | null) => void;
  onPointerLeaveRecord: (recordId: string) => void;
  onApplyDraft: (record: HistoryItem, destination?: 'planner' | 'studio') => void;
  onReschedule: (record: HistoryItem) => void;
  onConfirm: (type: ConfirmActionType, record: HistoryItem) => void;
  onDeleteDraft: (record: HistoryItem) => void;
  onImagePointerEnter: (target: HTMLElement, path: string) => void;
  onImagePointerLeave: () => void;
  onExpandedImageLoad: () => void;
  getDisplayedAttachmentUrl: (path: string) => string | undefined;
  t: HistoryTranslate;
  locale: 'ru' | 'en';
}) {
  const timestamp = getHistoryTimestamp(record);
  const previousTimestamp = previousRecord ? getHistoryTimestamp(previousRecord) : '';
  const channelDetail = [record.channelLabel, record.channelName]
    .find((value) => value.trim() && value.trim() !== record.title.trim());
  const startsNewDay = index === 0 || getHistoryDayKey(previousTimestamp) !== getHistoryDayKey(timestamp);
  const startsNewMonth = index === 0 || getHistoryMonthKey(previousTimestamp) !== getHistoryMonthKey(timestamp);
  const scheduleMessage = record.original.kind === 'scheduled' ? record.original.message : null;
  const canReschedule = record.status === 'scheduled' && Boolean(scheduleMessage);
  const primaryAction = record.status === 'failed'
    ? { label: t('history.openInEditor'), handler: () => onApplyDraft(record, 'studio'), type: 'use-text' }
    : record.status === 'scheduled'
      ? canReschedule
        ? { label: t('history.edit'), handler: () => onReschedule(record), type: 'reschedule' }
        : { label: t('history.sendNow'), handler: () => onConfirm('send-now', record), type: 'send-now' }
      : record.status === 'draft'
        ? { label: t('history.useDraft'), handler: () => onApplyDraft(record), type: 'use-draft' }
        : null;
  const secondaryActions = [
    ...(record.status === 'draft'
      ? [{ label: t('history.delete'), handler: () => onDeleteDraft(record), type: 'delete' }]
      : []),
    ...(record.status === 'scheduled' && scheduleMessage
      ? [
        ...(canReschedule || record.source === 'personal'
          ? [{ label: t('history.sendNow'), handler: () => onConfirm('send-now', record), type: 'send-now' }]
          : []),
        { label: t('history.cancel'), handler: () => onConfirm('cancel', record), type: 'cancel' },
      ]
      : []),
    ...((record.status === 'sent' || record.status === 'failed') && scheduleMessage
      ? [{ label: t('history.delete'), handler: () => onConfirm('delete', record), type: 'delete' }]
      : []),
  ];
  const reminderType = getPlannerReminderType(record);
  const reminderTypePresentation = reminderType ? getPlannerReminderTypePresentation(reminderType, t) : null;

  return (
    <Fragment key={record.id}>
      {pageMode && showsMonthStrip && startsNewMonth && (
        <h3 className="history-month-heading">{formatHistoryMonthLabel(timestamp, locale)}</h3>
      )}
      {startsNewDay && !pageMode && (
        <h3 className="history-date-heading" aria-label={formatHistoryDayLabel(timestamp, locale, t)}>
          <span className="history-date-heading-label">{formatHistoryDayLabel(timestamp, locale, t)}</span>
        </h3>
      )}
      <article
        ref={isExpanded ? expandedRecordRef : undefined}
        className={`history-record${isExpanded ? ' is-expanded' : ''}${isSelected ? ' is-selected' : ''}${isMultiSelected ? ' is-multi-selected' : ''}${isHoverSuppressed ? ' is-hover-suppressed' : ''}${record.status === 'draft' ? ' is-draft' : ''}`}
        data-draft-color={record.status === 'draft' ? record.draftColor : undefined}
        data-history-day-label={pageMode ? formatHistoryDayLabel(timestamp, locale, t) : undefined}
        data-history-month-label={pageMode ? formatHistoryMonthLabel(timestamp, locale) : undefined}
        onPointerLeave={(event) => {
          if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
          onPointerLeaveRecord(record.id);
        }}
      >
        <button
          type="button"
          className="history-record-open"
          data-history-record-id={pageMode ? record.id : undefined}
          onClick={(event) => {
            if (pageMode) {
              if (event.ctrlKey || event.metaKey) {
                onToggleMultiSelect(record);
                return;
              }
              if (isSelected) {
                if (event.detail > 0) onSuppressHover(record.id);
                onSelect(record);
              } else {
                onSuppressHover(null);
                onSelect(record);
              }
            } else {
              onToggleExpanded(record, isExpanded);
            }
          }}
          aria-label={t('history.expandRecord', { action: t(isExpanded ? 'history.collapse' : 'history.open'), title: record.title })}
          aria-expanded={!pageMode ? isExpanded : undefined}
          aria-pressed={pageMode ? isSelected || isMultiSelected : undefined}
        >
          <span className="history-record-meta">
            <span className="history-record-source-group">
              <span className={`history-record-source is-${record.source === 'workspace' ? 'studio' : 'personal'}${isMultiSelected ? ' is-multi-selected' : ''}`}>
                {record.source === 'workspace' ? t('history.sourceStudio') : t('history.sourcePersonal')}
              </span>
              {record.status === 'draft' && record.draftColor && (
                <span
                  className="history-record-draft-dot"
                  data-color={record.draftColor}
                  aria-label={t('history.draftColor', { color: record.draftColor })}
                  title={t('history.color', { color: record.draftColor })}
                />
              )}
            </span>
            {!isExpanded && (
              <span className="history-record-date">
                {getHistoryStatusLabel(record.status, t)} · {formatDateLabel(timestamp, locale, t)}
              </span>
            )}
            {record.attachments.length > 0 ? (
              <span className="history-record-attachments" aria-label={formatAttachmentCount(record.attachments.length, locale)} title={formatAttachmentCount(record.attachments.length, locale)}>
                <span className="history-record-attachment-preview" aria-hidden="true">
                  {record.attachments.slice(0, 2).map((attachment) => (
                    isImageAttachment(attachment) ? (
                      <span className="history-record-attachment-image" key={attachment}>
                        <img
                          src={getDisplayedAttachmentUrl(attachment)}
                          alt=""
                          onPointerEnter={(event) => onImagePointerEnter(event.currentTarget, attachment)}
                          onPointerLeave={onImagePointerLeave}
                          onError={(event) => event.currentTarget.parentElement?.classList.add('is-unavailable')}
                        />
                        <span className="history-record-attachment-image-fallback"><Paperclip size={12} strokeWidth={1.8} /></span>
                      </span>
                    ) : (
                      <span className="history-record-attachment-file" key={attachment}>
                        <Paperclip size={12} strokeWidth={1.8} />
                      </span>
                    )
                  ))}
                </span>
                <span className="history-record-attachment-count">{formatDisplayCount(record.attachments.length, locale)}</span>
              </span>
            ) : (
              <span className="history-record-attachments is-empty" aria-hidden="true" />
            )}
          </span>

          <span className="history-record-heading">
            <span className="history-record-heading-title">
              <strong>{record.title}</strong>
              {reminderType && reminderTypePresentation && (
                <span
                  className="history-record-reminder-type"
                  data-reminder-type={reminderType}
                  aria-label={reminderTypePresentation.label}
                  title={reminderTypePresentation.label}
                >
                  <reminderTypePresentation.Icon size={14} strokeWidth={1.9} aria-hidden="true" />
                </span>
              )}
            </span>
            {!isExpanded && <time dateTime={timestamp}>{formatTime(timestamp, locale)}</time>}
          </span>
          {channelDetail && <span className="history-record-chat">{channelDetail}</span>}
          {!isExpanded && <span className="history-record-text">{record.text}</span>}
          {!isExpanded && getVisibleHistoryError(record.lastError, t) && (
            <span className="history-record-error-preview">{getVisibleHistoryError(record.lastError, t)}</span>
          )}
        </button>
        {isExpanded && (
          <div
            className="history-post-expanded"
            aria-label={t('history.fullContent', { title: record.title })}
            onClick={(event) => {
              if (event.target !== event.currentTarget) return;
              const bubble = event.currentTarget.querySelector('.history-post-bubble');
              const bubbleLeft = bubble?.getBoundingClientRect().left
                ?? event.currentTarget.getBoundingClientRect().left + 56;
              if (event.clientX < bubbleLeft) onSelect(record);
            }}
          >
            <div className="history-post-time-row">
              <time dateTime={timestamp}>{formatTime(timestamp, locale)}</time>
              <span>{getHistoryStatusLabel(record.status, t)}</span>
            </div>
            {getVisibleHistoryError(record.lastError, t) && (
              <p className="history-record-error" role="alert">{getVisibleHistoryError(record.lastError, t)}</p>
            )}
            <div className="history-post-bubble">
              {Boolean(record.attachments.length) && (
                <div className="history-post-attachments" aria-label={t('history.attachmentsLabel')}>
                  {record.attachments.map((attachment) => (
                    isImageAttachment(attachment) ? (
                      <img
                        key={attachment}
                        src={getDisplayedAttachmentUrl(attachment)}
                        alt={getAttachmentName(attachment, t)}
                        onLoad={onExpandedImageLoad}
                      />
                    ) : (
                      <a key={attachment} href={toAttachmentUrl(attachment)} download={getAttachmentName(attachment, t)}>
                        <FileText size={17} strokeWidth={1.7} aria-hidden="true" />
                        <span>{getAttachmentName(attachment, t)}</span>
                      </a>
                    )
                  ))}
                </div>
              )}
              <div className="history-post-text" dangerouslySetInnerHTML={{ __html: richTextToHtml(record.text, record.entities) }} />
            </div>
            {(record.silent || record.effect) && (
              <div className="history-post-options">
                {record.silent && <span>{t('history.silent')}</span>}
                {record.effect && <span>{t('history.effect', { effect: record.effect })}</span>}
              </div>
            )}
          </div>
        )}
        {!pageMode && (
          <div className="history-record-actions">
            <div className="history-record-leading-actions">
              {primaryAction && (
                <div className="history-record-primary-wrap">
                  <button
                    type="button"
                    className="history-record-action is-primary"
                    onClick={primaryAction.handler}
                    aria-label={primaryAction.type === 'reschedule'
                      ? t('history.showRecord', { action: t('history.edit'), title: record.title })
                      : primaryAction.type === 'open-draft'
                        ? t('history.editDraftTitle', { title: record.title })
                        : primaryAction.type === 'use-draft'
                          ? t('history.useDraftTitle', { title: record.title })
                          : primaryAction.label}
                  >
                    <span>{primaryAction.label}</span>
                  </button>
                </div>
              )}
              {secondaryActions.length > 0 && (
                <div className="history-record-more">
                  <button
                    type="button"
                    className="history-record-action is-more"
                    onClick={() => setActionMenuOpenId((current) => current === record.id ? null : record.id)}
                    aria-label={t('history.more')}
                    title={t('history.more')}
                    aria-expanded={actionMenuOpen}
                  >
                    <Ellipsis size={19} strokeWidth={2} aria-hidden="true" />
                  </button>
                  {actionMenuOpen && (
                    <div ref={actionMenuRef} className="history-record-action-menu" role="menu" aria-label={t('history.moreActions', { title: record.title })}>
                      {secondaryActions.map((action) => (
                        <button
                          key={action.type}
                          type="button"
                          role="menuitem"
                          className={`history-record-action-menu-item${action.type === 'cancel' || action.type === 'delete' ? ' is-danger' : ''}`}
                          onClick={() => {
                            action.handler();
                            setActionMenuOpenId(null);
                          }}
                          aria-label={action.type === 'reschedule' ? t('history.showRecord', { action: t('history.edit'), title: record.title }) : action.label}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              className="history-record-action is-expand"
              onClick={() => onToggleExpanded(record, isExpanded)}
              aria-label={t('history.showRecord', { action: t(isExpanded ? 'history.collapse' : 'history.showFull'), title: record.title })}
              aria-expanded={isExpanded}
            >
              {isExpanded
                ? <Minimize2 size={14} strokeWidth={1.8} aria-hidden="true" />
                : <Maximize2 size={14} strokeWidth={1.8} aria-hidden="true" />}
              <span>{t(isExpanded ? 'history.collapse' : 'history.fullSize')}</span>
            </button>
            {record.status === 'sending' && scheduleMessage && (
              <button type="button" className="history-record-action is-send-now" disabled>
                <span>{t('history.sending')}</span>
              </button>
            )}
          </div>
        )}
      </article>
    </Fragment>
  );
}
