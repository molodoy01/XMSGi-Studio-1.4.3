import type { HistoryItem } from './historyModel';
import type { HistoryTranslate } from './historyPresentation';
import {
  getHistoryErrorCause,
  getHistoryErrorDetailMessage,
  getHistoryErrorNextStep,
  getHistoryErrorOperation,
  getHistoryErrorRetryability,
  getHistoryErrorWait,
  isImmediateScheduleError,
} from './historyErrorPresentation';

export function HistoryDetailErrorExplanation({
  record,
  t,
}: {
  record: HistoryItem;
  t: HistoryTranslate;
}) {
  if (record.status !== 'failed') return null;

  const immediateScheduleError = isImmediateScheduleError(record);
  const errorTitle = t(immediateScheduleError ? 'history.errorImmediateSendTitle' : 'history.errorExplanation');
  const errorCause = getHistoryErrorCause(record, t);
  const errorDetailMessage = getHistoryErrorDetailMessage(record, t);
  const errorNextStep = getHistoryErrorNextStep(record, t);
  const errorOperation = getHistoryErrorOperation(record, t);
  const errorRetryability = getHistoryErrorRetryability(record, t);
  const errorWait = getHistoryErrorWait(record, t);

  return (
    <section className="history-detail-error-explanation" aria-label={errorTitle}>
      <h3>{errorTitle}</h3>
      {immediateScheduleError ? (
        <p className="history-detail-error" role="alert">{t('history.errorImmediateSendDescription')}</p>
      ) : (
        <>
          {errorCause && <p><strong>{t('history.errorWhy')}:</strong> {errorCause}</p>}
          {errorDetailMessage && <p className="history-detail-error" role="alert"><strong>{t('history.errorDetailLabel')}:</strong> {errorDetailMessage}</p>}
          {errorNextStep && <p><strong>{t('history.errorNextStep')}:</strong> {errorNextStep}</p>}
          {errorOperation && <p><strong>{t('history.errorOperation')}:</strong> {errorOperation}</p>}
          {errorRetryability && <p><strong>{t('history.errorRetry')}:</strong> {errorRetryability}</p>}
          {errorWait && <p>{errorWait}</p>}
          {record.lastErrorDetails?.code && (
            <p><strong>{t('history.errorCode')}:</strong> <code>{record.lastErrorDetails.code}</code></p>
          )}
        </>
      )}
    </section>
  );
}
