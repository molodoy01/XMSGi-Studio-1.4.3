import { useEffect, useRef, useState } from 'react';
import { useConfirm } from '@/components/useConfirm';
import { WorkspacePreviewPanel } from '../components/WorkspacePreviewPanel';
import { useWorkspaceAttachmentSelection } from '../hooks/useWorkspaceAttachmentSelection';
import { useWorkspaceAttachmentPreview } from '../hooks/useWorkspaceAttachmentPreview';
import { useWorkspaceStageMode } from '../hooks/useWorkspaceStageMode';
import { useWorkspacePageDocumentActions } from '../hooks/useWorkspacePageDocumentActions';
import { useWorkspaceDocumentState } from '../hooks/useWorkspaceDocumentState';
import { useWorkspacePageControls } from '../hooks/useWorkspacePageControls';
import { useWorkspaceDraftHydration } from '../hooks/useWorkspaceDraftHydration';
import { useWorkspacePageDraftLifecycle } from '../hooks/useWorkspacePageDraftLifecycle';
import { useWorkspacePageEffects } from '../hooks/useWorkspacePageEffects';
import { useWorkspacePageEditorActions } from '../hooks/useWorkspacePageEditorActions';
import { useWorkspacePagePublishing } from '../hooks/useWorkspacePagePublishing';
import { WorkspacePageDialogs } from '../components/WorkspacePageDialogs';
import { WorkspacePageEditorSection } from '../components/WorkspacePageEditorSection';
import type { WorkspacePageProps } from './workspacePageTypes';
import { WorkspaceAttachmentPreviewPortal } from '../components/WorkspaceAttachmentPreviewPortal';
import { getMessageMaxLength } from '../lib/messageLimits';
import { useLocale } from '@studio/lib/i18n';
import type { DraftColor } from '@studio/types';
import { readDraftStageColorFilter, writeDraftStageColorFilter } from '../lib/workspacePreferences';
import {
  MAX_ALBUMS,
} from '../lib/workspaceAttachments';
import { uid } from '@shared/utils';
import './WorkspacePage.css';

