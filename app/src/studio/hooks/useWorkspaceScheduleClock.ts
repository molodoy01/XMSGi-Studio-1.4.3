import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { refreshScheduleDateTime } from '../lib/scheduling';

type WorkspaceScheduleClockOptions = {
  stageMode: string;
  date: string;
  time: string;
  followCurrentTime: boolean;
  setDate: Dispatch<SetStateAction<string>>;
  setTime: Dispatch<SetStateAction<string>>;
};

export function useWorkspaceScheduleClock({
  stageMode,
  date,
  time,
  followCurrentTime,
  setDate,
  setTime,
}: WorkspaceScheduleClockOptions) {
  const [scheduleClockNow, setScheduleClockNow] = useState(() => Date.now());

  useEffect(() => {
    if (stageMode !== 'schedule') return undefined;

    let timeoutId = 0;
    const refreshScheduleClock = () => {
      const now = new Date();
      setScheduleClockNow(now.getTime());
      const nextSchedule = refreshScheduleDateTime(date, time, followCurrentTime, now);
      if (nextSchedule) {
        setDate((current) => current === nextSchedule.date ? current : nextSchedule.date);
        setTime((current) => current === nextSchedule.time ? current : nextSchedule.time);
      }
      timeoutId = window.setTimeout(refreshScheduleClock, 60_000 - (Date.now() % 60_000) + 25);
    };

    refreshScheduleClock();
    return () => window.clearTimeout(timeoutId);
  }, [date, followCurrentTime, setDate, setTime, stageMode, time]);

  return scheduleClockNow;
}
