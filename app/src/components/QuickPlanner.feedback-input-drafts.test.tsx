import { createElement } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chat, ScheduledMessage } from '@/types';
import { LocaleProvider } from '@/lib/i18n';
import {
  flushPlannerDraftWrite,
  MAX_PLANNER_ATTACHMENTS,
  readPlannerDraft,
  readPlannerDraftAttachments,
  readPlannerDraftEntities,
  readPlannerDraftRecoveryStack,
  writePlannerDraft,
  writePlannerDraftRecoveryStack,
} from '../lib/plannerDraft';
import { QuickPlanner } from './QuickPlanner';
import { quickPlannerStyles, activityStyles, globalStyles, colorThemeStyles, render } from './QuickPlanner.testUtils';

describe("QuickPlanner feedback: input and drafts", () => {
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
  it('uses the 4096-character limit without attachments', () => {
      const { container } = render(<QuickPlanner />);
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      expect(editor).toHaveAttribute('maxLength', '4096');
      expect(container.querySelector('.quick-planner-character-count')).toHaveTextContent('/ 4096');
  
      fireEvent.change(editor, { target: { value: 'a'.repeat(4096) } });
  
      expect(container.querySelector('.quick-planner-character-count')).toHaveTextContent('4096 / 4096');
      expect(screen.getByText('4096 of 4096 characters')).toBeInTheDocument();
    });
  it('uses the 1024-character Telegram caption limit when an attachment is present', () => {
      localStorage.setItem('xmsgi-planner-draft-attachments', JSON.stringify(['C:\\photo.png']));
      const { container } = render(<QuickPlanner />);
  
      expect(screen.getByRole('textbox', { name: 'Reminder text' })).toHaveAttribute('maxLength', '1024');
      expect(container.querySelector('.quick-planner-character-count')).toHaveTextContent('/ 1024');
    });
  it('removes the message placeholder on focus and restores it on blur', () => {
      render(<QuickPlanner />);
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      expect(editor).toHaveAttribute('placeholder');
      expect(editor.getAttribute('placeholder')).not.toBe('');
  
      fireEvent.focus(editor);
      expect(editor).toHaveAttribute('placeholder', '');
  
      fireEvent.blur(editor);
      expect(editor.getAttribute('placeholder')).not.toBe('');
    });
  it('keeps plain Enter in the message field from reaching submit shortcuts', () => {
      const onAncestorKeyDown = vi.fn();
      const onSendNow = vi.fn().mockResolvedValue(true);
      const view = render(
        <div onKeyDown={onAncestorKeyDown}>
          <QuickPlanner onSendNow={onSendNow} />
        </div>,
        'Send now',
      );
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      const submitButton = view.container.querySelector<HTMLButtonElement>('.quick-planner-submit');
      const initialSubmitClass = submitButton?.className;
      act(() => editor.focus());
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
  
      editor.dispatchEvent(enterEvent);
  
      expect(enterEvent.defaultPrevented).toBe(false);
      expect(onAncestorKeyDown).not.toHaveBeenCalled();
      expect(onSendNow).not.toHaveBeenCalled();
      expect(submitButton?.className).toBe(initialSubmitClass);
      expect(document.activeElement).toBe(editor);
    });
  it('hides the Activity panel at the narrow Planner breakpoint', () => {
      expect(quickPlannerStyles).toMatch(
        /@media \(max-width: 900px\)[\s\S]*?\.quick-planner-activity\s*\{\s*display:\s*none;\s*\}/,
      );
      expect(quickPlannerStyles).toMatch(
        /@media \(max-width: 1040px\)[\s\S]*?html\.electron-runtime:has\(\.product-view\.is-active \.quick-planner\) \.quick-planner-activity\s*\{\s*display:\s*none;\s*\}/,
      );
    });
  it('keeps Electron Activity adjacent to the fixed Planner card without overlap', () => {
      expect(quickPlannerStyles).toMatch(
        /@media \(min-width: 781px\) and \(max-width: 1259px\)[\s\S]*?\.quick-planner-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[^}]*width:\s*min\(calc\(100% \+ 12px\),\s*760px\);[\s\S]*?\.quick-planner-activity\s*\{\s*display:\s*none;/,
      );
      expect(quickPlannerStyles).toMatch(
        /@media \(min-width: 781px\) and \(max-width: 1259px\)[\s\S]*?\.quick-planner-heading\s*\{\s*min-height:\s*0;\s*margin-bottom:\s*0;/,
      );
      expect(quickPlannerStyles).not.toMatch(/@media \(min-width: 1260px\)/);
    });
  it('vertically centers the Planner workbench in narrow Electron windows', () => {
      expect(quickPlannerStyles).toMatch(
        /@media \(max-width: 1040px\)[\s\S]*?html\.electron-runtime:has\(\.product-view\.is-active \.quick-planner\) \.quick-planner-layout\s*\{[^}]*align-content:\s*safe center;/,
      );
      expect(quickPlannerStyles).toMatch(
        /@media \(max-width: 780px\)\s*\{\s*html\.electron-runtime:has\(\.product-view\.is-active \.quick-planner\) \.quick-planner-layout\s*\{\s*align-content:\s*safe center;/,
      );
      expect(quickPlannerStyles).toMatch(
        /@media \(max-width: 1040px\)[\s\S]*?html\.electron-runtime:has\(\.product-view\.is-active \.quick-planner\) \.quick-planner-heading\s*\{\s*min-height:\s*0;\s*margin-bottom:\s*0;/,
      );
      expect(quickPlannerStyles).not.toContain('top: -68px;');
    });
  it('keeps the New Message heading accessible without reserving visible space', () => {
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-heading h1\.quick-planner-sr-only\s*\{\s*transform:\s*none;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-heading\s*\{\s*min-height:\s*0;\s*margin-bottom:\s*0;/,
      );
    });
  it('keeps the Electron Planner workbench and its controls fixed across resolutions', () => {
      expect(quickPlannerStyles).toMatch(
        /html\.electron-runtime:has\(\.product-view\.is-active \.quick-planner\) \.quick-planner-workbench\s*\{[^}]*width:\s*760px;[^}]*min-width:\s*760px;[^}]*max-width:\s*760px;[^}]*height:\s*510px;[^}]*min-height:\s*510px;[^}]*max-height:\s*510px;[^}]*flex:\s*0 0 510px;[^}]*overflow:\s*hidden;/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\.electron-runtime:has\(\.product-view\.is-active \.quick-planner\) \.quick-planner-toolbar\s*\{[^}]*grid-template-columns:\s*minmax\(180px,\s*0\.8fr\) minmax\(0,\s*1\.2fr\);[^}]*gap:\s*20px;/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\.electron-runtime:has\(\.product-view\.is-active \.quick-planner\) \.quick-planner-composer\s*\{[^}]*height:\s*240px;[^}]*min-height:\s*240px;[^}]*max-height:\s*240px;[^}]*flex:\s*0 0 240px;/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\.electron-runtime:has\(\.product-view\.is-active \.quick-planner\) \.quick-planner-message\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0;[^}]*min-height:\s*0;[^}]*flex:\s*1 1 0;[^}]*margin:\s*13px 0 8px;/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\.electron-runtime:has\(\.product-view\.is-active \.quick-planner\) \.quick-planner-schedule-row\s*\{[^}]*height:\s*62px;[^}]*min-height:\s*62px;[^}]*flex:\s*0 0 62px;[^}]*flex-wrap:\s*nowrap;/,
      );
      expect(quickPlannerStyles).not.toMatch(/@media \(min-width: 781px\) and \(max-height: 800px\)/);
    });
  it('wraps action-mode labels inside narrow workbench buttons', () => {
      expect(quickPlannerStyles).toMatch(
        /@container quick-planner-workbench \(max-width: 620px\)\s*\{\s*\.quick-planner-mode-switch button\s*\{\s*flex-direction:\s*column;[^}]*font-size:\s*9px;[^}]*white-space:\s*normal;/,
      );
      expect(quickPlannerStyles).toMatch(
        /@container quick-planner-workbench \(max-width: 620px\)[\s\S]*?\.quick-planner-mode-switch button > span\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*text-align:\s*center;/,
      );
    });
  it('uses a gray text selection in the light Planner theme', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner::selection,\s*html\[data-theme='light'\] \.quick-planner ::selection\s*\{\s*background:\s*#d9dde0;\s*color:\s*#26343d;/,
      );
    });
  it('uses a light gray text selection in the dark Planner theme', () => {
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner \.quick-planner-message::selection\s*\{\s*background:\s*#c4c9cc;\s*color:\s*#20272c;/,
      );
    });
  it('shows reconnection progress in the Planner status area', () => {
      render(<QuickPlanner connectionRecoveryStatus="reconnecting" />, 'Send now');
  
      const status = document.querySelector('.quick-planner-action-feedback.is-connection-status');
      const spinner = status?.querySelector('.quick-planner-connection-spinner');
      expect(status).toHaveAttribute('role', 'status');
      expect(spinner).toBeInTheDocument();
      expect(globalStyles).toMatch(
        /\.quick-planner-connection-spinner,[\s\S]*?\.workspace-page-connection-spinner(?:,[^{]+)?\s*\{[^}]*width:\s*13px;[^}]*height:\s*13px;[^}]*flex:\s*0 0 13px;[^}]*border-radius:\s*50%;[^}]*animation:\s*connection-status-spin 800ms linear infinite;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-compose-footer \.quick-planner-action-feedback > \.quick-planner-action-feedback-message\s*\{[^}]*width:\s*auto;/,
      );
      expect(quickPlannerStyles).not.toMatch(
        /\.quick-planner-compose-footer \.quick-planner-action-feedback > span\s*\{/,
      );
    });
  it('removes the connection capsule surface in the dark theme only', () => {
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner-compose-footer \.quick-planner-action-feedback\.is-connection-status\s*\{\s*border-color:\s*transparent;\s*background:\s*transparent;\s*box-shadow:\s*none;/,
      );
      expect(quickPlannerStyles).toMatch(
        /\.quick-planner-compose-footer \.quick-planner-action-feedback\.is-connection-status\s*\{[^}]*background:\s*var\(--surface-raised\);/,
      );
    });
  it('hides the recovery notice when its display timeout expires', () => {
      render(
        <QuickPlanner
          connectionRecoveryStatus="offline"
          connectionRecoveryNoticeStatus={null}
        />,
        'Send now',
      );

      expect(document.querySelector('.quick-planner-action-feedback.is-connection-status')).toBeNull();
    });
  it('shows a green success notice after the connection is restored', () => {
      render(
        <QuickPlanner
          connectionRecoveryStatus={null}
          connectionRecoveryNoticeStatus="restored"
        />,
        'Send now',
      );

      const status = document.querySelector('.quick-planner-action-feedback.is-connection-status');
      expect(status).toHaveClass('is-success');
      expect(status).toHaveTextContent('Connection restored');
      expect(status?.querySelector('.quick-planner-connection-spinner')).not.toBeInTheDocument();
    });
  it('loads a selected history draft into the active Planner editor', () => {
      const request = {
        revision: 1,
        text: 'Continue editing this saved draft',
        attachments: ['C:/drafts/photo.png'],
        entities: [{ type: 'bold' as const, offset: 0, length: 8 }],
        restoreDraft: { text: '', attachments: [], entities: [] },
      };
      const onOpenInStudio = vi.fn();
      const view = render(<QuickPlanner />, 'Send now');
      view.rerender(createElement(LocaleProvider, null, <QuickPlanner draftLoadRequest={request} onOpenInStudio={onOpenInStudio} />));
  
      expect(view.container.querySelector<HTMLTextAreaElement>('.quick-planner-message')?.value)
        .toBe('Continue editing this saved draft');
      expect(view.container.querySelector('.quick-planner-attachment-name')).toHaveTextContent('photo.png');
      expect(readPlannerDraftAttachments()).toEqual(['C:/drafts/photo.png']);
      expect(readPlannerDraftEntities()).toEqual(request.entities);
      fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
      fireEvent.click(screen.getByRole('button', { name: 'Open in Studio' }));
      expect(onOpenInStudio).toHaveBeenCalledWith({
        text: request.text,
        attachments: request.attachments,
        entities: request.entities,
      });
    });
  it('clears the transferred Planner draft only after Studio confirms it opened', async () => {
      const onOpenInStudio = vi.fn().mockResolvedValue(true);
      const view = render(<QuickPlanner onOpenInStudio={onOpenInStudio} />, 'Send now');
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      fireEvent.change(editor, { target: { value: 'Move this draft to Studio' } });
      fireEvent.click(screen.getByRole('button', { name: 'Draft' }));

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Open in Studio' }));
        await Promise.resolve();
      });

      expect(onOpenInStudio).toHaveBeenCalledWith({
        text: 'Move this draft to Studio',
        attachments: [],
        entities: [],
      });
      expect(editor).toHaveValue('');
      expect(readPlannerDraft()).toBe('');
      expect(readPlannerDraftAttachments()).toEqual([]);
      expect(readPlannerDraftEntities()).toEqual([]);
      expect(view.container.querySelector('.quick-planner-attachment-name')).not.toBeInTheDocument();
    });
  it('restores a queued Planner draft after Studio confirms the current draft was accepted', async () => {
    const previousDraft = { text: 'Previous Planner text', attachments: [], entities: [] };
    writePlannerDraft(previousDraft.text);
    flushPlannerDraftWrite();
    const onOpenInStudio = vi.fn().mockResolvedValue(true);
    const view = render(<QuickPlanner onOpenInStudio={onOpenInStudio} />, 'Send now');
    view.rerender(createElement(LocaleProvider, null, <QuickPlanner
      draftLoadRequest={{
        revision: 1,
        text: 'Move this draft to Studio',
        attachments: [],
        entities: [],
        restoreDraft: null,
      }}
      onOpenInStudio={onOpenInStudio}
    />));
    fireEvent.click(screen.getByRole('button', { name: 'Draft' }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open in Studio' }));
      await Promise.resolve();
    });

    expect(onOpenInStudio).toHaveBeenCalledWith({
      text: 'Move this draft to Studio',
      attachments: [],
      entities: [],
    });
    expect(view.container.querySelector<HTMLTextAreaElement>('.quick-planner-message')).toHaveValue(previousDraft.text);
    expect(readPlannerDraftRecoveryStack()).toEqual([]);
    expect(screen.getByRole('status')).toHaveTextContent('Your previous text has been restored in the editor.');
  });
  it('keeps the Planner draft when Studio does not confirm opening', async () => {
      const onOpenInStudio = vi.fn().mockResolvedValue(false);
      render(<QuickPlanner onOpenInStudio={onOpenInStudio} />, 'Send now');
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      fireEvent.change(editor, { target: { value: 'Keep this Planner draft' } });
      fireEvent.click(screen.getByRole('button', { name: 'Draft' }));

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Open in Studio' }));
        await Promise.resolve();
      });

      expect(editor).toHaveValue('Keep this Planner draft');
      expect(readPlannerDraft()).toBe('Keep this Planner draft');
    });
  it('limits imported Planner drafts to ten attachments before sending', async () => {
      const chat: Chat = { id: 'chat-imported-draft', name: 'Imported draft chat' };
      const attachments = Array.from({ length: MAX_PLANNER_ATTACHMENTS + 2 }, (_, index) => (
        `C:/drafts/photo-${index}.png`
      ));
      const request = {
        revision: 1,
        text: 'Imported draft',
        attachments,
        entities: [],
        restoreDraft: { text: '', attachments: [], entities: [] },
      };
      const onSendNow = vi.fn().mockResolvedValue(true);
      const view = render(
        <QuickPlanner chats={[chat]} selectedChat={chat} onSendNow={onSendNow} />,
        'Send now',
      );
      view.rerender(createElement(LocaleProvider, null, <QuickPlanner
        chats={[chat]}
        selectedChat={chat}
        draftLoadRequest={request}
        onSendNow={onSendNow}
      />));
  
      expect(view.container.querySelectorAll('.quick-planner-attachment')).toHaveLength(MAX_PLANNER_ATTACHMENTS);
      expect(screen.getByRole('status')).toHaveTextContent('Max 10 files per message.');
      expect(readPlannerDraftAttachments()).toEqual(attachments.slice(0, MAX_PLANNER_ATTACHMENTS));
  
      await act(async () => {
        fireEvent.click(view.container.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit')!);
        await Promise.resolve();
      });
  
      expect(onSendNow).toHaveBeenCalledWith(
        chat,
        'Imported draft',
        attachments.slice(0, MAX_PLANNER_ATTACHMENTS),
        undefined,
        [],
      );
    });
  it('limits an oversized persisted Planner draft and reports the limit', () => {
      const attachments = Array.from({ length: MAX_PLANNER_ATTACHMENTS + 1 }, (_, index) => (
        `C:/drafts/photo-${index}.png`
      ));
      writePlannerDraft('Saved Planner draft', [], attachments);
      flushPlannerDraftWrite();
  
      const { container } = render(<QuickPlanner />);
  
      expect(container.querySelectorAll('.quick-planner-attachment')).toHaveLength(MAX_PLANNER_ATTACHMENTS);
      expect(screen.getByRole('status')).toHaveTextContent('Max 10 files per message.');
      expect(readPlannerDraftAttachments()).toEqual(attachments.slice(0, MAX_PLANNER_ATTACHMENTS));
    });
  it('restores the previous Planner draft after successfully sending a selected Posts draft', async () => {
      const chat: Chat = { id: 'chat-restore', name: 'Restore chat' };
      const restoreDraft = {
        text: 'Previous Planner text',
        attachments: ['C:/planner/previous.pdf'],
        entities: [{ type: 'italic' as const, offset: 0, length: 8 }],
      };
      const onRestoreDraft = vi.fn();
      const onSendNow = vi.fn().mockResolvedValue(true);
      const { container } = render(
        <QuickPlanner
          chats={[chat]}
          selectedChat={chat}
          draftLoadRequest={{
            revision: 1,
            text: 'Selected Posts draft',
            attachments: ['C:/posts/selected.png'],
            entities: [{ type: 'bold' as const, offset: 0, length: 8 }],
            restoreDraft,
          }}
          onRestoreDraft={onRestoreDraft}
          onSendNow={onSendNow}
        />,
      );
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      const submit = container.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit')!;
      fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
      await act(async () => {
        fireEvent.click(submit);
        await Promise.resolve();
      });
  
      expect(onSendNow).toHaveBeenCalledWith(
        chat,
        'Selected Posts draft',
        ['C:/posts/selected.png'],
        undefined,
        [{ type: 'bold', offset: 0, length: 8 }],
      );
      expect(editor).toHaveValue(restoreDraft.text);
      expect(container.querySelector('.quick-planner-attachment-name')).toHaveTextContent('previous.pdf');
      expect(readPlannerDraft()).toBe(restoreDraft.text);
      expect(readPlannerDraftAttachments()).toEqual(restoreDraft.attachments);
      expect(onRestoreDraft).toHaveBeenCalledWith(expect.objectContaining(restoreDraft), []);
      expect(screen.getByRole('status')).toHaveTextContent('Message sent.');
      expect(screen.getByRole('status')).not.toHaveTextContent('You had text here before');
      await act(async () => vi.advanceTimersByTimeAsync(3359));
      expect(editor).toHaveValue(restoreDraft.text);
      expect(onRestoreDraft).toHaveBeenCalledTimes(1);
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(editor).toHaveValue(restoreDraft.text);
      expect(container.querySelector('.quick-planner-attachment-name')).toHaveTextContent('previous.pdf');
      expect(readPlannerDraft()).toBe(restoreDraft.text);
      expect(readPlannerDraftAttachments()).toEqual(restoreDraft.attachments);
      expect(readPlannerDraftEntities()).toEqual(restoreDraft.entities);
      expect(onRestoreDraft).toHaveBeenLastCalledWith(expect.objectContaining(restoreDraft), []);
      expect(screen.getByRole('status')).toHaveTextContent('Your previous text has been restored in the editor.');
      expect(screen.getByRole('status')).toHaveClass('is-success');
      await act(async () => vi.advanceTimersByTimeAsync(4359));
      expect(screen.getByRole('status')).toBeInTheDocument();
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  it('does not show a previous-text notice when the Planner was empty before loading a Posts draft', async () => {
      const chat: Chat = { id: 'chat-empty-restore', name: 'Empty restore chat' };
      const onRestoreDraft = vi.fn();
      const onSendNow = vi.fn().mockResolvedValue(true);
      const { container } = render(
        <QuickPlanner
          chats={[chat]}
          selectedChat={chat}
          draftLoadRequest={{
            revision: 1,
            text: 'Selected Posts draft',
            attachments: [],
            entities: [],
            restoreDraft: null,
          }}
          onRestoreDraft={onRestoreDraft}
          onSendNow={onSendNow}
        />,
      );
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      const submit = container.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit')!;
      fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
  
      await act(async () => {
        fireEvent.click(submit);
        await Promise.resolve();
      });
  
      expect(onSendNow).toHaveBeenCalledWith(chat, 'Selected Posts draft', undefined, undefined, []);
      expect(editor).toHaveValue('');
      expect(onRestoreDraft).toHaveBeenCalledWith(null, []);
      expect(screen.getByRole('status')).toHaveTextContent('Message sent.');
      expect(screen.getByRole('status')).not.toHaveTextContent('You had text here before');
    });
  it('shows the localized Russian notice only after a previous draft is restored', async () => {
    localStorage.setItem('awaitmsg_locale', 'ru');
    const chat: Chat = { id: 'chat-russian-restore', name: 'Чат' };
    const onSendNow = vi.fn().mockResolvedValue(true);
    const { container } = render(
      <QuickPlanner
        chats={[chat]}
        selectedChat={chat}
        draftLoadRequest={{
          revision: 1,
          text: 'Текущий текст',
          attachments: [],
          entities: [],
          restoreDraft: { text: 'Предыдущий текст', attachments: [], entities: [] },
        }}
        onSendNow={onSendNow}
      />,
      'Send now',
    );
    const submit = container.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit')!;

    await act(async () => {
      fireEvent.click(submit);
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent('Сообщение отправлено.');
    await act(async () => vi.advanceTimersByTimeAsync(3360));
    expect(screen.getByRole('status')).toHaveTextContent('Предыдущий текст восстановлен в редакторе.');
    expect(container.querySelector<HTMLTextAreaElement>('.quick-planner-message')).toHaveValue('Предыдущий текст');
  });
  it('keeps the selected Posts draft after a failed send and restores the previous draft on retry success', async () => {
      const chat: Chat = { id: 'chat-retry-restore', name: 'Retry restore chat' };
      const restoreDraft = { text: 'Previous Planner text', attachments: [], entities: [] };
      const onRestoreDraft = vi.fn();
      const onSendNow = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const { container } = render(
        <QuickPlanner
          chats={[chat]}
          selectedChat={chat}
          draftLoadRequest={{
            revision: 1,
            text: 'Selected Posts draft',
            attachments: [],
            entities: [],
            restoreDraft,
          }}
          onRestoreDraft={onRestoreDraft}
          onSendNow={onSendNow}
        />,
      );
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      const submit = container.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit')!;
      fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
  
      await act(async () => {
        fireEvent.click(submit);
        await Promise.resolve();
      });
      expect(editor).toHaveValue('Selected Posts draft');
      expect(onRestoreDraft).not.toHaveBeenCalled();
  
      await act(async () => {
        fireEvent.click(submit);
        await Promise.resolve();
      });
      expect(editor).toHaveValue(restoreDraft.text);
      expect(onRestoreDraft).toHaveBeenCalledWith(expect.objectContaining(restoreDraft), []);
      await act(async () => vi.advanceTimersByTimeAsync(3360));
      expect(editor).toHaveValue(restoreDraft.text);
      expect(onRestoreDraft).toHaveBeenLastCalledWith(expect.objectContaining(restoreDraft), []);
    });
  it('restores Planner drafts in reverse order with attachments, entities, and effects intact', async () => {
    const chat: Chat = { id: 'chat-recovery-stack', name: 'Recovery chat', type: 'channel' };
    const draftA = {
      text: 'Draft A',
      attachments: ['C:/drafts/a.png'],
      entities: [{ type: 'italic' as const, offset: 0, length: 7 }],
    };
    const draftB = {
      text: 'Draft B',
      attachments: ['C:/drafts/b.png'],
      entities: [{ type: 'bold' as const, offset: 0, length: 7 }],
    };
    writePlannerDraft(draftA.text, draftA.entities, draftA.attachments);
    flushPlannerDraftWrite();
    writePlannerDraftRecoveryStack([]);
    const onSendNow = vi.fn().mockResolvedValue(true);
    const view = render(<QuickPlanner chats={[chat]} selectedChat={chat} onSendNow={onSendNow} />, 'Send now');
    const loadDraft = (revision: number, draft: typeof draftB, effect?: string) => {
      view.rerender(createElement(LocaleProvider, null, <QuickPlanner
        chats={[chat]}
        selectedChat={chat}
        onSendNow={onSendNow}
        draftLoadRequest={{
          revision,
          ...draft,
          ...(effect ? { effect } : {}),
          restoreDraft: null,
        }}
      />));
    };

    loadDraft(1, draftB, 'fire');
    loadDraft(2, { text: 'Draft C', attachments: [], entities: [] });
    expect(readPlannerDraftRecoveryStack().map((draft) => draft.text)).toEqual(['Draft A', 'Draft B']);
    expect(readPlannerDraftRecoveryStack()[1]).toMatchObject({
      ...draftB,
      selectedChat: chat,
      effect: 'fire',
    });

    const editor = screen.getByRole('textbox', { name: 'Reminder text' });
    const submit = view.container.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit')!;
    await act(async () => {
      fireEvent.click(submit);
      await Promise.resolve();
    });
    expect(editor).toHaveValue(draftB.text);
    expect(readPlannerDraftAttachments()).toEqual(draftB.attachments);
    expect(readPlannerDraftEntities()).toEqual(draftB.entities);
    expect(readPlannerDraftRecoveryStack().map((draft) => draft.text)).toEqual(['Draft A']);

    await act(async () => {
      fireEvent.click(submit);
      await Promise.resolve();
    });
    expect(editor).toHaveValue(draftA.text);
    expect(readPlannerDraftAttachments()).toEqual(draftA.attachments);
    expect(readPlannerDraftEntities()).toEqual(draftA.entities);
    expect(readPlannerDraftRecoveryStack()).toEqual([]);
    expect(onSendNow).toHaveBeenNthCalledWith(1, chat, 'Draft C', undefined, undefined, []);
    expect(onSendNow).toHaveBeenNthCalledWith(2, chat, 'Draft B', draftB.attachments, 'fire', draftB.entities);
    await act(async () => vi.advanceTimersByTimeAsync(3360));
    expect(screen.getByRole('status')).toHaveTextContent('Your previous text has been restored in the editor.');
  });
  it('restores the original scheduled-message identity before rescheduling a displaced draft', async () => {
    const chat: Chat = { id: 'chat-replacement-stack', name: 'Scheduled chat', type: 'channel' };
    const when = new Date(Date.now() + 2 * 60 * 60 * 1000);
    when.setSeconds(0, 0);
    const original: ScheduledMessage = {
      id: 'scheduled-source',
      chatId: chat.id,
      chatName: chat.name,
      text: 'Scheduled draft B',
      when: when.toISOString(),
      createdAt: new Date().toISOString(),
      status: 'scheduled',
      attachments: ['C:/scheduled/photo.png'],
      entities: [{ type: 'italic', offset: 0, length: 10 }],
      silent: true,
    };
    writePlannerDraft('Draft A');
    flushPlannerDraftWrite();
    const onSendNow = vi.fn().mockResolvedValue(true);
    const onSchedule = vi.fn().mockResolvedValue(true);
    const view = render(<QuickPlanner
      chats={[chat]}
      selectedChat={chat}
      onSendNow={onSendNow}
      onSchedule={onSchedule}
      draftLoadRequest={{
        revision: 1,
        text: original.text,
        attachments: original.attachments ?? [],
        entities: original.entities ?? [],
        selectedChat: chat,
        restoreDraft: null,
        rescheduleMessage: original,
      }}
    />, 'Send now');
    view.rerender(createElement(LocaleProvider, null, <QuickPlanner
      chats={[chat]}
      selectedChat={chat}
      onSendNow={onSendNow}
      onSchedule={onSchedule}
      draftLoadRequest={{
        revision: 2,
        text: 'Draft C',
        attachments: [],
        entities: [],
        selectedChat: chat,
        restoreDraft: null,
      }}
    />));

    fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
    const submit = view.container.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit')!;
    await act(async () => {
      fireEvent.click(submit);
      await Promise.resolve();
    });
    expect(view.container.querySelector<HTMLTextAreaElement>('.quick-planner-message')).toHaveValue(original.text);
    expect(readPlannerDraftRecoveryStack().map((draft) => draft.text)).toEqual(['Draft A']);

    await act(async () => {
      fireEvent.click(submit);
      await Promise.resolve();
    });
    expect(onSchedule).toHaveBeenCalledWith(expect.objectContaining({
      chatId: chat.id,
      message: original.text,
      attachments: original.attachments,
      entities: original.entities,
      silent: true,
      replaceMessage: original,
    }));
    expect(view.container.querySelector<HTMLTextAreaElement>('.quick-planner-message')).toHaveValue('Draft A');
    expect(readPlannerDraftRecoveryStack()).toEqual([]);
  });
  it('deduplicates the active draft and keeps the queue unchanged when sending fails', async () => {
    const chat: Chat = { id: 'chat-recovery-failure', name: 'Recovery chat' };
    writePlannerDraft('Draft A');
    flushPlannerDraftWrite();
    const onSendNow = vi.fn().mockResolvedValue(false);
    const view = render(<QuickPlanner chats={[chat]} selectedChat={chat} onSendNow={onSendNow} />);
    const loadDraft = (revision: number, text: string) => {
      view.rerender(createElement(LocaleProvider, null, <QuickPlanner
        chats={[chat]}
        selectedChat={chat}
        onSendNow={onSendNow}
        draftLoadRequest={{
          revision,
          text,
          attachments: [],
          entities: [],
          restoreDraft: null,
        }}
      />));
    };
    loadDraft(1, 'Draft B');
    expect(readPlannerDraftRecoveryStack().map((draft) => draft.text)).toEqual(['Draft A']);
    const [draftA] = readPlannerDraftRecoveryStack();
    if (!draftA) throw new Error('Expected the displaced draft to be saved');
    writePlannerDraftRecoveryStack([...readPlannerDraftRecoveryStack(), { ...draftA, text: 'Draft B' }]);
    loadDraft(2, 'Draft C');
    expect(readPlannerDraftRecoveryStack().map((draft) => draft.text)).toEqual(['Draft A', 'Draft B']);

    const editor = screen.getByRole('textbox', { name: 'Reminder text' });
    await act(async () => {
      fireEvent.click(view.container.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit')!);
      await Promise.resolve();
    });
    expect(editor).toHaveValue('Draft C');
    expect(readPlannerDraftRecoveryStack().map((draft) => draft.text)).toEqual(['Draft A', 'Draft B']);
  });
  it('repeats the offline status instead of showing the empty-message warning when sending', () => {
      const { container } = render(<QuickPlanner connectionRecoveryStatus="offline" />, 'Send now');
      const connectionStatus = container.querySelector('.quick-planner-action-feedback.is-connection-status');
      expect(connectionStatus).toHaveClass('is-error');

      const submitButton = container.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit');
  
      if (!submitButton) throw new Error('Expected the Planner send button');
      fireEvent.click(submitButton);
  
      let status = screen.getByRole('alert');
      expect(status).toHaveTextContent('Telegram is unavailable. The app will keep trying to reconnect.');
      expect(status).toHaveClass('is-error');
  
      fireEvent.click(submitButton);
      status = screen.getByRole('alert');
      expect(status).toHaveTextContent('Telegram is unavailable. The app will keep trying to reconnect.');
      expect(status).toHaveClass('is-retriggered');
      expect(status).not.toHaveTextContent('Write a message');
    });
  it('makes the selected action mode easy to distinguish in dark theme', () => {
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme\] \.quick-planner \.quick-planner-mode-switch button\.is-active\s*\{\s*color:\s*var\(--planner-accent\);\s*border:\s*1px solid rgba\(var\(--planner-accent-rgb\), 0\.24\);\s*background:\s*rgba\(var\(--planner-accent-rgb\), 0\.06\);\s*box-shadow:\s*0 1px 2px rgba\(35, 52, 66, 0\.06\);/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme\] \.quick-planner \.quick-planner-mode-switch button\.is-active:hover\s*\{\s*background:\s*rgba\(var\(--planner-accent-rgb\), 0\.06\);/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme\] \.quick-planner \.quick-planner-mode-switch button\.is-active:active\s*\{\s*background:\s*rgba\(var\(--planner-accent-rgb\), 0\.06\);/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner \.quick-planner-mode-switch button\.is-active,[\s\S]*?button\.is-active:active\s*\{\s*color:\s*#f0f4f6;\s*border-color:\s*#74828b;\s*background:\s*#354047;/,
      );
    });
  it('uses the editor hover tint on Planner controls and Activity buttons in light theme', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner-workbench \.quick-planner-mode-switch button:is\(:hover, :focus-visible\),[\s\S]*?\.quick-planner-workbench \.quick-planner-tools button:is\(:hover, :focus-visible, \.is-active\),[\s\S]*?\.quick-planner-workbench \.quick-planner-clear-message:is\(:hover, :focus-visible\):not\(:disabled\),[\s\S]*?\.quick-planner-workbench \.quick-planner-schedule-row button:not\(\.quick-planner-submit\):not\(\.is-readonly\):is\(:hover, :focus-visible\):not\(:disabled\)\s*\{\s*border-color:\s*#91afbf !important;\s*background:\s*#d7e6ed !important;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner-activity \.quick-planner-activity-period-option:hover:not\(\.is-active\),\s*html\[data-theme='light'\] \.quick-planner-activity \.quick-planner-activity-view:hover:not\(\.is-active\)\s*\{\s*border-color:\s*#91afbf !important;\s*background:\s*#d7e6ed !important;[^}]*box-shadow:\s*0 2px 6px rgba\(34, 47, 58, 0\.18\), inset 0 0 0 1px rgba\(71, 124, 158, 0\.12\) !important;/,
      );
    });
  it('keeps inactive Planner modes transparent while retaining the switch surface', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner-mode-switch\s*\{[^}]*border-color:\s*rgba\(110, 166, 202, 0\.1\);[^}]*background:\s*linear-gradient\(180deg, rgba\(32, 40, 46, 0\.32\), rgba\(28, 36, 42, 0\.38\)\);/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner-mode-switch button:hover:not\(\.is-active\),[\s\S]*?focus-visible:not\(\.is-active\)\s*\{[^}]*color:\s*#e0e6ea;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme\] \.quick-planner-workbench \.quick-planner-mode-switch button:not\(\.is-active\),[\s\S]*?button:not\(\.is-active\):active\s*\{\s*background:\s*transparent !important;\s*background-image:\s*none !important;\s*box-shadow:\s*none !important;/,
      );
    });
  it('uses a neutral selected background for dark Planner action modes', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner-mode-switch button\.is-active\s*\{[^}]*border-color:\s*#74828b;[^}]*background:\s*#354047;[^}]*color:\s*#f0f4f6;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner-date-picker-grid button\.is-selected,\s*html\[data-theme='dark'\] \.quick-planner-time-list button\[aria-selected='true'\]\s*\{[^}]*background:\s*#1a4d73;[^}]*color:\s*#eaf7ff;/,
      );
    });
  it('uses glass surfaces for dark date and time popovers while keeping selected values distinct', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner-schedule-popover,[\s\S]*?html\[data-theme='dark'\] \.workspace-page-schedule-time-menu\s*\{[\s\S]*?backdrop-filter:\s*blur\(16px\) saturate\(135%\) !important;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner-date-picker-grid button:not\(\.is-selected\):not\(:disabled\),\s*html\[data-theme='dark'\] \.quick-planner-time-list button:not\(\[aria-selected='true'\]\):not\(:disabled\)\s*\{\s*border-color:\s*rgba\(215, 230, 240, 0\.08\) !important;\s*background:\s*rgba\(15, 21, 26, 0\.42\) !important;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner-date-picker-grid button\.is-selected,\s*html\[data-theme='dark'\] \.quick-planner-time-list button\[aria-selected='true'\]\s*\{[^}]*background:\s*#1a4d73;/,
      );
    });
  it('gives date and time options a visible border on hover and focus', () => {
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner-date-picker-grid button:hover:not\(:disabled\),[\s\S]*?html\[data-theme='dark'\] \.workspace-page-schedule-time-picker button:focus-visible:not\(:disabled\)[\s\S]*?\{\s*border:\s*1px solid rgba\(124, 195, 255, 0\.82\) !important;[\s\S]*?background:\s*rgba\(35, 157, 251, 0\.2\) !important;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner-date-picker-grid button:hover:not\(:disabled\),[\s\S]*?html\[data-theme='light'\] \.workspace-page-schedule-time-picker button:focus-visible:not\(:disabled\)[\s\S]*?\{\s*border:\s*1px solid #477c9e !important;[\s\S]*?background:\s*rgba\(71, 124, 158, 0\.14\) !important;/,
      );
    });
  it('matches the light-theme publish button to the activity graph line', () => {
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner \.quick-planner-submit:not\(:disabled\)\s*\{\s*border-color:\s*var\(--planner-accent\);\s*background:\s*var\(--planner-accent\);\s*color:\s*#ffffff;/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner \.quick-planner-submit:hover:not\(:disabled\),\s*html\[data-theme='light'\] \.quick-planner \.quick-planner-submit:focus-visible:not\(:disabled\)\s*\{\s*border-color:\s*#168de8;\s*background:\s*#168de8;\s*color:\s*#ffffff;/,
      );
      expect(activityStyles).toMatch(
        /\.quick-planner-activity-chart\s*\{\s*--activity-chart-color:\s*var\(--planner-accent,\s*#477c9e\);/,
      );
      expect(activityStyles).not.toMatch(
        /html:not\(\[data-theme='dark'\]\) \.quick-planner-activity-chart\s*\{\s*--activity-chart-color:\s*#78aec4;/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme='dark'\] \.quick-planner \.quick-planner-mode-switch button\.is-active,[\s\S]*?background:\s*#354047;/,
      );
    });
});