export function WorkspacePage({
  connected,
  connectionRecoveryStatus = null,
  inlineNotification = null,
  chats,
  selectedChat,
  setSelectedChat,
  selectedChatControlled = false,
  onAddChat,
  onRemoveChat,
  removeModal,
  setRemoveModal,
  confirmRemoveChat,
  upcoming,
  date,
  time,
  scheduling,
  successPulse,
  lastAction,
  setDate,
  setTime,
  handleSchedule,
  handleSendDraftNow,
  publishingDraft,
  onRegisterPlannerTextOpener,
  onRegisterBeforeLeaveStudio,
  onRegisterHistoryDraftOpener,
  onRegisterHistoryDraftUseHandler,
  onRegisterHistoryDraftClearHandler,
  onRegisterHistoryDraftDeleteHandler,
  onRegisterHistoryRescheduleHandler,
}: WorkspacePageProps) {
  const { locale, t } = useLocale();
  const confirm = useConfirm();
  const attachmentPreviewUrlsRef = useRef(new Set<string>());
  const attachmentItemsRef = useRef<HTMLDivElement | null>(null);
  const bodyInputRef = useRef<HTMLDivElement | null>(null);
  const focusRescheduledEditorAtEndRef = useRef(false);
  const focusPlannerEditorAtEndRef = useRef(false);
  const focusEditorAfterStageEscapeRef = useRef(false);
  const restorePlannerDocumentRef = useRef<() => Promise<boolean>>(async () => false);
  const previewFeedRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const [selectedDraftColor, setSelectedDraftColor] = useState<DraftColor | null>(readDraftStageColorFilter);
  useEffect(() => {
    writeDraftStageColorFilter(selectedDraftColor);
  }, [selectedDraftColor]);
  const {
    initialDraftRef,
    initialDraftLoadErrorRef,
    workspaceDocumentId,
    workspaceDocumentIdRef,
    setWorkspaceDocumentId,
    draftBody,
    setDraftBody,
    draftBodyRef,
    draftEntities,
    setDraftEntities,
    messageEffectId,
    setMessageEffectId,
    attachments,
    setAttachments,
    attachmentsRef,
    attachmentUsageRef,
    attachmentSelectionGenerationRef,
    replaceAttachments,
  } = useWorkspaceDocumentState();
  const {
    attachmentPreview,
    showAttachmentPreview,
    scheduleAttachmentPreview,
    hideAttachmentPreview,
  } = useWorkspaceAttachmentPreview();
  const [attachmentError, setAttachmentError] = useState('');
  const [textFileError, setTextFileError] = useState('');
  const attachmentSelection = useWorkspaceAttachmentSelection({
    attachments,
    setAttachments,
    attachmentUsageRef,
    attachmentSelectionGenerationRef,
    draftBody,
    setAttachmentError,
  });
  const {
    fileInputRef,
    albumFileInputRef,
    handleAddFiles,
    handleFileSelection,
    handleAlbumFileSelection,
    openAlbumFileSelection,
  } = attachmentSelection;
  const pageControls = useWorkspacePageControls({
    connected,
    selectedChat,
    setSelectedChat,
    chats,
    date,
    time,
    setDate,
    setTime,
    workspaceRef,
  });
  const { stageMode, setStageMode } = pageControls.stage;
  const {
    workspaceSelectedChats,
    setWorkspaceSelectedChats,
    workspaceChatOriginRef,
    openChatSelection,
    backFromChatSelection,
    completeChatSelection,
    chatLookupError,
    setChatLookupError,
  } = pageControls.chatSelection;
  const {
    scheduleFocus,
    setScheduleFocus,
    followCurrentTime,
    setFollowCurrentTime,
    scheduleSelectionConfirmed,
    setScheduleSelectionConfirmed,
    repeatMode,
    setRepeatMode,
    repeatDays,
    setRepeatDays,
    repeatOccurrences,
    setRepeatOccurrences,
    scheduleClockNow,
    scheduleSubmissionPendingRef,
    scheduleSubmissionStartedRef,
  } = pageControls.schedule;
  const { draftColor, setDraftColor } = pageControls.drafts;
  const {
    previewHistory,
    previewHistoryLoading,
    previewHistoryError,
    setPreviewHistoryError,
    previewHistoryErrorRetryable,
    retryPreviewHistory,
    appendMessage: appendPreviewHistoryMessage,
    setChatWallpaper,
    chatListOpen,
    setChatListOpen,
    previewVisible,
    previewCollapsed,
    togglePreviewVisibility,
  } = pageControls.preview;
  const {
    publishMenuOpen,
    setPublishMenuOpen,
    sendError,
    setSendError,
    pendingDraftReplacementRef,
    suppressDraftReplacementSuccessClearRef,
    completeDraftReplacementRef,
    publishFeedback,
    publishFeedbackDetail,
    publishFeedbackKind,
    publishFeedbackOverridesProgress,
    publishFeedbackInstance,
    retriggeredPublishFeedback,
    showPublishFeedback,
    clearPublishFeedbackMessage,
    publishAction,
    setPublishAction,
    publishMenuRef,
    publishMenuToggleRef,
  } = pageControls.publishing;
  const { telegramConnectionState, previewClockNow } = pageControls.runtime;
  const { editorAppearance, editorAppearanceTokens } = pageControls.editorAppearance;
  const {
    rescheduleSource,
    setRescheduleSource,
    rescheduleSourceRef,
    plannerRestoreRef,
  } = pageControls.rescheduling;
  const maxDraftLength = getMessageMaxLength(attachments.length > 0);

  const applyWorkspaceDraft = useWorkspaceDraftHydration({
    rescheduleSourceRef,
    workspaceDocumentIdRef,
    setWorkspaceDocumentId,
    initialDraftRef,
    attachmentSelectionGenerationRef,
    selectedChat,
    date,
    time,
    repeatMode,
    repeatOccurrences,
    setDraftBody,
    setDraftEntities,
    replaceAttachments,
    setFollowCurrentTime,
    setDate,
    setTime,
    setRepeatMode,
    setRepeatDays,
    setRepeatOccurrences,
  });

  const draftLifecycle = useWorkspacePageDraftLifecycle({
    lifecycle: {
      initialWorkspaceDraftRef: initialDraftRef,
      initialWorkspaceDraftError: initialDraftLoadErrorRef.current,
      workspace: {
        documentId: workspaceDocumentId,
        body: draftBody,
        entities: draftEntities,
        attachments,
        selectedChat,
        date,
        time,
        repeatMode,
        repeatDays,
        repeatOccurrences,
      },
      chats,
      setSelectedChat,
      preserveSelectedChat: selectedChatControlled,
      setDate,
      setTime,
      rescheduleSourceRef,
      onWorkspaceDraftLoaded: applyWorkspaceDraft,
    },
    setStageMode,
    confirm,
    showFeedback: showPublishFeedback,
  });
  const {
    savedDrafts,
    savedDraftsRef,
    replaceSavedDrafts,
    previewSavedDrafts,
    documentHistories,
    draftStoreReady,
    draftStoreSaving,
    draftStoreError,
    setDraftStoreError,
    draftStoreBackups,
    savedAt,
    setSavedAt,
    persistDraftStore,
    cancelPendingAutosave,
    flushWorkspaceDraftNow,
    createWorkspaceDraftSnapshot,
    markWorkspaceDraftPersisted,
    recordWorkspaceVersion,
    handleRestoreDraftBackup: restoreDraftBackup,
    handleExportDrafts: exportDrafts,
    handleImportDrafts: importDrafts,
    draftEditingId,
    setDraftEditingId,
    draftEditorColor,
    setDraftEditorColor,
    draftName,
    setDraftName,
    draftBodyText,
    setDraftBodyText,
    draftBodyEntities,
    setDraftBodyEntities,
    openDraftEditor,
    closeDraftEditor,
    handleDeleteDraft,
    saveDraftStage,
    recordWorkspaceVersionRef,
  } = draftLifecycle;

  const {
    templates,
    templateEditingId,
    templateDraftName,
    setTemplateDraftName,
    templateDraftBody,
    setTemplateDraftBody,
    openTemplateEditor,
    closeTemplateEditor,
    saveTemplateStage,
    handleDeleteTemplate,
    handleExportTemplates,
    handleImportTemplates,
    deferredPreviewText,
    deferredPreviewEntities,
    toggleChatList,
    selectPreviewChat,
    publishExecution,
    previewTime,
  } = useWorkspacePageEffects({
    stageMode,
    setStageMode,
    lastAction,
    scheduling,
    scheduleSubmissionPendingRef,
    scheduleSubmissionStartedRef,
    setRepeatMode,
    setRepeatDays,
    setRepeatOccurrences,
    setScheduleFocus,
    draftBody,
    draftEntities,
    bodyInputRef,
    focusRescheduledEditorAtEndRef,
    focusPlannerEditorAtEndRef,
    focusEditorAfterStageEscapeRef,
    attachmentError,
    setAttachmentError,
    textFileError,
    setTextFileError,
    sendError,
    setSendError,
    draftStoreError,
    setDraftStoreError,
    draftStoreBackups,
    chatLookupError,
    setChatLookupError,
    previewHistoryError,
    setPreviewHistoryError,
    attachmentPreviewUrlsRef,
    attachments,
    setAttachments,
    showFeedback: showPublishFeedback,
    setSelectedChat,
    chatOriginRef: workspaceChatOriginRef,
    setWorkspaceSelectedChats,
    setDraftEditingId,
    setDraftName,
    setDraftBodyText,
    setDraftBodyEntities,
    publishMenuOpen,
    setPublishMenuOpen,
    publishMenuRef,
    publishMenuToggleRef,
    chatListOpen,
    setChatListOpen,
    successPulse,
    suppressDraftReplacementSuccessClearRef,
    pendingDraftReplacementRef,
    completeDraftReplacementRef,
    createWorkspaceDraftSnapshot,
    attachmentSelectionGenerationRef,
    recordWorkspaceVersionRef,
    plannerRestoreRef,
    restorePlannerDocumentRef,
    replaceAttachments,
    setWorkspaceDocumentId,
    newDocumentId: uid,
    workspaceRef,
    maxDraftLength,
    setDraftBody,
    setDraftEntities,
    draftEditingId,
    draftBodyText,
    draftBodyEntities,
    attachmentsCount: attachments.length,
    selectedChat,
    previewHistoryChatId: previewHistory?.chat.id,
    previewHistoryMessageCount: previewHistory?.messages.length ?? 0,
    previewHistoryLoading,
    previewFeedRef,
    previewCollapsed,
    previewClockNow,
    onRegisterBeforeLeaveStudio,
    fallbackError: t('studio.draftsCouldNotSave'),
    historyCouldNotSaveMessage: t('studio.historyCouldNotSave'),
    flushWorkspaceDraftNow,
  });
  const changeStageMode = useWorkspaceStageMode({
    stageMode,
    setStageMode,
    setScheduleFocus,
    setSelectedChat,
    chatOriginRef: workspaceChatOriginRef,
    setWorkspaceSelectedChats,
    closeTemplateEditor,
    closeDraftEditor,
  });
  const handleDraftsNavigationClick = () => {
    if (stageMode === 'draft') {
      changeStageMode('editor');
      return;
    }

    changeStageMode('draft');
  };

  const documentActions = useWorkspacePageDocumentActions({
    page: {
      chats,
      upcoming,
      selectedChat,
      setSelectedChat,
      date,
      time,
      setDate,
      setTime,
      onRegisterPlannerTextOpener,
      onRegisterHistoryDraftOpener,
      onRegisterHistoryDraftUseHandler,
      onRegisterHistoryDraftClearHandler,
      onRegisterHistoryDraftDeleteHandler,
      onRegisterHistoryRescheduleHandler,
    },
    document: {
      initialDraftRef,
      initialDraftLoadErrorRef,
      workspaceDocumentId,
      workspaceDocumentIdRef,
      setWorkspaceDocumentId,
      draftBody,
      setDraftBody,
      draftBodyRef,
      draftEntities,
      setDraftEntities,
      messageEffectId,
      setMessageEffectId,
      attachments,
      setAttachments,
      attachmentsRef,
      attachmentUsageRef,
      attachmentSelectionGenerationRef,
      replaceAttachments,
    },
    controls: pageControls,
    drafts: draftLifecycle,
    refs: {
      bodyInputRef,
      focusRescheduledEditorAtEndRef,
      focusPlannerEditorAtEndRef,
      restorePlannerDocumentRef,
    },
    stage: { setStageMode, changeStageMode },
    confirm,
    showFeedback: showPublishFeedback,
  });
  const {
    draftReplacement: draftReplacementActions,
    versionHistory,
  } = documentActions;
  const {
    restorePreviousDraftAfterReplacement,
    useSavedDraft,
  } = draftReplacementActions;

  const publishing = useWorkspacePagePublishing({
    execution: {
      controller: publishExecution,
      actions: {
        selectedChat,
        messageEffectId,
        draftBody,
        draftEntities,
        attachments,
        setDraftBody,
        setDraftEntities,
        setMessageEffectId,
        setSendError,
        pendingDraftReplacementRef,
        suppressDraftReplacementSuccessClearRef,
        attachmentPreviewUrlsRef,
        bodyInputRef,
        replaceAttachments,
        setWorkspaceDocumentId,
        handleSendDraftNow,
        appendPreviewHistoryMessage,
        setPublishMenuOpen,
        showFeedback: showPublishFeedback,
        completeDraftReplacementRef,
        createWorkspaceDraftSnapshot,
        workspaceDocumentId,
        workspaceDocumentIdRef,
        draftColor,
        savedDraftsRef,
        plannerRestoreRef,
        cancelPendingAutosave,
        previewSavedDrafts,
        replaceSavedDrafts,
        attachmentSelectionGenerationRef,
        draftBodyRef,
        attachmentsRef,
        persistDraftStore,
        setSavedAt,
        markWorkspaceDraftPersisted,
        setScheduleSelectionConfirmed,
        recordWorkspaceVersion,
        restorePlannerDocumentRef,
      },
    },
    validation: {
      attachments,
      attachmentError,
      draftBody,
      draftStoreReady,
      draftStoreError,
      publishingDraft,
      scheduling,
      selectedChat,
      publishAction,
      date,
      time,
      scheduleClockNow,
      repeatMode,
      repeatDays,
      repeatOccurrences,
      locale,
      translate: (key) => t(key),
    },
    presentation: {
      inlineNotification,
      sendError,
      connectionRecoveryStatus,
      publishFeedbackOverridesProgress,
      publishFeedback,
      publishFeedbackDetail,
      publishFeedbackKind,
      publishingDraft,
      telegramConnectionState,
      draftStoreError,
      attachmentError,
      textFileError,
      chatLookupError,
      previewHistoryError,
      rescheduleSource,
      publishAction,
      date,
      time,
      savedAt,
      selectedChat,
      translate: t,
    },
    schedule: {
      stageMode,
      scheduleFocus,
      setScheduleFocus,
      setScheduleSelectionConfirmed,
      setPublishAction,
      setPublishMenuOpen,
      changeStageMode,
      workspaceRef,
      selectedChat,
      attachments,
      draftBody,
      date,
      time,
      repeatMode,
      repeatDays,
      repeatOccurrences,
      draftEntities,
      messageEffectId,
      rescheduleSource,
      scheduleSubmissionPendingRef,
      scheduleSubmissionStartedRef,
      handleSchedule,
    },
    emptyMessageFocus: {
      stageMode,
      changeStageMode,
      draftBodyLength: draftBody.length,
      bodyInputRef,
    },
    actions: {
      publishAction,
      setPublishAction,
      setScheduleSelectionConfirmed,
      setRescheduleSource,
      rescheduleSourceRef,
      clearScheduleFocus: () => setScheduleFocus(null),
      setPublishMenuOpen,
      clearPublishFeedbackMessage,
      stageMode,
      changeStageMode,
      scheduleSelectionConfirmed,
      showFeedback: showPublishFeedback,
      enterMessageMessage: t('studio.enterMessage'),
      selectChatMessage: t('studio.selectChat'),
      futureDateTimeMessage: t('studio.futureDateTime'),
    },
  });
  const {
    sendInFlight,
    savingCurrentDraft,
    publishScheduleSummary,
    reconnectingForSend,
    localizeChatName,
    selectedChatSubtitle,
    currentModeSummary,
    publishFooterStatus,
    sendDraftNow,
    openScheduleStage,
    choosePublishAction,
    handlePrimaryPublish,
  } = publishing;

  const {
    versionHistoryOpen,
    setVersionHistoryOpen,
    selectedHistoryDocumentId,
    selectedVersionId,
    isRestoringVersion,
    versionRestoreError,
    openVersionHistory,
    restoreWorkspaceVersion,
    selectHistoryDocument,
    selectHistoryVersion,
  } = versionHistory;

  const editorActions = useWorkspacePageEditorActions({
    draftBody,
    maxDraftLength,
    draftBodyRef,
    setAttachments,
    setDraftBody,
    setDraftEntities,
    editorRef: bodyInputRef,
    attachmentHistory: {
      attachments,
      replaceAttachments,
      attachmentPreviewUrlsRef,
      pendingDraftReplacementRef,
      restorePreviousDraftAfterReplacement,
      plannerRestoreRef,
      restorePlannerDocumentRef,
      historyCouldNotSaveMessage: t('studio.historyCouldNotSave'),
    },
    createWorkspaceDraftSnapshot,
    recordWorkspaceVersion,
    showFeedback: showPublishFeedback,
    confirm,
    translate: t,
    setTextFileError,
    showPublishFeedback,
    changeStageMode,
  });
  const {
    handleEditorChange,
    insertTextAtCursor,
    handleBeforeClearEditorText,
    handleRemoveAttachment,
    handleRemoveAlbum,
    handleExportEditorText,
    handleImportEditorText,
  } = editorActions;

  return (
    <div
      ref={workspaceRef}
      aria-label={t('studio.workspace')}
      className="workspace-page"
    >
      <WorkspaceAttachmentPreviewPortal
        preview={attachmentPreview}
        ariaLabel={attachmentPreview ? t('studio.previewFile', { name: attachmentPreview.name }) : ''}
      />
      <div className="workspace-page-shell">
        <main className="workspace-page-main">
          <WorkspacePageEditorSection
            title={t('studio.createPost')}
            publishAction={publishAction}
            editorAppearance={editorAppearance.style}
            editorAppearanceTokens={editorAppearanceTokens}
            currentActionLabel={t('studio.currentAction')}
            currentModeSummary={currentModeSummary}
            chatSelector={{
              channelSelectorLabel: t('studio.channelSelector'),
              chooseChatLabel: t('studio.chooseChat'),
              chooseChatOrChannelTitle: t('studio.chooseChatOrChannel'),
              selectedChat,
              selectedChatSubtitle,
              localizeChatName,
              onOpen: () => openChatSelection(stageMode),
              expanded: stageMode === 'chat',
            }}
            editor={{
              inputRef: bodyInputRef,
              text: draftBody,
              entities: draftEntities,
              selectedEffectId: messageEffectId,
              onEffectChange: setMessageEffectId,
              maxLength: maxDraftLength,
              stageMode,
              albumDisabled: attachmentUsageRef.current.albumIds.size >= MAX_ALBUMS,
              onOpenAlbum: (position) => openAlbumFileSelection(position),
              onBeforeClear: handleBeforeClearEditorText,
              onOpenVersionHistory: openVersionHistory,
              onAddFiles: (files, position) => void handleAddFiles(files, position),
              onExportText: (editorText, format) => void handleExportEditorText(editorText, format),
              onChange: handleEditorChange,
            }}
            stage={{
              mode: stageMode,
              schedule: {
                scheduleFocus,
                onModeChange: changeStageMode,
                onScheduleDone: () => setScheduleSelectionConfirmed(true),
                date,
                time,
                setDate,
                setTime,
                followCurrentTime,
                setFollowCurrentTime,
                repeatMode,
                setRepeatMode,
                repeatDays,
                setRepeatDays,
                repeatOccurrences,
                setRepeatOccurrences,
              },
              templates: {
                onModeChange: changeStageMode,
                templates,
                onInsertTemplate: insertTextAtCursor,
                templateEditingId,
                templateDraftName,
                setTemplateDraftName,
                templateDraftBody,
                setTemplateDraftBody,
                openTemplateEditor,
                onDeleteTemplate: handleDeleteTemplate,
                closeTemplateEditor,
                saveTemplateStage,
                onExportTemplates: handleExportTemplates,
                onImportTemplates: (file) => { void handleImportTemplates(file); },
              },
              drafts: {
                onModeChange: changeStageMode,
                savedDrafts,
                selectedDraftColor,
                setSelectedDraftColor,
                onInsertDraft: useSavedDraft,
                draftEditingId,
                draftColor: draftEditorColor,
                setDraftColor: setDraftEditorColor,
                draftName,
                setDraftName,
                draftBodyText,
                setDraftBodyText: (value) => {
                  setDraftBodyText(value);
                  setDraftBodyEntities([]);
                },
                openDraftEditor,
                onDeleteDraft: handleDeleteDraft,
                closeDraftEditor,
                saveDraftStage,
                draftStoreReady,
                draftStoreSaving,
                onExportDrafts: () => { void exportDrafts(showPublishFeedback); },
                onImportDrafts: () => { void importDrafts(showPublishFeedback); },
                onImportEditorText: () => void handleImportEditorText(),
              },
              chats: {
                chats,
                selectedChats: workspaceSelectedChats,
                onChatSelectionChange: setWorkspaceSelectedChats,
                onChatSelectionDone: completeChatSelection,
                onChatSelectionBack: backFromChatSelection,
                onChatError: setChatLookupError,
                onAddChat,
                onRemoveChat,
              },
            }}
            attachmentTray={{
              attachments,
              attachmentItemsRef,
              onAddPhotosToAlbum: (albumId, position) => openAlbumFileSelection(position, albumId),
              onRemoveAttachment: handleRemoveAttachment,
              onRemoveAlbum: handleRemoveAlbum,
              onSchedulePreview: scheduleAttachmentPreview,
              onShowPreview: showAttachmentPreview,
              onHidePreview: hideAttachmentPreview,
            }}
            actionRows={{
              fileInputRef,
              albumFileInputRef,
              onFileSelection: handleFileSelection,
              onAlbumFileSelection: handleAlbumFileSelection,
              previewVisible,
              onTogglePreview: togglePreviewVisibility,
              stageMode,
              setStageMode,
              changeStageMode,
              onDraftsNavigationClick: handleDraftsNavigationClick,
              closeTemplateEditor,
              publishAction,
              scheduleFocus,
              openScheduleStage,
              publishMenuOpen,
              setPublishMenuOpen,
              publishMenuRef,
              publishMenuToggleRef,
              onPrimaryPublish: handlePrimaryPublish,
              onChoosePublishAction: choosePublishAction,
              sendInFlight,
              savingCurrentDraft,
              publishingDraft,
              scheduling,
              successPulse,
              lastAction,
              reconnectingForSend,
              publishFooterStatus,
              publishScheduleSummary,
              draftColor,
              setDraftColor,
              inlineNotification,
              publishFeedbackInstance,
              retriggeredPublishFeedback,
              connectionRecoveryStatus,
              sendError,
              onRetrySend: () => { void sendDraftNow(); },
              previewHistoryError,
              previewHistoryErrorRetryable,
              previewHistoryLoading,
              onRetryPreviewHistory: retryPreviewHistory,
              draftStoreError,
              draftStoreBackups,
              onRestoreDraftBackup: (index) => { void restoreDraftBackup(index); },
            }}
          />

          <WorkspacePreviewPanel
            chats={chats}
            selectedChat={selectedChat}
            previewHistory={previewHistory}
            previewHistoryLoading={previewHistoryLoading}
            previewFeedRef={previewFeedRef}
            draftText={deferredPreviewText}
            draftEntities={deferredPreviewEntities}
            attachments={attachments}
            previewTime={previewTime}
            collapsed={previewCollapsed}
            visible={previewVisible}
            chatListOpen={chatListOpen}
            onToggleChatList={toggleChatList}
            onSelectChat={selectPreviewChat}
            onWallpaperChange={setChatWallpaper}
          />
        </main>
      </div>

      <WorkspacePageDialogs
        chatRemoval={{
          show: removeModal.show,
          chatName: removeModal.chat?.name || '',
          onConfirm: confirmRemoveChat,
          onCancel: () => setRemoveModal({ show: false, chat: null }),
        }}
        history={versionHistoryOpen ? {
          accentChannels: editorAppearanceTokens['--editor-outline'],
          histories: documentHistories,
          selectedDocumentId: selectedHistoryDocumentId,
          selectedVersionId,
          restoring: isRestoringVersion,
          restoreError: versionRestoreError,
          onClose: () => setVersionHistoryOpen(false),
          onSelectDocument: selectHistoryDocument,
          onSelect: selectHistoryVersion,
          onRestore: (version) => { void restoreWorkspaceVersion(version); },
          onOpenCopy: (version) => { void restoreWorkspaceVersion(version, true); },
        } : null}
      />
    </div>
  );
}
