import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { useNotifications, useScheduler } from './core';
import type { useLocale } from '@/lib/i18n';
import type { Chat, RichTextEntity } from '@/types';
import type { SavedDraft, ScheduledMessage } from '@shared/types';
import type { StudioPlannerTextPayload } from '@shared/bridge';
import { getPlannerAttachmentPaths } from './workspace/plannerText';
import type { HistoryItem } from './workspace/historyModel';
import {
  flushPlannerDraftWrite,
  readSavedPlannerDrafts,
  writeSavedPlannerDrafts,
} from './lib/plannerDraft';
import { telegramDeleteSavedMessage } from './services/telegramAppService';
import { updateSavedStudioDrafts } from '@studio/lib/draftStore';
import { getBackgroundProductView, type ProductView } from './lib/productView';

export type PlannerDraftLoadRequest = {
  revision: number;
  text: string;
  attachments: string[];
  entities: RichTextEntity[];
  selectedChat?: Chat | null;
  clearDraft?: boolean;
  restoreDraft: {
    text: string;
    attachments: string[];
    entities: RichTextEntity[];
  } | null;
  rescheduleMessage?: ScheduledMessage;
  savedDraftSource?: { kind: 'planner' | 'studio'; id: string };
};

type AppHistoryDraftActionsDependencies = {
  browserDraftMode: boolean;
  clearActivePlannerDraft: () => boolean;
  handlePersonalDeleteMessage: ReturnType<typeof useScheduler>['handleDeleteMessage'];
  openPlannerTextInStudio: (payload: StudioPlannerTextPayload, onOpened?: (opened: boolean) => void) => boolean;
  nextPlannerDraftLoadRevision: () => number;
  pendingStudioDraftUseWaitersRef: MutableRefObject<Set<(handler: (draft: SavedDraft) => Promise<boolean>) => void>>;
  productViewRef: MutableRefObject<ProductView>;
  setPlannerDraftLoadRequest: Dispatch<SetStateAction<PlannerDraftLoadRequest | null>>;
  setProductView: (view: ProductView) => void;
  showNotification: ReturnType<typeof useNotifications>['showNotification'];
  studioDraftDeleterRef: MutableRefObject<((draftId: string) => Promise<boolean>) | null>;
  studioDraftOpenerRef: MutableRefObject<((draft: SavedDraft) => void) | null>;
  studioDraftUseRef: MutableRefObject<((draft: SavedDraft) => Promise<boolean>) | null>;
  studioScheduler: Pick<ReturnType<typeof useScheduler>, 'handleDeleteMessage'>;
  t: ReturnType<typeof useLocale>['t'];
};

