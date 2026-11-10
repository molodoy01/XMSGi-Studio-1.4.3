import { useEffect } from 'react';
import type { RefObject } from 'react';

type WorkspacePreviewAutoScrollOptions = {
  feedRef: RefObject<HTMLDivElement | null>;
  chatId?: string;
  messageCount: number;
  loading: boolean;
  previewText: string;
  entityCount: number;
  attachmentCount: number;
  chatListOpen: boolean;
  collapsed: boolean;
  selectedChatId?: string;
};

export function useWorkspacePreviewAutoScroll({
  feedRef,
  chatId,
  messageCount,
  loading,
  previewText,
  entityCount,
  attachmentCount,
  chatListOpen,
  collapsed,
  selectedChatId,
}: WorkspacePreviewAutoScrollOptions) {
  useEffect(() => {
    if (loading || collapsed) return;

    const frameId = window.requestAnimationFrame(() => {
      if (feedRef.current) {
        feedRef.current.scrollTop = feedRef.current.scrollHeight;
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    attachmentCount,
    chatId,
    chatListOpen,
    collapsed,
    entityCount,
    feedRef,
    loading,
    messageCount,
    previewText,
    selectedChatId,
  ]);
}
