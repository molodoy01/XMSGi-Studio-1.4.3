import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chat, ScheduledMessage } from '@/types';
import {
  flushPlannerDraftWrite,
  readPlannerDraftAttachments,
  readPlannerDraftRecoveryStack,
  writePlannerDraft,
} from '../lib/plannerDraft';
import { QuickPlanner } from './QuickPlanner';
import { QuickPlannerNavigationContext } from '../workspace/QuickPlannerNavigationContext';
import { quickPlannerStyles, render } from './QuickPlanner.testUtils';

describe("QuickPlanner feedback: actions and scheduling", () => {
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
  it('forwards send, schedule, and draft actions to Posts callbacks', async () => {
      const chat: Chat = { id: 'chat-1', name: 'Studio channel', type: 'channel' };
      Object.defineProperty(window, 'telegram', {
        configurable: true,
        value: {
          getAvailableEffects: vi.fn().mockResolvedValue({
            success: true,
            effects: [
              { id: '111', emoticon: '🔥', premiumRequired: false },
              { id: '222', emoticon: '🎉', premiumRequired: false },
            ],
          }),
          getFilePath: vi.fn((file: File) => `C:/photos/${file.name}`),
        },
      });

      const onSendNow = vi.fn().mockResolvedValue(true);
      const onSchedule = vi.fn().mockResolvedValue(true);
      const onSaveDraft = vi.fn().mockReturnValue(true);
      const openPosts = vi.fn();
      const { container } = render(
        <QuickPlannerNavigationContext.Provider value={{
          currentSection: 'quick-plan',
          openQuickPlan: vi.fn(),
          openStudio: vi.fn(),
          openPosts,
          openSettings: vi.fn(),
        }}>
          <QuickPlanner
            chats={[chat]}
            selectedChat={chat}
            onSendNow={onSendNow}
            onSchedule={onSchedule}
            onSaveDraft={onSaveDraft}
          />
        </QuickPlannerNavigationContext.Provider>,
      );
      await act(async () => { await Promise.resolve(); });
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      const submit = () => container.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit')!;
      const addPhoto = (name: string) => fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, {
        target: { files: [new File(['photo'], name, { type: 'image/png' })] },
      });
      const selectEffect = (name: string) => {
        fireEvent.click(screen.getByRole('button', { name: 'Message effects' }));
        fireEvent.click(screen.getByRole('button', { name }));
      };
  
      selectEffect('effect 🔥');
      fireEvent.change(editor, { target: { value: 'Send from Planner' } });
      addPhoto('send.png');
      fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
      await act(async () => {
        fireEvent.click(submit());
        await Promise.resolve();
      });
      expect(onSendNow).toHaveBeenCalledWith(chat, 'Send from Planner', ['C:/photos/send.png'], '111', []);
      expect(openPosts).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Message effects' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('status')).toHaveClass('is-success');
      expect(screen.getByRole('status')).toHaveTextContent('Message sent.');
      expect(screen.getByRole('status')).not.toHaveTextContent('Posts');
  
      fireEvent.change(editor, { target: { value: 'Schedule from Planner' } });
      addPhoto('schedule.png');
      fireEvent.click(within(screen.getByRole('group', { name: 'Planner actions' })).getByRole('button', { name: 'Schedule' }));
      selectEffect('effect 🎉');
      await act(async () => {
        fireEvent.click(submit());
        await Promise.resolve();
      });
      expect(onSchedule).not.toHaveBeenCalled();
      expect(screen.getByRole('status')).toHaveClass('is-warning');
      await act(async () => {
        fireEvent.click(submit());
        await Promise.resolve();
      });
      expect(onSchedule).toHaveBeenCalledWith(expect.objectContaining({
        chatId: chat.id,
        message: 'Schedule from Planner',
        date: expect.any(String),
        time: expect.any(String),
        attachments: ['C:/photos/schedule.png'],
        effect: '222',
        entities: [],
      }));
      expect(openPosts).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Message effects' })).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('status')).toHaveClass('is-success');
      expect(screen.getByRole('status')).toHaveTextContent('Schedule request sent.');
      expect(screen.getByRole('status')).not.toHaveTextContent('Posts');
  
      fireEvent.change(editor, { target: { value: 'Save from Planner' } });
      fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
      await act(async () => {
        fireEvent.click(submit());
        await Promise.resolve();
      });
      expect(onSaveDraft).toHaveBeenCalledWith({
        message: 'Save from Planner',
        attachments: [],
        entities: [],
        selectedChat: chat,
      });
      expect(openPosts).not.toHaveBeenCalled();
      expect(screen.getByRole('status')).toHaveTextContent('Draft saved.');
      expect(screen.getByRole('status')).not.toHaveTextContent('Posts');
    });
  it('restores all Planner schedule data and retains it when the replacement fails', async () => {
    const chat: Chat = { id: 'chat-1', name: 'Studio channel', type: 'channel' };
    const when = new Date(Date.now() + 2 * 60 * 60 * 1000);
    when.setSeconds(0, 0);
    const original: ScheduledMessage = {
      id: 'planner-schedule-1',
      chatId: chat.id,
      chatName: chat.name,
      text: 'Bold reminder',
      when: when.toISOString(),
      createdAt: new Date().toISOString(),
      status: 'scheduled',
      telegramMessageId: 'telegram-planner-1',
      attachments: ['C:/photos/reminder.png'],
      entities: [{ type: 'bold', offset: 0, length: 4 }],
      silent: true,
      effect: 'fire',
    };
    const onSchedule = vi.fn().mockResolvedValue(false);
    const { container } = render(
      <QuickPlanner
        chats={[chat]}
        selectedChat={chat}
        onSchedule={onSchedule}
        draftLoadRequest={{
          revision: 1,
          text: original.text,
          attachments: original.attachments ?? [],
          entities: original.entities ?? [],
          restoreDraft: null,
          rescheduleMessage: original,
        }}
      />,
    );
    const submit = container.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit')!;
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('textbox', { name: 'Reminder text' })).toHaveValue(original.text);

    await act(async () => {
      fireEvent.click(submit);
      await Promise.resolve();
    });
    expect(onSchedule).toHaveBeenCalledWith({
      chatId: chat.id,
      message: original.text,
      date: `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`,
      time: `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`,
      attachments: original.attachments,
      effect: original.effect,
      entities: original.entities,
      silent: true,
      replaceMessage: original,
    });
    expect(screen.getByRole('textbox', { name: 'Reminder text' })).toHaveValue(original.text);
    expect(screen.getByRole('alert')).toHaveClass('is-error');
  });
  it('keeps the active text and recovery queue when scheduling fails', async () => {
    const chat: Chat = { id: 'chat-recovery-schedule', name: 'Recovery chat', type: 'channel' };
    writePlannerDraft('Previous draft');
    flushPlannerDraftWrite();
    const onSchedule = vi.fn().mockResolvedValue(false);
    const { container } = render(
      <QuickPlanner
        chats={[chat]}
        selectedChat={chat}
        onSchedule={onSchedule}
        draftLoadRequest={{
          revision: 1,
          text: 'Current draft',
          attachments: ['C:/current/photo.png'],
          entities: [{ type: 'bold', offset: 0, length: 7 }],
          restoreDraft: null,
        }}
      />,
    );
    const editor = screen.getByRole('textbox', { name: 'Reminder text' });
    const submit = container.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit')!;
    fireEvent.click(within(screen.getByRole('group', { name: 'Planner actions' })).getByRole('button', { name: 'Schedule' }));
    await act(async () => {
      fireEvent.click(submit);
      fireEvent.click(submit);
      await Promise.resolve();
    });

    expect(onSchedule).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Current draft',
      attachments: ['C:/current/photo.png'],
      entities: [{ type: 'bold', offset: 0, length: 7 }],
    }));
    expect(editor).toHaveValue('Current draft');
    expect(readPlannerDraftRecoveryStack().map((draft) => draft.text)).toEqual(['Previous draft']);
  });
  it('keeps Planner text and photos when Telegram rejects sending or scheduling', async () => {
      const chat: Chat = { id: 'chat-1', name: 'Studio channel', type: 'channel' };
      const onSendNow = vi.fn().mockResolvedValue(false);
      const onSchedule = vi.fn().mockResolvedValue(false);
      const openPosts = vi.fn();
      Object.defineProperty(window, 'telegram', {
        configurable: true,
        value: { getFilePath: vi.fn((file: File) => `C:/photos/${file.name}`) },
      });
      const { container } = render(
        <QuickPlannerNavigationContext.Provider value={{
          currentSection: 'quick-plan',
          openQuickPlan: vi.fn(),
          openStudio: vi.fn(),
          openPosts,
          openSettings: vi.fn(),
        }}>
          <QuickPlanner chats={[chat]} selectedChat={chat} onSendNow={onSendNow} onSchedule={onSchedule} />
        </QuickPlannerNavigationContext.Provider>,
      );
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      const addPhoto = (name: string) => fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, {
        target: { files: [new File(['photo'], name, { type: 'image/png' })] },
      });
      const submit = () => container.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit')!;
  
      fireEvent.change(editor, { target: { value: 'Keep this send' } });
      addPhoto('failed-send.png');
      fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
      await act(async () => { fireEvent.click(submit()); await Promise.resolve(); });
      expect(onSendNow).toHaveBeenCalledWith(chat, 'Keep this send', ['C:/photos/failed-send.png'], undefined, []);
      expect(editor).toHaveValue('Keep this send');
      expect(screen.getByText('failed-send.png')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Message was not sent.');
      expect(screen.getByRole('alert')).not.toHaveTextContent('Posts');
  
      fireEvent.click(within(screen.getByRole('group', { name: 'Planner actions' })).getByRole('button', { name: 'Schedule' }));
      await act(async () => { fireEvent.click(submit()); await Promise.resolve(); });
      expect(onSchedule).not.toHaveBeenCalled();
      await act(async () => { fireEvent.click(submit()); await Promise.resolve(); });
      expect(onSchedule).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Keep this send',
        attachments: ['C:/photos/failed-send.png'],
      }));
      expect(editor).toHaveValue('Keep this send');
      expect(screen.getByText('failed-send.png')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Message could not be scheduled.');
      expect(screen.getByRole('alert')).not.toHaveTextContent('Posts');
      expect(openPosts).not.toHaveBeenCalled();
    });
  it('keeps Planner content and warns when Telegram sent but history persistence failed', async () => {
      vi.setSystemTime(new Date(2026, 9, 19, 10, 10, 0));
      const chat: Chat = { id: 'chat-history-failure', name: 'History failure chat' };
      const onSendNow = vi.fn().mockResolvedValue('sent-history-failed');
      const { container } = render(
        <QuickPlanner chats={[chat]} selectedChat={chat} onSendNow={onSendNow} />,
      );
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      const submit = () => container.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit')!;
  
      fireEvent.change(editor, { target: { value: 'Keep confirmed message' } });
      fireEvent.click(screen.getByRole('button', { name: 'NOW' }));
      fireEvent.click(screen.getByRole('button', { name: 'Choose time' }));
      fireEvent.click(within(screen.getByRole('dialog', { name: 'Schedule time picker' })).getByRole('option', { name: '10:45' }));
      fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
      await act(async () => { fireEvent.click(submit()); await Promise.resolve(); });
  
      expect(onSendNow).toHaveBeenCalledWith(chat, 'Keep confirmed message', undefined, undefined, []);
      expect(editor).toHaveValue('Keep confirmed message');
      expect(screen.getByRole('status')).toHaveClass('is-warning');
      expect(screen.getByRole('status')).toHaveTextContent('Message history could not be saved.');
      expect(screen.getByRole('status')).not.toHaveClass('is-success');
      expect(screen.getByRole('button', { name: 'Choose time' })).toHaveTextContent('10:11');
    });
  it('uses the first chat-name letter in placeholder avatars', () => {
      const chat: Chat = { id: 'chat-1', name: 'Design group', type: 'group' };
      const { container } = render(<QuickPlanner chats={[chat]} selectedChat={chat} />);
  
      expect(container.querySelector('.quick-planner-chat > .quick-planner-chat-avatar')).toHaveTextContent('D');
      fireEvent.click(container.querySelector('.quick-planner-chat')!);
      const chatOptionList = container.querySelector<HTMLElement>('.quick-planner-chat-options')!;
      const chatOption = within(chatOptionList).getByRole('option', { name: /Design group/ });
      expect(chatOption.querySelector('.quick-planner-chat-avatar')).toHaveTextContent('D');
    });
  it('warns instead of opening Studio when draft text is empty', () => {
      const openStudio = vi.fn();
      render(
        <QuickPlannerNavigationContext.Provider value={{
          currentSection: 'quick-plan',
          openQuickPlan: vi.fn(),
          openStudio,
          openPosts: vi.fn(),
          openSettings: vi.fn(),
        }}>
          <QuickPlanner />
        </QuickPlannerNavigationContext.Provider>,
      );
  
      fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
      fireEvent.click(screen.getByRole('button', { name: 'Open in Studio' }));
  
      expect(screen.getByRole('status')).toHaveTextContent('Write a message before opening Studio.');
      expect(openStudio).not.toHaveBeenCalled();
    });
  it('opens Studio when draft text is present', () => {
      const openStudio = vi.fn();
      const onOpenInStudio = vi.fn();
      render(
        <QuickPlannerNavigationContext.Provider value={{
          currentSection: 'quick-plan',
          openQuickPlan: vi.fn(),
          openStudio,
          openPosts: vi.fn(),
          openSettings: vi.fn(),
        }}>
          <QuickPlanner onOpenInStudio={onOpenInStudio} />
        </QuickPlannerNavigationContext.Provider>,
      );
  
      fireEvent.change(screen.getByRole('textbox', { name: 'Reminder text' }), {
        target: { value: 'Write the next idea' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
      fireEvent.click(screen.getByRole('button', { name: 'Open in Studio' }));
  
      expect(onOpenInStudio).toHaveBeenCalledWith({
        text: 'Write the next idea',
        attachments: [],
        entities: [],
      });
      expect(openStudio).not.toHaveBeenCalled();
    });
  it('returns to Studio when Escape is pressed in Quick Planner', () => {
      const openStudio = vi.fn();
      render(
        <QuickPlannerNavigationContext.Provider value={{
          currentSection: 'quick-plan',
          openQuickPlan: vi.fn(),
          openStudio,
          openPosts: vi.fn(),
          openSettings: vi.fn(),
        }}>
          <>
            <div className="topbar">
              <button type="button" className="settings-action">Posts</button>
            </div>
            <QuickPlanner />
          </>
        </QuickPlannerNavigationContext.Provider>,
      );
      const topbarAction = screen.getByRole('button', { name: 'Posts' });
      topbarAction.focus();
  
      fireEvent.keyDown(document, { key: 'Escape' });
  
      expect(openStudio).toHaveBeenCalledOnce();
      expect(document.activeElement).not.toBe(topbarAction);
    });
  it('closes an open Planner picker before Escape returns to Studio', () => {
      const openStudio = vi.fn();
      render(
        <QuickPlannerNavigationContext.Provider value={{
          currentSection: 'quick-plan',
          openQuickPlan: vi.fn(),
          openStudio,
          openPosts: vi.fn(),
          openSettings: vi.fn(),
        }}>
          <QuickPlanner />
        </QuickPlannerNavigationContext.Provider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Message effects' }));
      expect(screen.getByRole('dialog', { name: 'Message effects' })).toBeInTheDocument();
  
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog', { name: 'Message effects' })).not.toBeInTheDocument();
      expect(openStudio).not.toHaveBeenCalled();
  
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(openStudio).toHaveBeenCalledOnce();
    });
  it('passes selected attachment paths when opening Studio from Planner', () => {
      const previousTelegram = Object.getOwnPropertyDescriptor(window, 'telegram');
      Object.defineProperty(window, 'telegram', {
        configurable: true,
        value: { getFilePath: vi.fn((file: File) => `C:/photos/${file.name}`) },
      });
      const onOpenInStudio = vi.fn();
      const { container } = render(<QuickPlanner onOpenInStudio={onOpenInStudio} />);
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      fireEvent.change(editor, { target: { value: 'Photo caption' } });
      fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, {
        target: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
      fireEvent.click(screen.getByRole('button', { name: 'Open in Studio' }));
  
      expect(onOpenInStudio).toHaveBeenCalledWith({
        text: 'Photo caption',
        attachments: ['C:/photos/photo.png'],
        entities: [],
      });
  
      if (previousTelegram) Object.defineProperty(window, 'telegram', previousTelegram);
      else Reflect.deleteProperty(window, 'telegram');
    });
  it('opens Studio with a photo even when the Planner caption is empty', () => {
      Object.defineProperty(window, 'telegram', {
        configurable: true,
        value: { getFilePath: vi.fn((file: File) => `C:/photos/${file.name}`) },
      });
      const onOpenInStudio = vi.fn();
      const { container } = render(<QuickPlanner onOpenInStudio={onOpenInStudio} />);
      fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, {
        target: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
      fireEvent.click(screen.getByRole('button', { name: 'Open in Studio' }));
  
      expect(onOpenInStudio).toHaveBeenCalledWith({
        text: '',
        attachments: ['C:/photos/photo.png'],
        entities: [],
      });
    });
  it('keeps selected photos separate in Planner until the user explicitly opens Studio', () => {
      const getFilePath = vi.fn((file: File) => `C:/photos/${file.name}`);
      Object.defineProperty(window, 'telegram', {
        configurable: true,
        value: { getFilePath },
      });
      const onOpenInStudio = vi.fn();
      const { container } = render(<QuickPlanner onOpenInStudio={onOpenInStudio} />);
      fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, {
        target: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] },
      });
  
      expect(screen.getByText('photo.png')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('File added.');
      expect(screen.getByRole('status')).not.toHaveTextContent('Studio');
      expect(onOpenInStudio).not.toHaveBeenCalled();
      const emojiTool = screen.getByRole('button', { name: 'Open emoji window' }).closest('.quick-planner-tool-anchor');
      const attachmentPanel = emojiTool?.nextElementSibling;
      expect(attachmentPanel).toHaveClass('quick-planner-attachments');
      expect(attachmentPanel?.querySelector('.quick-planner-attachments-scrollbar')).toBeInTheDocument();
      expect(attachmentPanel?.querySelector('.quick-planner-attachment-list')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove photo.png' })).toBeInTheDocument();
      expect(readPlannerDraftAttachments()).toEqual(['C:/photos/photo.png']);
      fireEvent.click(screen.getByRole('button', { name: 'Remove photo.png' }));
      expect(screen.queryByText('photo.png')).not.toBeInTheDocument();
      expect(readPlannerDraftAttachments()).toEqual([]);
      expect(onOpenInStudio).not.toHaveBeenCalled();
    });
  it('adds a pasted clipboard image as a Planner attachment and leaves text paste enabled', async () => {
      const copyAttachment = vi.fn(async (file: File) => ({
        success: true,
        attachment: { name: 'clipboard-photo.png', path: 'C:/drafts/clipboard-photo.png', size: file.size },
      }));
      Object.defineProperty(window, 'draftStorage', {
        configurable: true,
        value: { load: vi.fn(), copyAttachment },
      });
      const { container } = render(<QuickPlanner />);
      const editor = container.querySelector<HTMLTextAreaElement>('.quick-planner-message')!;
      const image = new File(['image-bytes'], 'clipboard-photo.png', { type: 'image/png' });
      const paste = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(paste, 'clipboardData', {
        value: {
          items: [{ kind: 'file', type: 'image/png', getAsFile: () => image }],
          files: [image],
          getData: (type: string) => type === 'text/plain' ? 'copied caption' : '',
        },
      });
  
      await act(async () => {
        editor.dispatchEvent(paste);
        await Promise.resolve();
      });
  
      expect(paste.defaultPrevented).toBe(false);
      expect(copyAttachment).toHaveBeenCalledWith(image);
      expect(screen.getByRole('button', { name: 'Remove clipboard-photo.png' })).toBeInTheDocument();
      expect(readPlannerDraftAttachments()).toEqual(['C:/drafts/clipboard-photo.png']);
    });
  it('selects a Planner line on a triple click and all text on a fourth click', () => {
      const { container } = render(<QuickPlanner />);
      const editor = container.querySelector<HTMLTextAreaElement>('.quick-planner-message')!;
      const message = 'First line\nSecond line\nThird line';
      fireEvent.change(editor, { target: { value: message } });
  
      editor.setSelectionRange(14, 20);
      fireEvent.click(editor, { detail: 3 });
      expect(editor.value.slice(editor.selectionStart, editor.selectionEnd)).toBe('Second line');
  
      fireEvent.click(editor, { detail: 4 });
      expect(editor.selectionStart).toBe(0);
      expect(editor.selectionEnd).toBe(message.length);
    });
  it('accepts file drops on the text field and highlights it while dragging', () => {
      const getFilePath = vi.fn((file: File) => `C:/photos/${file.name}`);
      Object.defineProperty(window, 'telegram', {
        configurable: true,
        value: { getFilePath },
      });
      render(<QuickPlanner />);
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      const file = new File(['photo'], 'dropped.png', { type: 'image/png' });
      const dataTransfer = {
        files: [file],
        types: ['Files'],
        dropEffect: 'none',
      };
  
      fireEvent.dragEnter(editor, { dataTransfer });
      expect(editor).toHaveClass('is-file-drag-over');
      fireEvent.dragOver(editor, { dataTransfer });
      fireEvent.drop(editor, { dataTransfer });
  
      expect(editor).not.toHaveClass('is-file-drag-over');
      expect(editor).toHaveValue('');
      expect(screen.getByText('dropped.png')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('File added.');
      expect(getFilePath).toHaveBeenCalledWith(file);
      expect(readPlannerDraftAttachments()).toEqual(['C:/photos/dropped.png']);
    });
  it('limits Planner attachments to ten and reports the limit', () => {
      Object.defineProperty(window, 'telegram', {
        configurable: true,
        value: { getFilePath: vi.fn((file: File) => `C:/photos/${file.name}`) },
      });
      const { container } = render(<QuickPlanner />);
      const files = Array.from({ length: 12 }, (_, index) => (
        new File([`photo-${index}`], `photo-${index}.png`, { type: 'image/png' })
      ));
      fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, {
        target: { files },
      });
  
      expect(container.querySelectorAll('.quick-planner-attachment')).toHaveLength(10);
      expect(screen.getByRole('status')).toHaveTextContent('Max 10 files per message.');
      expect(screen.getByRole('status')).toHaveClass('is-warning');
    });
  it('shows the attachment scrollbar only when the chips overflow', () => {
      Object.defineProperty(window, 'telegram', {
        configurable: true,
        value: { getFilePath: vi.fn((file: File) => `C:/photos/${file.name}`) },
      });
      const { container } = render(<QuickPlanner />);
      fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, {
        target: { files: [
          new File(['one'], 'one.png', { type: 'image/png' }),
          new File(['two'], 'two.png', { type: 'image/png' }),
        ] },
      });
      const panel = container.querySelector('.quick-planner-attachments')!;
      const list = panel.querySelector('.quick-planner-attachment-list') as HTMLDivElement;
  
      const scrollbar = panel.querySelector('.quick-planner-attachments-scrollbar') as HTMLDivElement;
      expect(list).toBeInTheDocument();
      expect(panel).not.toHaveClass('has-overflow');
      expect(quickPlannerStyles).toMatch(/\.quick-planner-attachments:not\(\.has-overflow\)\s+\.quick-planner-attachments-scrollbar\s*\{\s*display:\s*none;/);
      expect(quickPlannerStyles).toMatch(/\.quick-planner-attachment\s*\{[^}]*border:\s*1px solid #c5d0d9;/);
  
      Object.defineProperty(list, 'scrollWidth', { configurable: true, value: 600 });
      Object.defineProperty(list, 'clientWidth', { configurable: true, value: 250 });
      Object.defineProperty(list, 'scrollLeft', { value: 0, writable: true, configurable: true });
      fireEvent.resize(window);
  
      expect(panel).toHaveClass('has-overflow');
      expect(scrollbar).toHaveAttribute('role', 'scrollbar');
      fireEvent.keyDown(list, { key: 'ArrowRight', code: 'ArrowRight' });
      expect(list.scrollLeft).toBeGreaterThan(0);
    });
  it('passes the selected Telegram effect when opening Studio from Planner', async () => {
      Object.defineProperty(window, 'telegram', {
        configurable: true,
        value: {
          getAvailableEffects: vi.fn().mockResolvedValue({
            success: true,
            effects: [{ id: '123456789', emoticon: '🎉', premiumRequired: false }],
          }),
        },
      });
      const onOpenInStudio = vi.fn();
      render(<QuickPlanner onOpenInStudio={onOpenInStudio} />);
      await act(async () => { await Promise.resolve(); });
      fireEvent.change(screen.getByRole('textbox', { name: 'Reminder text' }), {
        target: { value: 'Effect caption' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Message effects' }));
      const effects = screen.getByRole('group', { name: 'Choose message effect' });
      fireEvent.click(within(effects).getByRole('button', { name: 'effect 🎉' }));
      fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
      fireEvent.click(screen.getByRole('button', { name: 'Open in Studio' }));
  
      expect(onOpenInStudio).toHaveBeenCalledWith({
        text: 'Effect caption',
        attachments: [],
        entities: [],
        effect: '123456789',
      });
    });
  it('starts one minute ahead and clamps manually entered past times', () => {
      vi.setSystemTime(new Date(2026, 9, 19, 10, 10, 0));
      render(<QuickPlanner />);
      const timeTrigger = screen.getByRole('button', { name: 'Choose time' });
  
      expect(timeTrigger).toHaveTextContent('10:11');
      fireEvent.click(timeTrigger);
      fireEvent.change(screen.getByRole('textbox', { name: 'Enter schedule time' }), {
        target: { value: '09:00' },
      });
  
      expect(timeTrigger).toHaveTextContent('10:11');
    });
  it('keeps the selected schedule time fixed when the clock advances', () => {
      vi.setSystemTime(new Date(2026, 9, 19, 10, 14, 0));
      render(<QuickPlanner />);
      const timeTrigger = screen.getByRole('button', { name: 'Choose time' });
  
      expect(timeTrigger).toHaveTextContent('10:15');
      act(() => vi.advanceTimersByTime(60_025));
  
      expect(timeTrigger).toHaveTextContent('10:15');
    });
  it('warns once when schedule time has not been touched, then allows the second submit', async () => {
      vi.setSystemTime(new Date(2026, 9, 19, 10, 10, 0));
      const chat: Chat = { id: 'chat-1', name: 'Studio channel', type: 'channel' };
      const onSchedule = vi.fn().mockResolvedValue(true);
      const { container } = render(<QuickPlanner chats={[chat]} selectedChat={chat} onSchedule={onSchedule} />);
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      const submit = container.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit')!;
  
      fireEvent.change(editor, { target: { value: 'Schedule without selecting a time' } });
  
      await act(async () => {
        fireEvent.click(submit);
        await Promise.resolve();
      });
  
      expect(onSchedule).not.toHaveBeenCalled();
      expect(screen.getByRole('status')).toHaveClass('is-warning');
      expect(screen.getByRole('status')).toHaveTextContent('Schedule now? Press again to confirm.');
  
      await act(async () => {
        fireEvent.click(submit);
        await Promise.resolve();
      });
  
      expect(onSchedule).toHaveBeenCalledTimes(1);
    });
  it('keeps the date and time fields aligned in Send now without opening pickers', () => {
      render(<QuickPlanner />);
      fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
      const dateTrigger = screen.getByRole('button', { name: 'Choose date' });
      const timeTrigger = screen.getByRole('button', { name: 'Choose time' });
  
      expect(dateTrigger).toHaveClass('is-readonly');
      expect(timeTrigger).toHaveClass('is-readonly');
      expect(dateTrigger).toHaveAttribute('aria-disabled', 'true');
      expect(timeTrigger).toHaveAttribute('aria-disabled', 'true');
      expect(dateTrigger.querySelector('svg:last-child')).toHaveStyle({ visibility: 'hidden' });
      expect(timeTrigger.querySelector('svg:last-child')).toHaveStyle({ visibility: 'hidden' });
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme\] \.quick-planner \.quick-planner-schedule-field > button\.is-readonly\s*\{\s*color:\s*var\(--planner-muted\);\s*\}/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme\] \.quick-planner \.quick-planner-schedule-field > button\.is-readonly svg\s*\{\s*color:\s*currentColor;\s*\}/,
      );
      expect(quickPlannerStyles).toMatch(
        /html\[data-theme\] \.quick-planner \.quick-planner-schedule-field > button\.is-readonly:hover,\s*html\[data-theme\] \.quick-planner \.quick-planner-schedule-field > button\.is-readonly:focus-visible,\s*html\[data-theme\] \.quick-planner \.quick-planner-schedule-field > button\.is-readonly:active\s*\{[^}]*border-color:\s*transparent;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;[^}]*outline:\s*none;[^}]*transform:\s*none;/,
      );
  
      fireEvent.click(dateTrigger);
      fireEvent.click(timeTrigger);
      expect(screen.queryByRole('dialog', { name: 'Choose schedule date' })).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Choose schedule time' })).not.toBeInTheDocument();
    });
  it('does not warn when NOW is selected before scheduling', async () => {
      vi.setSystemTime(new Date(2026, 9, 19, 10, 10, 0));
      const chat: Chat = { id: 'chat-1', name: 'Studio channel', type: 'channel' };
      const onSchedule = vi.fn().mockResolvedValue(true);
      const { container } = render(<QuickPlanner chats={[chat]} onSchedule={onSchedule} />);
  
      fireEvent.click(screen.getByRole('button', { name: 'NOW' }));
  
      expect(screen.getByRole('button', { name: 'Choose time' })).toHaveTextContent('10:11');
      fireEvent.change(screen.getByRole('textbox', { name: 'Reminder text' }), {
        target: { value: 'Schedule one minute from now' },
      });
      fireEvent.click(container.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit')!);
  
      expect(onSchedule).toHaveBeenCalledWith({
        chatId: 'chat-1',
        message: 'Schedule one minute from now',
        date: '2026-10-19',
        time: '10:11',
        entities: [],
      });
    });
  it('resets the schedule date and time after a successful schedule', async () => {
      vi.setSystemTime(new Date(2026, 9, 19, 10, 10, 0));
      const chat: Chat = { id: 'chat-1', name: 'Studio channel', type: 'channel' };
      const onSchedule = vi.fn().mockResolvedValue(true);
      const { container } = render(<QuickPlanner chats={[chat]} onSchedule={onSchedule} />);
  
      fireEvent.click(screen.getByRole('button', { name: 'NOW' }));
      fireEvent.click(screen.getByRole('button', { name: 'Choose time' }));
      const timePicker = screen.getByRole('dialog', { name: 'Schedule time picker' });
      fireEvent.click(within(timePicker).getByRole('option', { name: '10:45' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Reminder text' }), {
        target: { value: 'Schedule and reset the fields' },
      });
  
      await act(async () => {
        fireEvent.click(container.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit')!);
        await Promise.resolve();
      });
  
      expect(onSchedule).toHaveBeenCalledWith(expect.objectContaining({
        date: '2026-10-19',
        time: '10:45',
      }));
      expect(screen.getByRole('button', { name: 'Choose date' })).toHaveTextContent('Oct 19');
      expect(screen.getByRole('button', { name: 'Choose time' })).toHaveTextContent('10:11');
    });
  it('resets the schedule date and time after a successful immediate send', async () => {
      vi.setSystemTime(new Date(2026, 9, 19, 10, 10, 0));
      const chat: Chat = { id: 'chat-1', name: 'Studio channel', type: 'channel' };
      const onSendNow = vi.fn().mockResolvedValue(true);
      const { container } = render(<QuickPlanner chats={[chat]} onSendNow={onSendNow} />);
  
      fireEvent.click(screen.getByRole('button', { name: 'NOW' }));
      fireEvent.click(screen.getByRole('button', { name: 'Choose time' }));
      const timePicker = screen.getByRole('dialog', { name: 'Schedule time picker' });
      fireEvent.click(within(timePicker).getByRole('option', { name: '10:45' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Reminder text' }), {
        target: { value: 'Send and reset the fields' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
  
      await act(async () => {
        fireEvent.click(container.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit')!);
        await Promise.resolve();
      });
  
      expect(onSendNow).toHaveBeenCalledOnce();
      expect(screen.getByRole('button', { name: 'Choose date' })).toHaveTextContent('Oct 19');
      expect(screen.getByRole('button', { name: 'Choose time' })).toHaveTextContent('10:11');
    });
  it('opens the calendar and 15-minute time list above the schedule controls', () => {
      render(<QuickPlanner />);
      const dateButton = screen.getByRole('button', { name: 'Choose date' });
      const originalDate = dateButton.textContent;
  
      fireEvent.click(dateButton);
      const calendar = screen.getByRole('dialog', { name: 'Schedule date picker' });
      expect(calendar).toBeInTheDocument();
      fireEvent.click(within(calendar).getByRole('button', { name: 'Next month' }));
  
      const nextMonthDay = calendar.querySelector<HTMLButtonElement>('[aria-pressed="false"]:not(:disabled)');
      expect(nextMonthDay).not.toBeNull();
      fireEvent.click(nextMonthDay!);
      expect(screen.queryByRole('dialog', { name: 'Schedule date picker' })).not.toBeInTheDocument();
      expect(dateButton.textContent).not.toBe(originalDate);
      expect(dateButton.querySelector('span')).toHaveTextContent(/^[A-Z][a-z]{2} \d{1,2}( '\d{2})?$/);
  
      fireEvent.click(screen.getByRole('button', { name: 'Choose time' }));
      const timePicker = screen.getByRole('dialog', { name: 'Schedule time picker' });
      const editableTime = within(timePicker).getByRole('textbox', { name: 'Enter schedule time' }) as HTMLInputElement;
      expect(editableTime).toHaveFocus();
      expect(editableTime.selectionStart).toBe(editableTime.selectionEnd);
      const timeList = within(timePicker).getByRole('listbox', { name: 'Available times' });
      expect(within(timeList).getAllByRole('option')).toHaveLength(96);
  
      fireEvent.click(within(timeList).getByRole('option', { name: '09:15' }));
      expect(screen.queryByRole('dialog', { name: 'Schedule time picker' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Choose time' })).toHaveTextContent('09:15');
    });
});
