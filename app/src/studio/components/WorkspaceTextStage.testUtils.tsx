/* eslint-disable react-refresh/only-export-components */
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { vi } from 'vitest';
import { LocaleProvider } from '@studio/lib/i18n';
import type { Chat, DraftColor, SavedDraft, Template } from '@studio/types';
import { RichTextEditor as BaseRichTextEditor } from './RichTextEditor';
import { WorkspaceTextStage } from './WorkspaceTextStage';
import { ChatSelectionStage } from './stages/ChatSelectionStage';
import { DraftsStage } from './stages/DraftsStage';
import { ScheduleStage } from './stages/ScheduleStage';
import { TemplatesStage } from './stages/TemplatesStage';
import type { StageMode } from './stages/types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
export function RichTextEditor(props: React.ComponentProps<typeof BaseRichTextEditor>) {
  return <LocaleProvider><BaseRichTextEditor {...props} /></LocaleProvider>;
}
export const chatA: Chat = {
  id: 'chat-1',
  name: 'Alpha Team',
  username: 'alpha',
  type: 'group',
  avatarDataUrl: '',
};
export const chatB: Chat = {
  id: 'chat-2',
  name: 'Beta Channel',
  username: 'beta',
  type: 'channel',
  avatarDataUrl: '',
};
export const templateA: Template = {
  id: 'tpl-1',
  name: 'Welcome',
  body: 'Hello from template',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};
export const savedDraftA: SavedDraft = {
  id: 'draft-1',
  name: 'Follow-up',
  body: 'Saved draft message',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};
