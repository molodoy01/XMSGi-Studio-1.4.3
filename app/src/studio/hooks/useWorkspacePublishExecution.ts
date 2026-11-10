import { useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Chat, RichTextEntity, SavedDraft } from '../types';
import type { WorkspaceDraft } from '../lib/draftStore';
import { getAttachmentTransportItems, type WorkspaceAttachment } from '../lib/workspaceAttachments';
import type { WorkspacePageProps } from '../pages/workspacePageTypes';
import { FOOTER_STATUS_DURATION_MS } from '../pages/WorkspacePageHelpers';
import { createSavedDraft } from '../lib/drafts';
import { hasDraftContent } from '../lib/draftStore';
import { normalizeAttachments } from '../lib/draftAttachments';
import { richTextToHtml } from '../lib/richText';
import { uid } from '@shared/utils';
import { useLocale } from '@studio/lib/i18n';

type PublishExecutionOptions = {
  hasDraftContentState: boolean;
  canSendNow: boolean;
  selectedChat: Chat | null;
  messageEffectId: string | null;
  draftBody: string;
  draftEntities: RichTextEntity[];
  attachments: WorkspaceAttachment[];
  setDraftBody: Dispatch<SetStateAction<string>>;
  setDraftEntities: Dispatch<SetStateAction<RichTextEntity[]>>;
  setMessageEffectId: Dispatch<SetStateAction<string | null>>;
  setSendError: Dispatch<SetStateAction<string>>;
  pendingDraftReplacementRef: MutableRefObject<{ previousSnapshot: WorkspaceDraft } | null>;
  suppressDraftReplacementSuccessClearRef: MutableRefObject<boolean>;
  attachmentPreviewUrlsRef: MutableRefObject<Set<string>>;
  bodyInputRef: MutableRefObject<HTMLDivElement | null>;
  replaceAttachments: (attachments: WorkspaceAttachment[]) => void;
  setWorkspaceDocumentId: (documentId: string) => void;
  handleSendDraftNow: WorkspacePageProps['handleSendDraftNow'];
  appendPreviewHistoryMessage: (chatId: string, text: string) => void;
  setPublishMenuOpen: Dispatch<SetStateAction<boolean>>;
  showFeedback: (message: string, kind?: 'warning' | 'success', detail?: string, durationMs?: number) => void;
  completeDraftReplacementRef: MutableRefObject<(showRestoreFeedback?: boolean) => Promise<boolean>>;
  createWorkspaceDraftSnapshot: () => WorkspaceDraft | null;
  workspaceDocumentId: string;
  workspaceDocumentIdRef: MutableRefObject<string>;
  draftColor: SavedDraft['color'];
  savedDraftsRef: MutableRefObject<SavedDraft[]>;
  plannerRestoreRef: MutableRefObject<{ draft: SavedDraft | null } | null>;
  cancelPendingAutosave: () => void;
  previewSavedDrafts: (drafts: SavedDraft[]) => void;
  replaceSavedDrafts: (drafts: SavedDraft[]) => void;
  attachmentSelectionGenerationRef: MutableRefObject<number>;
  draftBodyRef: MutableRefObject<string>;
  attachmentsRef: MutableRefObject<WorkspaceAttachment[]>;
  persistDraftStore: (
    savedDrafts: SavedDraft[] | (() => SavedDraft[]),
    workspaceDraft: WorkspaceDraft | null,
    onPersisted?: () => void,
  ) => Promise<boolean>;
  setSavedAt: Dispatch<SetStateAction<string>>;
  markWorkspaceDraftPersisted: (draft: WorkspaceDraft | null) => void;
  setScheduleSelectionConfirmed: Dispatch<SetStateAction<boolean>>;
  recordWorkspaceVersion: (
    snapshot: WorkspaceDraft | null,
    reason: 'publish',
  ) => Promise<{ success: boolean }>;
  restorePlannerDocumentRef: MutableRefObject<() => Promise<boolean>>;
};

export function useWorkspacePublishExecution() {
  const { t } = useLocale();
  const [sendInFlight, setSendInFlight] = useState(false);
  const sendInFlightRef = useRef(false);
  const [savingCurrentDraft, setSavingCurrentDraft] = useState(false);
  const savingCurrentDraftRef = useRef(false);

  return {
    sendInFlight,
    savingCurrentDraft,
    createActions: (options: PublishExecutionOptions) => createPublishActions(options, {
      sendInFlightRef,
      setSendInFlight,
      savingCurrentDraftRef,
      setSavingCurrentDraft,
    }, t),
  };
}

