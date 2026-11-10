import { useEffect, useRef } from 'react';
import type { WorkspacePageProps } from '../pages/workspacePageTypes';
import type { SavedDraft, ScheduledMessage } from '../types';

type HistoryHandlers = {
  openDraft: (draft: SavedDraft) => void;
  useDraft: (draft: SavedDraft) => Promise<boolean>;
  clearDrafts: () => Promise<boolean>;
  deleteDraft: (draftId: string) => Promise<boolean>;
  reschedule: (message: ScheduledMessage) => void;
};

export function useWorkspaceHistoryRegistrations(
  registrations: Pick<
    WorkspacePageProps,
    | 'onRegisterHistoryDraftOpener'
    | 'onRegisterHistoryDraftUseHandler'
    | 'onRegisterHistoryDraftClearHandler'
    | 'onRegisterHistoryDraftDeleteHandler'
    | 'onRegisterHistoryRescheduleHandler'
  >,
  handlers: HistoryHandlers,
) {
  const {
    onRegisterHistoryDraftOpener,
    onRegisterHistoryDraftUseHandler,
    onRegisterHistoryDraftClearHandler,
    onRegisterHistoryDraftDeleteHandler,
    onRegisterHistoryRescheduleHandler,
  } = registrations;
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!onRegisterHistoryDraftOpener) return;
    onRegisterHistoryDraftOpener((draft) => handlersRef.current.openDraft(draft));
    return () => onRegisterHistoryDraftOpener(null);
  }, [onRegisterHistoryDraftOpener]);

  useEffect(() => {
    if (!onRegisterHistoryDraftUseHandler) return;
    onRegisterHistoryDraftUseHandler((draft) => handlersRef.current.useDraft(draft));
    return () => onRegisterHistoryDraftUseHandler(null);
  }, [onRegisterHistoryDraftUseHandler]);

  useEffect(() => {
    if (!onRegisterHistoryDraftClearHandler) return;
    onRegisterHistoryDraftClearHandler(() => handlersRef.current.clearDrafts());
    return () => onRegisterHistoryDraftClearHandler(null);
  }, [onRegisterHistoryDraftClearHandler]);

  useEffect(() => {
    if (!onRegisterHistoryDraftDeleteHandler) return;
    onRegisterHistoryDraftDeleteHandler((draftId) => handlersRef.current.deleteDraft(draftId));
    return () => onRegisterHistoryDraftDeleteHandler(null);
  }, [onRegisterHistoryDraftDeleteHandler]);

  useEffect(() => {
    if (!onRegisterHistoryRescheduleHandler) return;
    onRegisterHistoryRescheduleHandler((message) => handlersRef.current.reschedule(message));
    return () => onRegisterHistoryRescheduleHandler(null);
  }, [onRegisterHistoryRescheduleHandler]);
}
