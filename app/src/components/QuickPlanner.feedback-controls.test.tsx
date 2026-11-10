import { createElement } from 'react';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chat } from '@/types';
import { LocaleProvider } from '@/lib/i18n';
import { DEFAULT_EDITOR_APPEARANCE, writeEditorAppearancePreferences } from '@shared/editorAppearance';
import { flushPlannerDraftWrite } from '../lib/plannerDraft';
import { QuickPlanner } from './QuickPlanner';
import { colorThemeStyles, render, createScheduledMessage } from './QuickPlanner.testUtils';

describe("QuickPlanner feedback: controls and emoji", () => {
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
  it('includes a newly received confirmed send even when the scheduling clock state is stale', () => {
      const initialTime = new Date('2035-05-12T12:00:00.000Z');
      vi.setSystemTime(initialTime);
      const view = render(<QuickPlanner sent={[]} />);
  
      const sentAt = new Date(initialTime.getTime() + 500).toISOString();
      vi.setSystemTime(new Date(initialTime.getTime() + 1000));
      view.rerender(createElement(LocaleProvider, null, createElement(QuickPlanner, {
        sent: [createScheduledMessage({ status: 'sent', sentAt })],
      })));
  
      expect(screen.getByRole('img', { name: 'Confirmed messages sent in the last 7 days: 1' })).toBeInTheDocument();
      expect(screen.queryByText('Nothing here yet.')).not.toBeInTheDocument();
    });
  it('does not present history load errors as an empty activity state', () => {
      render(<QuickPlanner historyReady={false} historyError />);
  
      expect(screen.getAllByText('Message history could not be loaded.')).toHaveLength(2);
      expect(screen.queryByText('Nothing here yet.')).not.toBeInTheDocument();
      expect(screen.queryByText('No upcoming messages.')).not.toBeInTheDocument();
    });
  it('shows a zero-count chart when saved sent records have no valid sentAt value', () => {
      render(<QuickPlanner sent={[
        createScheduledMessage({ id: 'missing-time', status: 'sent' }),
        createScheduledMessage({ id: 'invalid-time', status: 'sent', sentAt: 'invalid' }),
      ]} />);
  
      expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
      expect(screen.getByRole('img', { name: 'Confirmed messages sent in the last 7 days: 0' })).toBeInTheDocument();
      expect(screen.getByText('0', { selector: '.quick-planner-activity-total-count' })).toBeInTheDocument();
    });
  it('shows loading rather than empty states until history is restored', () => {
      render(<QuickPlanner historyReady={false} />);
  
      expect(screen.getByText('Loading activity…')).toBeInTheDocument();
      expect(screen.getByText('Loading upcoming messages…')).toBeInTheDocument();
    });
  it('shows only future scheduled messages in chronological order and updates with props', () => {
      vi.setSystemTime(new Date('2035-05-12T12:00:00.000Z'));
      const first = createScheduledMessage({
        id: 'first',
        chatName: 'First chat',
        text: 'First upcoming',
        when: '2035-05-12T13:00:00.000Z',
      });
      const second = createScheduledMessage({
        id: 'second',
        chatName: 'Second chat',
        text: 'Second upcoming',
        when: '2035-05-12T14:00:00.000Z',
      });
      const cancelled = createScheduledMessage({ id: 'cancelled', text: 'Cancelled record' });
      Object.assign(cancelled, { status: 'cancelled' });
      const view = render(<QuickPlanner upcoming={[
        second,
        first,
        createScheduledMessage({ id: 'past', text: 'Expired record', when: '2035-05-12T11:00:00.000Z' }),
        createScheduledMessage({ id: 'sent', status: 'sent', text: 'Sent record' }),
        createScheduledMessage({ id: 'failed', status: 'failed', text: 'Failed record' }),
        createScheduledMessage({ id: 'sending', status: 'sending', text: 'Sending record' }),
        createScheduledMessage({ id: 'unknown', status: 'unknown', text: 'Unknown record' }),
        createScheduledMessage({ id: 'pending', status: 'pending', text: 'Pending record' }),
        createScheduledMessage({ id: 'invalid', when: 'invalid-date', text: 'Invalid record' }),
        cancelled,
      ]} />);
  
      const items = view.container.querySelectorAll('.quick-planner-upcoming-item');
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent('First upcoming');
      expect(items[1]).toHaveTextContent('Second upcoming');
      for (const excluded of ['Expired record', 'Sent record', 'Failed record', 'Sending record', 'Unknown record', 'Pending record', 'Invalid record', 'Cancelled record']) {
        expect(screen.queryByText(excluded)).not.toBeInTheDocument();
      }
  
      view.rerender(createElement(LocaleProvider, null, createElement(QuickPlanner, {
        upcoming: [createScheduledMessage({ id: 'updated', text: 'Updated schedule', when: '2035-05-12T16:00:00.000Z' })],
      })));
      expect(screen.getByText('Updated schedule')).toBeInTheDocument();
      expect(screen.queryByText('First upcoming')).not.toBeInTheDocument();
    });
  it('formats upcoming ISO timestamps as the local scheduled instant', () => {
      const when = '2035-05-12T15:00:00.000Z';
      render(<QuickPlanner upcoming={[createScheduledMessage({ when })]} />);
  
      const displayedTime = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(when));
      expect(screen.getByText(displayedTime)).toBeInTheDocument();
      expect(screen.getByText(displayedTime)).toHaveAttribute('title', new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(when)));
    });
  it('keeps full long Upcoming labels available while displaying compact previews', () => {
      const chatName = 'A very long channel name that needs more than one line';
      const messageText = 'A detailed message preview that should remain available in full';
      render(<QuickPlanner upcoming={[createScheduledMessage({
        chatName,
        text: messageText,
      })]} />);
  
      expect(screen.getByText(chatName)).toHaveAttribute('title', chatName);
      expect(screen.getByText(messageText)).toHaveAttribute('title', messageText);
    });
  it('uses a translated content label for a scheduled attachment with no text', () => {
      render(<QuickPlanner upcoming={[createScheduledMessage({
        text: '',
        attachments: ['C:\\files\\image.png'],
      })]} />);
  
      expect(screen.getByText('Media message')).toBeInTheDocument();
      expect(screen.queryByText('undefined')).not.toBeInTheDocument();
    });
  it('restarts repeated validation warnings and dismisses them after the Studio timeout', () => {
      render(<QuickPlanner />);
      const submitButton = document.querySelector<HTMLButtonElement>('.quick-planner-schedule-row .quick-planner-submit')!;
  
      fireEvent.click(submitButton!);
      const firstStatus = screen.getByRole('status');
      expect(firstStatus).not.toHaveClass('is-retriggered');
      fireEvent.click(submitButton!);
      const repeatedStatus = screen.getByRole('status');
  
      expect(repeatedStatus).not.toBe(firstStatus);
      expect(repeatedStatus).toHaveClass('is-retriggered');
      expect(repeatedStatus).toHaveClass('is-warning');
      expect(repeatedStatus).toHaveClass('planner-inline-notification');
      expect(repeatedStatus.querySelector('svg')).toBeNull();
  
      act(() => vi.advanceTimersByTime(4999));
      expect(screen.getByRole('status')).toBeInTheDocument();
  
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
  
      fireEvent.click(submitButton);
      const nextStatus = screen.getByRole('status');
      expect(nextStatus).not.toHaveClass('is-retriggered');
      fireEvent.click(submitButton);
      expect(screen.getByRole('status')).toHaveClass('is-retriggered');
    });
  it('uses the Studio warning and success notification durations', () => {
      const chat: Chat = { id: 'chat-1', name: 'Test channel', type: 'channel' };
      const { container } = render(<QuickPlanner
        chats={[chat]}
        selectedChat={chat}
        onSaveDraft={() => true}
        onSchedule={async () => true}
      />);
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      const submitButton = () => container.querySelector<HTMLButtonElement>(
        '.quick-planner-schedule-row .quick-planner-submit',
      )!;
  
      fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
      fireEvent.click(submitButton());
  
      let status = screen.getByRole('status');
      expect(status).toHaveClass('is-warning');
      expect(status).toHaveClass('planner-inline-notification');
      act(() => vi.advanceTimersByTime(4999));
      expect(screen.getByRole('status')).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
  
      fireEvent.change(editor, {
        target: { value: 'Test status message' },
      });
  
      fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
      fireEvent.click(submitButton());
      status = screen.getByRole('status');
      expect(status).toHaveClass('is-success');
      act(() => vi.advanceTimersByTime(3359));
      expect(screen.getByRole('status')).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
  
    });
  it('shows fractional local timezone offsets without changing the timezone control width', () => {
      vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-345);
  
      const { container } = render(<QuickPlanner />);
      const timeZone = screen.getByText('GMT+5:45');
  
      expect(timeZone).toHaveClass('quick-planner-timezone');
      expect(container.querySelector('.quick-planner-timezone')?.textContent).toBe('GMT+5:45');
    });
  it('uses the default appearance accent in each theme when colors or action modes change', () => {
      const { container } = render(<QuickPlanner />);
      const planner = container.querySelector<HTMLElement>('.quick-planner')!;
      const modeGroup = screen.getByRole('group', { name: 'Planner actions' });
  
      expect(planner.style.getPropertyValue('--planner-accent')).toBe('#239dfb');
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.quick-planner\s*\{\s*--planner-accent:\s*#239dfb !important;\s*--planner-accent-rgb:\s*35,\s*157,\s*251 !important;/,
      );
  
      act(() => {
        writeEditorAppearancePreferences({
          style: 'outline',
          palette: 'custom',
          modeColors: { send: '#287fa6', schedule: '#b482f5', draft: '#f58b37' },
        });
      });
      expect(planner.style.getPropertyValue('--planner-accent')).toBe('#239dfb');
  
      fireEvent.click(within(modeGroup).getByRole('button', { name: 'Draft' }));
      expect(planner.style.getPropertyValue('--planner-accent')).toBe('#239dfb');
  
      fireEvent.click(within(modeGroup).getByRole('button', { name: 'Send now' }));
      expect(planner.style.getPropertyValue('--planner-accent')).toBe('#239dfb');
  
      act(() => writeEditorAppearancePreferences(DEFAULT_EDITOR_APPEARANCE));
      expect(planner.style.getPropertyValue('--planner-accent')).toBe('#239dfb');
    });
  it('removes group and channel chats from Planner through the existing remove callback', () => {
      const group: Chat = { id: 'group-1', name: 'Design group', type: 'group' };
      const channel: Chat = { id: 'channel-1', name: 'News channel', type: 'channel' };
      const onRemoveChat = vi.fn();
      const { container } = render(<QuickPlanner chats={[group, channel]} onRemoveChat={onRemoveChat} />);
  
      fireEvent.click(container.querySelector('.quick-planner-chat')!);
      fireEvent.click(screen.getByRole('button', { name: 'Remove Design group from Planner' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove News channel from Planner' }));
  
      expect(onRemoveChat).toHaveBeenNthCalledWith(1, group);
      expect(onRemoveChat).toHaveBeenNthCalledWith(2, channel);
    });
  it('clears reminder text with one click and returns focus to the editor', () => {
      render(<QuickPlanner />);
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      fireEvent.change(editor, { target: { value: 'A long reminder to erase' } });
  
      const clearButton = screen.getByRole('button', { name: 'Clear reminder text' });
      expect(clearButton.parentElement).toHaveClass('quick-planner-counter-controls');
      expect(clearButton.previousElementSibling).toHaveClass('quick-planner-character-count');
      expect(clearButton.querySelector('svg')).toHaveAttribute('width', '20');
      expect(clearButton.querySelector('svg')).toHaveAttribute('height', '20');
      editor.focus();
      fireEvent.mouseDown(clearButton);
      expect(editor).toHaveFocus();
      fireEvent.click(clearButton);
  
      expect(editor).toHaveValue('');
      expect(editor).toHaveFocus();
      expect(clearButton).toBeDisabled();
      expect(clearButton).toHaveAttribute('aria-hidden', 'true');
      expect(clearButton).toHaveClass('is-hidden');
    });
  it('opens the emoji picker 5px beside the smile button', () => {
      const { container } = render(<QuickPlanner />);
      const toolAnchors = container.querySelectorAll<HTMLElement>(
        '.quick-planner-tools > .quick-planner-tool-anchor',
      );
      vi.spyOn(toolAnchors[0], 'getBoundingClientRect').mockReturnValue(new DOMRect(80, 160, 48, 48));
      vi.spyOn(toolAnchors[2], 'getBoundingClientRect').mockReturnValue(new DOMRect(200, 160, 48, 48));
  
      fireEvent.click(screen.getByRole('button', { name: 'Open emoji window' }));
  
      expect(screen.getByRole('dialog', { name: 'Choose emoji' })).toHaveStyle({ left: '253px' });
    });
  it('loads Telegram effect IDs and selects a real message effect', async () => {
      const getAvailableEffects = vi.fn().mockResolvedValue({
        success: true,
        effects: [
          { id: '123456789', emoticon: '🎉', premiumRequired: false },
          { id: '223456789', emoticon: '👍', premiumRequired: false },
          { id: '323456789', emoticon: '👎', premiumRequired: false },
          { id: '423456789', emoticon: '🔥', premiumRequired: false },
          { id: '987654321', emoticon: '✨', premiumRequired: true },
        ],
      });
      Object.defineProperty(window, 'telegram', { configurable: true, value: { getAvailableEffects } });
      const onOpenInStudio = vi.fn();
      const { container } = render(<QuickPlanner onOpenInStudio={onOpenInStudio} />);
      await act(async () => { await Promise.resolve(); });
      expect(getAvailableEffects).toHaveBeenCalledOnce();
  
      expect(Array.from(container.querySelectorAll('.quick-planner-tools > .quick-planner-tool-anchor > button'))
        .map((button) => button.getAttribute('aria-label')))
        .toEqual(['Attach files', 'Message effects', 'Open emoji window']);
  
      const attachmentButton = screen.getByRole('button', { name: 'Attach files' });
      const effectsButton = screen.getByRole('button', { name: 'Message effects' });
      const emojiButton = screen.getByRole('button', { name: 'Open emoji window' });
      for (const button of [attachmentButton, effectsButton, emojiButton]) {
        expect(button.querySelector('svg')).toHaveAttribute('width', '24');
        expect(button.querySelector('svg')).toHaveAttribute('height', '24');
      }
      fireEvent.click(effectsButton);
      const effectsGrid = screen.getByRole('group', { name: 'Choose message effect' });
      expect(effectsGrid).toBeInTheDocument();
      expect(within(effectsGrid).getAllByRole('button').map((button) => button.getAttribute('aria-label')))
        .toEqual(['effect 🎉', 'effect 👍', 'effect 👎', 'No effect', 'effect 🔥']);
      expect(screen.queryByRole('button', { name: 'Premium effect ✨' })).not.toBeInTheDocument();
      const effectOption = screen.getByRole('button', { name: 'effect 🎉' });
      fireEvent.click(effectOption);
      expect(effectsButton).toHaveAttribute('aria-pressed', 'true');
      expect(effectsButton).toHaveAttribute('title', 'Message effects: 🎉');
      const selectedEffect = container.querySelector('.quick-planner-selected-effect');
      expect(selectedEffect).toHaveTextContent('🎉');
      expect(selectedEffect).toHaveAttribute('aria-label', 'Message effects: 🎉');
      expect(selectedEffect?.compareDocumentPosition(container.querySelector('.quick-planner-character-count')!))
        .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      fireEvent.click(effectsButton);
      const noEffectButton = screen.getByRole('button', { name: 'No effect' });
      expect(noEffectButton).toHaveAttribute('aria-pressed', 'false');
      fireEvent.click(noEffectButton);
      expect(effectsButton).toHaveAttribute('aria-pressed', 'false');
      expect(container.querySelector('.quick-planner-selected-effect')).not.toBeInTheDocument();
    });
  it('shows categorized emojis and inserts the chosen emoji at the cursor', () => {
      render(<QuickPlanner />);
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      fireEvent.change(editor, { target: { value: 'Good day' } });
      (editor as HTMLTextAreaElement).setSelectionRange(4, 4);
  
      fireEvent.click(screen.getByRole('button', { name: 'Open emoji window' }));
      const emojiPicker = screen.getByRole('dialog', { name: 'Choose emoji' });
      expect(emojiPicker).toHaveClass('quick-planner-emoji-picker');
      expect(emojiPicker.parentElement).toBe(document.body);
      fireEvent.click(screen.getByRole('tab', { name: 'Hearts' }));
      expect(screen.getByRole('group', { name: 'Hearts emoji' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Insert ❤️' }));
  
      expect(editor).toHaveValue('Good❤️ day');
      expect(screen.queryByRole('dialog', { name: 'Choose emoji' })).not.toBeInTheDocument();
    });
  it('persists the six latest unique emojis below the categories', () => {
      const selections = [
        { category: 'Faces', emoji: '😀' },
        { category: 'Hands', emoji: '👍' },
        { category: 'Hearts', emoji: '❤️' },
        { category: 'Nature', emoji: '🔥' },
        { category: 'Food', emoji: '🍎' },
        { category: 'Fun', emoji: '🎉' },
      ];
  
      const firstMount = render(<QuickPlanner />);
      for (const selection of selections) {
        fireEvent.click(screen.getByRole('button', { name: 'Open emoji window' }));
        fireEvent.click(screen.getByRole('tab', { name: selection.category }));
        const categoryGrid = screen.getByRole('group', { name: `${selection.category} emoji` });
        const emojiButton = within(categoryGrid).getByRole('button', { name: `Insert ${selection.emoji}` });
        fireEvent.click(emojiButton);
      }
      firstMount.unmount();
  
      render(<QuickPlanner />);
      fireEvent.click(screen.getByRole('button', { name: 'Open emoji window' }));
      const picker = screen.getByRole('dialog', { name: 'Choose emoji' });
      const recentGroup = within(picker).getByRole('group', { name: 'Recent emoji' });
      expect(within(recentGroup).getAllByRole('button').map((button) => button.getAttribute('aria-label')))
        .toEqual(['Insert recent 🎉', 'Insert recent 🍎', 'Insert recent 🔥', 'Insert recent ❤️', 'Insert recent 👍', 'Insert recent 😀']);
      expect(picker.querySelector('.quick-planner-emoji-categories')!.compareDocumentPosition(
        picker.querySelector('.quick-planner-emoji-recent')!,
      ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(picker.querySelector('.quick-planner-emoji-search')!.compareDocumentPosition(
        picker.querySelector('.quick-planner-emoji-recent')!,
      ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  it('keeps the Recent order unchanged when selecting an emoji from Recent', async () => {
      localStorage.setItem('xmsgi-quick-planner-recent-emojis', JSON.stringify(['😀', '❤️', '😃']));
      render(<QuickPlanner />);
      fireEvent.click(screen.getByRole('button', { name: 'Open emoji window' }));
      const getRecentOrder = () => within(screen.getByRole('group', { name: 'Recent emoji' }))
        .getAllByRole('button').map((button) => button.getAttribute('aria-label'));
      const recentOrder = getRecentOrder();
  
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Insert recent ❤️' }), { ctrlKey: true });
        await vi.advanceTimersByTimeAsync(20);
      });
  
      expect(screen.getByRole('dialog', { name: 'Choose emoji' })).toBeInTheDocument();
      expect(getRecentOrder()).toEqual(recentOrder);
      expect(JSON.parse(localStorage.getItem('xmsgi-quick-planner-recent-emojis')!)).toEqual(['😀', '❤️', '😃']);
    });
  it('closes the previous picker when opening the other toolbar picker', () => {
      render(<QuickPlanner />);
      fireEvent.click(screen.getByRole('button', { name: 'Open emoji window' }));
      expect(screen.getByRole('dialog', { name: 'Choose emoji' })).toBeInTheDocument();
  
      fireEvent.click(screen.getByRole('button', { name: 'Message effects' }));
      expect(screen.queryByRole('dialog', { name: 'Choose emoji' })).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Message effects' })).toBeInTheDocument();
  
      fireEvent.click(screen.getByRole('button', { name: 'Open emoji window' }));
      expect(screen.queryByRole('dialog', { name: 'Message effects' })).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Choose emoji' })).toBeInTheDocument();
    });
  it('opens the emoji window with the quick keyboard command', () => {
      render(<QuickPlanner />);
  
      fireEvent.keyDown(document, { key: '.', ctrlKey: true });
  
      const emojiButton = screen.getByRole('button', { name: 'Open emoji window' });
      expect(emojiButton).toHaveAttribute('title', 'Open emoji window (Ctrl+. / Cmd+.)');
      expect(emojiButton).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('dialog', { name: 'Choose emoji' })).toBeInTheDocument();
    });
  it('opens emoji search from a colon command and replaces the query with the keyboard-selected result', () => {
      render(<QuickPlanner />);
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      fireEvent.change(editor, { target: { value: 'Say :heart', selectionStart: 10, selectionEnd: 10 } });
  
      expect(editor).toHaveValue('Say :heart');
      expect(screen.getByRole('searchbox', { name: 'Search emoji' })).toHaveValue('heart');
      expect(screen.getByRole('group', { name: 'Emoji search results' })).toBeInTheDocument();
  
      fireEvent.keyDown(editor, { key: 'ArrowDown' });
      fireEvent.keyDown(editor, { key: 'Enter' });
  
      expect(editor).toHaveValue('Say ❤️');
      expect(screen.queryByRole('dialog', { name: 'Choose emoji' })).not.toBeInTheDocument();
    });
  it('finds the same heart emoji from English and Russian picker searches', () => {
      render(<QuickPlanner />);
      fireEvent.click(screen.getByRole('button', { name: 'Open emoji window' }));
      const search = screen.getByRole('searchbox', { name: 'Search emoji' });
  
      fireEvent.change(search, { target: { value: 'heart' } });
      const categories = screen.getByRole('tablist', { name: 'Emoji categories' });
      expect(within(categories).getByRole('tab', { name: 'Faces' })).toBeInTheDocument();
      expect(within(screen.getByRole('group', { name: 'Emoji search results' }))
        .getByRole('button', { name: 'Insert ❤️' })).toBeInTheDocument();
  
      fireEvent.change(search, { target: { value: 'сердце' } });
      expect(within(categories).getByRole('tab', { name: 'Faces' })).toBeInTheDocument();
      expect(within(screen.getByRole('group', { name: 'Emoji search results' }))
        .getByRole('button', { name: 'Insert ❤️' })).toBeInTheDocument();
    });
  it('searches emoji names in Russian and keeps the picker open when there are no matches', () => {
      render(<QuickPlanner />);
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      fireEvent.change(editor, { target: { value: 'Привет :сердце', selectionStart: 14, selectionEnd: 14 } });
  
      expect(screen.getByRole('searchbox', { name: 'Search emoji' })).toHaveValue('сердце');
      const results = screen.getByRole('group', { name: 'Emoji search results' });
      expect(within(results).getByRole('button', { name: 'Insert ❤️' })).toBeInTheDocument();
  
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search emoji' }), { target: { value: 'no-such-emoji' } });
  
      const picker = screen.getByRole('dialog', { name: 'Choose emoji' });
      expect(within(picker).getByRole('status')).toHaveTextContent('No emojis found.');
      expect(within(picker).getByRole('searchbox', { name: 'Search emoji' })).toBeInTheDocument();
      expect(within(picker).getByRole('region', { name: 'Recent emojis' })).toBeInTheDocument();
    });
  it('keeps the picker open for Ctrl selections and closes on a normal selection', async () => {
      render(<QuickPlanner />);
      const editor = screen.getByRole('textbox', { name: 'Reminder text' });
      fireEvent.change(editor, { target: { value: 'Hi ' } });
      (editor as HTMLTextAreaElement).setSelectionRange(3, 3);
      fireEvent.click(screen.getByRole('button', { name: 'Open emoji window' }));
      const modifierHint = screen.getByText('Hold Ctrl to add more');
      expect(modifierHint).toBeInTheDocument();
      expect(modifierHint.closest('.quick-planner-emoji-recent-heading')).not.toBeNull();
  
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Insert 😀' }), { ctrlKey: true });
        await vi.advanceTimersByTimeAsync(20);
      });
      expect(editor).toHaveValue('Hi 😀');
      expect(screen.getByRole('dialog', { name: 'Choose emoji' })).toBeInTheDocument();
  
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Insert 😃' }), { ctrlKey: true });
        await vi.advanceTimersByTimeAsync(20);
      });
      expect(editor).toHaveValue('Hi 😀😃');
      expect(screen.getByRole('dialog', { name: 'Choose emoji' })).toBeInTheDocument();
  
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Insert 😄' }));
        await vi.advanceTimersByTimeAsync(20);
      });
      expect(editor).toHaveValue('Hi 😀😃😄');
      expect(screen.queryByRole('dialog', { name: 'Choose emoji' })).not.toBeInTheDocument();
    });
  it('closes the picker shortly after Ctrl is released following a multi-select', async () => {
      render(<QuickPlanner />);
      fireEvent.click(screen.getByRole('button', { name: 'Open emoji window' }));
      fireEvent.keyDown(document, { key: 'Control' });
      expect(screen.getByRole('dialog', { name: 'Choose emoji' })).toHaveClass('is-modifier-held');
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Insert 😀' }), { ctrlKey: true });
        await vi.advanceTimersByTimeAsync(20);
      });
  
      fireEvent.keyUp(document, { key: 'Control' });
      expect(screen.getByRole('dialog', { name: 'Choose emoji' })).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Choose emoji' })).not.toHaveClass('is-modifier-held');
      await act(async () => vi.advanceTimersByTimeAsync(699));
      expect(screen.getByRole('dialog', { name: 'Choose emoji' })).toBeInTheDocument();
      await act(async () => vi.advanceTimersByTimeAsync(1));
      expect(screen.queryByRole('dialog', { name: 'Choose emoji' })).not.toBeInTheDocument();
    });
});
