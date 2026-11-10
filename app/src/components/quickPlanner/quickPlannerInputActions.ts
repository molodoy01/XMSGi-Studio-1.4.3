import type { ChangeEvent, ClipboardEvent, Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react';
import { getDraftStorageApi } from '@studio/lib/draftStore';
import { limitMessageText } from '@/lib/messageLimits';
import { recentEmojiStorageKey } from '@/lib/emojiCatalog';
import { telegramGetFilePath } from '@/services/telegramAppService';
import type { RichTextEntity } from '@/types';
import type { TranslationKey } from '@/lib/i18n';
import {
  getNextScheduleDateTime,
  formatTimeValue,
  retainUnchangedRichTextEntities,
  toDateInputValue,
  toLocalDateTime,
  type PlannerAttachment,
} from './quickPlannerUtils';
import { MAX_PLANNER_ATTACHMENTS } from '../../lib/plannerDraft';

type UseQuickPlannerInputActionsProps = {
  message: string;
  setMessage: Dispatch<SetStateAction<string>>;
  messageMaxLength: number;
  messageInputRef: RefObject<HTMLTextAreaElement>;
  setMessageEntities: Dispatch<SetStateAction<RichTextEntity[]>>;
  emojiCommandRange: { start: number; end: number } | null;
  setEmojiCommandRange: Dispatch<SetStateAction<{ start: number; end: number } | null>>;
  setEmojiSearchQuery: Dispatch<SetStateAction<string>>;
  setRecentEmojis: Dispatch<SetStateAction<string[]>>;
  setEmojiPickerOpen: Dispatch<SetStateAction<boolean>>;
  emojiPickerOpen: boolean;
  setEffectPickerOpen: Dispatch<SetStateAction<boolean>>;
  setEmojiActiveIndex: Dispatch<SetStateAction<number>>;
  emojiReleaseCloseTimeoutRef: MutableRefObject<number | null>;
  emojiSelectionWaitingForReleaseRef: MutableRefObject<boolean>;
  normalizedEmojiSearchQuery: string;
  visibleEmojiOptions: Array<{ emoji: string }>;
  emojiActiveIndex: number;
  selectedDate: string;
  selectedTime: string;
  setScheduleTimeTouched: Dispatch<SetStateAction<boolean>>;
  scheduleNowConfirmationRef: MutableRefObject<string | null>;
  setSelectedDate: Dispatch<SetStateAction<string>>;
  setSelectedTime: Dispatch<SetStateAction<string>>;
  attachments: PlannerAttachment[];
  setAttachments: Dispatch<SetStateAction<PlannerAttachment[]>>;
  showActionFeedback: (message: string, tone: 'error' | 'warning' | 'success' | 'info') => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

export function createQuickPlannerInputActions({
  message,
  setMessage,
  messageMaxLength,
  messageInputRef,
  setMessageEntities,
  emojiCommandRange,
  setEmojiCommandRange,
  setEmojiSearchQuery,
  setRecentEmojis,
  setEmojiPickerOpen,
  emojiPickerOpen,
  setEffectPickerOpen,
  setEmojiActiveIndex,
  emojiReleaseCloseTimeoutRef,
  emojiSelectionWaitingForReleaseRef,
  normalizedEmojiSearchQuery,
  visibleEmojiOptions,
  emojiActiveIndex,
  selectedDate,
  selectedTime,
  setScheduleTimeTouched,
  scheduleNowConfirmationRef,
  setSelectedDate,
  setSelectedTime,
  attachments,
  setAttachments,
  showActionFeedback,
  t,
}: UseQuickPlannerInputActionsProps) {
  const insertEmoji = (emoji: string, keepPickerOpen = false, updateRecent = true) => {
    if (emojiReleaseCloseTimeoutRef.current !== null) {
      window.clearTimeout(emojiReleaseCloseTimeoutRef.current);
      emojiReleaseCloseTimeoutRef.current = null;
    }
    emojiSelectionWaitingForReleaseRef.current = keepPickerOpen;
    const textarea = messageInputRef.current;
    const start = emojiCommandRange?.start ?? textarea?.selectionStart ?? message.length;
    const end = emojiCommandRange?.end ?? textarea?.selectionEnd ?? message.length;
    const nextMessage = limitMessageText(`${message.slice(0, start)}${emoji}${message.slice(end)}`, messageMaxLength);
    setMessageEntities((current) => retainUnchangedRichTextEntities(message, nextMessage, current));
    setMessage(nextMessage);
    setEmojiCommandRange(null);
    if (!keepPickerOpen) setEmojiSearchQuery('');
    if (updateRecent) {
      setRecentEmojis((current) => {
        const nextRecentEmojis = [emoji, ...current.filter((recentEmoji) => recentEmoji !== emoji)].slice(0, 6);
        try {
          window.localStorage.setItem(recentEmojiStorageKey, JSON.stringify(nextRecentEmojis));
        } catch {
          // Keep this picker usable when storage is unavailable.
        }
        return nextRecentEmojis;
      });
    }
    setEmojiPickerOpen(keepPickerOpen);
    window.requestAnimationFrame(() => {
      textarea?.focus();
      const cursor = Math.min(start + emoji.length, nextMessage.length);
      textarea?.setSelectionRange(cursor, cursor);
    });
  };

  const toggleEmojiPicker = () => {
    const nextOpen = !emojiPickerOpen;
    setEmojiPickerOpen(nextOpen);
    if (nextOpen) setEffectPickerOpen(false);
    if (!nextOpen) {
      setEmojiSearchQuery('');
      setEmojiCommandRange(null);
      setEmojiActiveIndex(0);
    }
  };

  const handleEmojiPickerKeyDown = (event: {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    preventDefault: () => void;
    stopPropagation: () => void;
  }) => {
    if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.stopPropagation();
    }
    if (!normalizedEmojiSearchQuery || visibleEmojiOptions.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setEmojiActiveIndex((index) => (index + direction + visibleEmojiOptions.length) % visibleEmojiOptions.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      insertEmoji(visibleEmojiOptions[emojiActiveIndex]?.emoji ?? visibleEmojiOptions[0].emoji, Boolean(event.ctrlKey || event.metaKey));
    }
  };

  const applyQuickTime = (preset: 'now' | '30min' | 'tomorrow') => {
    if (preset === 'now') {
      const nextAvailable = getNextScheduleDateTime(new Date());
      setScheduleTimeTouched(true);
      scheduleNowConfirmationRef.current = null;
      setSelectedDate(nextAvailable.date);
      setSelectedTime(nextAvailable.time);
      return;
    }

    setScheduleTimeTouched(true);
    scheduleNowConfirmationRef.current = null;
    const selectedDateTime = toLocalDateTime(selectedDate, selectedTime);

    if (preset === '30min') selectedDateTime.setMinutes(selectedDateTime.getMinutes() + 30);
    if (preset === 'tomorrow') selectedDateTime.setDate(selectedDateTime.getDate() + 1);

    setSelectedDate(toDateInputValue(selectedDateTime));
    setSelectedTime(formatTimeValue(selectedDateTime));
  };

  const handleAttachmentFiles = (selectedFiles: File[]) => {
    if (selectedFiles.length > 0) {
      const resolvedFiles = selectedFiles.flatMap((file) => {
        try {
          const path = telegramGetFilePath(file);
          return path ? [{ name: file.name, path }] : [];
        } catch {
          return [];
        }
      });
      const remainingSlots = Math.max(0, MAX_PLANNER_ATTACHMENTS - attachments.length);
      const acceptedFiles = resolvedFiles.slice(0, remainingSlots);
      if (acceptedFiles.length > 0) {
        setAttachments((current) => [...current, ...acceptedFiles].slice(0, MAX_PLANNER_ATTACHMENTS));
      }
      const limitReached = resolvedFiles.length > remainingSlots;
      const someFilesUnavailable = resolvedFiles.length !== selectedFiles.length;
      showActionFeedback(
        limitReached
          ? t('quickPlanner.attachmentLimit', { count: MAX_PLANNER_ATTACHMENTS })
          : someFilesUnavailable
            ? t('quickPlanner.someFilesUnavailable')
            : acceptedFiles.length === 1
              ? t('quickPlanner.fileAdded')
              : t('quickPlanner.filesAdded'),
        limitReached || someFilesUnavailable ? 'warning' : 'success',
      );
    }
  };

  const handleClipboardImages = async (files: File[]) => {
    const remainingSlots = Math.max(0, MAX_PLANNER_ATTACHMENTS - attachments.length);
    const acceptedFiles = files.slice(0, remainingSlots);
    const storage = getDraftStorageApi();

    const storedAttachments = storage && typeof storage.copyAttachment === 'function'
      ? await Promise.all(acceptedFiles.map(async (file) => {
        try {
          const result = await storage.copyAttachment(file);
          return result.success && result.attachment
            ? { name: result.attachment.name, path: result.attachment.path }
            : null;
        } catch {
          return null;
        }
      }))
      : [];
    const resolvedAttachments = storedAttachments.filter((attachment): attachment is PlannerAttachment => attachment !== null);

    if (resolvedAttachments.length > 0) {
      setAttachments((current) => [...current, ...resolvedAttachments].slice(0, MAX_PLANNER_ATTACHMENTS));
    }

    const hasUnavailableFiles = resolvedAttachments.length !== acceptedFiles.length;
    showActionFeedback(
      files.length > remainingSlots
        ? t('quickPlanner.attachmentLimit', { count: MAX_PLANNER_ATTACHMENTS })
        : hasUnavailableFiles
          ? t('quickPlanner.someFilesUnavailable')
          : resolvedAttachments.length === 1
            ? t('quickPlanner.fileAdded')
            : t('quickPlanner.filesAdded'),
      files.length > remainingSlots || hasUnavailableFiles ? 'warning' : 'success',
    );
  };

  const handleMessagePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardItems = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    const clipboardImages = clipboardItems.length > 0
      ? clipboardItems
      : Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));
    if (clipboardImages.length === 0) return;

    const preparedImages = clipboardImages.map((file, index) => {
      if (file.name) return file;
      const extension = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
      return new File([file], `pasted-image-${Date.now()}-${index + 1}.${extension}`, {
        type: file.type,
        lastModified: file.lastModified,
      });
    });
    void handleClipboardImages(preparedImages);
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleAttachmentFiles(Array.from(event.currentTarget.files ?? []));
    event.currentTarget.value = '';
  };

  return {
    insertEmoji,
    toggleEmojiPicker,
    handleEmojiPickerKeyDown,
    applyQuickTime,
    handleAttachmentFiles,
    handleMessagePaste,
    handleAttachmentChange,
  };
}
