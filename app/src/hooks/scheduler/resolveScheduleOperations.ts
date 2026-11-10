import type { MutableRefObject } from 'react';
import type { Chat, ScheduledMessage, RichTextEntity } from '@/types';
import type { TranslationKey } from '@/lib/i18n';
import type { MessageHistoryScope } from '@/lib/storage';
import { persistScheduleHistoryAndWait } from '@/lib/storage';
import { getScheduleIdentities } from '@/services/schedulerAppService';
import { createBridgeValidationError, normalizeTelegramBridgeError } from '@shared/bridge';
import type { UseSchedulerOptions } from './useSchedulerUtils';
import {
  MASS_SCHEDULE_WARNING_DURATION_MS,
  MASS_SCHEDULE_WARNING_THRESHOLD,
} from './useSchedulerUtils';

type ScheduleOperation = Parameters<typeof getScheduleIdentities>[0][number];

type ResolveScheduleOperationsOptions = {
  chat: Chat;
  text: string;
  entities: RichTextEntity[];
  silent: boolean;
  effect?: string;
  replaceMessage?: ScheduledMessage;
  scheduleGroups: string[][];
  occurrenceDates: Date[];
  upcoming: ScheduledMessage[];
  upcomingStateRef: MutableRefObject<ScheduledMessage[]>;
  setUpcoming: (messages: ScheduledMessage[]) => void;
  historyScope: MessageHistoryScope;
  schedulingLockRef: MutableRefObject<boolean>;
  activePublishIdsRef: MutableRefObject<Set<string>>;
  setScheduling: (scheduling: boolean) => void;
  showNotification: UseSchedulerOptions['showNotification'];
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

type ResolveScheduleOperationsResult =
  | { kind: 'invalid' | 'duplicate' }
  | {
      kind: 'ready';
      candidateOperations: ScheduleOperation[];
      candidateIdentities: string[];
      upcomingWithIdentities: ScheduledMessage[];
    };

function releaseScheduleLock({
  replaceMessage,
  schedulingLockRef,
  activePublishIdsRef,
  setScheduling,
}: Pick<ResolveScheduleOperationsOptions, 'replaceMessage' | 'schedulingLockRef' | 'activePublishIdsRef' | 'setScheduling'>) {
  schedulingLockRef.current = false;
  if (replaceMessage) activePublishIdsRef.current.delete(replaceMessage.id);
  setScheduling(false);
}

export async function resolveScheduleOperations({
  chat,
  text,
  entities,
  silent,
  effect,
  replaceMessage,
  scheduleGroups,
  occurrenceDates,
  upcoming,
  upcomingStateRef,
  setUpcoming,
  historyScope,
  schedulingLockRef,
  activePublishIdsRef,
  setScheduling,
  showNotification,
  t,
}: ResolveScheduleOperationsOptions): Promise<ResolveScheduleOperationsResult> {
  const chatId = chat.id;
  const candidateOperations: ScheduleOperation[] = occurrenceDates.flatMap((occurrenceDate) => (
    scheduleGroups.map((groupAttachments, groupIndex) => {
      const isPrimaryGroup = groupIndex === 0;
      return {
        chatId,
        message: isPrimaryGroup ? text : '',
        targetTimestamp: Math.floor(occurrenceDate.getTime() / 1000),
        attachments: groupAttachments,
        entities: isPrimaryGroup ? entities : [],
        silent,
        effect: isPrimaryGroup ? effect : undefined,
      };
    })
  ));

  if (occurrenceDates.length >= MASS_SCHEDULE_WARNING_THRESHOLD) {
    showNotification(
      t('schedule.massWarningMessage', { count: occurrenceDates.length }),
      'warning',
      t('schedule.massWarningTitle'),
      undefined,
      MASS_SCHEDULE_WARNING_DURATION_MS,
    );
  }

  const candidateTimestamps = new Set(candidateOperations.map((operation) => operation.targetTimestamp));
  const comparableUpcoming = upcoming.filter((scheduledMessage) => {
    const scheduledTimestamp = Math.floor(new Date(scheduledMessage.when).getTime() / 1000);
    return scheduledMessage.id !== replaceMessage?.id
      && scheduledMessage.status !== 'sent'
      && scheduledMessage.chatId === chatId
      && candidateTimestamps.has(scheduledTimestamp)
      && candidateOperations.some((operation) => (
        operation.message === scheduledMessage.text
        && (scheduledMessage.attachments ?? []).length === (operation.attachments ?? []).length
      ));
  });
  const legacyUpcoming = comparableUpcoming.filter((scheduledMessage) => !scheduledMessage.operationIdentity);
  const identityOperations: ScheduleOperation[] = [
    ...candidateOperations,
    ...legacyUpcoming.map((scheduledMessage) => ({
      chatId: scheduledMessage.chatId,
      message: scheduledMessage.text,
      targetTimestamp: Math.floor(new Date(scheduledMessage.when).getTime() / 1000),
      attachments: scheduledMessage.attachments ?? [],
      entities: scheduledMessage.entities ?? [],
      silent: scheduledMessage.silent,
      effect: scheduledMessage.effect,
    })),
  ];

  schedulingLockRef.current = true;
  if (replaceMessage) activePublishIdsRef.current.add(replaceMessage.id);
  setScheduling(true);

  let identityResult: Awaited<ReturnType<typeof getScheduleIdentities>>;
  try {
    identityResult = await getScheduleIdentities(identityOperations);
    if (!identityResult.success || !identityResult.identities || identityResult.identities.length !== identityOperations.length) {
      throw new Error(identityResult.error || t('schedule.failed'));
    }
  } catch (error) {
    releaseScheduleLock({ replaceMessage, schedulingLockRef, activePublishIdsRef, setScheduling });
    const errorDetails = normalizeTelegramBridgeError(error, 'publish', t('schedule.failed'));
    showNotification(errorDetails.message, 'error', t('schedule.schedulingFailed'), errorDetails);
    return { kind: 'invalid' };
  }

  const candidateIdentities = identityResult.identities.slice(0, candidateOperations.length);
  if (candidateIdentities.some((identity) => typeof identity !== 'string')) {
    releaseScheduleLock({ replaceMessage, schedulingLockRef, activePublishIdsRef, setScheduling });
    const errorDetails = createBridgeValidationError(t('schedule.failed'), 'SCHEDULE_IDENTITY_INVALID');
    showNotification(errorDetails.message, 'error', t('schedule.schedulingFailed'), errorDetails);
    return { kind: 'invalid' };
  }

  const legacyIdentityByMessage = new Map<string, string | null>();
  legacyUpcoming.forEach((scheduledMessage, index) => {
    legacyIdentityByMessage.set(scheduledMessage.id, identityResult.identities![candidateOperations.length + index]);
  });
  const unverifiableLegacyMedia = legacyUpcoming.some((scheduledMessage) => (
    (scheduledMessage.attachments?.length ?? 0) > 0
    && typeof legacyIdentityByMessage.get(scheduledMessage.id) !== 'string'
  ));
  if (unverifiableLegacyMedia) {
    releaseScheduleLock({ replaceMessage, schedulingLockRef, activePublishIdsRef, setScheduling });
    const errorDetails = createBridgeValidationError(t('schedule.failed'), 'LEGACY_MEDIA_IDENTITY_UNAVAILABLE');
    showNotification(errorDetails.message, 'warning', t('schedule.errorTitle'), errorDetails);
    return { kind: 'invalid' };
  }

  const upcomingWithIdentities = upcomingStateRef.current.map((scheduledMessage) => {
    const operationIdentity = legacyIdentityByMessage.get(scheduledMessage.id);
    return !scheduledMessage.operationIdentity && operationIdentity
      ? { ...scheduledMessage, operationIdentity }
      : scheduledMessage;
  });
  const currentComparableUpcoming = upcomingWithIdentities.filter((scheduledMessage) => {
    const scheduledTimestamp = Math.floor(new Date(scheduledMessage.when).getTime() / 1000);
    return scheduledMessage.id !== replaceMessage?.id
      && scheduledMessage.status !== 'sent'
      && scheduledMessage.chatId === chatId
      && candidateTimestamps.has(scheduledTimestamp)
      && candidateOperations.some((operation) => (
        operation.message === scheduledMessage.text
        && (scheduledMessage.attachments ?? []).length === (operation.attachments ?? []).length
      ));
  });
  const existingIdentities = new Set(currentComparableUpcoming.map((scheduledMessage) => (
    scheduledMessage.operationIdentity || legacyIdentityByMessage.get(scheduledMessage.id)
  )).filter((identity): identity is string => typeof identity === 'string'));
  const duplicateExists = candidateIdentities.some((identity) => existingIdentities.has(identity!));

  if (duplicateExists) {
    if (legacyUpcoming.some((scheduledMessage) => legacyIdentityByMessage.get(scheduledMessage.id))) {
      upcomingStateRef.current = upcomingWithIdentities;
      setUpcoming(upcomingWithIdentities);
      await persistScheduleHistoryAndWait(historyScope, 'upcoming', upcomingWithIdentities);
    }
    releaseScheduleLock({ replaceMessage, schedulingLockRef, activePublishIdsRef, setScheduling });
    showNotification(t('schedule.duplicate'), 'warning', t('schedule.duplicateTitle'));
    return { kind: 'duplicate' };
  }

  return {
    kind: 'ready',
    candidateOperations,
    candidateIdentities: candidateIdentities.filter((identity): identity is string => typeof identity === 'string'),
    upcomingWithIdentities,
  };
}