export function createAppHistoryDraftActions({
  browserDraftMode,
  clearActivePlannerDraft,
  handlePersonalDeleteMessage,
  openPlannerTextInStudio,
  nextPlannerDraftLoadRevision,
  pendingStudioDraftUseWaitersRef,
  productViewRef,
  setPlannerDraftLoadRequest,
  setProductView,
  showNotification,
  studioDraftDeleterRef,
  studioDraftOpenerRef,
  studioDraftUseRef,
  studioScheduler,
  t,
}: AppHistoryDraftActionsDependencies) {
  const deleteSavedStudioDraft = async (draftId: string): Promise<boolean> => {
    const registeredDelete = studioDraftDeleterRef.current;
    if (registeredDelete) return registeredDelete(draftId);
    return updateSavedStudioDrafts((drafts) => drafts.filter((draft) => draft.id !== draftId));
  };

  const deleteHistoryRecord = async (record: HistoryItem, suppressNotification = false): Promise<boolean> => {
    if (record.original.kind === 'saved-draft') return deleteSavedStudioDraft(record.original.draft.id);
    if (record.original.kind === 'saved-planner-draft') {
      const savedDraftId = record.original.draft.id;
      const remainingDrafts = readSavedPlannerDrafts().filter(({ id }) => id !== savedDraftId);
      return writeSavedPlannerDrafts(remainingDrafts);
    }
    if (record.original.kind === 'planner-draft') {
      return clearActivePlannerDraft();
    }
    const message = record.original.message;
    const normalizedChatName = message.chatName.trim().toLocaleLowerCase();
    const isSavedMessagesChat = normalizedChatName === 'saved messages' || normalizedChatName === 'сохранённые сообщения';
    const telegramMessageIds = [...new Set([
        message.telegramMessageId,
        ...(message.telegramMessageIds ?? []),
      ].filter((id): id is string | number => id !== undefined && id !== null).map(String))];
    if (record.source === 'personal' && record.status === 'sent' && isSavedMessagesChat && telegramMessageIds.length > 0) {
      return Promise.all(telegramMessageIds.map((messageId) => telegramDeleteSavedMessage({
        chatId: message.chatId,
        messageId,
      }))).then(async (results) => {
        if (results.some((result) => !result.success)) return false;
        const deleted = await handlePersonalDeleteMessage(message, true);
        if (!deleted) return false;
        if (!suppressNotification) {
          showNotification(t('history.recordDeletedFromHistory'), 'success', t('history.title'));
        }
        return true;
      });
    }
    if (!['sent', 'failed', 'cancelled'].includes(record.status)) return false;
    let deleted = false;
    if (record.source === 'workspace') {
      deleted = (await studioScheduler.handleDeleteMessage(message, true)) !== false;
    } else {
      deleted = await handlePersonalDeleteMessage(message, true);
    }
    if (deleted && record.status === 'sent' && !suppressNotification) {
      showNotification(t('history.recordDeletedFromHistory'), 'success', t('history.title'));
    }
    return deleted;
  };

  const openHistoryDraft = (record: HistoryItem) => {
    setProductView(record.source === 'workspace' ? 'studio' : 'planner');
    if (record.original.kind === 'saved-draft') {
      studioDraftOpenerRef.current?.(record.original.draft);
    } else if (record.original.kind === 'planner-draft') {
      const { text, attachments, entities } = record.original;
      setProductView('planner');
      setPlannerDraftLoadRequest({
        revision: nextPlannerDraftLoadRevision(),
        text,
        attachments: [...attachments],
        entities: [...entities],
        selectedChat: record.original.chat,
        restoreDraft: null,
      });
    } else if (record.original.kind === 'saved-planner-draft') {
      const { draft } = record.original;
      setProductView('planner');
      setPlannerDraftLoadRequest({
        revision: nextPlannerDraftLoadRevision(),
        text: draft.message,
        attachments: [...draft.attachments],
        entities: [...draft.entities],
        selectedChat: draft.selectedChat ?? null,
        restoreDraft: null,
      });
    }
  };

  const useHistoryDraft = async (record: HistoryItem, destination?: 'planner' | 'studio'): Promise<boolean> => {
    const target = destination ?? getBackgroundProductView(
      productViewRef.current,
      browserDraftMode ? 'planner' : 'studio',
    );
    if (record.original.kind === 'saved-draft' && target === 'studio') {
      setProductView('studio');
      const applyDraft = studioDraftUseRef.current ?? await new Promise<((draft: SavedDraft) => Promise<boolean>) | null>((resolve) => {
        const resolveHandler = (handler: (draft: SavedDraft) => Promise<boolean>) => {
          window.clearTimeout(timeoutId);
          resolve(handler);
        };
        const timeoutId = window.setTimeout(() => {
          pendingStudioDraftUseWaitersRef.current.delete(resolveHandler);
          resolve(null);
        }, 10_000);
        pendingStudioDraftUseWaitersRef.current.add(resolveHandler);
      });
      if (!applyDraft) {
        showNotification(t('studio.draftCouldNotBeOpened'), 'error', 'Studio');
        return false;
      }
      try {
        const applied = await applyDraft(record.original.draft);
        if (!applied) return false;
        return true;
      } catch (error) {
        console.error('Failed to use a saved Studio draft from Posts.', error);
        showNotification(t('studio.draftCouldNotBeOpened'), 'error', 'Studio');
        return false;
      }
    }

    const plannerPayload = record.original.kind === 'planner-draft'
      ? { text: record.original.text, attachments: record.original.attachments, entities: record.original.entities }
      : record.original.kind === 'saved-planner-draft'
        ? { text: record.original.draft.message, attachments: record.original.draft.attachments, entities: record.original.draft.entities }
        : record.original.kind === 'saved-draft'
          ? {
            text: record.original.draft.body,
            attachments: getPlannerAttachmentPaths(record.original.draft.attachments ?? []),
            entities: record.original.draft.entities ?? [],
          }
          : record.original.kind === 'scheduled'
            ? {
              text: record.original.message.text,
              attachments: record.original.message.attachments ?? [],
              entities: record.original.message.entities ?? [],
            }
          : null;
    if (!plannerPayload) return false;

    if (target === 'studio') {
      const savedDraftId = record.original.kind === 'saved-planner-draft' ? record.original.draft.id : null;
      return new Promise<boolean>((resolve) => {
        const started = openPlannerTextInStudio(plannerPayload, (opened) => {
          if (opened && savedDraftId) {
            const remainingDrafts = readSavedPlannerDrafts().filter(({ id }) => id !== savedDraftId);
            if (!writeSavedPlannerDrafts(remainingDrafts)) {
              showNotification(t('quickPlanner.couldNotRemoveDraft'), 'error', t('quickPlanner.draftRemovalFailed'));
            }
          }
          resolve(opened);
        });
        if (!started) resolve(false);
      });
    }

    if (!flushPlannerDraftWrite()) {
      showNotification(t('quickPlanner.couldNotSaveDraft'), 'error', 'Posts');
      return false;
    }
    setProductView('planner');
    const selectedChat = record.original.kind === 'saved-planner-draft'
      ? record.original.draft.selectedChat ?? null
      : record.original.kind === 'planner-draft'
        ? record.original.chat
      : record.original.kind === 'scheduled'
        ? {
          id: record.original.message.chatId,
          name: record.original.message.chatName,
          type: 'unknown' as const,
        }
        : null;
    setPlannerDraftLoadRequest({
      revision: nextPlannerDraftLoadRevision(),
      text: plannerPayload.text,
      attachments: [...plannerPayload.attachments],
      entities: [...plannerPayload.entities],
      selectedChat,
      restoreDraft: null,
      ...(record.original.kind === 'scheduled' ? { rescheduleMessage: record.original.message } : {}),
      ...(record.original.kind === 'saved-planner-draft'
        ? { savedDraftSource: { kind: 'planner' as const, id: record.original.draft.id } }
        : record.original.kind === 'saved-draft'
          ? { savedDraftSource: { kind: 'studio' as const, id: record.original.draft.id } }
          : {}),
    });
    return true;
  };



  return { deleteHistoryRecord, openHistoryDraft, useHistoryDraft };
}
