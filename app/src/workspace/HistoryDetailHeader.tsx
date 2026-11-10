import type { HistoryItem } from './historyModel';
import { ArrowLeft, Clock, Eye } from 'lucide-react';
import {
  getHistoryCategoryLabel,
  getHistoryRecordCategory,
  getHistoryStatusLabel,
  getHistoryTimestamp,
  type HistoryTranslate,
} from './historyPresentation';

type DetailTextSize = 'small' | 'default' | 'large';

export function HistoryDetailHeader({
  record,
  previewMode,
  textSize,
  onChangeTextSize,
  onBack,
  backButtonRef,
  recordListRef,
  locale,
  t,
}: {
  record: HistoryItem;
  previewMode: 'details' | 'preview';
  textSize: DetailTextSize;
  onChangeTextSize: (direction: -1 | 1) => void;
  onBack: () => void;
  backButtonRef: { current: HTMLButtonElement | null };
  recordListRef: { current: HTMLDivElement | null };
  locale: 'ru' | 'en';
  t: HistoryTranslate;
}) {
  const channelDetail = [record.channelLabel, record.channelName]
    .find((value) => value.trim() && value.trim() !== record.title.trim());
  const timestamp = getHistoryTimestamp(record);

  return (
    <div className={`history-detail-header${previewMode === 'preview' ? ' is-preview-open' : ''}`}>
      <button
        type="button"
        className="history-detail-back"
        ref={backButtonRef}
        onClick={() => {
          const recordId = record.id;
          onBack();
          if (typeof window.matchMedia === 'function'
            && window.matchMedia('(max-width: 900px)').matches) {
            window.requestAnimationFrame(() => {
              const recordButtons = recordListRef.current
                ?.querySelectorAll<HTMLButtonElement>('.history-record-open');
              const selectedButton = Array.from(recordButtons ?? [])
                .find((button) => button.dataset.historyRecordId === recordId);
              selectedButton?.focus();
            });
          }
        }}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        <span>{t('history.backToList')}</span>
      </button>
      <div className="history-detail-topline">
        <div className="history-detail-title-row">
          <h2>{record.title}</h2>
          {previewMode === 'preview' && (
            <span className="history-detail-preview-badge">
              <Eye size={14} aria-hidden="true" />
              <span>{t('history.preview')}</span>
            </span>
          )}
        </div>
        <div className="history-detail-heading">
          <span className="history-detail-category">
            {t('history.detailCategory', {
              category: getHistoryCategoryLabel(getHistoryRecordCategory(record), t),
            })}
          </span>
          <span className={`history-record-source is-${record.source === 'workspace' ? 'studio' : 'personal'}`}>
            {record.source === 'workspace' ? t('history.sourceStudio') : t('history.sourcePersonal')}
          </span>
          <span className={`history-detail-status is-${record.status}`}>
            {getHistoryStatusLabel(record.status, t)}
          </span>
        </div>
        <div className="history-detail-meta">
          <div className="history-detail-meta-line">
            {channelDetail && <span>{channelDetail}</span>}
            <time className="history-detail-time" dateTime={timestamp}>
              <Clock size={13} aria-hidden="true" />
              {new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })
                .format(new Date(timestamp))}
            </time>
          </div>
        </div>
        <div className="history-detail-reading-controls" role="group" aria-label={t('history.detailTextSize')}>
          <button
            type="button"
            className="history-detail-font-button"
            onClick={() => onChangeTextSize(-1)}
            disabled={textSize === 'small'}
            aria-label={t('history.decreaseTextSize')}
            title={t('history.decreaseTextSize')}
          >
            A−
          </button>
          <button
            type="button"
            className="history-detail-font-button"
            onClick={() => onChangeTextSize(1)}
            disabled={textSize === 'large'}
            aria-label={t('history.increaseTextSize')}
            title={t('history.increaseTextSize')}
          >
            A+
          </button>
        </div>
      </div>
    </div>
  );
}