function createPublishActions(
  options: PublishExecutionOptions,
  state: {
    sendInFlightRef: MutableRefObject<boolean>;
    setSendInFlight: Dispatch<SetStateAction<boolean>>;
    savingCurrentDraftRef: MutableRefObject<boolean>;
    setSavingCurrentDraft: Dispatch<SetStateAction<boolean>>;
  },
  t: ReturnType<typeof useLocale>['t'],
) {
  const { sendInFlightRef, setSendInFlight, savingCurrentDraftRef, setSavingCurrentDraft } = state;
  const sendDraftNow = async () => {
    const {
      selectedChat, canSendNow, pendingDraftReplacementRef, draftBody, attachments, draftEntities,
      handleSendDraftNow, setSendError, setPublishMenuOpen, suppressDraftReplacementSuccessClearRef,
      appendPreviewHistoryMessage, setDraftBody, setDraftEntities, bodyInputRef, replaceAttachments,
      attachmentPreviewUrlsRef, setWorkspaceDocumentId, setMessageEffectId, showFeedback,
      completeDraftReplacementRef,
    } = options;
    if (!selectedChat || !canSendNow || sendInFlightRef.current) return;
    const isDraftReplacementSend = pendingDraftReplacementRef.current !== null;
    const chat = selectedChat;
    const text = draftBody;
    const attachmentTransportItems = getAttachmentTransportItems(attachments);
    const attachmentGroups = attachmentTransportItems.map((item) => item.paths);
    const failedAttachmentIds = new Set<string>();
    let successfulGroupCount = 0;
    let firstGroupSent = false;
    sendInFlightRef.current = true;
    setSendInFlight(true);
    setSendError('');
    setPublishMenuOpen(false);
    suppressDraftReplacementSuccessClearRef.current = isDraftReplacementSend;
    try {
      const sent = await handleSendDraftNow(
        chat,
        text,
        attachmentGroups.flat(),
        draftEntities,
        attachmentGroups,
        (groupIndex, sentGroup) => {
          if (groupIndex === 0) firstGroupSent = sentGroup;
          const group = attachmentTransportItems[groupIndex];
          if (sentGroup) {
            successfulGroupCount += 1;
            return;
          }
          group?.attachments.forEach((attachment) => failedAttachmentIds.add(attachment.id));
        },
        options.messageEffectId ?? undefined,
        true,
      );
      if (!sent) {
        suppressDraftReplacementSuccessClearRef.current = false;
        if (failedAttachmentIds.size > 0) {
          const returnedAttachments = attachments.filter((attachment) => failedAttachmentIds.has(attachment.id));
          const returnedAttachmentIds = new Set(returnedAttachments.map((attachment) => attachment.id));
          attachments.forEach((attachment) => {
            if (returnedAttachmentIds.has(attachment.id)) return;
            const previewUrl = attachment.previewUrl;
            if (previewUrl && attachmentPreviewUrlsRef.current.delete(previewUrl)) {
              URL.revokeObjectURL(previewUrl);
            }
          });
          replaceAttachments(returnedAttachments);

          if (firstGroupSent) {
            if (bodyInputRef.current) {
              bodyInputRef.current.innerHTML = '';
              bodyInputRef.current.dataset.selectionStart = '0';
              bodyInputRef.current.dataset.selectionEnd = '0';
            }
            setDraftBody('');
            setDraftEntities([]);
            setWorkspaceDocumentId(uid());
            if (text.trim()) appendPreviewHistoryMessage(chat.id, text);
          }
        }
        setSendError(successfulGroupCount > 0 ? '' : t('studio.sendFailed'));
        return;
      }

      setSendError('');
      if (sent === 'sent-history-failed' && !isDraftReplacementSend) {
        suppressDraftReplacementSuccessClearRef.current = false;
      }
      if (sent !== 'sent-history-failed') {
        if (!pendingDraftReplacementRef.current) {
          if (bodyInputRef.current) {
            bodyInputRef.current.innerHTML = '';
            bodyInputRef.current.dataset.selectionStart = '0';
            bodyInputRef.current.dataset.selectionEnd = '0';
          }
          setDraftBody('');
          setDraftEntities([]);
        }
        setMessageEffectId(null);
      }
      showFeedback(
        sent === 'sent-history-failed'
          ? 'Telegram sent the message, but local history could not be saved. Do not resend this message.'
          : t('studio.messageSent'),
        sent === 'sent-history-failed' ? 'warning' : 'success',
        '',
        sent === 'sent-history-failed'
          ? FOOTER_STATUS_DURATION_MS.publishWarning
          : FOOTER_STATUS_DURATION_MS.publishSuccess,
      );

      appendPreviewHistoryMessage(chat.id, text);
      if (isDraftReplacementSend && pendingDraftReplacementRef.current) {
        if (sent === 'sent-history-failed') {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, FOOTER_STATUS_DURATION_MS.publishWarning);
          });
        }
        await completeDraftReplacementRef.current(sent !== true);
      }
    } catch {
      suppressDraftReplacementSuccessClearRef.current = false;
      setSendError(t('studio.sendFailed'));
    } finally {
      sendInFlightRef.current = false;
      setSendInFlight(false);
    }
  };

  const saveCurrentDraft = async () => {
    const {
      hasDraftContentState, createWorkspaceDraftSnapshot, workspaceDocumentId, draftColor,
      workspaceDocumentIdRef,
      savedDraftsRef, plannerRestoreRef, attachmentPreviewUrlsRef, cancelPendingAutosave,
      previewSavedDrafts, attachmentSelectionGenerationRef, bodyInputRef, draftBodyRef,
      setDraftBody, setDraftEntities, replaceAttachments, setWorkspaceDocumentId, persistDraftStore,
      replaceSavedDrafts, setSavedAt, markWorkspaceDraftPersisted, showFeedback,
      setScheduleSelectionConfirmed, setPublishMenuOpen, recordWorkspaceVersion,
      restorePlannerDocumentRef, attachmentsRef,
    } = options;
    if (!hasDraftContentState || savingCurrentDraftRef.current) return;

    const nextDraft = createWorkspaceDraftSnapshot();
    if (!nextDraft) return;
    const savedDraft = createSavedDraft({
      ...nextDraft,
      name: `Draft ${nextDraft.savedAt}`,
      documentId: workspaceDocumentId,
      color: draftColor,
    });
    const nextSavedDrafts = [savedDraft, ...savedDraftsRef.current];
    const restoringPlannerDraft = Boolean(plannerRestoreRef.current?.draft);
    const previousDocumentId = workspaceDocumentId;
    const emptyDocumentId = uid();
    const previewUrlsToRevoke = [...attachmentPreviewUrlsRef.current];
    savingCurrentDraftRef.current = true;
    setSavingCurrentDraft(true);

    if (!restoringPlannerDraft) {
      cancelPendingAutosave();
      previewSavedDrafts(nextSavedDrafts);
      attachmentSelectionGenerationRef.current += 1;
      if (bodyInputRef.current) {
        bodyInputRef.current.innerHTML = '';
        bodyInputRef.current.dataset.selectionStart = '0';
        bodyInputRef.current.dataset.selectionEnd = '0';
      }
      draftBodyRef.current = '';
      setDraftBody('');
      setDraftEntities([]);
      replaceAttachments([]);
      setWorkspaceDocumentId(emptyDocumentId);
    }

    try {
      const persistedWorkspaceDraft = restoringPlannerDraft ? nextDraft : null;
      const persisted = await persistDraftStore(nextSavedDrafts, persistedWorkspaceDraft, () => {
        replaceSavedDrafts(nextSavedDrafts);
        setSavedAt(nextDraft.savedAt);
        markWorkspaceDraftPersisted(persistedWorkspaceDraft);
      });
      if (!persisted) {
        if (!restoringPlannerDraft) {
          previewSavedDrafts(savedDraftsRef.current);
          if (workspaceDocumentIdRef.current === emptyDocumentId
            && !hasDraftContent(draftBodyRef.current, attachmentsRef.current)) {
            if (bodyInputRef.current) {
              bodyInputRef.current.innerHTML = richTextToHtml(nextDraft.body, nextDraft.entities ?? []);
              bodyInputRef.current.dataset.selectionStart = '0';
              bodyInputRef.current.dataset.selectionEnd = '0';
            }
            draftBodyRef.current = nextDraft.body;
            setDraftBody(nextDraft.body);
            setDraftEntities(nextDraft.entities ?? []);
            replaceAttachments(normalizeAttachments(nextDraft.attachments));
            setWorkspaceDocumentId(previousDocumentId);
          }
        }
        return;
      }

      showFeedback(t('studio.draftSavedNotice'), 'success');
      setScheduleSelectionConfirmed(false);
      setPublishMenuOpen(false);
      if (restoringPlannerDraft) {
        const checkpoint = await recordWorkspaceVersion(createWorkspaceDraftSnapshot(), 'publish');
        if (!checkpoint.success) {
          showFeedback(t('studio.historyCouldNotSave'), 'warning');
          return;
        }
        await restorePlannerDocumentRef.current();
        return;
      }
      previewUrlsToRevoke.forEach((url) => {
        URL.revokeObjectURL(url);
        attachmentPreviewUrlsRef.current.delete(url);
      });
    } finally {
      savingCurrentDraftRef.current = false;
      setSavingCurrentDraft(false);
    }
  };

  return { saveCurrentDraft, sendDraftNow };
}
