import { useMemo } from 'react';
import type { TranslationKey } from '@studio/lib/i18n';
import type { PublishAction, PublishFooterStatus } from '../components/WorkspacePageActionRows';
import { FOOTER_STATUS_DURATION_MS } from '../pages/WorkspacePageHelpers';
import type { StudioInlineNotification } from '../pages/workspacePageTypes';
import type { Chat, ScheduledMessage } from '../types';

type WorkspacePublishPresentationOptions = {
  inlineNotification: StudioInlineNotification | null;
  sendError: string;
  connectionRecoveryStatus: 'reconnecting' | 'offline' | 'restored' | null;
  publishFeedbackOverridesProgress: boolean;
  publishFeedback: string;
  publishFeedbackDetail: string;
  publishFeedbackKind: 'warning' | 'success';
  sendInFlight: boolean;
  publishingDraft: boolean;
  telegramConnectionState: 'connected' | 'connecting' | 'reconnecting' | 'disconnected';
  draftStoreError: string;
  attachmentError: string;
  textFileError: string;
  chatLookupError: string;
  previewHistoryError: string;
  rescheduleSource: ScheduledMessage | null;
  publishAction: PublishAction;
  date: string;
  time: string;
  publishScheduleSummary: string;
  savedAt: string;
  selectedChat: Chat | null;
  translate: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

export function useWorkspacePublishPresentation({
  inlineNotification,
  sendError,
  connectionRecoveryStatus,
  publishFeedbackOverridesProgress,
  publishFeedback,
  publishFeedbackDetail,
  publishFeedbackKind,
  sendInFlight,
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
  publishScheduleSummary,
  savedAt,
  selectedChat,
  translate,
}: WorkspacePublishPresentationOptions) {
  return useMemo(() => {
    const reconnectingForSend = publishingDraft
      && (telegramConnectionState === 'connecting' || telegramConnectionState === 'reconnecting');
    const localizeChatName = (name: string) => name === 'Saved Messages'
      ? translate('studio.savedMessagesType')
      : name;
    const selectedChatSubtitle = selectedChat
      ? selectedChat.name === 'Saved Messages'
        ? translate('studio.privateChat')
        : selectedChat.type === 'private'
          ? selectedChat.username
            ? `@${selectedChat.username.replace(/^@/, '')}`
            : translate('studio.privateChat')
          : selectedChat.type === 'group'
            ? translate('studio.groupChat')
            : selectedChat.type === 'channel'
              ? translate('studio.channelType')
              : translate('studio.chatType')
      : '';
    const currentModeSummary = rescheduleSource
      ? translate('studio.replaceScheduled', { chat: localizeChatName(rescheduleSource.chatName) })
      : publishAction === 'schedule'
        ? (date && time ? publishScheduleSummary : translate('studio.chooseDateTime'))
        : publishAction === 'draft'
          ? savedAt ? translate('studio.draftModeSummary', { time: savedAt }) : translate('studio.draftMenuOption')
          : selectedChat
            ? selectedChat.name === 'Saved Messages'
              ? translate('studio.sendToSavedSummary')
              : translate('studio.sendToChatSummary', { chat: localizeChatName(selectedChat.name) })
            : translate('studio.sendChooseChatSummary');

    const publishFooterStatus: PublishFooterStatus | null = inlineNotification
      ? {
          message: inlineNotification.message,
          detail: inlineNotification.title === 'Studio' ? undefined : inlineNotification.title,
          kind: inlineNotification.type === 'error'
            ? 'error'
            : inlineNotification.type === 'warning'
              ? 'warning'
              : inlineNotification.type === 'success'
                ? 'success'
                : 'notice',
          transient: true,
          duration: inlineNotification.durationMs,
        }
      : sendError
        ? { message: sendError, kind: 'error', transient: false, duration: FOOTER_STATUS_DURATION_MS.sendError }
        : connectionRecoveryStatus === 'offline'
          ? { message: translate('telegramStatus.offlineMessage'), kind: 'error', transient: false, duration: null }
          : connectionRecoveryStatus === 'reconnecting'
            ? { message: translate('telegramStatus.networkMessage'), kind: 'progress', transient: false, duration: null }
            : connectionRecoveryStatus === 'restored'
              ? { message: translate('telegramStatus.restoredMessage'), kind: 'success', transient: false, duration: null }
              : publishFeedbackOverridesProgress && publishFeedback
              ? {
                  message: publishFeedback,
                  detail: publishFeedbackDetail || undefined,
                  kind: publishFeedbackKind,
                  transient: true,
                  duration: publishFeedbackKind === 'warning'
                    ? FOOTER_STATUS_DURATION_MS.publishWarning
                    : FOOTER_STATUS_DURATION_MS.publishSuccess,
                }
              : sendInFlight || publishingDraft
                ? {
                    message: translate(reconnectingForSend ? 'studio.reconnectingProgress' : 'studio.sentProgress'),
                    kind: 'progress',
                    transient: false,
                    duration: null,
                  }
                : publishFeedback && publishFeedbackKind === 'success'
                  ? {
                      message: publishFeedback,
                      detail: publishFeedbackDetail || undefined,
                      kind: publishFeedbackKind,
                      transient: true,
                      duration: FOOTER_STATUS_DURATION_MS.publishSuccess,
                    }
                  : publishFeedback
                    ? {
                        message: publishFeedback,
                        detail: publishFeedbackDetail || undefined,
                        kind: publishFeedbackKind,
                        transient: true,
                        duration: FOOTER_STATUS_DURATION_MS.publishWarning,
                      }
                    : draftStoreError
                      ? { message: draftStoreError, kind: 'error', transient: false, duration: FOOTER_STATUS_DURATION_MS.draftStoreError }
                      : attachmentError
                        ? { message: attachmentError, kind: 'error', transient: true, duration: FOOTER_STATUS_DURATION_MS.attachmentError }
                        : textFileError
                          ? { message: textFileError, kind: 'error', transient: false, duration: FOOTER_STATUS_DURATION_MS.textFileError }
                          : chatLookupError
                            ? { message: chatLookupError, kind: 'error', transient: false, duration: FOOTER_STATUS_DURATION_MS.chatLookupError }
                            : previewHistoryError
                              ? { message: previewHistoryError, kind: 'error', transient: false, duration: FOOTER_STATUS_DURATION_MS.previewHistoryError }
                              : null;

    return {
      reconnectingForSend,
      localizeChatName,
      selectedChatSubtitle,
      currentModeSummary,
      publishFooterStatus,
    };
  }, [
    attachmentError,
    chatLookupError,
    connectionRecoveryStatus,
    date,
    draftStoreError,
    inlineNotification,
    previewHistoryError,
    publishAction,
    publishFeedback,
    publishFeedbackDetail,
    publishFeedbackKind,
    publishFeedbackOverridesProgress,
    publishScheduleSummary,
    publishingDraft,
    rescheduleSource,
    savedAt,
    selectedChat,
    sendError,
    sendInFlight,
    telegramConnectionState,
    textFileError,
    time,
    translate,
  ]);
}
