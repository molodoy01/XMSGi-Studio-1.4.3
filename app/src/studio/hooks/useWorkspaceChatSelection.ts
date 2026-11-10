import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Chat } from '../types';
import type { WorkspaceStageMode } from './useWorkspaceStageMode';

type WorkspaceChatSelectionOptions = {
  selectedChat: Chat | null;
  setSelectedChat: Dispatch<SetStateAction<Chat | null>>;
  chats: Chat[];
  setStageMode: Dispatch<SetStateAction<WorkspaceStageMode>>;
};

export function useWorkspaceChatSelection({
  selectedChat,
  setSelectedChat,
  chats,
  setStageMode,
}: WorkspaceChatSelectionOptions) {
  const [selectedChats, setSelectedChats] = useState<Chat[]>([]);
  const originRef = useRef<Chat | null>(null);

  const openChatSelection = useCallback((stageMode: WorkspaceStageMode) => {
    if (stageMode === 'chat') {
      setSelectedChat(originRef.current);
      originRef.current = null;
      setSelectedChats([]);
      setStageMode('editor');
      return;
    }

    originRef.current = selectedChat;
    setSelectedChats((current) => current.length > 0 ? current : selectedChat ? [selectedChat] : []);
    setStageMode('chat');
  }, [selectedChat, setSelectedChat, setStageMode]);

  const backFromChatSelection = useCallback(() => {
    setSelectedChat(originRef.current);
    originRef.current = null;
    setSelectedChats([]);
    setStageMode('editor');
  }, [setSelectedChat, setStageMode]);

  const completeChatSelection = useCallback((chosenChat?: Chat) => {
    const nextSelectedChats = chosenChat ? [chosenChat] : selectedChats;
    const availableChats = nextSelectedChats.filter((chat) => chats.some((item) => item.id === chat.id));
    setSelectedChats(availableChats);
    setSelectedChat(availableChats[0] ?? null);
    originRef.current = null;
    setStageMode('editor');
  }, [chats, selectedChats, setSelectedChat, setStageMode]);

  return {
    selectedChats,
    setSelectedChats,
    originRef,
    openChatSelection,
    backFromChatSelection,
    completeChatSelection,
  };
}
