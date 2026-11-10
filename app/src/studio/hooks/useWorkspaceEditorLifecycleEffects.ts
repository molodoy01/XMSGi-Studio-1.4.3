import { useEffect } from 'react';
import { FOOTER_STATUS_DURATION_MS, useTimedStatus } from '../pages/WorkspacePageHelpers';
import type { WorkspacePageEffectsOptions } from './useWorkspacePageEffects';
import { useWorkspaceAttachmentPreviews } from './useWorkspaceAttachmentPreviews';
import { useWorkspaceDraftLengthLimit } from './useWorkspaceDraftLengthLimit';
import { useWorkspaceEditorFocus } from './useWorkspaceEditorFocus';
import { useWorkspaceEditorReloadGuard } from './useWorkspaceEditorReloadGuard';
import { useWorkspaceStageEscape } from './useWorkspaceStageEscape';

type Options = Pick<WorkspacePageEffectsOptions,
  | 'stageMode'
  | 'setStageMode'
  | 'draftBody'
  | 'draftEntities'
  | 'bodyInputRef'
  | 'focusRescheduledEditorAtEndRef'
  | 'focusPlannerEditorAtEndRef'
  | 'focusEditorAfterStageEscapeRef'
  | 'attachmentError'
  | 'setAttachmentError'
  | 'textFileError'
  | 'setTextFileError'
  | 'sendError'
  | 'setSendError'
  | 'draftStoreError'
  | 'setDraftStoreError'
  | 'draftStoreBackups'
  | 'chatLookupError'
  | 'setChatLookupError'
  | 'previewHistoryError'
  | 'setPreviewHistoryError'
  | 'attachmentPreviewUrlsRef'
  | 'attachments'
  | 'setAttachments'
  | 'showFeedback'
  | 'setSelectedChat'
  | 'chatOriginRef'
  | 'setWorkspaceSelectedChats'
  | 'setDraftEditingId'
  | 'setDraftName'
  | 'setDraftBodyText'
  | 'setDraftBodyEntities'
  | 'workspaceRef'
  | 'maxDraftLength'
  | 'setDraftBody'
  | 'setDraftEntities'
  | 'attachmentsCount'
>;

export function useWorkspaceEditorLifecycleEffects(options: Options, closeTemplateEditor: () => void) {
  const { stageMode, setStageMode } = options;

  useWorkspaceEditorFocus({
    stageMode,
    draftBody: options.draftBody,
    draftEntities: options.draftEntities,
    editorRef: options.bodyInputRef,
    focusRescheduledEditorAtEndRef: options.focusRescheduledEditorAtEndRef,
    focusPlannerEditorAtEndRef: options.focusPlannerEditorAtEndRef,
    focusEditorAfterStageEscapeRef: options.focusEditorAfterStageEscapeRef,
  });

  useTimedStatus(options.attachmentError, options.setAttachmentError, FOOTER_STATUS_DURATION_MS.attachmentError);
  useTimedStatus(options.textFileError, options.setTextFileError, FOOTER_STATUS_DURATION_MS.textFileError);
  useTimedStatus(options.sendError, options.setSendError, FOOTER_STATUS_DURATION_MS.sendError);
  useTimedStatus(
    options.draftStoreError,
    options.setDraftStoreError,
    FOOTER_STATUS_DURATION_MS.draftStoreError,
    options.draftStoreBackups.length > 0,
  );
  useTimedStatus(options.chatLookupError, options.setChatLookupError, FOOTER_STATUS_DURATION_MS.chatLookupError);
  useTimedStatus(options.previewHistoryError, options.setPreviewHistoryError, FOOTER_STATUS_DURATION_MS.previewHistoryError);

  useEffect(() => () => {
    options.attachmentPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    options.attachmentPreviewUrlsRef.current.clear();
  }, [options.attachmentPreviewUrlsRef]);

  useWorkspaceAttachmentPreviews({
    attachments: options.attachments,
    setAttachments: options.setAttachments,
    showFeedback: options.showFeedback,
  });
  useWorkspaceDraftLengthLimit({
    draftBody: options.draftBody,
    draftEntities: options.draftEntities,
    setDraftBody: options.setDraftBody,
    setDraftEntities: options.setDraftEntities,
    maxDraftLength: options.maxDraftLength,
    attachmentCount: options.attachmentsCount,
  });
  useWorkspaceEditorReloadGuard(options.workspaceRef);
  useWorkspaceStageEscape({
    stageMode,
    setStageMode,
    closeTemplateEditor,
    setSelectedChat: options.setSelectedChat,
    chatOriginRef: options.chatOriginRef,
    setWorkspaceSelectedChats: options.setWorkspaceSelectedChats,
    focusEditorAfterStageEscapeRef: options.focusEditorAfterStageEscapeRef,
    setDraftEditingId: options.setDraftEditingId,
    setDraftName: options.setDraftName,
    setDraftBodyText: options.setDraftBodyText,
    setDraftBodyEntities: options.setDraftBodyEntities,
  });
}
