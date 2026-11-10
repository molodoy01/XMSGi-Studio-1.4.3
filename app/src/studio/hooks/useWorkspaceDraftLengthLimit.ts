import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { sliceRichText } from '../lib/richText';
import type { RichTextEntity } from '../types';

type WorkspaceDraftLengthLimitOptions = {
  draftBody: string;
  draftEntities: RichTextEntity[];
  setDraftBody: Dispatch<SetStateAction<string>>;
  setDraftEntities: Dispatch<SetStateAction<RichTextEntity[]>>;
  maxDraftLength: number;
  attachmentCount: number;
};

export function useWorkspaceDraftLengthLimit({
  draftBody,
  draftEntities,
  setDraftBody,
  setDraftEntities,
  maxDraftLength,
  attachmentCount,
}: WorkspaceDraftLengthLimitOptions) {
  useEffect(() => {
    if (draftBody.length <= maxDraftLength) return;

    const limited = sliceRichText(draftBody, draftEntities, 0, maxDraftLength);
    setDraftBody(limited.text);
    setDraftEntities(limited.entities);
  }, [attachmentCount, draftBody, draftEntities, maxDraftLength, setDraftBody, setDraftEntities]);
}
