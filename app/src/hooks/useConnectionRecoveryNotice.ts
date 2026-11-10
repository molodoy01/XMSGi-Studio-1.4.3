import { useEffect, useRef, useState } from 'react';

const CONNECTION_RECOVERY_NOTICE_DURATION_MS = 15_000;

export type ConnectionRecoveryNoticeStatus = 'reconnecting' | 'offline' | 'restored' | null;

export function useConnectionRecoveryNotice(
  active: boolean,
  connected: boolean,
  offline = false,
): ConnectionRecoveryNoticeStatus {
  const [status, setStatus] = useState<ConnectionRecoveryNoticeStatus>(null);
  const wasActive = useRef(false);

  useEffect(() => {
    if (active) {
      wasActive.current = true;
      setStatus(offline ? 'offline' : 'reconnecting');
    } else if (wasActive.current && connected) {
      wasActive.current = false;
      setStatus('restored');
    } else {
      wasActive.current = false;
      setStatus(null);
    }
  }, [active, connected, offline]);

  useEffect(() => {
    if (status === null) return undefined;
    if (status === 'restored') return undefined;

    const timeout = window.setTimeout(() => setStatus(null), CONNECTION_RECOVERY_NOTICE_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [status]);

  useEffect(() => {
    if (status !== 'restored') return undefined;

    const dismiss = () => setStatus(null);
    window.addEventListener('pointerdown', dismiss, true);
    window.addEventListener('keydown', dismiss, true);
    return () => {
      window.removeEventListener('pointerdown', dismiss, true);
      window.removeEventListener('keydown', dismiss, true);
    };
  }, [status]);

  return status;
}
