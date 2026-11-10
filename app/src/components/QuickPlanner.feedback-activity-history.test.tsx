import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPlannerDraftWrite, writePlannerDraft } from '../lib/plannerDraft';
import { QuickPlanner } from './QuickPlanner';
import { quickPlannerStyles, colorThemeStyles, render, createScheduledMessage } from './QuickPlanner.testUtils';

describe("QuickPlanner feedback: activity and history", () => {
  beforeEach(() => {
      flushPlannerDraftWrite();
      for (const key of [
        'xmsgi-planner-draft-text',
        'xmsgi-planner-draft-updated-at',
        'xmsgi-planner-draft-entities',
        'xmsgi-planner-draft-attachments',
        'xmsgi-planner-draft-snapshot-v1',
        'xmsgi-planner-draft-recovery-stack-v1',
        'xmsgi:active-draft:v1',
      ]) localStorage.removeItem(key);
      vi.useFakeTimers();
    });
  afterEach(() => {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
      flushPlannerDraftWrite();
      vi.restoreAllMocks();
      Reflect.deleteProperty(window, 'telegram');
      Reflect.deleteProperty(window, 'draftStorage');
      localStorage.removeItem('xmsgi-quick-planner-recent-emojis');
      localStorage.removeItem('awaitmsg_locale');
      for (const key of [
        'xmsgi-planner-draft-text',
        'xmsgi-planner-draft-updated-at',
        'xmsgi-planner-draft-entities',
        'xmsgi-planner-draft-attachments',
        'xmsgi-planner-draft-snapshot-v1',
        'xmsgi-planner-draft-recovery-stack-v1',
        'xmsgi:active-draft:v1',
      ]) localStorage.removeItem(key);
    });
  it('uses the blue Planner accent for selected dates and times in light theme', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner-date-picker-grid button\.is-selected,[\s\S]*?background:\s*var\(--planner-accent\) !important;[\s\S]*?color:\s*#ffffff !important;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner-time-list button\[aria-selected='true'\],[\s\S]*?background:\s*var\(--planner-accent\);[\s\S]*?color:\s*#ffffff;/,
      );
    });
  it('removes glossy highlights and shadows from the send button in every state', () => {
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme\] \.quick-planner \.quick-planner-schedule-row \.quick-planner-submit,[\s\S]*?background:\s*var\(--planner-accent\);[\s\S]*?box-shadow:\s*none;/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme\] \.quick-planner \.quick-planner-submit:hover:not\(:disabled\),[\s\S]*?box-shadow:\s*none;[\s\S]*?filter:\s*none;[\s\S]*?transform:\s*none;/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner \.quick-planner-submit:hover:not\(:disabled\),[\s\S]*?box-shadow:\s*none;/,
      );
    });
  it('uses the Planner accent for time-option hover and focus highlights', () => {
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-time-list button:hover:not\(:disabled\),\s*\.quick-planner-time-list button:focus-visible:not\(:disabled\)\s*\{\s*color:\s*#ffffff;\s*background:\s*var\(--planner-accent\);/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner-time-list button:hover:not\(:disabled\),\s*html\[data-theme='dark'\] \.quick-planner-time-list button:focus-visible:not\(:disabled\),[\s\S]*?\{\s*background:\s*#239dfb !important;\s*color:\s*#ffffff !important;/,
      );
    });
  it('makes the Planner time list scrollbar more visible in light theme', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner-time-list\s*\{\s*scrollbar-color:\s*#7b8993 #edf1f3;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner-time-list::-webkit-scrollbar-thumb\s*\{\s*background:\s*#7b8993;\s*border:\s*2px solid #edf1f3;/,
      );
    });
  it('matches the date and time controls to the send button height in both themes', () => {
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-schedule-row > \.quick-planner-schedule-field > button,\s*\.quick-planner-time-value > \.quick-planner-schedule-field > button\s*\{[^}]*height:\s*44px;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner \.quick-planner-schedule-field > button\s*\{[^}]*border-color:\s*transparent;[^}]*background:\s*transparent;[^}]*font-size:\s*16px;[^}]*font-weight:\s*700;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner \.quick-planner-schedule-row > \.quick-planner-schedule-field > button,\s*html\[data-theme='dark'\] \.quick-planner \.quick-planner-time-value > \.quick-planner-schedule-field > button\s*\{[^}]*border-color:\s*transparent;[^}]*background:\s*transparent;/,
      );
    });
  it('styles quick time presets like separate Studio actions without a dark container backdrop', () => {
      expect(quickPlannerStyles).toMatch(/\.quick-planner-presets\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/);
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-presets button,\s*\.quick-planner-presets button \+ button\s*\{[^}]*height:\s*44px;[^}]*border:\s*1px solid var\(--planner-line\);[^}]*border-radius:\s*6px;[^}]*background:\s*#ffffff;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-schedule-row \.quick-planner-presets button:hover,\s*\.quick-planner-schedule-row \.quick-planner-presets button:focus-visible\s*\{[^}]*border-color:\s*rgba\(var\(--planner-accent-rgb\),\s*0\.42\);[^}]*background:\s*rgba\(var\(--planner-accent-rgb\),\s*0\.05\);[^}]*outline:\s*none;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner-mode-switch,\s*html\[data-theme='dark'\] \.quick-planner-presets,\s*html\[data-theme='dark'\] \.quick-planner-schedule-row button,[\s\S]*?\{\s*border-color:\s*#35414a;\s*background:\s*#10161a;\s*color:\s*#c5cfd6;/,
      );
      expect(quickPlannerStyles).not.toMatch(
        /html\[data-theme='dark'\] \.quick-planner \.quick-planner-schedule-row \.quick-planner-presets > button/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner \.quick-planner-schedule-row \.quick-planner-presets\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/,
      );
    });
  it('uses filled neutral date and time buttons without a dark schedule strip in dark theme', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner \.quick-planner-schedule-row::before\s*\{[^}]*border-color:\s*transparent;[^}]*background:\s*transparent;[^}]*backdrop-filter:\s*none;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner \.quick-planner-schedule-row button:not\(\.quick-planner-submit\)\s*\{[^}]*border-color:\s*#36414a;[^}]*background:\s*#1a2228;[^}]*color:\s*#d8e4eb;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner \.quick-planner-schedule-row button:not\(\.quick-planner-submit\):hover,[\s\S]*?button:not\(\.quick-planner-submit\):focus-visible\s*\{[^}]*border-color:\s*#59636b;[^}]*background:\s*#252d32;[^}]*color:\s*#f2f5f7;/,
      );
    });
  it('uses a restrained dark Planner message field outline and removes it on focus', () => {
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-composer\s*\{[^}]*padding:\s*24px 17px 18px;/,
      );
      expect(quickPlannerStyles).toMatch(
        /@media \(max-width: 560px\)[\s\S]*?\.quick-planner-composer\s*\{[^}]*padding:\s*20px 17px 16px;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-message\s*\{[^}]*transition:\s*background-color 180ms ease,\s*transform 180ms ease;/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner \.quick-planner-message:not\(:focus\),\s*html\[data-theme='light'\] \.quick-planner \.quick-planner-message:not\(:focus\):hover\s*\{[^}]*border-color:\s*transparent;[^}]*box-shadow:\s*none;/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner \.quick-planner-message:focus\s*\{[^}]*border-color:\s*transparent;[^}]*box-shadow:\s*none;/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner \.quick-planner-message:not\(:focus\):not\(:hover\)\s*\{\s*border-color:\s*transparent;\s*box-shadow:\s*none;/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner \.quick-planner-message:not\(:focus\):hover\s*\{\s*border-color:\s*transparent;\s*box-shadow:\s*none;/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner \.quick-planner-message:focus,\s*html\[data-theme='dark'\] \.quick-planner \.quick-planner-message:focus-visible\s*\{\s*border-color:\s*transparent;\s*box-shadow:\s*none;\s*outline:\s*none;/,
      );
    });
  it('aligns the Planner mode, schedule, and send controls with the message field inset', () => {
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner \.quick-planner-toolbar,\s*\.quick-planner \.quick-planner-schedule-row\s*\{\s*padding-inline:\s*17px;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner \.quick-planner-workbench:has\(\.quick-planner-schedule-row\) \.quick-planner-schedule-row\s*\{\s*padding-inline:\s*17px;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner \.quick-planner-schedule-row > \.quick-planner-schedule-field,[\s\S]*?\.quick-planner \.quick-planner-schedule-row > \.quick-planner-draft-actions\s*\{\s*transform:\s*none;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner \.quick-planner-workbench:has\(\.quick-planner-schedule-row\) \.quick-planner-schedule-row > \.quick-planner-schedule-field,[\s\S]*?\.quick-planner \.quick-planner-workbench:has\(\.quick-planner-schedule-row\) \.quick-planner-schedule-row > \.quick-planner-draft-actions\s*\{\s*transform:\s*none;/,
      );
      expect(quickPlannerStyles).toMatch(
        /@media \(max-width: 560px\)\s*\{\s*\.quick-planner \.quick-planner-schedule-row > \.quick-planner-submit,\s*\.quick-planner \.quick-planner-schedule-row > \.quick-planner-draft-actions\s*\{\s*right:\s*17px;/,
      );
    });
  it('removes the shadow from the New Message heading', () => {
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner-heading h1\s*\{\s*filter:\s*none !important;\s*text-shadow:\s*none !important;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-heading h1\s*\{[^}]*transform:\s*translateY\(80px\);/,
      );
    });
  it('removes all reserved vertical space for the hidden Planner heading', () => {
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-heading\s*\{\s*min-height:\s*0;\s*margin-bottom:\s*0;/,
      );
    });
  it('keeps the workbench free of decorative top stripes and inner glow at every size', () => {
      expect(quickPlannerStyles).not.toMatch(/\.quick-planner-workbench::before/);
      const workbenchShadows = [...quickPlannerStyles.matchAll(/\.quick-planner-workbench\s*\{[^}]*box-shadow:\s*([^;]+);/g)]
        .map((match) => match[1]);
      expect(workbenchShadows.length).toBeGreaterThan(0);
      workbenchShadows.forEach((shadow) => {
        expect(shadow).not.toMatch(/inset|0\s+0\s+0\s+1px/);
      });
      expect(colorThemeStyles).not.toMatch(/html\[data-theme='dark'\] \.quick-planner-workbench\s*\{[^}]*box-shadow:[^;]*inset/);
    });
  it('keeps the light workbench background free of highlights', () => {
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-workbench\s*\{[^}]*background:\s*#f7f8fa;/,
      );
      expect(quickPlannerStyles).not.toMatch(
        /\.quick-planner-workbench\s*\{[^}]*background:\s*(?:radial|linear)-gradient/,
      );
    });
  it('reserves enough width for the enlarged date and time labels with their icons', () => {
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-schedule-row > \.quick-planner-schedule-field\s*\{\s*width:\s*144px;\s*flex:\s*0 0 144px;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-time-value > \.quick-planner-schedule-field\s*\{\s*width:\s*124px;\s*flex:\s*0 0 124px;/,
      );
      expect(quickPlannerStyles).toMatch(
        /@media \(max-width:\s*560px\)\s*\{[\s\S]*?\.quick-planner-schedule-row \.quick-planner-time-value > \.quick-planner-schedule-field\s*\{\s*width:\s*124px;\s*flex-basis:\s*124px;/,
      );
      expect(quickPlannerStyles).toMatch(/\.quick-planner-schedule-row \.quick-planner-presets\s*\{[^}]*margin-left:\s*12px;/);
    });
  it('centers the date and time labels and icons inside their controls', () => {
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-schedule-row > \.quick-planner-schedule-field > button,\s*\.quick-planner-time-value > \.quick-planner-schedule-field > button\s*\{[^}]*justify-content:\s*center;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-schedule-row > \.quick-planner-schedule-field > button > span\s*\{\s*flex:\s*0 1 auto;\s*text-align:\s*left;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-schedule-row \.quick-planner-schedule-field > button\.is-readonly > svg:last-child\s*\{\s*visibility:\s*hidden;/,
      );
    });
  it('reflows schedule controls inside a narrow Planner card instead of clipping them', () => {
      expect(quickPlannerStyles).toMatch(
        /@container quick-planner-workbench \(max-width:\s*680px\)\s*\{[\s\S]*?\.quick-planner-schedule-row\s*\{[^}]*display:\s*grid;[^}]*overflow:\s*visible;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-schedule-row > \.quick-planner-submit-group,\s*\.quick-planner-schedule-row > \.quick-planner-draft-actions\s*\{[^}]*flex:\s*0 0 auto;[^}]*margin:\s*0 0 0 auto;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-schedule-row > \.quick-planner-submit-group\s*\{[^}]*grid-column:\s*2;[^}]*width:\s*100%;[^}]*min-width:\s*0;/,
      );
      expect(quickPlannerStyles).toMatch(/\.quick-planner-workbench\s*\{[^}]*container-name:\s*quick-planner-workbench;[^}]*container-type:\s*inline-size;/);
    });
  it('places the timezone immediately to the left of the send button', () => {
      const { container } = render(<QuickPlanner />);
      const submitGroup = container.querySelector('.quick-planner-submit-group')!;
      const timezone = submitGroup.querySelector('.quick-planner-timezone');
      const submit = submitGroup.querySelector('.quick-planner-submit');
  
      expect(timezone).toHaveTextContent(/^GMT/);
      expect(submitGroup.firstElementChild).toBe(timezone);
      expect(submitGroup.lastElementChild).toBe(submit);
      expect(container.querySelector('.quick-planner-time-value .quick-planner-timezone')).not.toBeInTheDocument();
      expect(quickPlannerStyles).toMatch(/\.quick-planner-timezone\.is-no-presets\s*\{[^}]*border-right:\s*1px solid var\(--planner-line\);/);
    });
  it('places the available time list above the editable time field', () => {
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-time-picker\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s+auto;[^}]*grid-template-areas:\s*"times"\s*"entry";/,
      );
      expect(quickPlannerStyles).toMatch(/\.quick-planner-time-field\s*\{[^}]*grid-area:\s*entry;/);
      expect(quickPlannerStyles).toMatch(/\.quick-planner-time-list\s*\{[^}]*grid-area:\s*times;/);
    });
  it('does not populate the chat picker with sample chats', () => {
      render(<QuickPlanner />);
  
      expect(screen.getByRole('button', { name: 'Choose a chat' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Choose a chat' }));
      expect(document.querySelector('.quick-planner-chat-options [role="option"]')).not.toBeInTheDocument();
      expect(screen.getByText('No chats found')).toBeInTheDocument();
    });
  it('keeps the open chat picker above the message editor and outside the workbench clipping area', () => {
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-workbench:has\(\.quick-planner-chat-menu\)\s*\{[^}]*z-index:\s*10;[^}]*overflow:\s*visible;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-workbench:has\(\.quick-planner-chat-menu\) \.quick-planner-toolbar\s*\{[^}]*position:\s*relative;[^}]*z-index:\s*1;/,
      );
      expect(quickPlannerStyles).toMatch(/\.quick-planner-chat-options\s*\{\s*max-height:\s*260px;/);
    });
  it('renders a feedback preview in the same accessible Planner status slot', () => {
      render(<QuickPlanner feedbackPreview={{ tone: 'error', message: 'Could not send the message.' }} />);
  
      const feedback = screen.getByRole('alert');
      expect(feedback).toHaveTextContent('Could not send the message.');
      expect(feedback).toHaveAttribute('title', 'Could not send the message.');
      expect(feedback).toHaveClass('quick-planner-action-feedback', 'is-error');
    });
  it('renders retry and dismiss actions in notification previews', () => {
      const onRetry = vi.fn();
      const onDismiss = vi.fn();
      render(<QuickPlanner feedbackPreview={{
        tone: 'error',
        message: 'Could not send the message.',
        actions: [
          { id: 'retry', label: 'Retry', onClick: onRetry },
          { id: 'dismiss', label: 'Dismiss', onClick: onDismiss },
        ],
      }} />);
  
      const feedback = screen.getByRole('alert');
      expect(feedback).toHaveTextContent('Could not send the message.');
      expect(feedback).toHaveClass('has-actions');
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(onRetry).toHaveBeenCalledOnce();
      expect(onDismiss).toHaveBeenCalledOnce();
    });
  it('restores the Planner text and attachment chips after remounting', () => {
      writePlannerDraft('Survives reload', [], ['C:\\files\\report.pdf']);
      expect(flushPlannerDraftWrite()).toBe(true);
  
      const firstRender = render(<QuickPlanner />);
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      expect(editor).toHaveValue('Survives reload');
      expect(firstRender.container.querySelector('.quick-planner-attachment-name')).toHaveTextContent('report.pdf');
  
      fireEvent.change(editor, { target: { value: 'Updated before reload' } });
      expect(flushPlannerDraftWrite()).toBe(true);
      firstRender.unmount();
  
      const secondRender = render(<QuickPlanner />);
      expect(screen.getByRole('textbox', { name: 'Reminder text' })).toHaveValue('Updated before reload');
      expect(secondRender.container.querySelector('.quick-planner-attachment-name')).toHaveTextContent('report.pdf');
    });
  it('translates the Planner page and its accessible controls into Russian', () => {
      localStorage.setItem('awaitmsg_locale', 'ru');
  
      render(<QuickPlanner />, 'Send now');
  
      expect(screen.getByRole('heading', { name: 'Новое сообщение' })).toBeInTheDocument();
      expect(screen.getByRole('main', { name: 'Новое сообщение' })).toHaveAttribute('lang', 'ru');
      const modeGroup = screen.getByRole('group', { name: 'Режимы действия' });
      expect(within(modeGroup).getByRole('button', { name: 'Отправить сейчас' })).toHaveAttribute('aria-pressed', 'true');
      expect(document.querySelector('.quick-planner-schedule-label')).toHaveTextContent('ОТПРАВИТЬ СЕЙЧАС');
      expect(screen.getByRole('textbox', { name: 'Текст напоминания' })).toHaveAttribute('placeholder', 'Запишите то, что важно…');
      expect(screen.getAllByRole('button', { name: 'Отправить сейчас' })).not.toHaveLength(0);
      expect(screen.getByRole('heading', { name: 'Активность' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Предстоящие' })).not.toBeInTheDocument();
  
      fireEvent.click(within(modeGroup).getByRole('button', { name: 'Запланировать' }));
      expect(document.querySelector('.quick-planner-schedule-label')).toHaveTextContent('ЗАПЛАНИРОВАТЬ');
      fireEvent.click(screen.getByRole('button', { name: 'Выбрать дату' }));
      const datePicker = screen.getByRole('dialog', { name: 'Выбор даты отправки' });
      expect(datePicker).toHaveTextContent(new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date()));
      expect(datePicker.querySelector('.quick-planner-date-picker-weekdays')).toHaveTextContent('пн');
  
      fireEvent.click(screen.getByRole('button', { name: 'Открыть окно эмодзи' }));
      expect(screen.getByRole('dialog', { name: 'Выбрать эмодзи' })).toHaveTextContent('Лица');
  
      fireEvent.click(screen.getByRole('button', { name: 'Черновик' }));
      expect(screen.getByRole('button', { name: 'Сохранить' })).toBeInTheDocument();
    });
  it('shows Activity while hiding the Upcoming section', () => {
      const { container } = render(<QuickPlanner />, 'Send now');
  
      expect(screen.getByRole('heading', { name: 'Activity' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Upcoming' })).not.toBeInTheDocument();
      expect(container.querySelector('.quick-planner-upcoming-section')).toHaveAttribute('hidden');
      expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
      expect(within(screen.getByRole('group', { name: 'Planner actions' })).getByRole('button', { name: 'Send now' }))
        .toHaveAttribute('aria-pressed', 'true');
      expect(document.querySelector('.quick-planner-schedule-label')).toHaveTextContent('SEND NOW');
    });
  it('charts only distinct confirmed sends with valid sentAt timestamps over local days', () => {
      const now = new Date(2035, 4, 12, 12, 0, 0);
      vi.setSystemTime(now);
      const sentAt = new Date(2035, 4, 12, 9, 30, 0).toISOString();
      const sent = [
        createScheduledMessage({ id: 'send-a', status: 'sent', sentAt, sendAttemptId: 'attempt-a' }),
        createScheduledMessage({ id: 'duplicate', status: 'sent', sentAt, sendAttemptId: 'attempt-a' }),
        createScheduledMessage({ id: 'send-b', status: 'sent', sentAt }),
        createScheduledMessage({ id: 'unknown', status: 'unknown', sentAt }),
        createScheduledMessage({ id: 'failed', status: 'failed', sentAt }),
        createScheduledMessage({ id: 'missing-time', status: 'sent', sentAt: undefined }),
        createScheduledMessage({ id: 'invalid-time', status: 'sent', sentAt: 'not-a-date' }),
        createScheduledMessage({ id: 'planned', status: 'scheduled', sentAt }),
      ];
  
      render(<QuickPlanner sent={sent} />);
  
      const dateLabel = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(now);
      expect(screen.getByRole('img', { name: 'Confirmed messages sent in the last 7 days: 2' })).toBeInTheDocument();
      expect(screen.getByTitle(`${dateLabel}: 2 messages sent`)).toBeInTheDocument();
      expect(screen.getByText('2', { selector: '.quick-planner-activity-total-count' })).toBeInTheDocument();
      expect(screen.getByText('confirmed sends', { selector: '.quick-planner-activity-total-label' })).toBeInTheDocument();
    });
});
