import { useCallback, useEffect, useRef, useState } from 'react';
import type { RichTextEntity } from '../types';
import { normalizeAttachments } from '../lib/draftAttachments';
import { readInitialWorkspaceDraft, type WorkspaceDraft } from '../lib/draftStore';
import type { WorkspaceAttachment } from '../lib/workspaceAttachments';
import { uid } from '@shared/utils';

export function useWorkspaceDocumentState() {
  const initialDraftRef = useRef<Partial<WorkspaceDraft> | null>(null);
  const initialDraftLoadErrorRef = useRef('');
  if (initialDraftRef.current === null) {
    try {
      initialDraftRef.current = readInitialWorkspaceDraft();
    } catch (error) {
      initialDraftRef.current = {};
      initialDraftLoadErrorRef.current = error instanceof Error
        ? error.message
        : 'Saved workspace draft could not be read.';
    }
  }

  const [workspaceDocumentId, setWorkspaceDocumentIdState] = useState(
    () => initialDraftRef.current?.documentId || uid(),
  );
  const workspaceDocumentIdRef = useRef(workspaceDocumentId);
  workspaceDocumentIdRef.current = workspaceDocumentId;
  const setWorkspaceDocumentId = useCallback((documentId: string) => {
    workspaceDocumentIdRef.current = documentId;
    setWorkspaceDocumentIdState(documentId);
  }, []);

  const [draftBody, setDraftBody] = useState(() => initialDraftRef.current?.body ?? '');
  const draftBodyRef = useRef(draftBody);
  useEffect(() => {
    draftBodyRef.current = draftBody;
  }, [draftBody]);
  const [draftEntities, setDraftEntities] = useState<RichTextEntity[]>(
    () => initialDraftRef.current?.entities ?? [],
  );
  const [messageEffectId, setMessageEffectId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<WorkspaceAttachment[]>(
    () => normalizeAttachments(initialDraftRef.current?.attachments),
  );
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const attachmentUsageRef = useRef({
    count: attachments.length,
    standaloneCount: attachments.filter((attachment) => !attachment.albumId).length,
    size: attachments.reduce((total, attachment) => total + (attachment.size ?? 0), 0),
    albumIds: new Set(attachments.flatMap((attachment) => attachment.albumId ? [attachment.albumId] : [])),
  });
  const attachmentSelectionGenerationRef = useRef(0);
  const replaceAttachments = useCallback((nextAttachments: WorkspaceAttachment[]) => {
    attachmentsRef.current = nextAttachments;
    attachmentUsageRef.current = {
      count: nextAttachments.length,
      standaloneCount: nextAttachments.filter((attachment) => !attachment.albumId).length,
      size: nextAttachments.reduce((total, attachment) => total + (attachment.size ?? 0), 0),
      albumIds: new Set(nextAttachments.flatMap((attachment) => attachment.albumId ? [attachment.albumId] : [])),
    };
    setAttachments(nextAttachments);
  }, []);

  return {
    initialDraftRef,
    initialDraftLoadErrorRef,
    workspaceDocumentId,
    workspaceDocumentIdRef,
    setWorkspaceDocumentId,
    draftBody,
    setDraftBody,
    draftBodyRef,
    draftEntities,
    setDraftEntities,
    messageEffectId,
    setMessageEffectId,
    attachments,
    setAttachments,
    attachmentsRef,
    attachmentUsageRef,
    attachmentSelectionGenerationRef,
    replaceAttachments,
  };
}
