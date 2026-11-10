import { useCallback, useLayoutEffect } from 'react';

type FlushWorkspaceDraft = () => Promise<{ success: boolean; error: string }>;

type WorkspaceSaveBeforeLeaveOptions = {
  flushWorkspaceDraftNow: FlushWorkspaceDraft;
  showFeedback: (message: string, kind?: 'warning' | 'success') => void;
  fallbackError: string;
  onRegisterBeforeLeaveStudio?: (flush: (() => Promise<boolean>) | null) => void;
};

export function useWorkspaceSaveBeforeLeave({
  flushWorkspaceDraftNow,
  showFeedback,
  fallbackError,
  onRegisterBeforeLeaveStudio,
}: WorkspaceSaveBeforeLeaveOptions) {
  const flushBeforeLeaveStudio = useCallback(async () => {
    try {
      const result = await flushWorkspaceDraftNow();
      if (!result.success) showFeedback(result.error, 'warning');
      return result.success;
    } catch {
      showFeedback(fallbackError, 'warning');
      return false;
    }
  }, [fallbackError, flushWorkspaceDraftNow, showFeedback]);

  useLayoutEffect(() => {
    if (!onRegisterBeforeLeaveStudio) return;
    onRegisterBeforeLeaveStudio(flushBeforeLeaveStudio);
    return () => onRegisterBeforeLeaveStudio(null);
  }, [flushBeforeLeaveStudio, onRegisterBeforeLeaveStudio]);
}