export type ScheduleProps = Omit<React.ComponentProps<typeof ScheduleStage>, 'mode'>;
export type TemplateProps = Omit<React.ComponentProps<typeof TemplatesStage>, 'mode'>;
export type DraftProps = Omit<React.ComponentProps<typeof DraftsStage>, 'mode'>;
export type ChatProps = Omit<React.ComponentProps<typeof ChatSelectionStage>, 'mode'>;
export type LegacyStageProps = { mode: StageMode } & ScheduleProps & TemplateProps & DraftProps & ChatProps;
export function groupStageProps({ mode, ...props }: LegacyStageProps): React.ComponentProps<typeof WorkspaceTextStage> {
  return {
    mode,
    schedule: {
      scheduleFocus: props.scheduleFocus,
      onModeChange: props.onModeChange,
      onScheduleDone: props.onScheduleDone,
      date: props.date,
      time: props.time,
      setDate: props.setDate,
      setTime: props.setTime,
      followCurrentTime: props.followCurrentTime,
      setFollowCurrentTime: props.setFollowCurrentTime,
      repeatMode: props.repeatMode,
      setRepeatMode: props.setRepeatMode,
      repeatDays: props.repeatDays,
      setRepeatDays: props.setRepeatDays,
      repeatOccurrences: props.repeatOccurrences,
      setRepeatOccurrences: props.setRepeatOccurrences,
    },
    templates: {
      onModeChange: props.onModeChange,
      templates: props.templates,
      onInsertTemplate: props.onInsertTemplate,
      templateEditingId: props.templateEditingId,
      templateDraftName: props.templateDraftName,
      setTemplateDraftName: props.setTemplateDraftName,
      templateDraftBody: props.templateDraftBody,
      setTemplateDraftBody: props.setTemplateDraftBody,
      openTemplateEditor: props.openTemplateEditor,
      onDeleteTemplate: props.onDeleteTemplate,
      closeTemplateEditor: props.closeTemplateEditor,
      saveTemplateStage: props.saveTemplateStage,
      onExportTemplates: props.onExportTemplates,
      onImportTemplates: props.onImportTemplates,
    },
    drafts: {
      onModeChange: props.onModeChange,
      savedDrafts: props.savedDrafts,
      selectedDraftColor: props.selectedDraftColor,
      setSelectedDraftColor: props.setSelectedDraftColor,
      onInsertDraft: props.onInsertDraft,
      draftEditingId: props.draftEditingId,
      draftColor: props.draftColor,
      setDraftColor: props.setDraftColor,
      draftName: props.draftName,
      setDraftName: props.setDraftName,
      draftBodyText: props.draftBodyText,
      setDraftBodyText: props.setDraftBodyText,
      openDraftEditor: props.openDraftEditor,
      onDeleteDraft: props.onDeleteDraft,
      closeDraftEditor: props.closeDraftEditor,
      saveDraftStage: props.saveDraftStage,
      draftStoreReady: props.draftStoreReady,
      draftStoreSaving: props.draftStoreSaving,
      onExportDrafts: props.onExportDrafts,
      onImportDrafts: props.onImportDrafts,
      onImportEditorText: props.onImportEditorText,
    },
    chats: {
      chats: props.chats,
      selectedChats: props.selectedChats,
      onChatSelectionChange: props.onChatSelectionChange,
      onChatSelectionDone: props.onChatSelectionDone,
      onChatSelectionBack: props.onChatSelectionBack,
      onChatError: props.onChatError,
      onAddChat: props.onAddChat,
      onRemoveChat: props.onRemoveChat,
    },
  };
}
export function renderStage(overrides: Partial<LegacyStageProps> = {}) {
  const rootElement = document.createElement('div');
  document.body.appendChild(rootElement);

  const root: Root = createRoot(rootElement);
  const defaults: LegacyStageProps = {
    mode: 'editor',
    onModeChange: vi.fn(),
    chats: [chatA, chatB],
    selectedChats: [chatA],
    onChatSelectionChange: vi.fn(),
    onChatSelectionDone: vi.fn(),
    onChatSelectionBack: vi.fn(),
    onChatError: vi.fn(),
    onAddChat: vi.fn(),
    onRemoveChat: vi.fn(),
    date: '2026-01-10',
    time: '09:00',
    setDate: vi.fn(),
    setTime: vi.fn(),
    followCurrentTime: false,
    setFollowCurrentTime: vi.fn(),
    repeatMode: 'none',
    setRepeatMode: vi.fn(),
    repeatDays: [],
    setRepeatDays: vi.fn(),
    repeatOccurrences: 3,
    setRepeatOccurrences: vi.fn(),
    templates: [templateA],
    onInsertTemplate: vi.fn(),
    templateEditingId: null,
    templateDraftName: '',
    setTemplateDraftName: vi.fn(),
    templateDraftBody: '',
    setTemplateDraftBody: vi.fn(),
    openTemplateEditor: vi.fn(),
    onDeleteTemplate: vi.fn(),
    closeTemplateEditor: vi.fn(),
    saveTemplateStage: vi.fn(),
    savedDrafts: [savedDraftA],
    selectedDraftColor: null,
    setSelectedDraftColor: vi.fn<(color: React.SetStateAction<DraftColor | null>) => void>(),
    onInsertDraft: vi.fn(),
    draftEditingId: null,
    draftColor: 'gray',
    setDraftColor: vi.fn(),
    draftName: '',
    setDraftName: vi.fn(),
    draftBodyText: '',
    setDraftBodyText: vi.fn(),
    openDraftEditor: vi.fn(),
    onDeleteDraft: vi.fn(),
    closeDraftEditor: vi.fn(),
    saveDraftStage: vi.fn(),
    draftStoreReady: true,
    draftStoreSaving: false,
    onExportDrafts: vi.fn(),
    onImportDrafts: vi.fn(),
    onImportEditorText: vi.fn(),
  };

  function StageHarness({ stage }: { stage: React.ComponentProps<typeof WorkspaceTextStage> }) {
    const [selectedDraftColor, setSelectedDraftColor] = useState(stage.drafts.selectedDraftColor);
    return (
      <WorkspaceTextStage
        {...stage}
        drafts={{ ...stage.drafts, selectedDraftColor, setSelectedDraftColor }}
      />
    );
  }

  const stage = groupStageProps({ ...defaults, ...overrides });
  act(() => {
    root.render(<LocaleProvider><StageHarness stage={stage} /></LocaleProvider>);
  });

  return {
    root,
    rootElement,
    rerender: (nextOverrides: Partial<LegacyStageProps>) => {
      const nextStage = groupStageProps({ ...defaults, ...overrides, ...nextOverrides });
      act(() => {
        root.render(<LocaleProvider><StageHarness stage={nextStage} /></LocaleProvider>);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      rootElement.remove();
    },
  };
}
export function renderRichTextEditor(overrides: Partial<React.ComponentProps<typeof RichTextEditor>> = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onChange = vi.fn();
  const defaults: React.ComponentProps<typeof RichTextEditor> = {
    text: '',
    entities: [],
    onChange,
    maxLength: 4096,
  };

  act(() => root.render(<LocaleProvider><RichTextEditor {...defaults} {...overrides} /></LocaleProvider>));

  return {
    container,
    editor: container.querySelector('[contenteditable="true"]') as HTMLDivElement,
    onChange,
    root,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}
export function captureAnimationFrames() {
  let nextId = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = ++nextId;
    callbacks.set(id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    callbacks.delete(id);
  });
  return {
    get pendingCount() {
      return callbacks.size;
    },
    flush() {
      const currentCallbacks = [...callbacks.values()];
      callbacks.clear();
      act(() => currentCallbacks.forEach((callback) => callback(0)));
    },
  };
}
export function createLogoHarness() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const animation = { cancel: vi.fn(), onfinish: null } as unknown as Animation;
  const animate = vi.fn((frames: Keyframe[], options?: KeyframeAnimationOptions) => {
    void frames;
    void options;
    return animation;
  });
  const previousAnimate = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'animate');
  const previousImageBounds = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'getBoundingClientRect');
  Object.defineProperty(HTMLImageElement.prototype, 'animate', { configurable: true, value: animate });
  Object.defineProperty(HTMLImageElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ width: 240, height: 240, top: 0, right: 240, bottom: 240, left: 0, x: 0, y: 0, toJSON: () => ({}) }),
  });
  act(() => root.render(
    <LocaleProvider><RichTextEditor text="" entities={[]} onChange={vi.fn()} maxLength={4096} /></LocaleProvider>,
  ));
  const editor = container.querySelector('[contenteditable="true"]') as HTMLDivElement;
  let cleanedUp = false;
  Object.defineProperty(editor, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ width: 600, height: 300, top: 0, right: 600, bottom: 300, left: 0, x: 0, y: 0, toJSON: () => ({}) }),
  });

  return {
    animation,
    animate,
    container,
    editor,
    cleanup() {
      if (cleanedUp) return;
      cleanedUp = true;
      act(() => root.unmount());
      container.remove();
      if (previousAnimate) Object.defineProperty(HTMLImageElement.prototype, 'animate', previousAnimate);
      else Reflect.deleteProperty(HTMLImageElement.prototype, 'animate');
      if (previousImageBounds) Object.defineProperty(HTMLImageElement.prototype, 'getBoundingClientRect', previousImageBounds);
      else Reflect.deleteProperty(HTMLImageElement.prototype, 'getBoundingClientRect');
    },
  };
}
