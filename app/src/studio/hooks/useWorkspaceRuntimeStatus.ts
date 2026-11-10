import { useEffect, useState } from 'react';

export type TelegramConnectionState = 'connected' | 'connecting' | 'reconnecting' | 'disconnected';

type WorkspaceRuntimeStatusOptions = {
  connected: boolean;
};

export function useWorkspaceRuntimeStatus({ connected }: WorkspaceRuntimeStatusOptions) {
  const [telegramConnectionState, setTelegramConnectionState] = useState<TelegramConnectionState>(
    connected ? 'connected' : 'disconnected',
  );
  const [previewClockNow, setPreviewClockNow] = useState(() => Date.now());

  useEffect(() => {
    setTelegramConnectionState(connected ? 'connected' : 'disconnected');
  }, [connected]);

  useEffect(() => {
    const unsubscribe = window.telegram?.onStatus((status) => {
      const nextStatus = typeof status === 'string'
        ? status
        : status && typeof status === 'object' && 'status' in status
          ? status.status
          : undefined;
      if (
        nextStatus === 'connected'
        || nextStatus === 'connecting'
        || nextStatus === 'reconnecting'
        || nextStatus === 'disconnected'
      ) {
        setTelegramConnectionState(nextStatus);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let timeoutId = 0;
    const refreshPreviewClock = () => {
      const now = Date.now();
      setPreviewClockNow(now);
      timeoutId = window.setTimeout(refreshPreviewClock, 60_000 - (now % 60_000) + 25);
    };

    timeoutId = window.setTimeout(refreshPreviewClock, 60_000 - (Date.now() % 60_000) + 25);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return { telegramConnectionState, previewClockNow };
}
