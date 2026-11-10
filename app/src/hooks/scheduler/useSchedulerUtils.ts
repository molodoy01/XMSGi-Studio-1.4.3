import type { Chat, NotificationType, RichTextEntity, ScheduledMessage } from '@/types';
import type { BridgeErrorDetails } from '@shared/bridge';
import { createBridgeValidationError } from '@shared/bridge';
import { waitForTelegramRateLimit } from '@/services/schedulerAppService';
import type { MessageHistoryScope } from '@/lib/storage';

export const REPEAT_SCHEDULE_DELAY_MS = 1500;
export const MASS_SCHEDULE_WARNING_THRESHOLD = 10;
export const MASS_SCHEDULE_WARNING_DURATION_MS = 5000;
export const MAX_SCHEDULE_FUTURE_DAYS = 367;

export function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function waitForTelegramAccount() {
  const result = await waitForTelegramRateLimit();
  if (!result.success) {
    throw new Error(result.error || 'Telegram account is not ready to resume requests.');
  }
}

export function normalizeRestoredMessage(message: ScheduledMessage): ScheduledMessage {
  const status = String(message.status);
  if (status === 'confirmed') return { ...message, status: 'scheduled' };
  if (status === 'sending') {
    if (message.retryAction === 'schedule') {
      return {
        ...message,
        status: 'failed',
        lastError: message.lastError || 'The app closed while this message was being scheduled.',
        retryAction: 'schedule',
      };
    }
    return {
      ...message,
      status: 'unknown',
      lastError: message.lastError || 'The app closed while this message was sending. Studio cannot verify the result automatically after restart; check Telegram before sending again.',
      retryAction: undefined,
    };
  }
  if (['pending', 'scheduled', 'sent', 'failed', 'unknown'].includes(status)) return message;
  return {
    ...message,
    status: 'failed',
    lastError: message.lastError || `Unsupported saved status: ${status}`,
    retryAction: message.retryAction ?? 'send',
  };
}

export type UseSchedulerOptions = {
  historyScope?: MessageHistoryScope;
  accountId?: string;
  connected: boolean;
  selectedChat: Chat | null;
  chats: Chat[];
  message: string;
  composerAttachments?: string[];
  composerEntities?: RichTextEntity[];
  showNotification: (
    message: string,
    type: NotificationType,
    title: string,
    errorDetails?: BridgeErrorDetails,
    durationMs?: number,
  ) => void;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  refreshChatPermissions?: (chatId: string) => Promise<unknown>;
};

export function buildValidationNotification(
  showNotification: UseSchedulerOptions['showNotification'],
  message: string,
  type: NotificationType,
  title: string,
  code: string,
) {
  showNotification(message, type, title, createBridgeValidationError(message, code));
}
