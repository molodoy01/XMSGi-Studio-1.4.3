import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { WorkspaceStageMode } from './useWorkspaceStageMode';
import type { ScheduleRepeatOptions } from '../lib/scheduling';

type WorkspaceScheduleSubmissionOptions = {
  lastAction: 'sent' | 'scheduled' | null;
  scheduling: boolean;
  stageMode: WorkspaceStageMode;
  scheduleSubmissionPendingRef: MutableRefObject<boolean>;
  scheduleSubmissionStartedRef: MutableRefObject<boolean>;
  setRepeatMode: Dispatch<SetStateAction<ScheduleRepeatOptions['mode']>>;
  setRepeatDays: Dispatch<SetStateAction<string[]>>;
  setRepeatOccurrences: Dispatch<SetStateAction<number>>;
  setScheduleFocus: Dispatch<SetStateAction<'repeat' | 'time' | null>>;
  setStageMode: Dispatch<SetStateAction<WorkspaceStageMode>>;
};

export function useWorkspaceScheduleSubmission({
  lastAction,
  scheduling,
  stageMode,
  scheduleSubmissionPendingRef,
  scheduleSubmissionStartedRef,
  setRepeatMode,
  setRepeatDays,
  setRepeatOccurrences,
  setScheduleFocus,
  setStageMode,
}: WorkspaceScheduleSubmissionOptions) {
  useEffect(() => {
    if (!scheduleSubmissionPendingRef.current) return;
    if (scheduling) {
      scheduleSubmissionStartedRef.current = true;
      return;
    }
    if (stageMode !== 'schedule' && !scheduleSubmissionStartedRef.current) {
      scheduleSubmissionPendingRef.current = false;
      scheduleSubmissionStartedRef.current = false;
      return;
    }
    if (!scheduleSubmissionStartedRef.current) return;

    const scheduledSuccessfully = lastAction === 'scheduled';
    scheduleSubmissionPendingRef.current = false;
    scheduleSubmissionStartedRef.current = false;
    if (!scheduledSuccessfully) return;

    setRepeatMode('none');
    setRepeatDays([]);
    setRepeatOccurrences(1);
    setScheduleFocus(null);
    setStageMode('editor');
  }, [
    lastAction,
    scheduling,
    scheduleSubmissionPendingRef,
    scheduleSubmissionStartedRef,
    setRepeatDays,
    setRepeatMode,
    setRepeatOccurrences,
    setScheduleFocus,
    setStageMode,
    stageMode,
  ]);
}
