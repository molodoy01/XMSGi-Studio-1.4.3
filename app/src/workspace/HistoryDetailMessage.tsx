import type { Ref } from 'react';
import { FileText } from 'lucide-react';
import { richTextToHtml } from '@/lib/richText';
import { isImageAttachment, toAttachmentUrl } from './historyAttachments';
import { getAttachmentName, type HistoryTranslate } from './historyPresentation';
import type { HistoryItem } from './historyModel';

export function HistoryDetailMessage({
  record,
  previewMode,
  textSize,
  previewRef,
  getDisplayedAttachmentUrl,
  t,
}: {
  record: HistoryItem;
  previewMode: 'details' | 'preview';
  textSize: 'small' | 'default' | 'large';
  previewRef: Ref<HTMLDivElement>;
  getDisplayedAttachmentUrl: (path: string) => string | undefined;
  t: HistoryTranslate;
}) {
  return (
    <div
      className={`history-detail-body is-${previewMode}`}
      data-text-size={textSize}
      ref={previewRef}
      tabIndex={-1}
    >
      <div className={previewMode === 'preview' ? 'history-detail-preview-current' : undefined}>
        <div className={previewMode === 'details'
          ? 'history-detail-plain-post'
          : 'history-detail-message-content'}
        >
          <div className="history-post-bubble">
            {record.attachments.length > 0 && (
              <div className="history-post-attachments" aria-label={t('history.attachmentsLabel')}>
                {record.attachments.map((attachment, attachmentIndex) => {
                  const attachmentName = getAttachmentName(attachment, t);
                  return isImageAttachment(attachment) ? (
                    <img
                      key={`${attachment}-${attachmentIndex}`}
                      src={getDisplayedAttachmentUrl(attachment)}
                      alt={attachmentName}
                    />
                  ) : (
                    <a
                      key={`${attachment}-${attachmentIndex}`}
                      href={toAttachmentUrl(attachment)}
                      download={attachmentName}
                    >
                      <FileText size={17} strokeWidth={1.7} aria-hidden="true" />
                      <span>{attachmentName}</span>
                    </a>
                  );
                })}
              </div>
            )}
            {record.text && (
              <div
                className="history-post-text"
                {...(previewMode === 'details'
                  ? { children: record.text }
                  : {
                    dangerouslySetInnerHTML: {
                      __html: richTextToHtml(record.text, record.entities),
                    },
                  })}
              />
            )}
            {(record.silent || record.effect) && (
              <div className="history-post-options">
                {record.silent && <span>{t('history.silent')}</span>}
                {record.effect && <span>{t('history.effect', { effect: record.effect })}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
