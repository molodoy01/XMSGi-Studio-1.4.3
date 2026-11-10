import { act } from 'react';
import { fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspacePage } from './WorkspacePage';
import { workspacePageStyles, colorThemeStyles, workspaceTestState, renderWorkspacePage, resetWorkspacePageTestEnvironment } from './WorkspacePage.testUtils';

describe('WorkspacePage feedback and connections', () => {
  beforeEach(resetWorkspacePageTestEnvironment);

  it('lightens selection and editing highlights in the light theme', () => {
      expect(colorThemeStyles).toMatch(/workspace-page-chat-stage-item\.is-selected,\s*html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-chat-stage \.workspace-page-chat-stage-item\.is-selected:hover,[\s\S]*?background:\s*#edf6fa;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-draft-stage \.workspace-page-template-stage-item\s*\{[^}]*margin-block:\s*-3px;[^}]*padding-block:\s*8px;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-template-stage\.workspace-page-rich-text-draft-stage \.workspace-page-template-stage-item:is\(:hover, :focus-within\)\s*\{[^}]*background:\s*#edf2f5 !important;/);
      expect(colorThemeStyles).toMatch(/workspace-page-template-stage-editor input,\s*html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-template-stage \.workspace-page-template-stage-editor textarea\s*\{[^}]*background:\s*#f8fbfd !important;/);
      expect(colorThemeStyles).toMatch(/workspace-page-template-stage-editor textarea:focus\s*\{[^}]*background:\s*#ffffff !important;[^}]*box-shadow:\s*0 0 0 3px rgba\(71, 124, 158, 0\.14\);/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-schedule-stage \.workspace-page-schedule-occurrences select\s*\{[^}]*background:\s*#ffffff;[^}]*color:\s*#29343d;[^}]*color-scheme:\s*light;/);
      expect(colorThemeStyles).toMatch(/workspace-page-schedule-occurrences select option\s*\{[^}]*background:\s*#ffffff;[^}]*color:\s*#29343d;/);
    });
  
  it('keeps the version history document selector list 40px shorter', () => {
      const dialogRule = workspacePageStyles.match(/\.workspace-page-version-history-dialog\s*\{([^}]*)\}/)?.[1] ?? '';
      const documentMenuRule = workspacePageStyles.match(/\.workspace-page-version-history-document-menu\s*\{([^}]*)\}/)?.[1] ?? '';
  
      expect(dialogRule).toMatch(/height:\s*min\(660px, calc\(100dvh - 72px\)\)/);
      expect(documentMenuRule).toMatch(/max-height:\s*min\(346px, calc\(100dvh - 414px\)\)/);
    });
  
  it('uses dark surfaces for Studio selection and editing windows', () => {
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page ::selection,\s*html\[data-theme='dark'\] \.workspace-page ::-moz-selection\s*\{\s*background:\s*#c4c9cc !important;\s*color:\s*#20272c !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-input::selection,[\s\S]*?\.workspace-page-template-stage-editor textarea::selection\s*\{\s*background:\s*#c4c9cc !important;\s*color:\s*#20272c !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-template-stage \.workspace-page-template-stage-editor textarea,[\s\S]*?background:\s*#151b20 !important;[^}]*color:\s*#e2e7eb;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-chat-stage \.workspace-page-chat-stage-item\s*\{[^}]*background:\s*#151b20;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page-rich-text-emoji-picker\s*\{[\s\S]*?--planner-ink:\s*#e2e7eb;[\s\S]*?background:\s*#171e23;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page-rich-text-emoji-picker \.quick-planner-emoji-categories button\s*\{[^}]*background:\s*#10161a;[^}]*color:\s*#c5cfd6;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page-rich-text-emoji-picker \.quick-planner-emoji-categories button\[aria-selected='true'\]\s*\{[^}]*background:\s*#17364d;[^}]*color:\s*#73c3ff;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-input,[\s\S]*?\.workspace-page-rich-text-input:focus-visible\s*\{[^}]*background:\s*#151b20 !important;[^}]*color:\s*#e2e7eb !important;[^}]*color-scheme:\s*dark;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-input,[\s\S]*?\.workspace-page-rich-text-input:focus-visible\s*\{\s*border-color:\s*#34414a !important;\s*border-radius:\s*0 !important;\s*background:\s*#151d22 !important;/);
      expect(workspacePageStyles).toMatch(/html\.electron-runtime\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-stage > \.workspace-page-textarea\.workspace-page-rich-text-input\.workspace-page-rich-text-stage-view\.is-active,[\s\S]*?\.workspace-page-rich-text-stage-view\.is-active:focus-visible\s*\{\s*border-radius:\s*0 !important;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page-version-history-close,[\s\S]*?\.workspace-page-version-history-copy\s*\{[^}]*background:\s*#1a2228 !important;[^}]*color:\s*#d4dde3 !important;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page-version-history-document-menu\s*\{[^}]*background:\s*#10161a !important;/);
    });
  
  it('reduces the floating emoji picker shadow by half in the light theme', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.workspace-page-rich-text-emoji-picker--floating\s*\{\s*box-shadow:\s*0 8px 20px rgba\(34, 47, 58, 0\.16\);/,
      );
    });
  
  it('aligns the empty editor prompt with the first typed line', () => {
      const editorRule = workspacePageStyles.match(/\.workspace-page-rich-text-input\s*\{[^}]*--workspace-page-editor-padding-block:\s*12px;[^}]*--workspace-page-editor-padding-inline:\s*14px;[^}]*\}/)?.[0] ?? '';
      const emptyPromptRule = workspacePageStyles.match(/\.workspace-page-rich-text-input\.is-empty:not\(\.is-focused\)::before\s*\{([^}]*)\}/)?.[1] ?? '';
      const finalEditorRule = workspacePageStyles.match(/\.workspace-page \.workspace-page-rich-text-input\s*\{([^}]*)\}/)?.[1] ?? '';
  
      expect(editorRule).not.toBe('');
      expect(emptyPromptRule).toMatch(/top:\s*var\(--workspace-page-editor-padding-block\)/);
      expect(emptyPromptRule).toMatch(/left:\s*var\(--workspace-page-editor-padding-inline\)/);
      expect(finalEditorRule).toMatch(/padding:\s*var\(--workspace-page-editor-padding-block\)\s+var\(--workspace-page-editor-padding-inline\)/);
    });
  
  it('keeps Studio date, time, and repeat controls readable in dark mode and on hover', () => {
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-schedule-stage \.workspace-page-schedule-inline-field\s*\{[^}]*background:\s*#151b20 !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-schedule-stage \.workspace-page-schedule-inline-field:hover\s*\{[^}]*opacity:\s*1 !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-schedule-stage \.workspace-page-schedule-segment:hover,[\s\S]*?\.workspace-page-schedule-segment:focus\s*\{[^}]*background:\s*#252d32 !important;[^}]*color:\s*#e2e7eb !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-schedule-stage \.workspace-page-weekday-list button\s*\{[^}]*background:\s*#151b20 !important;[^}]*color:\s*#c5cfd6 !important;/);
      expect(colorThemeStyles).toMatch(/html\[data-theme='dark'\] \.workspace-page \.workspace-page-rich-text-schedule-stage \.workspace-page-schedule-occurrences select,[\s\S]*?\.workspace-page-schedule-occurrences select option\s*\{[^}]*background:\s*#10161a !important;[^}]*color-scheme:\s*dark;/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-schedule-stage \.workspace-page-schedule-segment\s*\{/);
      expect(workspacePageStyles).toMatch(/html\[data-theme='light'\] \.workspace-page \.workspace-page-rich-text-schedule-stage input,[\s\S]*?\.workspace-page-rich-text-schedule-stage select\s*\{/);
    });
  
  it('keeps each saved-draft color visible in its picker and list in light theme', () => {
      const colorValues = {
        gray: '#8b929a',
        coral: '#e56f68',
        amber: '#d9a13c',
        green: '#55a87c',
        teal: '#269ca3',
        blue: '#548ed3',
      };
  
      for (const [color, value] of Object.entries(colorValues)) {
        expect(workspacePageStyles).toContain(`.workspace-page-draft-color-dot[data-color='${color}'] { background-color: ${value} !important; }`);
        expect(workspacePageStyles).toContain(`.draft-color-picker .draft-color-swatch[data-color='${color}']`);
      }
    });
  
  it('closes the schedule stage after a successful schedule result', async () => {
      const handleSchedule = vi.fn();
      const setTime = vi.fn();
      const { rerender, unmount } = await renderWorkspacePage({
        date: '2035-01-15',
        time: '18:30',
        setTime,
        handleSchedule,
      });
      const menuToggle = document.querySelector<HTMLButtonElement>('.workspace-page-publish-menu-toggle')!;
      await act(async () => menuToggle.click());
      const scheduleOption = Array.from(document.querySelectorAll('.workspace-page-publish-option'))
        .find((button) => button.textContent?.trim() === 'Schedule') as HTMLButtonElement;
      await act(async () => scheduleOption.click());
      const timeButton = Array.from(document.querySelectorAll('.workspace-page-schedule-compact-button'))
        .find((button) => button.textContent?.trim() === 'Time') as HTMLButtonElement;
      await act(async () => timeButton.click());
  
      const scheduleStage = '.workspace-page-rich-text-schedule-stage.is-active';
      expect(document.querySelector(scheduleStage)).not.toBeNull();
      const openTimePicker = document.querySelector<HTMLButtonElement>('[aria-label="Open time picker"]')!;
      await act(async () => openTimePicker.click());
      const availableTimes = document.querySelector('[aria-label="Available times"]')!;
      const selectedTimeOption = Array.from(availableTimes.querySelectorAll<HTMLButtonElement>('[role="option"]'))
        .find((option) => option.textContent?.trim() === '20:15')!;
      await act(async () => selectedTimeOption.click());
      expect(setTime).toHaveBeenCalledWith('20:15');
      rerender({ time: '20:15' });
  
      const doneButton = document.querySelector<HTMLButtonElement>('.workspace-page-schedule-footer .workspace-page-stage-primary')!;
      await act(async () => doneButton.click());
  
      expect(handleSchedule).not.toHaveBeenCalled();
      expect(document.querySelector(scheduleStage)).toBeNull();
      const publishButton = document.querySelector<HTMLButtonElement>('.workspace-page-publish-main')!;
      await act(async () => publishButton.click());
  
      expect(handleSchedule).toHaveBeenCalledOnce();
    expect(handleSchedule.mock.calls[0][0]).toMatchObject({ date: '2035-01-15', time: '20:15' });
      expect(document.querySelector(scheduleStage)).toBeNull();
      rerender({ scheduling: true });
      expect(document.querySelector(scheduleStage)).toBeNull();
      rerender({ scheduling: false, lastAction: 'scheduled' });
      expect(document.querySelector(scheduleStage)).toBeNull();
      unmount();
    });
  
  it('resets the repeat selection after a schedule succeeds', async () => {
      const handleSchedule = vi.fn();
      const { rerender, unmount } = await renderWorkspacePage({
        date: '2035-01-15',
        time: '18:30',
        handleSchedule,
      });
      const menuToggle = document.querySelector<HTMLButtonElement>('.workspace-page-publish-menu-toggle')!;
      await act(async () => menuToggle.click());
      const scheduleOption = document.querySelector<HTMLButtonElement>('.workspace-page-publish-option.is-scheduled')!;
      await act(async () => scheduleOption.click());
  
      const repeatButton = Array.from(document.querySelectorAll<HTMLButtonElement>('.workspace-page-schedule-compact-button'))
        .find((button) => button.textContent?.trim() === 'Repeat')!;
      await act(async () => repeatButton.click());
      const weeklyOption = Array.from(document.querySelectorAll<HTMLButtonElement>('.workspace-page-schedule-repeat-menu button'))
        .find((button) => button.textContent?.trim() === 'Weekly')!;
      await act(async () => weeklyOption.click());
      const repeatOccurrences = document.querySelector<HTMLSelectElement>('[aria-label="Repeat occurrences"]')!;
      await act(async () => fireEvent.change(repeatOccurrences, { target: { value: '3' } }));
      await act(async () => {
        (document.querySelector('.workspace-page-schedule-footer .workspace-page-stage-primary') as HTMLButtonElement).click();
      });
  
      await act(async () => {
        (document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).click();
      });
      expect(handleSchedule).toHaveBeenCalledOnce();
      expect(handleSchedule.mock.calls[0][1]).toMatchObject({
        mode: 'weekly',
        occurrences: 3,
      });
  
      rerender({ scheduling: true });
      rerender({ scheduling: false, lastAction: 'scheduled' });
  
      const repeatButtonAfterSuccess = Array.from(document.querySelectorAll<HTMLButtonElement>('.workspace-page-schedule-compact-button'))
        .find((button) => button.textContent?.trim() === 'Repeat')!;
      await act(async () => repeatButtonAfterSuccess.click());
      expect(document.querySelector('.workspace-page-schedule-repeat-menu button.is-selected'))
        .toHaveTextContent(/repeat/i);
      const resetWeeklyOption = Array.from(document.querySelectorAll<HTMLButtonElement>('.workspace-page-schedule-repeat-menu button'))
        .find((button) => button.textContent?.trim() === 'Weekly')!;
      await act(async () => resetWeeklyOption.click());
      expect(document.querySelector<HTMLSelectElement>('[aria-label="Repeat occurrences"]')?.value).toBe('1');
      unmount();
    });
  
  it('keeps the schedule stage open when scheduling fails', async () => {
      const handleSchedule = vi.fn();
      const { rerender, unmount } = await renderWorkspacePage({
        date: '2035-01-15',
        time: '18:30',
        handleSchedule,
      });
      const menuToggle = document.querySelector<HTMLButtonElement>('.workspace-page-publish-menu-toggle')!;
      await act(async () => menuToggle.click());
      const scheduleOption = Array.from(document.querySelectorAll('.workspace-page-publish-option'))
        .find((button) => button.textContent?.trim() === 'Schedule') as HTMLButtonElement;
      await act(async () => scheduleOption.click());
      const timeButton = Array.from(document.querySelectorAll('.workspace-page-schedule-compact-button'))
        .find((button) => button.textContent?.trim() === 'Time') as HTMLButtonElement;
      await act(async () => timeButton.click());
  
      const scheduleStage = '.workspace-page-rich-text-schedule-stage.is-active';
      const publishButton = document.querySelector<HTMLButtonElement>('.workspace-page-publish-main')!;
      await act(async () => publishButton.click());
      expect(handleSchedule).toHaveBeenCalledOnce();
      rerender({ scheduling: true });
      rerender({ scheduling: false, lastAction: null });
  
      expect(document.querySelector(scheduleStage)).not.toBeNull();
      unmount();
    });
  
  it('temporarily replaces the draft color picker with a prerequisite hint', async () => {
      localStorage.setItem('awaitmsg-workspace-draft', JSON.stringify({
        body: '',
        entities: [],
        attachments: [],
        savedAt: '12:00',
        date: '2026-01-10',
        time: '09:00',
        repeatMode: 'none',
        repeatDays: [],
        repeatOccurrences: 1,
      }));
      const { unmount } = await renderWorkspacePage();
      const menuToggle = document.querySelector('.workspace-page-publish-menu-toggle') as HTMLButtonElement;
  
      await act(async () => {
        menuToggle.click();
      });
      const draftOption = Array.from(document.querySelectorAll('.workspace-page-publish-option'))
        .find((button) => button.textContent?.trim() === 'Save draft') as HTMLButtonElement;
      await act(async () => {
        draftOption.click();
      });
  
      expect(document.querySelector('.draft-color-picker')).not.toBeNull();
      vi.useFakeTimers();
      await act(async () => {
        (document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).click();
      });
  
      expect(document.querySelector('.workspace-page-publish-transient-feedback')?.textContent).toBe('Add a message.');
      expect(document.querySelector('.workspace-page-publish-transient-feedback')?.parentElement?.classList.contains('workspace-page-draft-footer')).toBe(true);
      expect(document.querySelector('.workspace-page-publish-footer-content')?.classList.contains('is-feedback-hidden')).toBe(true);
      expect(workspaceTestState.inMemoryDraftStore.savedDrafts).toHaveLength(0);
  
      const firstFeedback = document.querySelector('.workspace-page-publish-transient-feedback');
      await act(async () => {
        (document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).click();
      });
      const repeatedFeedback = document.querySelector('.workspace-page-publish-transient-feedback');
      expect(repeatedFeedback?.textContent).toBe('Add a message.');
      expect(repeatedFeedback).not.toBe(firstFeedback);
  
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect(document.querySelector('.workspace-page-publish-transient-feedback')).not.toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1999);
      });
      expect(document.querySelector('.workspace-page-publish-transient-feedback')).not.toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(document.querySelector('.workspace-page-publish-transient-feedback')).toBeNull();
      expect(document.querySelector('.workspace-page-publish-footer-content')?.classList.contains('is-feedback-hidden')).toBe(false);
      expect(document.querySelector('.draft-color-picker')).not.toBeNull();
      vi.useRealTimers();
      unmount();
    });
  
  it('does not show footer hints for missing schedule time or optional repeat days', async () => {
      localStorage.setItem('awaitmsg-workspace-draft', JSON.stringify({
        body: 'Hello world',
        entities: [],
        attachments: [],
        savedAt: '12:00',
        date: '2026-01-10',
        time: '',
        repeatMode: 'weekly',
        repeatDays: [],
        repeatOccurrences: 1,
      }));
      const handleSchedule = vi.fn();
      const { unmount } = await renderWorkspacePage({
        date: '2026-01-10',
        time: '',
        handleSchedule,
      });
      const menuToggle = document.querySelector('.workspace-page-publish-menu-toggle') as HTMLButtonElement;
  
      await act(async () => {
        menuToggle.click();
      });
      const scheduleOption = Array.from(document.querySelectorAll('.workspace-page-publish-option'))
        .find((button) => button.textContent?.trim() === 'Schedule') as HTMLButtonElement;
      await act(async () => {
        scheduleOption.click();
      });
      await act(async () => {
        (document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).click();
      });
  
      expect(document.querySelector('.workspace-page-publish-transient-feedback')).toBeNull();
      expect(handleSchedule).not.toHaveBeenCalled();
      unmount();
    });
  
  it('leaves scheduler notification rendering to the shared app shell', async () => {
      const { unmount } = await renderWorkspacePage();
      expect(document.querySelector('.app-notification')).toBeNull();
      unmount();
    });
  
  it('keeps the editor preview and removes the duplicate queue UI', async () => {
      const { unmount } = await renderWorkspacePage();
  
      const actionGroup = document.querySelector('.workspace-page-action-left-group');
      expect(actionGroup?.querySelector('.workspace-page-mode-button-history')).toBeNull();
      expect(actionGroup?.textContent).not.toContain('Queue / History');
      expect(document.querySelector('.workspace-page-preview-panel')).not.toBeNull();
      expect(document.querySelector('.messages-panel')).toBeNull();
      const toolbar = document.querySelector('.workspace-page-rich-text-toolbar');
      expect(toolbar).not.toBeNull();
      const leadingTools = toolbar!.querySelector('.workspace-page-rich-text-leading-tools');
      expect(Array.from(leadingTools!.querySelectorAll('button')).map((button) => button.getAttribute('aria-label'))).toEqual([
        'Choose emoji',
        'Message effects',
      ]);
      const editorFormattingControls = Array.from(toolbar!.querySelectorAll<HTMLButtonElement>(
        '.workspace-page-rich-text-toolbar-actions .workspace-page-rich-text-format-option, .workspace-page-rich-text-toolbar-actions .workspace-page-rich-text-album-trigger, .workspace-page-rich-text-toolbar-actions .workspace-page-rich-text-link-trigger:not(.workspace-page-version-history-trigger):not(.workspace-page-rich-text-album-trigger)',
      ));
      expect(editorFormattingControls.map((button) => button.getAttribute('aria-label'))).toEqual([
        'Bold',
        'Italic',
        'Underline',
        'Strikethrough',
        'Insert link',
        'Add photo album',
      ]);
      const toolbarActions = toolbar!.querySelector('.workspace-page-rich-text-toolbar-actions')!;
      const actionOrder = Array.from(toolbarActions.children).map((element) => {
        if (element.classList.contains('workspace-page-rich-text-toolbar-divider')) return 'divider';
        return element.getAttribute('aria-label') ?? element.querySelector('button')?.getAttribute('aria-label');
      });
      expect(actionOrder).toEqual([
        'Bold',
        'Italic',
        'Underline',
        'Strikethrough',
        'Insert link',
        'divider',
        'Open version history',
        'Export editor text',
        'Add photo album',
      ]);
      expect(toolbar!.querySelector('.workspace-page-rich-text-format-clear')).toBeNull();
      expect(editorFormattingControls.every((button) => !button.disabled)).toBe(true);
      expect(toolbar!.querySelector('.workspace-page-version-history-trigger')).not.toBeNull();
      expect(toolbar!.querySelector('.workspace-page-editor-export-trigger')).not.toBeNull();
      const editor = document.querySelector('.workspace-page-rich-text-input') as HTMLDivElement;
      expect(editor.getAttribute('contenteditable')).toBe('true');
      act(() => {
        editor.textContent = 'Typed immediately';
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(editor.textContent).toBe('Typed immediately');
      expect(document.querySelector('.chat-preview-draft-bubble')?.textContent).toContain('Typed immediately');
  
      unmount();
    });
  
  it('shows send progress and a persistent retry action in the footer on failure', async () => {
      let resolveFirstSend: ((sent: boolean) => void) | null = null;
      const handleSendDraftNow = vi.fn()
        .mockImplementationOnce(() => new Promise<boolean>((resolve) => {
          resolveFirstSend = resolve;
        }))
        .mockResolvedValueOnce(true);
      const { unmount } = await renderWorkspacePage({ handleSendDraftNow });
  
      await act(async () => {
        (document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      expect(document.querySelector('.workspace-page-publish-transient-feedback')?.textContent).toBe('Sending…');
      expect((document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).disabled).toBe(true);
  
      await act(async () => {
        resolveFirstSend?.(false);
        await Promise.resolve();
      });
      expect(document.querySelector('[role="alert"]')?.textContent).toContain('Message not sent.');
      expect(document.querySelector('[role="textbox"]')?.textContent).toContain('Hello world');
      const retryButton = document.querySelector('.workspace-page-publish-transient-feedback .workspace-page-send-retry') as HTMLButtonElement;
      expect(retryButton).toBeTruthy();
  
      vi.useFakeTimers();
      await act(async () => {
        retryButton.click();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(handleSendDraftNow).toHaveBeenCalledTimes(2);
      expect(document.querySelector('[role="textbox"]')?.textContent?.trim()).toBe('');
      expect(document.querySelector('.workspace-page-publish-transient-feedback')?.textContent).toBe('Message sent.');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3360);
      });
      expect(document.querySelector('.workspace-page-publish-transient-feedback')).toBeNull();
      vi.useRealTimers();
      unmount();
    });
  
  it('shows external Studio warnings and errors in the publish footer as a single-line status', async () => {
      const view = await renderWorkspacePage({
        inlineNotification: {
          message: 'Telegram could not schedule the message.',
          title: 'Schedule failed',
          type: 'error',
          durationMs: 4500,
          revision: 1,
        },
      });
  
      const status = document.querySelector('.workspace-page-publish-transient-feedback');
      expect(status).toHaveAttribute('role', 'alert');
      expect(status).toHaveTextContent('Telegram could not schedule the message.');
      expect(status).not.toHaveTextContent('Schedule failed');
      expect(document.querySelector('.workspace-page-send-feedback')).toBeNull();
  
      view.rerender({
        inlineNotification: {
          message: 'Some chats may not accept scheduled posts.',
          title: 'Scheduling warning',
          type: 'warning',
          durationMs: 4500,
          revision: 2,
        },
      });
      expect(document.querySelector('.workspace-page-publish-transient-feedback')).toHaveAttribute('role', 'status');
      expect(document.querySelector('.workspace-page-publish-transient-feedback')).toHaveTextContent('Some chats may not accept scheduled posts.');
      expect(document.querySelector('.workspace-page-publish-transient-feedback')).not.toHaveTextContent('Scheduling warning');
      view.unmount();
    });
  
  it('returns failed album attachments to the editor after partial send', async () => {
      const handleSendDraftNow = vi.fn().mockImplementation(async (
        ...args: Parameters<React.ComponentProps<typeof WorkspacePage>['handleSendDraftNow']>
      ) => {
        const onAttachmentGroupResult = args[5];
        onAttachmentGroupResult?.(0, true);
        onAttachmentGroupResult?.(1, false);
        return false;
      });
      const { unmount } = await renderWorkspacePage({ handleSendDraftNow });
      const albumInput = document.querySelector<HTMLInputElement>('input[accept*="image/png"][multiple]')!;
      const addAlbum = async (fileName: string) => {
        await act(async () => {
          Object.defineProperty(albumInput, 'files', {
            value: [new File(['image'], fileName, { type: 'image/png' })],
            configurable: true,
          });
          albumInput.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        });
      };
  
      await addAlbum('sent-album.png');
      await addAlbum('failed-album.png');
      expect(document.querySelectorAll('.workspace-page-photo-album-card')).toHaveLength(2);
  
      await act(async () => {
        (document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).click();
        await Promise.resolve();
        await Promise.resolve();
      });
  
      expect(handleSendDraftNow).toHaveBeenCalledTimes(1);
      expect(handleSendDraftNow.mock.calls[0][5]).toHaveLength(2);
      const remainingAlbumCards = Array.from(document.querySelectorAll('.workspace-page-photo-album-card'));
      expect(remainingAlbumCards).toHaveLength(1);
      expect(remainingAlbumCards[0].querySelector('img')?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
      expect(document.querySelector('.workspace-page-photo-album-card img[src*="sent-album.png"]')).toBeNull();
      expect(document.querySelector('.workspace-page-rich-text-input')?.textContent).not.toContain('Hello world');
      unmount();
    });
  
  it('clears send errors after their longer status period', async () => {
      const handleSendDraftNow = vi.fn().mockResolvedValue(false);
      const { unmount } = await renderWorkspacePage({ handleSendDraftNow });
      vi.useFakeTimers();
  
      await act(async () => {
        (document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).click();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-error')).not.toBeNull();
  
      await act(async () => {
        await vi.advanceTimersByTimeAsync(7999);
      });
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-error')).not.toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-error')).toBeNull();
  
      vi.useRealTimers();
      unmount();
    });
  
  it('clears prerequisite warnings after their shorter status period', async () => {
      localStorage.setItem('awaitmsg-workspace-draft', JSON.stringify({
        body: '',
        entities: [],
        attachments: [],
        savedAt: '12:00',
        date: '2026-01-10',
        time: '09:00',
        repeatMode: 'none',
        repeatDays: [],
        repeatOccurrences: 1,
      }));
      const { unmount } = await renderWorkspacePage();
      vi.useFakeTimers();
  
      await act(async () => {
        (document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).click();
      });
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-warning')?.textContent).toBe('Add a message.');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4999);
      });
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-warning')).not.toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-warning')).toBeNull();
  
      vi.useRealTimers();
      unmount();
    });
  
  it('renders the Add file attachment button', async () => {
      const { unmount } = await renderWorkspacePage();
  
      const attachmentButton = document.querySelector('.workspace-page-attachment-toggle') as HTMLButtonElement | null;
  
      expect(attachmentButton).toBeTruthy();
      expect(attachmentButton?.getAttribute('aria-label')).toBe('Add file');
      expect(attachmentButton?.querySelector('svg')).not.toBeNull();
  
      unmount();
    });
  
  it('renders matching metallic chat and publish-menu chevrons', async () => {
      const { unmount } = await renderWorkspacePage();
      const previewIcon = document.querySelector('.workspace-page-action-left-group .workspace-page-preview-toggle svg');
      const chatChevron = document.querySelector('.workspace-page-chat-trigger-chevron');
      const publishChevron = document.querySelector('.workspace-page-publish-menu-toggle .workspace-page-publish-trigger-arrow svg');

      expect(previewIcon?.querySelector('.workspace-page-preview-pupil')).not.toBeNull();
      expect(chatChevron?.querySelectorAll('path')).toHaveLength(3);
      expect(chatChevron?.querySelector('#workspace-chat-chevron-metal')).not.toBeNull();
      expect(publishChevron).toHaveAttribute('width', '19');
      expect(publishChevron).toHaveAttribute('height', '19');
      expect(workspacePageStyles).toMatch(/\.workspace-page-publish-trigger-arrow svg\s*\{\s*width:\s*19px;\s*height:\s*19px;\s*transition:\s*width 180ms ease, height 180ms ease;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-publish-menu-toggle:hover \.workspace-page-publish-trigger-arrow svg,\s*\.workspace-page-publish-menu-toggle:focus-visible \.workspace-page-publish-trigger-arrow svg\s*\{\s*width:\s*23px;\s*height:\s*23px;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-attachment-icon\s*\{\s*width:\s*20px;\s*height:\s*20px;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-preview-toggle svg\s*\{\s*width:\s*20px;\s*height:\s*20px;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-chat-trigger-chevron\s*\{[^}]*width:\s*19px;[^}]*height:\s*19px;/);
      expect(workspacePageStyles).toMatch(/\.workspace-page-chat-trigger-chevron\s*\{[^}]*filter:\s*drop-shadow/);
  
      unmount();
    });
  
  it('shows send progress and success ahead of an earlier draft-store error', async () => {
      const longDraftError = `Draft storage failed. ${'UNBROKEN_ERROR_TOKEN_'.repeat(12)} Check the storage location and retry.`;
      vi.mocked(window.draftStorage.save).mockResolvedValueOnce({
        success: false,
        code: 'WRITE_FAILED',
        error: longDraftError,
      });
      let resolveSend: ((sent: boolean) => void) | null = null;
      const handleSendDraftNow = vi.fn().mockImplementation(() => new Promise<boolean>((resolve) => {
        resolveSend = resolve;
      }));
      const { unmount } = await renderWorkspacePage({ handleSendDraftNow });
  
      await act(async () => {
        (document.querySelector('.workspace-page-publish-menu-toggle') as HTMLButtonElement).click();
      });
      const saveDraftOption = Array.from(document.querySelectorAll('.workspace-page-publish-option'))
        .find((button) => button.textContent?.trim() === 'Save draft') as HTMLButtonElement;
      await act(async () => {
        saveDraftOption.click();
      });
      await act(async () => {
        (document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).click();
        await Promise.resolve();
        await Promise.resolve();
      });
      const longErrorFeedback = document.querySelector('.workspace-page-publish-transient-feedback.is-error');
      expect(longErrorFeedback).toHaveTextContent(longDraftError);
      expect(longErrorFeedback?.querySelector('.workspace-page-publish-transient-feedback-status')).toHaveTextContent(longDraftError);
      expect(workspacePageStyles).toContain('overflow-wrap: anywhere;');
      expect(workspacePageStyles).toContain('max-height: min(320px, calc(100dvh - 180px));');
      expect(workspacePageStyles).toContain('overflow-y: auto;');
      expect(workspacePageStyles).not.toContain('-webkit-line-clamp: 2;');
  
      await act(async () => {
        (document.querySelector('.workspace-page-publish-menu-toggle') as HTMLButtonElement).click();
      });
      const sendOption = Array.from(document.querySelectorAll('.workspace-page-publish-option'))
        .find((button) => button.textContent?.trim() === 'Send now') as HTMLButtonElement;
      await act(async () => {
        sendOption.click();
      });
      await act(async () => {
        (document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).click();
        await Promise.resolve();
      });
      expect(document.querySelector('.workspace-page-publish-transient-feedback')?.textContent).toBe('Sending…');
  
      await act(async () => {
        resolveSend?.(true);
        await Promise.resolve();
      });
      expect(document.querySelector('.workspace-page-publish-transient-feedback.is-success')?.textContent).toBe('Message sent.');
      expect(document.querySelector('.workspace-page-publish-main')).not.toBeDisabled();
      unmount();
    });
  
  it('shows a reconnecting indicator while Studio send waits for Telegram reconnection', async () => {
      workspaceTestState.telegramStatusListener = null;
      const { unmount } = await renderWorkspacePage({ publishingDraft: true });
  
      expect(document.querySelector('.workspace-page-publish-main')).toHaveTextContent('Sending…');
  
      await act(async () => {
        workspaceTestState.telegramStatusListener?.('reconnecting');
      });
  
      expect(document.querySelector('.workspace-page-publish-main')).toHaveTextContent('Reconnecting…');
      expect(document.querySelector('.workspace-page-publish-transient-feedback')).toHaveTextContent('Reconnecting to Telegram…');
  
      await act(async () => {
        workspaceTestState.telegramStatusListener?.('connected');
      });
  
      expect(document.querySelector('.workspace-page-publish-main')).toHaveTextContent('Sending…');
      unmount();
    });
});
