import { useCallback, useDeferredValue } from 'react';
import type { WorkspacePageEffectsOptions } from './useWorkspacePageEffects';
import { useWorkspacePreviewAutoScroll } from './useWorkspacePreviewAutoScroll';
import type { Chat } from '../types';
import type { WorkspacePageTemplates } from './useWorkspaceTemplates';

type Options = Pick<WorkspacePageEffectsOptions,
  | 'stageMode'
  | 'draftEditingId'
  | 'draftBodyText'
  | 'draftBodyEntities'
  | 'draftBody'
  | 'draftEntities'
  | 'chatListOpen'
  | 'setChatListOpen'
  | 'setSelectedChat'
  | 'previewFeedRef'
  | 'previewHistoryChatId'
  | 'previewHistoryMessageCount'
  | 'previewHistoryLoading'
  | 'attachmentsCount'
  | 'previewCollapsed'
  | 'selectedChat'
  | 'previewClockNow'
>;

export function useWorkspacePreviewState(
  options: Options,
  templates: Pick<WorkspacePageTemplates, 'templateEditingId' | 'templateDraftBody'>,
) {
  const { setChatListOpen, setSelectedChat } = options;
  const previewText = options.stageMode === 'template' && templates.templateEditingId
    ? templates.templateDraftBody
    : options.stageMode === 'draft' && options.draftEditingId
      ? options.draftBodyText
      : options.draftBody;
  const previewEntities = options.stageMode === 'template' && templates.templateEditingId
    ? []
    : options.stageMode === 'draft' && options.draftEditingId
      ? options.draftBodyEntities
      : options.draftEntities;
  const deferredPreviewText = useDeferredValue(previewText);
  const deferredPreviewEntities = useDeferredValue(previewEntities);
  const toggleChatList = useCallback(
    () => setChatListOpen((current) => !current),
    [setChatListOpen],
  );
  const selectPreviewChat = useCallback((chat: Chat) => {
    setSelectedChat(chat);
    setChatListOpen(false);
  }, [setSelectedChat, setChatListOpen]);

  useWorkspacePreviewAutoScroll({
    feedRef: options.previewFeedRef,
    chatId: options.previewHistoryChatId,
    messageCount: options.previewHistoryMessageCount,
    loading: options.previewHistoryLoading,
    previewText: deferredPreviewText,
    entityCount: deferredPreviewEntities.length,
    attachmentCount: options.attachmentsCount,
    chatListOpen: options.chatListOpen,
    collapsed: options.previewCollapsed,
    selectedChatId: options.selectedChat?.id,
  });

  return {
    deferredPreviewText,
    deferredPreviewEntities,
    toggleChatList,
    selectPreviewChat,
    previewTime: new Date(options.previewClockNow).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}
