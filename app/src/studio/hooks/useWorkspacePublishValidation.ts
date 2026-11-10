import { useMemo } from 'react';
import type { Locale, TranslationKey } from '@studio/lib/i18n';
import { formatScheduleSummary, isFutureSchedule, MAX_SCHEDULE_OCCURRENCES, type ScheduleRepeatOptions } from '../lib/scheduling';
import { hasDraftContent } from '../lib/draftStore';
import { isTelegramPhotoAlbumImage } from '../lib/draftAttachments';
import type { WorkspaceAttachment } from '../lib/workspaceAttachments';
import type { PublishAction } from '../components/WorkspacePageActionRows';
import type { Chat } from '../types';

type WorkspacePublishValidationOptions = {
  attachments: WorkspaceAttachment[];
  attachmentError: string;
  draftBody: string;
  draftStoreReady: boolean;
  draftStoreError: string;
  savingCurrentDraft: boolean;
  publishingDraft: boolean;
  sendInFlight: boolean;
  scheduling: boolean;
  selectedChat: Chat | null;
  publishAction: PublishAction;
  date: string;
  time: string;
  scheduleClockNow: number;
  repeatMode: ScheduleRepeatOptions['mode'];
  repeatDays: string[];
  repeatOccurrences: number;
  locale: Locale;
  translate: (key: TranslationKey) => string;
};

export function useWorkspacePublishValidation({
  attachments,
  attachmentError,
  draftBody,
  draftStoreReady,
  draftStoreError,
  savingCurrentDraft,
  publishingDraft,
  sendInFlight,
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
  translate,
}: WorkspacePublishValidationOptions) {
  return useMemo(() => {
    const hasDraftContentState = hasDraftContent(draftBody, attachments);
    const hasSelectedTarget = Boolean(selectedChat);
    const hasValidScheduleDate = Boolean(date && !Number.isNaN(new Date(`${date}T12:00:00`).getTime()));
    const hasValidScheduleTime = Boolean(time && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time));
    const hasFutureSchedule = isFutureSchedule(date, time, new Date(scheduleClockNow));
    const hasValidRepeatConfig = repeatMode === 'none'
      || ((repeatMode === 'weekly' || repeatMode === 'biweekly') ? repeatDays.length > 0 : true)
      && repeatOccurrences > 0
      && repeatOccurrences <= MAX_SCHEDULE_OCCURRENCES;
    const hasUnsupportedPhotoAlbumImage = attachments.some((attachment) => (
      Boolean(attachment.albumId) && !isTelegramPhotoAlbumImage(attachment.name)
    ));
    const canSendNow = hasSelectedTarget && hasDraftContentState && !attachmentError
      && !hasUnsupportedPhotoAlbumImage && !publishingDraft && !sendInFlight && !scheduling;
    const canSaveDraft = hasDraftContentState && !publishingDraft && !savingCurrentDraft;
    const canSchedule = hasSelectedTarget && hasDraftContentState && !hasUnsupportedPhotoAlbumImage
      && !scheduling && hasValidScheduleDate && hasValidScheduleTime && hasValidRepeatConfig && hasFutureSchedule;

    let publishActionBlocker = '';
    if (publishAction === 'draft') {
      if (!hasDraftContentState) {
        publishActionBlocker = translate('studio.enterMessage');
      } else if (!draftStoreReady) {
        publishActionBlocker = draftStoreError || translate('studio.waitForDrafts');
      }
    } else if (publishAction === 'schedule') {
      if (!hasDraftContentState) {
        publishActionBlocker = translate('studio.enterMessage');
      } else if (!hasSelectedTarget) {
        publishActionBlocker = translate('studio.selectChat');
      } else if (hasUnsupportedPhotoAlbumImage) {
        publishActionBlocker = translate('studio.photoAlbumReaddUnsupported');
      } else if (!hasValidScheduleDate) {
        publishActionBlocker = translate('studio.invalidDate');
      } else if (!hasValidScheduleTime) {
        publishActionBlocker = translate('studio.invalidTime');
      } else if (!hasValidRepeatConfig) {
        publishActionBlocker = translate('studio.invalidRepeat');
      } else if (!hasFutureSchedule) {
        publishActionBlocker = translate('studio.futureDateTime');
      }
    } else if (!hasDraftContentState) {
      publishActionBlocker = translate('studio.enterMessage');
    } else if (!hasSelectedTarget) {
      publishActionBlocker = translate('studio.selectChat');
    } else if (hasUnsupportedPhotoAlbumImage) {
      publishActionBlocker = translate('studio.photoAlbumReaddUnsupported');
    } else if (attachmentError) {
      publishActionBlocker = translate('studio.fixAttachment');
    }

    const publishScheduleSummary = formatScheduleSummary(date, time, {
      mode: repeatMode,
      days: repeatDays,
      occurrences: repeatOccurrences,
    }, locale);

    return {
      hasDraftContentState,
      hasSelectedTarget,
      hasValidScheduleDate,
      hasValidScheduleTime,
      hasFutureSchedule,
      hasValidRepeatConfig,
      hasUnsupportedPhotoAlbumImage,
      canSendNow,
      canSaveDraft,
      canSchedule,
      publishActionBlocker,
      publishScheduleSummary,
    };
  }, [
    attachmentError,
    attachments,
    date,
    draftBody,
    draftStoreError,
    draftStoreReady,
    locale,
    publishAction,
    publishingDraft,
    repeatDays,
    repeatMode,
    repeatOccurrences,
    savingCurrentDraft,
    scheduleClockNow,
    scheduling,
    selectedChat,
    sendInFlight,
    time,
    translate,
  ]);
}
