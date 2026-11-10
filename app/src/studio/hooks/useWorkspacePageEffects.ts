import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Chat, RichTextEntity } from '../types';
import type { ScheduleRepeatOptions } from '../lib/scheduling';
import type { WorkspaceDraft } from '../lib/draftStore';
import type { WorkspaceAttachment } from '../lib/workspaceAttachments';
import { useWorkspaceTemplates } from './useWorkspaceTemplates';
import { useWorkspacePublishExecution } from './useWorkspacePublishExecution';
import { useWorkspaceEditorLifecycleEffects } from './useWorkspaceEditorLifecycleEffects';
import { useWorkspacePublishLifecycleEffects } from './useWorkspacePublishLifecycleEffects';
import { useWorkspacePreviewState } from './useWorkspacePreviewState';
import type { WorkspacePageProps } from '../pages/workspacePageTypes';
import type { PendingDraftReplacement } from './useWorkspaceDraftReplacement';
import type { SavedDraft } from '../types';

export type WorkspacePageEffectsOptions = {
  stageMode: 'editor' | 'schedule' | 'template' | 'draft' | 'chat';
  setStageMode: Dispatch<SetStateAction<'editor' | 'schedule' | 'template' | 'draft' | 'chat'>>;
  lastAction: WorkspacePageProps['lastAction'];
  scheduling: boolean;
  scheduleSubmissionPendingRef: MutableRefObject<boolean>;
  scheduleSubmissionStartedRef: MutableRefObject<boolean>;
  setRepeatMode: Dispatch<SetStateAction<ScheduleRepeatOptions['mode']>>;
  setRepeatDays: Dispatch<SetStateAction<string[]>>;
  setRepeatOccurrences: Dispatch<SetStateAction<number>>;
  setScheduleFocus: Dispatch<SetStateAction<'repeat' | 'time' | null>>;
  draftBody: string;
  draftEntities: RichTextEntity[];
  bodyInputRef: MutableRefObject<HTMLDivElement | null>;
  focusRescheduledEditorAtEndRef: MutableRefObject<boolean>;
  focusPlannerEditorAtEndRef: MutableRefObject<boolean>;
  focusEditorAfterStageEscapeRef: MutableRefObject<boolean>;
  attachmentError: string;
  setAttachmentError: Dispatch<SetStateAction<string>>;
  textFileError: string;
  setTextFileError: Dispatch<SetStateAction<string>>;
  sendError: string;
  setSendError: Dispatch<SetStateAction<string>>;
  draftStoreError: string;
  setDraftStoreError: Dispatch<SetStateAction<string>>;
  draftStoreBackups: number[];
  chatLookupError: string;
  setChatLookupError: Dispatch<SetStateAction<string>>;
  previewHistoryError: string;
  setPreviewHistoryError: Dispatch<SetStateAction<string>>;
  attachmentPreviewUrlsRef: MutableRefObject<Set<string>>;
  attachments: WorkspaceAttachment[];
  setAttachments: Dispatch<SetStateAction<WorkspaceAttachment[]>>;
  showFeedback: (message: string, kind?: 'warning' | 'success') => void;
  setSelectedChat: WorkspacePageProps['setSelectedChat'];
  chatOriginRef: MutableRefObject<Chat | null>;
  setWorkspaceSelectedChats: Dispatch<SetStateAction<Chat[]>>;
  setDraftEditingId: Dispatch<SetStateAction<string | null>>;
  setDraftName: Dispatch<SetStateAction<string>>;
  setDraftBodyText: Dispatch<SetStateAction<string>>;
  setDraftBodyEntities: Dispatch<SetStateAction<RichTextEntity[]>>;
  publishMenuOpen: boolean;
  setPublishMenuOpen: Dispatch<SetStateAction<boolean>>;
  publishMenuRef: MutableRefObject<HTMLDivElement | null>;
  publishMenuToggleRef: MutableRefObject<HTMLButtonElement | null>;
  chatListOpen: boolean;
  setChatListOpen: Dispatch<SetStateAction<boolean>>;
  successPulse: boolean;
  suppressDraftReplacementSuccessClearRef: MutableRefObject<boolean>;
  pendingDraftReplacementRef: MutableRefObject<PendingDraftReplacement | null>;
  completeDraftReplacementRef: MutableRefObject<(showRestoreFeedback?: boolean) => Promise<boolean>>;
  createWorkspaceDraftSnapshot: () => WorkspaceDraft | null;
  attachmentSelectionGenerationRef: MutableRefObject<number>;
  recordWorkspaceVersionRef: MutableRefObject<(
    snapshot: WorkspaceDraft | null,
    reason: 'publish',
  ) => Promise<{ success: boolean }>>;
  plannerRestoreRef: MutableRefObject<{ draft: SavedDraft | null } | null>;
  restorePlannerDocumentRef: MutableRefObject<() => Promise<boolean>>;
  replaceAttachments: (attachments: WorkspaceAttachment[]) => void;
  setWorkspaceDocumentId: (id: string) => void;
  newDocumentId: () => string;
  workspaceRef: MutableRefObject<HTMLDivElement | null>;
  maxDraftLength: number;
  setDraftBody: Dispatch<SetStateAction<string>>;
  setDraftEntities: Dispatch<SetStateAction<RichTextEntity[]>>;
  draftEditingId: string | null;
  draftBodyText: string;
  attachmentsCount: number;
  selectedChat: Chat | null;
  previewHistoryChatId?: string;
  previewHistoryMessageCount: number;
  previewHistoryLoading: boolean;
  previewFeedRef: MutableRefObject<HTMLDivElement | null>;
  previewCollapsed: boolean;
  previewClockNow: number;
  onRegisterBeforeLeaveStudio: WorkspacePageProps['onRegisterBeforeLeaveStudio'];
  fallbackError: string;
  historyCouldNotSaveMessage: string;
  flushWorkspaceDraftNow: () => Promise<{ success: boolean; error: string }>;
  draftBodyEntities: RichTextEntity[];
};

export function useWorkspacePageEffects(options: WorkspacePageEffectsOptions) {
  const { setStageMode } = options;
  const templates = useWorkspaceTemplates({ showFeedback: options.showFeedback, setStageMode });
  useWorkspaceEditorLifecycleEffects(options, templates.closeTemplateEditor);
  useWorkspacePublishLifecycleEffects(options);
  const previewState = useWorkspacePreviewState(options, templates);

  const publishExecution = useWorkspacePublishExecution();

  return {
    ...templates,
    ...previewState,
    publishExecution,
  };
}
