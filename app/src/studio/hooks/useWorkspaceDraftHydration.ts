import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Chat, RichTextEntity, ScheduledMessage } from '../types';
import type { WorkspaceDraft } from '../lib/draftStore';
import type { WorkspaceAttachment } from '../lib/workspaceAttachments';
import type { ScheduleRepeatOptions } from '../lib/scheduling';
import { normalizeAttachments } from '../lib/draftAttachments';
import { normalizeRichTextEntities } from '../lib/richText';
import { uid } from '@shared/utils';

type UseWorkspaceDraftHydrationOptions = {
  rescheduleSourceRef: MutableRefObject<ScheduledMessage | null>;
  workspaceDocumentIdRef: MutableRefObject<string>;
  setWorkspaceDocumentId: (documentId: string) => void;
  initialDraftRef: MutableRefObject<Partial<WorkspaceDraft> | null>;
  attachmentSelectionGenerationRef: MutableRefObject<number>;
  selectedChat: Chat | null;
  date: string;
  time: string;
  repeatMode: ScheduleRepeatOptions['mode'];
  repeatOccurrences: number;
  setDraftBody: Dispatch<SetStateAction<string>>;
  setDraftEntities: Dispatch<SetStateAction<RichTextEntity[]>>;
  replaceAttachments: (attachments: WorkspaceAttachment[]) => void;
  setFollowCurrentTime: Dispatch<SetStateAction<boolean>>;
  setDate: Dispatch<SetStateAction<string>>;
  setTime: Dispatch<SetStateAction<string>>;
  setRepeatMode: Dispatch<SetStateAction<ScheduleRepeatOptions['mode']>>;
  setRepeatDays: Dispatch<SetStateAction<string[]>>;
  setRepeatOccurrences: Dispatch<SetStateAction<number>>;
};

export function useWorkspaceDraftHydration(options: UseWorkspaceDraftHydrationOptions) {
  return (workspaceDraft: Partial<WorkspaceDraft> | null) => {
    if (options.rescheduleSourceRef.current) return;
    const documentId = workspaceDraft?.documentId || options.workspaceDocumentIdRef.current || uid();
    options.setWorkspaceDocumentId(documentId);
    options.initialDraftRef.current = {
      ...(workspaceDraft ?? {}),
      documentId,
      body: workspaceDraft?.body ?? '',
      entities: normalizeRichTextEntities(workspaceDraft?.entities, workspaceDraft?.body?.length ?? 0),
      attachments: normalizeAttachments(workspaceDraft?.attachments),
      selectedChat: workspaceDraft?.selectedChat ?? options.selectedChat,
      savedAt: workspaceDraft?.savedAt ?? '',
      date: workspaceDraft?.date || options.date,
      time: workspaceDraft?.time || options.time,
      repeatMode: workspaceDraft?.repeatMode || options.repeatMode,
      repeatDays: workspaceDraft?.repeatDays ?? [],
      repeatOccurrences: workspaceDraft?.repeatOccurrences || options.repeatOccurrences,
    };
    options.attachmentSelectionGenerationRef.current += 1;
    if (workspaceDraft) {
      options.setDraftBody(workspaceDraft.body ?? '');
      options.setDraftEntities(normalizeRichTextEntities(
        workspaceDraft.entities,
        workspaceDraft.body?.length ?? 0,
      ));
      options.replaceAttachments(normalizeAttachments(workspaceDraft.attachments));
      if (workspaceDraft.date || workspaceDraft.time) options.setFollowCurrentTime(false);
      if (workspaceDraft.date) options.setDate(workspaceDraft.date);
      if (workspaceDraft.time) options.setTime(workspaceDraft.time);
      if (workspaceDraft.repeatMode) options.setRepeatMode(workspaceDraft.repeatMode);
      options.setRepeatDays(workspaceDraft.repeatDays ?? []);
      if (workspaceDraft.repeatOccurrences) options.setRepeatOccurrences(workspaceDraft.repeatOccurrences);
    } else {
      options.setDraftBody('');
      options.setDraftEntities([]);
      options.replaceAttachments([]);
    }
  };
}
