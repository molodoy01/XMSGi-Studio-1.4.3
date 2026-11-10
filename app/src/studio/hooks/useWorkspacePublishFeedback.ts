import { useCallback, useEffect, useRef, useState } from 'react';
import { FOOTER_STATUS_DURATION_MS } from '../pages/WorkspacePageHelpers';

type PublishFeedbackKind = 'warning' | 'success';

export function useWorkspacePublishFeedback() {
  const timerRef = useRef<number | null>(null);
  const lastFeedbackRef = useRef<{ message: string; kind: PublishFeedbackKind } | null>(null);
  const [message, setMessage] = useState('');
  const [detail, setDetail] = useState('');
  const [kind, setKind] = useState<PublishFeedbackKind>('warning');
  const [overridesProgress, setOverridesProgress] = useState(false);
  const [instance, setInstance] = useState(0);
  const [retriggered, setRetriggered] = useState<{ message: string; kind: string } | null>(null);

  const showFeedback = useCallback((
    nextMessage: string,
    nextKind: PublishFeedbackKind = 'warning',
    nextDetail = '',
    durationMs?: number,
  ) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    const identity = { message: nextMessage, kind: nextKind };
    const previousIdentity = lastFeedbackRef.current;
    setRetriggered(
      previousIdentity?.message === identity.message && previousIdentity.kind === identity.kind
        ? identity
        : null,
    );
    lastFeedbackRef.current = identity;
    setInstance((current) => current + 1);
    setMessage(nextMessage);
    setDetail(nextDetail);
    setKind(nextKind);
    setOverridesProgress(true);
    timerRef.current = window.setTimeout(() => {
      setMessage('');
      setDetail('');
      setOverridesProgress(false);
      timerRef.current = null;
      if (lastFeedbackRef.current?.message === identity.message && lastFeedbackRef.current.kind === identity.kind) {
        lastFeedbackRef.current = null;
        setRetriggered(null);
      }
    }, durationMs ?? (nextKind === 'warning'
      ? FOOTER_STATUS_DURATION_MS.publishWarning
      : FOOTER_STATUS_DURATION_MS.publishSuccess));
  }, []);

  const clearFeedbackMessage = useCallback(() => {
    setMessage('');
  }, []);

  useEffect(() => () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
  }, []);

  return {
    publishFeedback: message,
    publishFeedbackDetail: detail,
    publishFeedbackKind: kind,
    publishFeedbackOverridesProgress: overridesProgress,
    publishFeedbackInstance: instance,
    retriggeredPublishFeedback: retriggered,
    showPublishFeedback: showFeedback,
    clearPublishFeedbackMessage: clearFeedbackMessage,
  };
}
