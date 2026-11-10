import { useCallback, startTransition, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { RichTextEntity } from '../types';
import { sliceRichText } from '../lib/richText';
import { remapAttachmentPositions, type WorkspaceAttachment } from '../lib/workspaceAttachments';

type Options = {
  maxLength: number;
  draftBodyRef: MutableRefObject<string>;
  setAttachments: Dispatch<SetStateAction<WorkspaceAttachment[]>>;
  setDraftBody: Dispatch<SetStateAction<string>>;
  setDraftEntities: Dispatch<SetStateAction<RichTextEntity[]>>;
};

export function useWorkspaceEditorChange({
  maxLength,
  draftBodyRef,
  setAttachments,
  setDraftBody,
  setDraftEntities,
}: Options) {
  return useCallback((nextText: string, nextEntities: RichTextEntity[]) => {
    const limited = nextText.length > maxLength
      ? sliceRichText(nextText, nextEntities, 0, maxLength)
      : { text: nextText, entities: nextEntities };
    const previousText = draftBodyRef.current;
    draftBodyRef.current = limited.text;
    startTransition(() => {
      setAttachments((current) => remapAttachmentPositions(current, previousText, limited.text));
      setDraftBody(limited.text);
      setDraftEntities((current) => (
        current.length === limited.entities.length
        && current.every((entity, index) => {
          const next = limited.entities[index];
          return entity.type === next.type
            && entity.offset === next.offset
            && entity.length === next.length
            && entity.url === next.url;
        })
          ? current
          : limited.entities
      ));
    });
  }, [draftBodyRef, maxLength, setAttachments, setDraftBody, setDraftEntities]);
}
