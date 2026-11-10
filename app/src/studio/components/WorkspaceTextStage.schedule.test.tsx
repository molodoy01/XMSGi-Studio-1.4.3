import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderStage } from './WorkspaceTextStage.testUtils';

describe("WorkspaceTextStage scheduling", () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  it('renders the time selection panel with the schedule header, navigation and timezone', () => {
      const { unmount } = renderStage({ mode: 'schedule', time: '09:30' });
  
      const title = document.querySelector('.workspace-page-schedule-header strong') as HTMLElement;
      const timezone = document.querySelector('.workspace-page-schedule-timezone') as HTMLElement;
      const hoursInput = document.querySelector<HTMLInputElement>('[aria-label="Hours"]');
      const minutesInput = document.querySelector<HTMLInputElement>('[aria-label="Minutes"]');
      const headerTime = document.querySelector('.workspace-page-schedule-header-time') as HTMLElement;
      const quickTime = document.querySelector('.workspace-page-schedule-quick-panel') as HTMLElement;
      const backButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Back')) as HTMLButtonElement;
      const doneButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Done')) as HTMLButtonElement;
  
      expect(title).toBeTruthy();
      expect(title.textContent).toBe('Schedule');
      expect(timezone).toBeTruthy();
      expect(hoursInput?.value).toBe('09');
      expect(minutesInput?.value).toBe('30');
      expect(headerTime).toBeTruthy();
      expect(headerTime.textContent).toContain('09:30');
      expect(document.querySelector('.workspace-page-schedule-summary')).toBeNull();
      expect(quickTime).toBeTruthy();
      expect(document.querySelector('.workspace-page-schedule-more')).toBeNull();
      expect(backButton).toBeTruthy();
      expect(doneButton).toBeTruthy();
      unmount();
    })
  it('renders the minimal schedule shell with title and footer actions', () => {
      const { unmount } = renderStage({ mode: 'schedule' });
  
      const title = document.querySelector('.workspace-page-schedule-header strong') as HTMLElement;
      const backButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Back')) as HTMLButtonElement;
      const doneButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Done')) as HTMLButtonElement;
  
      expect(title).toBeTruthy();
      expect(title.textContent).toBe('Schedule');
      expect(backButton).toBeTruthy();
      expect(doneButton).toBeTruthy();
      expect(document.querySelector('.workspace-page-schedule-flow')).toBeNull();
      expect(document.querySelector('.workspace-page-time-trigger')).toBeNull();
      expect(document.querySelector('.workspace-page-repeat-entry')).toBeNull();
      unmount();
    })
  it('renders a compact Studio date selector with day, month, year and an inline time panel', () => {
      const { unmount } = renderStage({ mode: 'schedule', date: '2026-01-10', time: '09:00' });
  
      expect(document.querySelector('.workspace-page-schedule-date-value')).toBeTruthy();
      expect(document.querySelector<HTMLInputElement>('[aria-label="Hours"]')?.value).toBe('09');
      expect(document.querySelector<HTMLInputElement>('[aria-label="Minutes"]')?.value).toBe('00');
      expect(document.querySelector('.workspace-page-schedule-header-time')).toBeTruthy();
      expect(document.querySelector('.workspace-page-schedule-summary')).toBeNull();
      expect(document.querySelector('.workspace-page-schedule-quick-panel')).toBeTruthy();
      expect(document.querySelector('.workspace-page-schedule-more')).toBeNull();
      expect(document.querySelector('.workspace-page-schedule-empty-panel')).toBeTruthy();
      expect(document.querySelectorAll('.workspace-page-schedule-segment')).toHaveLength(5);
      expect(document.querySelector('[aria-label="Day"]')).toBeTruthy();
      expect(document.querySelector('[aria-label="Month"]')).toBeTruthy();
      expect(document.querySelector('[aria-label="Year"]')).toBeTruthy();
      expect(document.querySelector('.workspace-page-schedule-timezone')).toBeTruthy();
      unmount();
    })
  it('allows entering both digits of the month before committing the date', () => {
      const setDate = vi.fn();
      const { unmount } = renderStage({ mode: 'schedule', date: '2027-01-05', setDate });
      const monthInput = document.querySelector('[aria-label="Month"]') as HTMLInputElement;
      const setNativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  
      act(() => {
        setNativeValue?.call(monthInput, '1');
        monthInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
  
      expect(setDate).not.toHaveBeenCalled();
      expect(monthInput.value).toBe('1');
  
      act(() => {
        setNativeValue?.call(monthInput, '10');
        monthInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
  
      expect(setDate).toHaveBeenCalledWith('2027-10-05');
      unmount();
    })
  it('opens the Studio calendar from the calendar icon in the schedule row', () => {
      const { unmount } = renderStage({ mode: 'schedule', date: '2026-01-10', time: '09:00' });
  
      const calendarButton = document.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement;
  
      expect(calendarButton).toBeTruthy();
      expect(document.querySelector('.quick-planner-date-picker')).toBeNull();
  
      act(() => {
        calendarButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
  
      expect(document.querySelector('.quick-planner-date-picker')).toHaveClass('quick-planner-schedule-popover');
      unmount();
    })
  it('shows today in the Studio calendar even when today is the selected date', () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const { unmount } = renderStage({ mode: 'schedule', date: today, time: '23:59' });
      const calendarButton = document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!;
  
      act(() => calendarButton.click());
  
      const todayButton = document.querySelector<HTMLButtonElement>('.quick-planner-date-picker-grid button.is-today');
      const calendar = document.querySelector<HTMLElement>('.quick-planner-date-picker');
      expect(todayButton).toBeInTheDocument();
      expect(todayButton).toHaveTextContent(String(now.getDate()));
      expect(todayButton).toHaveClass('is-selected');
      expect(todayButton).not.toBeDisabled();
      expect(calendar?.style.getPropertyValue('--planner-accent')).toBe('#477c9e');
      expect(calendar?.style.getPropertyValue('--planner-accent-rgb')).toBe('71, 124, 158');
      unmount();
    })
  it('does not write a zero year while the year segment is being edited', () => {
      const setDate = vi.fn();
      const { unmount } = renderStage({ mode: 'schedule', setDate, date: '2026-01-10' });
      const yearInput = document.querySelector('[aria-label="Year"]') as HTMLInputElement;
  
      act(() => {
        const setNativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setNativeValue?.call(yearInput, '2');
        yearInput.dispatchEvent(new Event('input', { bubbles: true }));
      });
  
      expect(setDate).not.toHaveBeenCalledWith(expect.stringContaining('0000'));
      unmount();
    })
  it('moves through date and time inputs when Space or Enter is pressed', () => {
      const { unmount } = renderStage({ mode: 'schedule', date: '2026-01-10', time: '09:00' });
      const dayInput = document.querySelector('[aria-label="Day"]') as HTMLInputElement;
      const monthInput = document.querySelector('[aria-label="Month"]') as HTMLInputElement;
      const yearInput = document.querySelector('[aria-label="Year"]') as HTMLInputElement;
      const hoursInput = document.querySelector('[aria-label="Hours"]') as HTMLInputElement;
      const minutesInput = document.querySelector('[aria-label="Minutes"]') as HTMLInputElement;
  
      const fields = [dayInput, monthInput, yearInput, hoursInput, minutesInput];
      for (const key of [' ', 'Enter']) {
        for (let index = 0; index < fields.length - 1; index += 1) {
          const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
          act(() => {
            fields[index].focus();
            fields[index].dispatchEvent(event);
          });
          expect(document.activeElement).toBe(fields[index + 1]);
          expect(event.defaultPrevented).toBe(true);
        }
      }
  
      expect(dayInput.value).toBe('10');
      expect(monthInput.value).toBe('01');
      expect(yearInput.value).toBe('2026');
      unmount();
    })
  it('shows the local timezone offset once', () => {
      const { unmount } = renderStage({ mode: 'schedule' });
      const timezone = document.querySelector('.workspace-page-schedule-timezone')?.textContent ?? '';
  
      expect(timezone).toMatch(/UTC[+-]\d{2}:\d{2}$/);
      expect(timezone).not.toMatch(/GMT[+-]\d.*GMT[+-]\d/);
      unmount();
    })
  it('keeps the standard Back and Done footer for schedule', () => {
      const { unmount } = renderStage({ mode: 'schedule', date: '2026-01-10', time: '09:00' });
  
      expect(document.querySelector('.workspace-page-schedule-header .workspace-page-schedule-nav')).toBeNull();
      expect(document.querySelector('.workspace-page-schedule-footer .workspace-page-stage-secondary')).toBeTruthy();
      expect(document.querySelector('.workspace-page-schedule-footer .workspace-page-stage-primary')).toBeTruthy();
      expect(document.querySelector('.workspace-page-schedule-footer')).toBeTruthy();
      unmount();
    })
  it('keeps template navigation visible below the template list', () => {
      const { unmount } = renderStage({ mode: 'template' });
  
      expect(document.querySelector('.workspace-page-template-stage-footer .workspace-page-stage-secondary')).toBeTruthy();
      expect(document.querySelector('.workspace-page-template-stage-footer .workspace-page-stage-primary')).toBeTruthy();
      unmount();
    })
  it('removes the legacy date and time trigger controls completely from the schedule shell', () => {
      const { unmount } = renderStage({ mode: 'schedule', date: '2026-01-10', time: '09:00' });
  
      const dateButton = document.querySelector('[data-date-trigger="true"]') as HTMLButtonElement | null;
      const timeButton = document.querySelector('[data-time-trigger="true"]') as HTMLButtonElement | null;
      const dayInput = document.querySelector('[aria-label="Day"]') as HTMLInputElement | null;
      const hourInput = document.querySelector('[aria-label="Hours"]') as HTMLInputElement | null;
      const minuteInput = document.querySelector('[aria-label="Minutes"]') as HTMLInputElement | null;
  
      expect(dateButton).toBeNull();
      expect(timeButton).toBeNull();
      expect(dayInput).toBeTruthy();
      expect(hourInput?.value).toBe('09');
      expect(minuteInput?.value).toBe('00');
      expect(document.querySelector('.workspace-page-schedule-empty-panel')).toBeTruthy();
  
      unmount();
    })
  it('renders the repeat menu as a separate non-collapsible schedule mode', () => {
      const setRepeatMode = vi.fn();
      const setRepeatOccurrences = vi.fn();
      const { unmount } = renderStage({
        mode: 'schedule',
        scheduleFocus: 'repeat',
        repeatMode: 'weekly',
        repeatDays: ['Thu'],
        repeatOccurrences: 5,
        setRepeatMode,
        setRepeatOccurrences,
      });
  
      expect(document.querySelector('.workspace-page-schedule-repeat-panel')).toBeTruthy();
      expect(document.querySelector('.workspace-page-schedule-main .workspace-page-schedule-repeat-panel')).toBeTruthy();
      expect(document.querySelector('.workspace-page-schedule-footer .workspace-page-stage-primary')).toBeTruthy();
      expect(document.querySelector('.workspace-page-schedule-header-time')?.textContent).toContain('Weekly');
      expect(document.querySelector('.workspace-page-schedule-header-time')?.textContent).toContain('5 times');
      expect(document.querySelector('.workspace-page-schedule-more')).toBeNull();
      expect(document.querySelectorAll('.workspace-page-schedule-repeat-menu button')).toHaveLength(5);
      expect(document.querySelectorAll('.workspace-page-weekday-list button')).toHaveLength(7);
      expect(document.querySelector('[aria-label="Repeat occurrences"]')).toBeTruthy();
  
      const dailyButton = Array.from(document.querySelectorAll('.workspace-page-schedule-repeat-menu button'))
        .find((button) => button.textContent === 'Daily') as HTMLButtonElement;
      act(() => {
        dailyButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      expect(setRepeatMode).toHaveBeenCalledWith('daily');
  
      const occurrences = document.querySelector('[aria-label="Repeat occurrences"]') as HTMLSelectElement;
      act(() => {
        occurrences.value = '10';
        occurrences.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(setRepeatOccurrences).toHaveBeenCalledWith(10);
      unmount();
    })
  it('places quick time controls after the time block and accumulates increments from the selected time', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 3, 23, 59, 30));
      const setDate = vi.fn();
      const setTime = vi.fn();
      const { rerender, unmount } = renderStage({
        mode: 'schedule',
        scheduleFocus: 'time',
        date: '2026-10-03',
        time: '09:00',
        setDate,
        setTime,
      });
  
      try {
        const quickDatePanel = document.querySelector('.workspace-page-schedule-quick-date-panel') as HTMLElement;
        const quickTimePanel = document.querySelector('.workspace-page-schedule-quick-time-panel') as HTMLElement;
        const timeRow = document.querySelector('.workspace-page-schedule-inline-row') as HTMLElement;
        expect(timeRow.nextElementSibling).toBe(quickTimePanel);
        expect(quickTimePanel.nextElementSibling).toBe(quickDatePanel);
        expect(document.querySelector('.workspace-page-schedule-summary')).toBeNull();
  
        act(() => (document.querySelector('[aria-label="Set time: Now"]') as HTMLButtonElement).click());
        expect(setDate).toHaveBeenCalledWith('2026-10-04');
        expect(setTime).toHaveBeenCalledWith('00:00');
  
        rerender({ mode: 'schedule', scheduleFocus: 'time', date: '2026-10-03', time: '23:50', setDate, setTime });
        act(() => (document.querySelector('[aria-label="Set time: In 15 min"]') as HTMLButtonElement).click());
        expect(setDate).toHaveBeenLastCalledWith('2026-10-04');
        expect(setTime).toHaveBeenLastCalledWith('00:05');
  
        rerender({ mode: 'schedule', scheduleFocus: 'time', date: '2026-10-04', time: '00:05', setDate, setTime });
        act(() => (document.querySelector('[aria-label="Set time: In 15 min"]') as HTMLButtonElement).click());
        expect(setDate).toHaveBeenLastCalledWith('2026-10-04');
        expect(setTime).toHaveBeenLastCalledWith('00:20');
      } finally {
        unmount();
        vi.useRealTimers();
      }
    })
  it('restores automatic time updates when the Now preset is selected', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 3, 23, 59, 30));
      const setDate = vi.fn();
      const setTime = vi.fn();
      const setFollowCurrentTime = vi.fn();
      const { unmount } = renderStage({
        mode: 'schedule',
        scheduleFocus: 'time',
        date: '2026-10-03',
        time: '09:00',
        followCurrentTime: false,
        setDate,
        setTime,
        setFollowCurrentTime,
      });
  
      try {
        act(() => (document.querySelector('[aria-label="Set time: Now"]') as HTMLButtonElement).click());
        expect(setFollowCurrentTime).toHaveBeenCalledWith(true);
        expect(setDate).toHaveBeenCalledWith('2026-10-04');
        expect(setTime).toHaveBeenCalledWith('00:00');
      } finally {
        unmount();
        vi.useRealTimers();
      }
    })
  it('stops automatic time updates when the user selects a quick date', () => {
      const setFollowCurrentTime = vi.fn();
      const { unmount } = renderStage({
        mode: 'schedule',
        scheduleFocus: 'time',
        followCurrentTime: true,
        setFollowCurrentTime,
      });
  
      try {
        act(() => (document.querySelector('[aria-label="Set date: Today"]') as HTMLButtonElement).click());
        expect(setFollowCurrentTime).toHaveBeenCalledWith(false);
      } finally {
        unmount();
      }
    })
  it('disables time picker options that are already in the past', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 3, 15, 30, 30));
      const { unmount } = renderStage({
        mode: 'schedule',
        scheduleFocus: 'time',
        date: '2026-10-03',
        time: '16:00',
      });
  
      try {
        act(() => (document.querySelector('[aria-label="Open time picker"]') as HTMLButtonElement).click());
        const options = [...document.querySelectorAll('[role="option"]')] as HTMLButtonElement[];
        const pastOption = options.find((option) => option.textContent === '15:15');
        const futureOption = options.find((option) => option.textContent === '15:45');
        expect(pastOption?.disabled).toBe(true);
        expect(futureOption?.disabled).toBe(false);
      } finally {
        unmount();
        vi.useRealTimers();
      }
    })
  it('sets quick dates relative to the selected date and clamps month-end dates', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 3, 12, 0));
      const setDate = vi.fn();
      const setTime = vi.fn();
      const { rerender, unmount } = renderStage({
        mode: 'schedule',
        scheduleFocus: 'time',
        date: '2026-01-31',
        time: '09:00',
        setDate,
        setTime,
      });
  
      try {
        const dateRow = document.querySelector('.workspace-page-schedule-quick-date-panel .workspace-page-schedule-quick-row') as HTMLElement;
        expect(dateRow.querySelectorAll('button')).toHaveLength(4);
  
        act(() => (document.querySelector('[aria-label="Set date: In 1 month"]') as HTMLButtonElement).click());
        expect(setDate).toHaveBeenLastCalledWith('2026-02-28');
        expect(setTime).not.toHaveBeenCalled();
  
        rerender({ mode: 'schedule', scheduleFocus: 'time', date: '2026-02-28', time: '09:00', setDate, setTime });
        act(() => (document.querySelector('[aria-label="Set date: In 1 week"]') as HTMLButtonElement).click());
        expect(setDate).toHaveBeenLastCalledWith('2026-03-07');
  
        rerender({ mode: 'schedule', scheduleFocus: 'time', date: '2026-03-07', time: '09:00', setDate, setTime });
        act(() => (document.querySelector('[aria-label="Set date: Today"]') as HTMLButtonElement).click());
        expect(setDate).toHaveBeenLastCalledWith('2026-10-03');
      } finally {
        unmount();
        vi.useRealTimers();
      }
    })
  it('renders the time picker outside the schedule field and aligns it to the clock button', () => {
      const setTime = vi.fn();
      const { unmount } = renderStage({ mode: 'schedule', scheduleFocus: 'time', date: '2099-01-10', time: '09:00', setTime });
      const timeField = document.querySelector('.workspace-page-schedule-inline-time') as HTMLElement;
      const clockButton = document.querySelector('[aria-label="Open time picker"]') as HTMLButtonElement;
      vi.spyOn(timeField, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        bottom: 138,
        left: 120,
        right: 340,
        width: 220,
        height: 38,
        x: 120,
        y: 100,
        toJSON: () => ({}),
      });
  
      expect(timeField).toBeTruthy();
      expect(timeField.querySelector('[aria-label="Hours"]')).toBeTruthy();
      expect(document.querySelector('[role="listbox"][aria-label="Available times"]')).toBeNull();
  
      act(() => {
        clockButton.click();
      });
  
      const timePicker = document.querySelector('[role="listbox"][aria-label="Available times"]') as HTMLElement;
      expect(timePicker).toBeTruthy();
      expect(timePicker.parentElement).toBe(document.body);
      expect(timePicker.style.top).toBe('144px');
      expect(timePicker.style.left).toBe('120px');
      expect(timePicker.style.height).toBe('220px');
      expect(clockButton.getAttribute('aria-expanded')).toBe('true');
      expect(timePicker.querySelectorAll('[role="option"]')).toHaveLength(96);
      expect(timePicker.querySelector('[aria-selected="true"]')?.textContent).toBe('09:00');
  
      const option = timePicker.querySelector('[role="option"][aria-selected="false"]') as HTMLButtonElement;
      act(() => option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
      expect(document.querySelector('[role="listbox"][aria-label="Available times"]')).not.toBeNull();
      act(() => option.click());
      expect(setTime).toHaveBeenCalled();
      expect(timeField.querySelector('[role="listbox"]')).toBeNull();
  
      act(() => {
        clockButton.click();
        clockButton.click();
      });
      expect(timeField.querySelector('[role="listbox"]')).toBeNull();
      expect(clockButton.getAttribute('aria-expanded')).toBe('false');
      unmount();
    })
  it('keeps the time picker below its field in a short viewport and closes it on Escape', () => {
      const previousHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
      const previousWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 220 });
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
      const { unmount } = renderStage({ mode: 'schedule', scheduleFocus: 'time' });
      const clockButton = document.querySelector('[aria-label="Open time picker"]') as HTMLButtonElement;
      const timeField = document.querySelector('.workspace-page-schedule-inline-time') as HTMLElement;
      vi.spyOn(timeField, 'getBoundingClientRect').mockReturnValue({
        top: 62,
        bottom: 100,
        left: 280,
        right: 318,
        width: 38,
        height: 38,
        x: 280,
        y: 62,
        toJSON: () => ({}),
      });
  
      try {
        act(() => clockButton.click());
        const timePicker = document.querySelector('[role="listbox"][aria-label="Available times"]') as HTMLElement;
        expect(timePicker.style.top).toBe('106px');
        expect(timePicker.style.left).toBe('132px');
        expect(timePicker.style.height).toBe('106px');
  
        act(() => timePicker.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
        expect(document.querySelector('[role="listbox"][aria-label="Available times"]')).toBeNull();
        expect(clockButton.getAttribute('aria-expanded')).toBe('false');
  
        act(() => clockButton.click());
        act(() => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
        expect(document.querySelector('[role="listbox"][aria-label="Available times"]')).toBeNull();
      } finally {
        unmount();
        if (previousHeight) Object.defineProperty(window, 'innerHeight', previousHeight);
        else Reflect.deleteProperty(window, 'innerHeight');
        if (previousWidth) Object.defineProperty(window, 'innerWidth', previousWidth);
        else Reflect.deleteProperty(window, 'innerWidth');
      }
    })
});
