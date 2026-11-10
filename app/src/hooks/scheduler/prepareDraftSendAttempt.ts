import type { MutableRefObject } from 'react';
import type { Chat, RichTextEntity, ScheduledMessage } from '@/types';
import { uid } from '@/lib/utils';

type DraftSendAttemptRef = MutableRefObject<{ fingerprint: string; id: string; recordId?: string } | null>;

type PrepareDraftSendAttemptOptions = {
  accountId: string;
  chat: Chat;
  text: string;
  attachments: string[];
  entities: RichTextEntity[];
  silent: boolean;
  effect?: string;
  upcoming: ScheduledMessage[];
  draftSendAttemptRef: DraftSendAttemptRef;
};

type PreparedDraftSendAttempt =
  | { kind: 'unresolved' }
  | {
      kind: 'ready';
      sendAttemptId: string;
      attemptRecordId: string;
      sendingMessage: ScheduledMessage;
      sendingUpcoming: ScheduledMessage[];
    };

export function prepareDraftSendAttempt({
  accountId,
  chat,
  text,
  attachments,
  entities,
  silent,
  effect,
  upcoming,
  draftSendAttemptRef,
}: PrepareDraftSendAttemptOptions): PreparedDraftSendAttempt {
  const fingerprint = JSON.stringify([chat.id, text, attachments, entities, silent, effect]);
  const unresolvedAttempt = upcoming.find((item) => (
    item.status === 'unknown'
    && JSON.stringify([
      item.chatId,
      item.text,
      item.attachments ?? [],
      item.entities ?? [],
      item.silent ?? false,
      item.effect,
    ]) === fingerprint
  ));
  if (unresolvedAttempt) return { kind: 'unresolved' };

  const restoredAttempt = upcoming.find((item) => (
    item.status === 'failed'
    && item.retryAction === 'send'
    && item.sendAttemptId
    && JSON.stringify([
      item.chatId,
      item.text,
      item.attachments ?? [],
      item.entities ?? [],
      item.silent ?? false,
      item.effect,
    ]) === fingerprint
  ));
  if (!draftSendAttemptRef.current || draftSendAttemptRef.current.fingerprint !== fingerprint) {
    draftSendAttemptRef.current = {
      fingerprint,
      id: restoredAttempt?.sendAttemptId ?? `${Date.now()}:${uid()}`,
      recordId: restoredAttempt?.id,
    };
  }

  const sendAttemptId = draftSendAttemptRef.current.id;
  const attemptRecordId = draftSendAttemptRef.current.recordId ?? uid();
  draftSendAttemptRef.current.recordId = attemptRecordId;
  const attemptedAt = new Date().toISOString();
  const sendingMessage: ScheduledMessage = {
    ...(restoredAttempt ?? {}),
    id: attemptRecordId,
    accountId,
    chatId: chat.id,
    chatName: chat.name,
    text,
    attachments,
    when: restoredAttempt?.when ?? attemptedAt,
    createdAt: restoredAttempt?.createdAt ?? attemptedAt,
    status: 'sending',
    lastAttemptAt: attemptedAt,
    lastError: undefined,
    lastErrorDetails: undefined,
    retryAction: 'send',
    sendAttemptId,
    entities,
    silent,
    effect,
  };
  const sendingUpcoming = [
    sendingMessage,
    ...upcoming.filter((item) => item.id !== attemptRecordId),
  ];

  return {
    kind: 'ready',
    sendAttemptId,
    attemptRecordId,
    sendingMessage,
    sendingUpcoming,
  };
}
