import { createWorkspaceTextTransferHandlers } from '../lib/workspaceTextTransfer';
import { useWorkspaceEditorChange } from './useWorkspaceEditorChange';
import { useWorkspaceEditorHistoryActions } from './useWorkspaceEditorHistoryActions';
import { useWorkspaceTextInsertion } from './useWorkspaceTextInsertion';

type HistoryOptions = Parameters<typeof useWorkspaceEditorHistoryActions>[0];
type TransferOptions = Parameters<typeof createWorkspaceTextTransferHandlers>[0];

type Options = {
  draftBody: string;
  maxDraftLength: number;
  draftBodyRef: Parameters<typeof useWorkspaceEditorChange>[0]['draftBodyRef'];
  setAttachments: Parameters<typeof useWorkspaceEditorChange>[0]['setAttachments'];
  setDraftBody: Parameters<typeof useWorkspaceEditorChange>[0]['setDraftBody'];
  setDraftEntities: Parameters<typeof useWorkspaceEditorChange>[0]['setDraftEntities'];
  editorRef: Parameters<typeof useWorkspaceTextInsertion>[0]['editorRef'];
  attachmentHistory: Pick<
    HistoryOptions,
    | 'attachments'
    | 'replaceAttachments'
    | 'attachmentPreviewUrlsRef'
    | 'pendingDraftReplacementRef'
    | 'restorePreviousDraftAfterReplacement'
    | 'plannerRestoreRef'
    | 'restorePlannerDocumentRef'
    | 'historyCouldNotSaveMessage'
  >;
  createWorkspaceDraftSnapshot: HistoryOptions['createWorkspaceDraftSnapshot'];
  recordWorkspaceVersion: TransferOptions['recordWorkspaceVersion'];
  showFeedback: HistoryOptions['showFeedback'];
  confirm: TransferOptions['confirm'];
  translate: TransferOptions['t'];
  setTextFileError: TransferOptions['setTextFileError'];
  showPublishFeedback: TransferOptions['showPublishFeedback'];
  changeStageMode: TransferOptions['changeStageMode'];
};

export function useWorkspacePageEditorActions({
  draftBody,
  maxDraftLength,
  draftBodyRef,
  setAttachments,
  setDraftBody,
  setDraftEntities,
  editorRef,
  attachmentHistory,
  createWorkspaceDraftSnapshot,
  recordWorkspaceVersion,
  showFeedback,
  confirm,
  translate,
  setTextFileError,
  showPublishFeedback,
  changeStageMode,
}: Options) {
  const handleEditorChange = useWorkspaceEditorChange({
    maxLength: maxDraftLength,
    draftBodyRef,
    setAttachments,
    setDraftBody,
    setDraftEntities,
  });
  const insertTextAtCursor = useWorkspaceTextInsertion({
    editorRef,
    draftBody,
    setDraftBody,
    setDraftEntities,
  });
  const editorHistoryActions = useWorkspaceEditorHistoryActions({
    ...attachmentHistory,
    createWorkspaceDraftSnapshot,
    recordWorkspaceVersion,
    showFeedback,
  });
  const textTransferHandlers = createWorkspaceTextTransferHandlers({
    draftBody,
    maxDraftLength,
    setDraftBody,
    setDraftEntities,
    setTextFileError,
    confirm,
    t: translate,
    createWorkspaceDraftSnapshot,
    recordWorkspaceVersion,
    showPublishFeedback,
    changeStageMode,
  });

  return {
    handleEditorChange,
    insertTextAtCursor,
    ...editorHistoryActions,
    ...textTransferHandlers,
  };
}
