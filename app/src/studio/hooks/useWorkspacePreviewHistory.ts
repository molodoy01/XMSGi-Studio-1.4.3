import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from '@studio/lib/i18n';
import { hasChatHistoryBridge, telegramGetChatHistory } from '@/services/chatAppService';
import type { Chat, PreviewChatHistory } from '../types';
import {
  getPreviewHistoryErrorPresentation,
  getPreviewHistoryMediaDataUrlChars,
} from '../pages/WorkspacePageHelpers';
import { appendPreviewMessage } from '../lib/preview';

const PREVIEW_HISTORY_LIMIT = 50;
const PREVIEW_HISTORY_CACHE_TTL_MS = 20_000;
const PREVIEW_HISTORY_CACHE_SIZE = 2;
const PREVIEW_HISTORY_CACHE_MAX_MEDIA_DATA_URL_CHARS = 4 * 1024 * 1024;
const MAX_CACHED_AVATAR_DATA_URL_CHARS = 1_500_000;
const CACHED_AVATAR_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

type CachedPreviewHistory = {
  history: PreviewChatHistory;
  cachedAt: number;
};

type WorkspacePreviewHistoryOptions = {
  connected: boolean;
  selectedChat: Chat | null;
};

export function useWorkspacePreviewHistory({ connected, selectedChat }: WorkspacePreviewHistoryOptions) {
  const { t } = useLocale();
  const [previewHistory, setPreviewHistory] = useState<PreviewChatHistory | null>(null);
  const [previewHistoryLoading, setPreviewHistoryLoading] = useState(false);
  const [previewHistoryError, setPreviewHistoryError] = useState('');
  const [previewHistoryErrorRetryable, setPreviewHistoryErrorRetryable] = useState(false);
  const [retry, setRetry] = useState(0);
  const cacheRef = useRef(new Map<string, CachedPreviewHistory>());
  const selectedChatRef = useRef(selectedChat);
  selectedChatRef.current = selectedChat;
  const selectedChatId = selectedChat?.id;

  const retryPreviewHistory = useCallback(() => {
    setRetry((current) => current + 1);
  }, []);

  const appendMessage = useCallback((chatId: string, text: string) => {
    setPreviewHistory((current) => {
      if (!current || current.chat.id !== chatId) return current;

      const nextHistory = appendPreviewMessage(current, chatId, text);
      const cache = cacheRef.current;
      if (cache.has(chatId)) {
        cache.delete(chatId);
        if (getPreviewHistoryMediaDataUrlChars(nextHistory) <= PREVIEW_HISTORY_CACHE_MAX_MEDIA_DATA_URL_CHARS) {
          cache.set(chatId, { history: nextHistory, cachedAt: Date.now() });
        }
      }
      return nextHistory;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!connected) {
      cacheRef.current.clear();
    }

    if (!connected || !selectedChatId) {
      setPreviewHistory(null);
      setPreviewHistoryLoading(false);
      setPreviewHistoryError('');
      setPreviewHistoryErrorRetryable(false);
      return () => {
        cancelled = true;
      };
    }

    if (!hasChatHistoryBridge()) {
      setPreviewHistory(null);
      setPreviewHistoryLoading(false);
      setPreviewHistoryError('');
      setPreviewHistoryErrorRetryable(false);
      return () => {
        cancelled = true;
      };
    }

    const cachedEntry = cacheRef.current.get(selectedChatId);
    if (cachedEntry && Date.now() - cachedEntry.cachedAt < PREVIEW_HISTORY_CACHE_TTL_MS) {
      const cache = cacheRef.current;
      cache.delete(selectedChatId);
      cache.set(selectedChatId, cachedEntry);
      setPreviewHistory(cachedEntry.history);
      setPreviewHistoryLoading(false);
      setPreviewHistoryError('');
      setPreviewHistoryErrorRetryable(false);
      return () => {
        cancelled = true;
      };
    }
    if (cachedEntry) cacheRef.current.delete(selectedChatId);

    setPreviewHistory(null);
    setPreviewHistoryLoading(true);
    setPreviewHistoryError('');
    setPreviewHistoryErrorRetryable(false);
    const cachedAvatarDataUrl = selectedChatRef.current?.avatarDataUrl;
    telegramGetChatHistory({
      chatId: selectedChatId,
      limit: PREVIEW_HISTORY_LIMIT,
      ...(cachedAvatarDataUrl
        && cachedAvatarDataUrl.length <= MAX_CACHED_AVATAR_DATA_URL_CHARS
        && CACHED_AVATAR_DATA_URL_PATTERN.test(cachedAvatarDataUrl)
        ? { cachedAvatarDataUrl }
        : {}),
    })
      .then((result) => {
        if (cancelled) return;

        if (result.success) {
          const history = result.history
            ? {
              ...result.history,
              chat: {
                ...result.history.chat,
                avatarDataUrl: result.history.chat.avatarDataUrl || selectedChatRef.current?.avatarDataUrl || '',
              },
            }
            : null;
          setPreviewHistory(history);
          if (
            history?.messages.length
            && getPreviewHistoryMediaDataUrlChars(history) <= PREVIEW_HISTORY_CACHE_MAX_MEDIA_DATA_URL_CHARS
          ) {
            const cache = cacheRef.current;
            cache.delete(selectedChatId);
            cache.set(selectedChatId, { history, cachedAt: Date.now() });
            while (cache.size > PREVIEW_HISTORY_CACHE_SIZE) {
              const oldestChatId = cache.keys().next().value;
              if (oldestChatId === undefined) break;
              cache.delete(oldestChatId);
            }
          }
          setPreviewHistoryError('');
          setPreviewHistoryErrorRetryable(false);
        } else {
          const errorPresentation = getPreviewHistoryErrorPresentation(result.error, {
            noAccess: t('studio.previewHistoryNoAccess'),
            unavailable: t('studio.previewHistoryFailed'),
          });
          setPreviewHistory(null);
          setPreviewHistoryError(errorPresentation.message);
          setPreviewHistoryErrorRetryable(errorPresentation.retryable);
        }
        setPreviewHistoryLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;

        const errorPresentation = getPreviewHistoryErrorPresentation(error, {
          noAccess: t('studio.previewHistoryNoAccess'),
          unavailable: t('studio.previewHistoryFailed'),
        });
        setPreviewHistory(null);
        setPreviewHistoryError(errorPresentation.message);
        setPreviewHistoryErrorRetryable(errorPresentation.retryable);
        setPreviewHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [connected, selectedChatId, retry, t]);

  return {
    previewHistory,
    previewHistoryLoading,
    previewHistoryError,
    setPreviewHistoryError,
    previewHistoryErrorRetryable,
    retryPreviewHistory,
    appendMessage,
  };
}
