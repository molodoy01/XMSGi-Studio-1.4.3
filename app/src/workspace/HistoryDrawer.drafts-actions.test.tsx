import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi, describe } from 'vitest';
import type { ScheduledMessage } from '@/types';
import { LocaleProvider } from '@/lib/i18n';
import { HistoryDrawer } from './HistoryDrawer';
import { normalizeSavedPlannerDraft, normalizeScheduledMessages } from './historyModel';
import { colorThemeStyles, scheduledMessage, channel, upcomingRecord, completedRecord, workspaceSentRecord, personalUpcomingRecord, renderHistory, renderHistoryPage, selectHistorySource, stubDownloads, readBlob } from './HistoryDrawer.testUtils';

vi.mock('@/services/chatAppService', () => ({
  telegramGetChatHistory: vi.fn(),
}));

describe('HistoryDrawer search', () => {
  beforeEach(() => {
      window.localStorage.removeItem('xmsgi-history-filters');
      window.localStorage.removeItem('xmsgi_saved_draft_color_filter');
      window.localStorage.removeItem('xmsgi_dismissed_draft_color_auto_filter');
      window.localStorage.setItem('awaitmsg_locale', 'ru');
    });

  it('mentions drafts in the empty Planner state', () => {
      renderHistory([upcomingRecord]);
  
      fireEvent.click(screen.getByRole('button', { name: 'Планер' }));
  
      expect(screen.getByText('Публикации и черновики планера появятся здесь.')).toBeInTheDocument();
    });
  
  it('places a personal scheduled send action in More and asks for confirmation', () => {
      const { onSendNow } = renderHistory([personalUpcomingRecord]);
  
      expect(screen.queryByRole('button', { name: 'Отправить сейчас' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Ещё' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Отправить сейчас' }));
  
      const confirmation = screen.getByRole('alertdialog', { name: 'Подтвердить отправку' });
      expect(confirmation).toHaveAttribute('aria-modal', 'true');
      expect(within(confirmation).getByRole('button', { name: 'Отмена' })).toHaveFocus();
      expect(confirmation).toHaveTextContent(`Отправить публикацию в «${personalUpcomingRecord.title}» сейчас?`);
      expect(onSendNow).not.toHaveBeenCalled();
      fireEvent.click(within(confirmation).getByRole('button', { name: 'Отправить сейчас' }));
  
      expect(onSendNow).toHaveBeenCalledWith(personalUpcomingRecord);
    });
  
  it('closes history layers in order when Escape is pressed', () => {
      const { onClose } = renderHistory([upcomingRecord]);
  
      fireEvent.click(screen.getByRole('button', { name: 'Экспортировать текущую категорию' }));
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('menu', { name: 'Формат экспорта' })).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Публикации' })).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
  
      fireEvent.click(screen.getByRole('button', { name: 'Ещё' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Отменить' }));
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('alertdialog', { name: 'Подтвердить отмену публикации' })).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: 'Публикации' })).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
  
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledOnce();
    });
  
  it('makes Edit primary for Studio messages and moves Send now into Actions', () => {
      const onReschedule = vi.fn();
      const onSendNow = vi.fn();
      const { onClose } = renderHistory([upcomingRecord, personalUpcomingRecord], vi.fn(), vi.fn(), onSendNow, vi.fn(), onReschedule);
  
      const rescheduleButton = screen.getByRole('button', { name: 'Изменить: XMSGi Updates' });
      fireEvent.click(screen.getAllByRole('button', { name: 'Ещё' })[0]);
      expect(screen.getByRole('menuitem', { name: 'Отправить сейчас' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Изменить: XMSGi Updates' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('menuitem', { name: 'Отправить сейчас' }));
      const confirmation = screen.getByRole('alertdialog', { name: 'Подтвердить отправку' });
      expect(onSendNow).not.toHaveBeenCalled();
      fireEvent.click(within(confirmation).getByRole('button', { name: 'Отправить сейчас' }));
      expect(onSendNow).toHaveBeenCalledWith(upcomingRecord);
  
      fireEvent.click(rescheduleButton);
  
      expect(onReschedule).toHaveBeenCalledWith(upcomingRecord);
      expect(onClose).toHaveBeenCalledOnce();
  
      fireEvent.click(screen.getAllByRole('button', { name: 'Ещё' })[1]);
      expect(screen.getByRole('menuitem', { name: 'Отправить сейчас' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Отправить сейчас' })).not.toBeInTheDocument();
    });

  it('offers Edit for scheduled Planner messages in the row and detail view only', () => {
    const onReschedule = vi.fn();
    const rowView = renderHistory([personalUpcomingRecord], vi.fn(), vi.fn(), vi.fn(), vi.fn(), onReschedule);
    const editButton = screen.getByRole('button', { name: `Изменить: ${personalUpcomingRecord.title}` });

    fireEvent.click(editButton);
    expect(onReschedule).toHaveBeenCalledWith(personalUpcomingRecord);
    expect(rowView.onClose).toHaveBeenCalledOnce();
    expect(rowView.onClose).toHaveBeenCalledWith(false);
    rowView.unmount();

    const detail = renderHistoryPage([personalUpcomingRecord], vi.fn(), onReschedule);
    fireEvent.click(detail.container.querySelector(`[data-history-record-id="${personalUpcomingRecord.id}"]`)!);
    fireEvent.click(screen.getByRole('button', { name: 'Изменить' }));
    expect(onReschedule).toHaveBeenCalledTimes(2);
    expect(onReschedule).toHaveBeenLastCalledWith(personalUpcomingRecord);
    expect(detail.onClose).toHaveBeenCalledOnce();
    expect(detail.onClose).toHaveBeenCalledWith(false);
  });

  it('does not offer Edit for sent or failed Planner messages', () => {
    const failedPlannerRecord = normalizeScheduledMessages([{
      ...scheduledMessage,
      id: 'failed-planner',
      status: 'failed',
    }], 'personal', 'upcoming', [channel])[0];
    renderHistory([completedRecord, failedPlannerRecord]);

    expect(screen.queryByRole('button', { name: /^Изменить:/ })).not.toBeInTheDocument();
  });
  
  it('confirms before deleting the selected sent-history category', async () => {
      const onClearSent = vi.fn().mockResolvedValue({ deleted: 0, failed: 0 });
      renderHistory([completedRecord, workspaceSentRecord], undefined, undefined, undefined, undefined, undefined, onClearSent);
      fireEvent.click(screen.getByRole('tab', { name: 'Отправлено' }));
  
      fireEvent.click(screen.getByRole('button', { name: 'Удалить историю отправленных' }));
      const confirmation = screen.getByRole('alertdialog', { name: 'Подтвердить удаление категории' });
      expect(confirmation).toHaveTextContent('Удалить 2 записи из истории?');
      expect(confirmation).toHaveTextContent('Сообщения в Telegram останутся.');
      expect(onClearSent).not.toHaveBeenCalled();
  
      fireEvent.click(within(confirmation).getByRole('button', { name: 'Отмена' }));
      expect(onClearSent).not.toHaveBeenCalled();
  
      fireEvent.click(screen.getByRole('button', { name: 'Studio' }));
      fireEvent.click(screen.getByRole('button', { name: 'Удалить историю отправленных' }));
      const studioConfirmation = screen.getByRole('alertdialog', { name: 'Подтвердить удаление категории' });
      expect(studioConfirmation).toHaveTextContent('Удалить 1 запись из истории?');
      fireEvent.mouseDown(studioConfirmation.parentElement!);
      expect(screen.queryByRole('alertdialog', { name: 'Подтвердить удаление категории' })).not.toBeInTheDocument();
      expect(onClearSent).not.toHaveBeenCalled();
  
      fireEvent.click(screen.getByRole('button', { name: 'Удалить историю отправленных' }));
      const finalConfirmation = screen.getByRole('alertdialog', { name: 'Подтвердить удаление категории' });
      fireEvent.click(within(finalConfirmation).getByRole('button', { name: 'Удалить 1 запись' }));
      await waitFor(() => expect(onClearSent).toHaveBeenCalledWith('workspace'));
    });
  
  it('shows the remaining draft count as each draft is deleted', async () => {
      const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
      const drafts = [
        { id: 'draft-a', name: 'Draft A', body: 'Body A', createdAt: '2026-09-28T10:00:00.000Z', updatedAt: '2026-09-29T18:35:00.000Z' },
        { id: 'draft-b', name: 'Draft B', body: 'Body B', createdAt: '2026-09-28T10:00:00.000Z', updatedAt: '2026-09-29T18:36:00.000Z' },
      ];
      const onClearDrafts = vi.fn().mockResolvedValue(true);
      const resolveDelete: Array<(deleted: boolean) => void> = [];
      const onDelete = vi.fn(() => new Promise<boolean>((resolve) => resolveDelete.push(resolve)));
      Object.defineProperty(window, 'draftStorage', {
        configurable: true,
        value: { load: vi.fn().mockResolvedValue({ success: true, store: { schemaVersion: 1, migrationVersion: 1, savedDrafts: drafts, workspaceDraft: null } }) },
      });
  
      try {
        renderHistory([], undefined, onDelete, undefined, undefined, undefined, vi.fn(), onClearDrafts);
        fireEvent.click(screen.getByRole('tab', { name: 'Черновики' }));
        await screen.findByText('Draft A');
        fireEvent.click(screen.getByRole('button', { name: 'Удалить черновики' }));
  
        const confirmation = screen.getByRole('alertdialog', { name: 'Подтвердить удаление категории' });
        expect(confirmation).toHaveTextContent('Удалить 2 черновика? Восстановление невозможно.');
        expect(confirmation).toHaveAttribute('aria-modal', 'true');
        expect(within(confirmation).getByRole('button', { name: 'Удалить 2 черновика' })).toHaveFocus();
        expect(onClearDrafts).not.toHaveBeenCalled();
        fireEvent.keyDown(confirmation, { key: 'Enter' });
  
        await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
        expect(within(confirmation).getByRole('heading', { name: 'Удаление 2 черновика? Восстановление невозможно.' })).toBeInTheDocument();
        expect(within(confirmation).queryByRole('status')).not.toBeInTheDocument();
        resolveDelete[0](true);
  
        await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(2));
        expect(within(confirmation).getByRole('heading', { name: 'Удаление 1 черновик? Восстановление невозможно.' })).toBeInTheDocument();
        resolveDelete[1](true);
  
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(onClearDrafts).not.toHaveBeenCalled();
        expect(screen.queryByText('Draft A')).not.toBeInTheDocument();
        expect(screen.queryByText('Draft B')).not.toBeInTheDocument();
      } finally {
        if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        else Reflect.deleteProperty(window, 'draftStorage');
      }
    });
  
  it('stops bulk draft deletion after the in-flight deletion finishes', async () => {
      const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
      const drafts = [
        { id: 'draft-stop-a', name: 'Draft stop A', body: 'Body A', createdAt: '2026-09-28T10:00:00.000Z', updatedAt: '2026-09-29T18:35:00.000Z' },
        { id: 'draft-stop-b', name: 'Draft stop B', body: 'Body B', createdAt: '2026-09-28T10:00:00.000Z', updatedAt: '2026-09-29T18:36:00.000Z' },
      ];
      const resolveDelete: Array<(deleted: boolean) => void> = [];
      const onDelete = vi.fn((_record: { id: string }) => new Promise<boolean>((resolve) => resolveDelete.push(resolve)));
      Object.defineProperty(window, 'draftStorage', {
        configurable: true,
        value: { load: vi.fn().mockResolvedValue({ success: true, store: { schemaVersion: 1, migrationVersion: 1, savedDrafts: drafts, workspaceDraft: null } }) },
      });
  
      try {
        renderHistory([], undefined, onDelete);
        fireEvent.click(screen.getByRole('tab', { name: 'Черновики' }));
        await screen.findByText('Draft stop A');
        fireEvent.click(screen.getByRole('button', { name: 'Удалить черновики' }));
  
        const confirmation = screen.getByRole('alertdialog', { name: 'Подтвердить удаление категории' });
        fireEvent.click(within(confirmation).getByRole('button', { name: 'Удалить 2 черновика' }));
        await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
        fireEvent.click(within(confirmation).getByRole('button', { name: 'Остановить' }));
        await act(async () => resolveDelete[0](true));
  
        expect(await within(confirmation).findByRole('status')).toHaveTextContent('Остановлено: обработано 1 из 2.');
        expect(onDelete).toHaveBeenCalledOnce();
        expect(onDelete.mock.calls.map(([record]) => record.id)).toEqual(['workspace:draft:draft-stop-b']);
        expect(confirmation.querySelector('.history-record-confirmation-action.is-primary')).toHaveTextContent('Закрыть');
      } finally {
        if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        else Reflect.deleteProperty(window, 'draftStorage');
      }
    });
  
  it('bulk-deletes only drafts matching the selected color', async () => {
      const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
      const savedColorFilter = window.localStorage.getItem('xmsgi_saved_draft_color_filter');
      const drafts = [
        { id: 'draft-coral', name: 'Coral draft', body: 'Coral body', color: 'coral', createdAt: '2026-09-28T10:00:00.000Z', updatedAt: '2026-09-29T18:35:00.000Z' },
        { id: 'draft-gray', name: 'Gray draft', body: 'Gray body', color: 'gray', createdAt: '2026-09-28T10:00:00.000Z', updatedAt: '2026-09-29T18:36:00.000Z' },
      ];
      const onDelete = vi.fn().mockResolvedValue(true);
      window.localStorage.removeItem('xmsgi_saved_draft_color_filter');
      window.localStorage.setItem('xmsgi-history-filters', JSON.stringify({
        sourceFilter: 'workspace',
        sourceFilterPinned: true,
        statusFilter: 'drafts',
      }));
      Object.defineProperty(window, 'draftStorage', {
        configurable: true,
        value: { load: vi.fn().mockResolvedValue({ success: true, store: { schemaVersion: 1, migrationVersion: 1, savedDrafts: drafts, workspaceDraft: null } }) },
      });
  
      try {
        render(
          <LocaleProvider>
            <HistoryDrawer
              isOpen
              pageMode
              statusFilterOnOpen="drafts"
              onClose={vi.fn()}
              records={[]}
              onCancel={vi.fn()}
              onReschedule={vi.fn()}
              onSendNow={vi.fn()}
              onDelete={onDelete}
              onOpenDraft={vi.fn()}
              onClearSent={vi.fn().mockResolvedValue({ deleted: 0, failed: 0 })}
            />
          </LocaleProvider>,
        );
        await screen.findByText('Coral draft');
        fireEvent.click(screen.getByRole('button', { name: 'Цвет черновика: Коралловый' }));
  
        expect(screen.getByText('Coral draft')).toBeInTheDocument();
        expect(screen.queryByText('Gray draft')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Удалить черновики' }));
  
        const confirmation = screen.getByRole('alertdialog', { name: 'Подтвердить удаление категории' });
        expect(confirmation).toHaveTextContent('Удалить 1 черновик? Восстановление невозможно.');
        fireEvent.click(within(confirmation).getByRole('button', { name: 'Удалить 1 черновик' }));
  
        await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
        expect(onDelete.mock.calls[0][0].original).toMatchObject({ kind: 'saved-draft', draft: { id: 'draft-coral' } });
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
        expect(screen.queryByText('Coral draft')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Цвет черновика: Коралловый' }));
        expect(screen.getByText('Gray draft')).toBeInTheDocument();
      } finally {
        if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        else Reflect.deleteProperty(window, 'draftStorage');
        if (savedColorFilter === null) window.localStorage.removeItem('xmsgi_saved_draft_color_filter');
        else window.localStorage.setItem('xmsgi_saved_draft_color_filter', savedColorFilter);
      }
    });
  
  it('deletes only the expanded sent record when the trash icon is used', async () => {
      const onDelete = vi.fn();
      renderHistory([completedRecord, workspaceSentRecord], vi.fn(), onDelete);
      fireEvent.click(screen.getByRole('tab', { name: 'Отправлено' }));
      fireEvent.click(screen.getByRole('button', { name: 'Открыть публикацию: Личные заметки' }));
      fireEvent.click(screen.getByRole('button', { name: 'Удалить Личные заметки' }));
  
      const confirmation = screen.getByRole('alertdialog', { name: 'Подтвердить удаление записи' });
      expect(confirmation).toHaveTextContent('Удалить «Личные заметки» из истории?');
      expect(confirmation).toHaveTextContent('Сообщение в Telegram останется.');
      expect(onDelete).not.toHaveBeenCalled();
      fireEvent.click(within(confirmation).getByRole('button', { name: 'Удалить запись' }));
  
      await waitFor(() => expect(onDelete).toHaveBeenCalledWith(completedRecord, true));
    });
  
  it('deletes only the expanded draft when the trash icon is used', async () => {
      const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
      const draft = {
        id: 'single-delete-draft',
        name: 'Draft to delete',
        body: 'Saved content',
        createdAt: '2026-09-28T10:00:00.000Z',
        updatedAt: '2026-09-29T18:35:00.000Z',
      };
      const onDelete = vi.fn().mockResolvedValue(true);
      Object.defineProperty(window, 'draftStorage', {
        configurable: true,
        value: { load: vi.fn().mockResolvedValue({ success: true, store: { schemaVersion: 1, migrationVersion: 1, savedDrafts: [draft], workspaceDraft: null } }) },
      });
  
      try {
        renderHistory([], vi.fn(), onDelete);
        fireEvent.click(screen.getByRole('tab', { name: 'Черновики' }));
        await screen.findByRole('button', { name: 'Открыть публикацию: Draft to delete' });
        fireEvent.click(screen.getByRole('button', { name: 'Открыть публикацию: Draft to delete' }));
        fireEvent.click(screen.getByRole('button', { name: 'Удалить Draft to delete' }));
  
        const confirmation = screen.getByRole('alertdialog', { name: 'Подтвердить удаление записи' });
        expect(confirmation).toHaveTextContent('Удалить черновик «Draft to delete»? Восстановление невозможно.');
        expect([...confirmation.querySelectorAll('.history-record-confirmation-action')].map((button) => button.textContent?.trim()))
          .toEqual(['Удалить черновик', 'Отмена']);
        expect(within(confirmation).getByRole('button', { name: 'Удалить черновик' })).toHaveFocus();
        fireEvent.keyDown(confirmation, { key: 'Enter' });
  
        await waitFor(() => expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({
          id: 'workspace:draft:single-delete-draft',
          status: 'draft',
        }), true));
        expect(screen.queryByText('Draft to delete')).not.toBeInTheDocument();
      } finally {
        if (originalDraftStorage) Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        else Reflect.deleteProperty(window, 'draftStorage');
      }
    });
  
  it('confirms cancellation of only Telegram-confirmed entries from the queue category', async () => {
      const queueRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        telegramMessageId: 'telegram-queue-1',
      }], 'workspace', 'upcoming', [channel])[0];
      const onCancelQueue = vi.fn().mockResolvedValue(true);
      renderHistory([queueRecord], undefined, undefined, undefined, undefined, undefined, undefined, undefined, onCancelQueue);
  
      fireEvent.click(screen.getByRole('button', { name: 'Отменить запланированные публикации' }));
      const confirmation = screen.getByRole('alertdialog', { name: 'Подтвердить отмену очереди' });
      expect(confirmation).toHaveTextContent('Снять с расписания 1 запись в Telegram?');
      expect(onCancelQueue).not.toHaveBeenCalled();
      fireEvent.click(within(confirmation).getByRole('button', { name: 'Отменить 1 запись' }));
  
      await waitFor(() => expect(onCancelQueue).toHaveBeenCalledWith([queueRecord]));
    });
  
  it('stops bulk queue cancellation after the in-flight cancellation finishes', async () => {
      const queueRecords = normalizeScheduledMessages([
        { ...scheduledMessage, id: 'queue-stop-first', telegramMessageId: 'telegram-queue-stop-first' },
        { ...scheduledMessage, id: 'queue-stop-second', text: 'Second queue post', telegramMessageId: 'telegram-queue-stop-second' },
      ], 'workspace', 'upcoming', [channel]);
      const resolveCancellation: Array<(success: boolean) => void> = [];
      const onCancelQueue = vi.fn(() => new Promise<boolean>((resolve) => resolveCancellation.push(resolve)));
      renderHistory(queueRecords, undefined, undefined, undefined, undefined, undefined, undefined, undefined, onCancelQueue);
  
      fireEvent.click(screen.getByRole('button', { name: 'Отменить запланированные публикации' }));
      const confirmation = screen.getByRole('alertdialog', { name: 'Подтвердить отмену очереди' });
      fireEvent.click(confirmation.querySelector('.history-record-confirmation-action.is-primary')!);
      await waitFor(() => expect(onCancelQueue).toHaveBeenCalledOnce());
  
      fireEvent.click(within(confirmation).getByRole('button', { name: 'Остановить' }));
      await act(async () => resolveCancellation[0](true));
  
      expect(await within(confirmation).findByRole('status')).toHaveTextContent('Остановлено: обработано 1 из 2.');
      expect(onCancelQueue).toHaveBeenCalledOnce();
      expect(screen.getByText('Second queue post')).toBeInTheDocument();
      expect(confirmation.querySelector('.history-record-confirmation-action.is-primary')).toHaveTextContent('Закрыть');
    });
  
  it('hides failed local schedule errors and retry actions from Posts', () => {
      const localFailure = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'ipc-schedule-failure',
        status: 'failed' as const,
        lastError: "Error invoking remote method 'telegram-schedule': Invalid IPC input: message is required",
        retryAction: 'schedule' as const,
        telegramMessageId: undefined,
      }], 'workspace', 'upcoming', [channel])[0];
      const onDelete = vi.fn();
      const onCancelQueue = vi.fn().mockResolvedValue(true);
  
      renderHistory([localFailure], undefined, onDelete, undefined, undefined, undefined, undefined, undefined, onCancelQueue);
      selectHistorySource('Studio');
  
      expect(screen.queryByText("Error invoking remote method 'telegram-schedule': Invalid IPC input: message is required")).not.toBeInTheDocument();
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Повторить планирование' })).not.toBeInTheDocument();
      expect(onDelete).not.toHaveBeenCalled();
      expect(onCancelQueue).not.toHaveBeenCalled();
    });
  
  it('shows valid queue entries but hides failed schedule retries', () => {
      const queueRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        telegramMessageId: 'telegram-queue-mixed',
      }], 'workspace', 'upcoming', [channel])[0];
      const localFailure = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'ipc-schedule-failure-mixed',
        text: 'Failed schedule that can be retried',
        status: 'failed' as const,
        retryAction: 'schedule' as const,
        telegramMessageId: undefined,
      }], 'workspace', 'upcoming', [channel])[0];
      const onDelete = vi.fn();
      const onCancelQueue = vi.fn().mockResolvedValue(true);
  
      renderHistory([queueRecord, localFailure], undefined, onDelete, undefined, undefined, undefined, undefined, undefined, onCancelQueue);
      selectHistorySource('Studio');
  
      expect(screen.getByText('Релиз нового набора шаблонов для Telegram-канала')).toBeInTheDocument();
      expect(screen.queryByText('Failed schedule that can be retried')).not.toBeInTheDocument();
      expect(screen.queryByText(/Error invoking remote method|Invalid IPC input/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Повторить планирование' })).not.toBeInTheDocument();
      expect(onDelete).not.toHaveBeenCalled();
      expect(onCancelQueue).not.toHaveBeenCalled();
    });
  
  it('cancels only the expanded scheduled record from the queue trash action', async () => {
      const queueRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        telegramMessageId: 'telegram-queue-selected',
      }], 'workspace', 'upcoming', [channel])[0];
      const otherRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'other-queue-record',
        chatName: 'Other channel',
        telegramMessageId: 'telegram-queue-other',
      }], 'workspace', 'upcoming', [])[0];
      const onCancelQueue = vi.fn().mockResolvedValue(true);
      renderHistory([queueRecord, otherRecord], undefined, undefined, undefined, undefined, undefined, undefined, undefined, onCancelQueue);
  
      fireEvent.click(screen.getByRole('button', { name: 'Показать полностью: XMSGi Updates' }));
      fireEvent.click(screen.getByRole('button', { name: 'Отменить XMSGi Updates' }));
      const confirmation = screen.getByRole('alertdialog', { name: 'Подтвердить отмену публикации' });
      expect(confirmation).toHaveTextContent('Убрать публикацию «XMSGi Updates» из расписания Telegram?');
      fireEvent.click(within(confirmation).getByRole('button', { name: 'Отменить расписание' }));
  
      await waitFor(() => expect(onCancelQueue).toHaveBeenCalledWith([queueRecord]));
    });
  
  it('does not offer bulk cancellation for upcoming records', () => {
      const { container } = renderHistory([upcomingRecord, personalUpcomingRecord]);
  
      expect(screen.queryByRole('button', { name: 'Отменить все запланированные' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Удалить историю отправленных' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Удалить черновики' })).not.toBeInTheDocument();
      expect(container.querySelector('.history-delete-button')).toBeDisabled();
      expect(container.querySelector('.history-export-button')).toBeEnabled();
    });
  
  it('keeps delete and export buttons visible but disabled when history is empty', () => {
      const { container } = renderHistory([]);
  
      expect(container.querySelector('.history-delete-button')).toBeInTheDocument();
      expect(container.querySelector('.history-delete-button')).toBeDisabled();
      expect(container.querySelector('.history-export-button')).toBeInTheDocument();
      expect(container.querySelector('.history-export-button')).toBeDisabled();
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='light'\] \.history-drawer\.is-page \.history-delete-button:disabled\s*\{[^}]*border-color:\s*transparent;[^}]*background:\s*transparent;[^}]*color:\s*#697984;[^}]*opacity:\s*0\.75;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-delete-button:disabled\s*\{[^}]*border-color:\s*transparent;[^}]*background:\s*transparent;[^}]*color:\s*#8496a1;[^}]*opacity:\s*0\.75;/,
      );
      expect(colorThemeStyles).toMatch(
        /html\[data-theme='dark'\] \.history-drawer\.is-page \.history-drawer-tools \.history-delete-button:disabled:hover::before,\s*html\[data-theme='light'\] \.history-drawer\.is-page \.history-drawer-tools \.history-delete-button:disabled:hover::before\s*\{\s*border-color:\s*transparent;\s*background:\s*rgba\(100,\s*112,\s*121,\s*0\.18\);\s*box-shadow:\s*none;/,
      );
    });
  
  it('labels the Posts delete and export icons without changing other drawer actions', () => {
      const { container } = renderHistoryPage([upcomingRecord]);
  
      expect(container.querySelector('.history-delete-action .history-action-label')).toHaveTextContent('Удалить');
      expect(container.querySelector('.history-export-control .history-action-label')).toHaveTextContent('Экспорт');
      expect(container.querySelector('.history-delete-button')).toHaveAttribute('aria-label');
      expect(container.querySelector('.history-export-button')).toHaveAttribute('aria-label');
    });
  
  it('hides failed retry attempts but keeps cancelled entries in scheduled history', () => {
      const failedRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        text: 'Failed entry for retry',
        status: 'failed' as ScheduledMessage['status'],
        lastError: 'Telegram is temporarily unavailable.',
        retryAction: 'send',
      }], 'personal', 'upcoming', [channel])[0];
      const cancelledRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'cancelled-history-entry',
        text: 'Cancelled entry remains visible',
        status: 'cancelled' as ScheduledMessage['status'],
      }], 'personal', 'upcoming', [channel])[0];
      const onSendNow = vi.fn();
  
      renderHistory([failedRecord, cancelledRecord], vi.fn(), vi.fn(), onSendNow);
      selectHistorySource('Planner');
  
      expect(screen.queryByRole('tab', { name: 'Ошибки' })).not.toBeInTheDocument();
      expect(screen.queryByText('Failed entry for retry')).not.toBeInTheDocument();
      expect(screen.getByText('Cancelled entry remains visible')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Повторить отправку' })).not.toBeInTheDocument();
      expect(onSendNow).not.toHaveBeenCalled();
    });
  
  it('shows Sending in the scheduled list without exposing another send action', () => {
      const sendingRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        status: 'sending' as ScheduledMessage['status'],
      }], 'workspace', 'upcoming', [channel])[0];
      renderHistory([sendingRecord]);
  
      expect(screen.queryByRole('tab', { name: 'Отправляется' })).not.toBeInTheDocument();
      expect(screen.getByRole('article')).toHaveTextContent('Отправляется');
      expect(screen.getByRole('button', { name: 'Отправляется…' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Отправить сейчас' })).not.toBeInTheDocument();
    });
  
  it('uses Studio drafts in the composer and puts Edit and Delete in More', async () => {
      const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
      const draft = {
        id: 'studio-draft-1',
        name: 'Анонс функции',
        body: 'Скоро обновление',
        color: 'coral' as const,
        createdAt: '2026-09-28T10:00:00.000Z',
        updatedAt: '2026-09-29T18:35:00.000Z',
      };
      const load = vi.fn().mockResolvedValue({
        success: true,
        store: { schemaVersion: 1, migrationVersion: 1, savedDrafts: [draft], workspaceDraft: null },
      });
      Object.defineProperty(window, 'draftStorage', {
        configurable: true,
        value: { load },
      });
  
      try {
        const onOpenDraft = vi.fn();
        const onUseDraft = vi.fn();
        const onDelete = vi.fn().mockResolvedValue(true);
        renderHistory([upcomingRecord], vi.fn(), onDelete, vi.fn(), onOpenDraft, vi.fn(), vi.fn(), vi.fn().mockResolvedValue(true), vi.fn().mockResolvedValue(true), onUseDraft);
        fireEvent.click(screen.getByRole('tab', { name: 'Черновики' }));
        const draftCard = await screen.findByRole('article');
        expect(draftCard).toHaveClass('is-draft');
        expect(draftCard).toHaveAttribute('data-draft-color', 'coral');
        expect(screen.getByLabelText('Цвет черновика: coral')).toBeInTheDocument();
        fireEvent.click(await screen.findByRole('button', { name: 'Использовать черновик: Анонс функции' }));
  
        expect(load).toHaveBeenCalledOnce();
        expect(onUseDraft).toHaveBeenCalledWith(expect.objectContaining({
          source: 'workspace',
          status: 'draft',
          original: { kind: 'saved-draft', draft: expect.objectContaining({ id: 'studio-draft-1' }) },
        }), 'studio');
        expect(onOpenDraft).not.toHaveBeenCalled();
  
        fireEvent.click(screen.getByRole('button', { name: 'Ещё' }));
        expect(screen.queryByRole('menuitem', { name: 'Редактировать' })).not.toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Удалить' })).toBeInTheDocument();
  
        fireEvent.click(screen.getByRole('menuitem', { name: 'Удалить' }));
        expect(onDelete).not.toHaveBeenCalled();
        const confirmation = screen.getByRole('alertdialog', { name: 'Подтвердить удаление записи' });
        expect(confirmation).toHaveTextContent('Удалить черновик «Анонс функции»? Восстановление невозможно.');
        fireEvent.click(within(confirmation).getByRole('button', { name: 'Удалить черновик' }));
        await waitFor(() => expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }), true));
        expect(screen.queryByRole('article')).not.toBeInTheDocument();
      } finally {
        if (originalDraftStorage) {
          Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        } else {
          Reflect.deleteProperty(window, 'draftStorage');
        }
      }
    });
  
  it('offers text and JSON export options', () => {
      renderHistory();
  
      fireEvent.click(screen.getByRole('button', { name: 'Экспортировать текущую категорию' }));
  
      expect(screen.getByText('Текущая категория: План')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Экспортировать текущий список как TXT (.txt)' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Экспортировать текущий список как JSON (.json)' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Архив с файлами: текущий список (.zip)' }))
        .toHaveTextContent('Копия + файлы (.zip)');
      expect(screen.getByRole('menuitem', { name: 'Архив с файлами: текущий список (.zip)' }))
        .toHaveAttribute('title', 'Добавляет доступные локальные фото и файлы. Недоступные вложения перечислены в posts-backup.json.');
      expect(screen.getByRole('menuitem', { name: 'Экспортировать текущий список как TXT (.txt)' }))
        .toHaveAttribute('title', 'Лучше для чтения, печати и отправки человеку.');
      expect(screen.getByRole('menuitem', { name: 'Экспортировать текущий список как JSON (.json)' }))
        .toHaveAttribute('title', 'Лучше для резервной копии и переноса данных.');
      expect(screen.queryByText('Завершённые')).not.toBeInTheDocument();
    });
  
  it('exports global search results within the selected source', async () => {
      const downloads = stubDownloads();
  
      try {
        renderHistory([upcomingRecord, personalUpcomingRecord, completedRecord]);
        fireEvent.click(screen.getByRole('button', { name: 'Планер' }));
        fireEvent.click(screen.getByRole('tab', { name: 'Отправлено' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Поиск по истории' }), {
          target: { value: 'подтвердить' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Экспортировать результаты поиска' }));
  
        expect(screen.getByText('Результаты поиска')).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Экспортировать текущий список как JSON (.json)' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Экспортировать результаты поиска' })).toBeEnabled();
  
        fireEvent.click(screen.getByRole('menuitem', { name: 'Экспортировать текущий список как JSON (.json)' }));
  
        const payload = JSON.parse(await readBlob(downloads.blobs[0])) as {
          filters: { source: string; status: string; query: string };
          records: Array<{ id: string }>;
        };
        expect(payload.filters).toEqual({ source: 'personal', status: 'all', query: 'подтвердить' });
        expect(payload.records.map((record) => record.id).sort()).toEqual([completedRecord.id, personalUpcomingRecord.id].sort());
      } finally {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
      }
    });
  
  it('exports a readable text file with the full message and attachment names', async () => {
      const downloads = stubDownloads();
  
      try {
        renderHistory();
        fireEvent.click(screen.getByRole('button', { name: 'Экспортировать текущую категорию' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Экспортировать текущий список как TXT (.txt)' }));
  
        expect(downloads.blobs[0].type).toBe('text/plain;charset=utf-8');
        expect(downloads.filenames[0]).toMatch(/xmsgi-scheduled-.*\.txt$/);
        const text = await readBlob(downloads.blobs[0]);
        expect(text).toContain('XMSGi — План');
        expect(text).toContain('Источник: Studio');
        expect(text).toContain('Чат: XMSGi Updates (@xmsgi_updates)');
        expect(text).toContain('Релиз нового набора шаблонов для Telegram-канала');
        expect(text).toContain('brief.pdf');
      } finally {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
      }
    });
  
  it('exports only the expanded record with its title in the menu and filename', async () => {
      const downloads = stubDownloads();
  
      try {
        renderHistory([upcomingRecord, personalUpcomingRecord]);
        fireEvent.click(screen.getByRole('button', { name: 'Показать полностью: XMSGi Updates' }));
        fireEvent.click(screen.getByRole('button', { name: 'Экспортировать XMSGi Updates' }));
  
        const exportMenu = screen.getByRole('menu', { name: 'Формат экспорта' });
        expect(exportMenu).toHaveTextContent('Экспорт: XMSGi Updates');
        expect(exportMenu).not.toHaveTextContent('Вся категория');
        expect(within(exportMenu).getAllByRole('menuitem')).toHaveLength(3);
        fireEvent.click(within(exportMenu).getByRole('menuitem', { name: 'Экспортировать «XMSGi Updates» как TXT (.txt)' }));
  
        expect(downloads.filenames[0]).toMatch(/xmsgi-scheduled-xmsgi-updates-.*\.txt$/i);
        const text = await readBlob(downloads.blobs[0]);
        expect(text).toContain('Всего: 1');
        expect(text).toContain('XMSGi Updates');
        expect(text).toContain('Релиз нового набора шаблонов для Telegram-канала');
        expect(text).not.toContain('Подтвердить встречу');
      } finally {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
      }
    });
  
  it('exports saved drafts from the selected drafts category', async () => {
      const originalDraftStorage = Object.getOwnPropertyDescriptor(window, 'draftStorage');
      const draft = {
        id: 'exported-studio-draft',
        name: 'Идея для следующего поста',
        body: 'Собрать заметки по обновлению.',
        createdAt: '2026-09-28T10:00:00.000Z',
        updatedAt: '2026-09-29T18:35:00.000Z',
      };
      Object.defineProperty(window, 'draftStorage', {
        configurable: true,
        value: {
          load: vi.fn().mockResolvedValue({
            success: true,
            store: { schemaVersion: 1, migrationVersion: 1, savedDrafts: [draft], workspaceDraft: null },
          }),
        },
      });
  
      try {
        renderHistory([]);
        fireEvent.click(screen.getByRole('tab', { name: 'Черновики' }));
        await screen.findByRole('article');
        const downloads = stubDownloads();
        fireEvent.click(screen.getByRole('button', { name: 'Экспортировать текущую категорию' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Экспортировать текущий список как JSON (.json)' }));
  
        const payload = JSON.parse(await readBlob(downloads.blobs[0])) as {
          filters: { source: string; status: string };
          records: Array<{ status: string; text: string; title: string }>;
        };
        expect(payload.filters).toEqual({ source: 'all', status: 'drafts', query: '' });
        expect(payload.records).toMatchObject([{ status: 'draft', title: draft.name, text: draft.body }]);
        expect(downloads.filenames[0]).toMatch(/xmsgi-drafts-.*\.json$/);
      } finally {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        if (originalDraftStorage) {
          Object.defineProperty(window, 'draftStorage', originalDraftStorage);
        } else {
          Reflect.deleteProperty(window, 'draftStorage');
        }
      }
    });
  
  it('exports completed records separately in a readable text file', async () => {
      const downloads = stubDownloads();
  
      try {
        renderHistory([upcomingRecord, completedRecord]);
        fireEvent.click(screen.getByRole('tab', { name: 'Отправлено' }));
        fireEvent.click(screen.getByRole('button', { name: 'Экспортировать текущую категорию' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Экспортировать текущий список как TXT (.txt)' }));
  
        expect(downloads.filenames[0]).toMatch(/xmsgi-sent-.*\.txt$/);
        const text = await readBlob(downloads.blobs[0]);
        expect(text).toContain('XMSGi — Отправлено');
        expect(text).toContain('Статус: Отправлено');
        expect(text).toContain('Подтвердить встречу');
        expect(text).not.toContain('Релиз нового набора шаблонов');
      } finally {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
      }
    });
  
  it('asks for confirmation before destructive history actions', () => {
      const onCancel = vi.fn();
      const onDelete = vi.fn();
      renderHistory([upcomingRecord, completedRecord], onCancel, onDelete);
  
      fireEvent.click(screen.getAllByRole('button', { name: 'Ещё' })[0]);
      fireEvent.click(screen.getByRole('menuitem', { name: 'Отменить' }));
      expect(screen.getByRole('alertdialog', { name: 'Подтвердить отмену публикации' })).toBeInTheDocument();
      expect(onCancel).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Отменить публикацию' }));
      expect(onCancel).toHaveBeenCalledWith(upcomingRecord);
  
      fireEvent.click(screen.getByRole('tab', { name: 'Отправлено' }));
      fireEvent.click(screen.getAllByRole('button', { name: 'Ещё' })[0]);
      fireEvent.click(screen.getByRole('menuitem', { name: 'Удалить' }));
      expect(screen.getByRole('alertdialog', { name: 'Подтвердить удаление' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Удалить запись' }));
      expect(onDelete).toHaveBeenCalledWith(completedRecord);
    });
  
  it('hides failed records and their retry and history actions', () => {
      const failedRecord = normalizeScheduledMessages([{
        ...scheduledMessage,
        id: 'failed-history-delete',
        status: 'failed' as ScheduledMessage['status'],
        lastError: 'Telegram did not confirm that the reminder was saved.',
        retryAction: 'schedule',
      }], 'workspace', 'upcoming', [channel])[0];
      const onDelete = vi.fn();
  
      renderHistory([failedRecord], vi.fn(), onDelete);
      selectHistorySource('Studio');
  
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Ещё' })).not.toBeInTheDocument();
      expect(screen.queryByText('Telegram did not confirm that the reminder was saved.')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Повторить планирование' })).not.toBeInTheDocument();
      expect(onDelete).not.toHaveBeenCalled();
    });

  it('omits "Quick" from the English Planner draft export heading', () => {
    window.localStorage.setItem('awaitmsg_locale', 'en');
    const plannerDraft = normalizeSavedPlannerDraft({
      id: 'saved-planner-export-heading',
      message: 'A saved idea',
      attachments: [],
      entities: [],
      reminderType: 'idea',
      savedAt: '2026-10-06T10:00:00.000Z',
    });

    renderHistory([plannerDraft]);
    fireEvent.click(screen.getByRole('tab', { name: 'Drafts' }));
    fireEvent.click(screen.getByRole('article').querySelector('.history-record-open')!);
    fireEvent.click(document.querySelector<HTMLButtonElement>('.history-export-button')!);

    expect(screen.getByRole('menu', { name: 'Export format' })).toHaveTextContent('Exporting: Saved Planner draft');
  });

  it('uses the concise Russian Planner name in the export heading', () => {
    const plannerDraft = normalizeSavedPlannerDraft({
      id: 'saved-planner-export-heading-ru',
      message: 'Сохранённая идея',
      attachments: [],
      entities: [],
      reminderType: 'idea',
      savedAt: '2026-10-06T10:00:00.000Z',
    });

    renderHistory([plannerDraft]);
    fireEvent.click(screen.getByRole('tab', { name: 'Черновики' }));
    fireEvent.click(screen.getByRole('article').querySelector('.history-record-open')!);
    fireEvent.click(document.querySelector<HTMLButtonElement>('.history-export-button')!);

    expect(screen.getByRole('menu', { name: 'Формат экспорта' })).toHaveTextContent('Экспорт: Сохранённый черновик планера');
  });
});
