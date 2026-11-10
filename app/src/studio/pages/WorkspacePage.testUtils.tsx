import { act } from 'react';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';
import type { Chat, PersistedDraftStore } from '@studio/types';
import { type WorkspaceDraft } from '../lib/draftStore';
import { LocaleProvider } from '@studio/lib/i18n';
import { ConfirmDialogProvider } from '@/components/ConfirmDialog';
import { WorkspacePage } from './WorkspacePage';
import { readColorThemeStyles, readGlobalStyles, readQuickPlannerStyles, readWorkspacePageStyles } from '../../test/globalStyles';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export const chatA: Chat = {
  id: 'chat-1',
  name: 'Alpha Team',
  username: 'alpha',
  type: 'group',
  avatarDataUrl: '',
};

export const workspacePageStyles = readWorkspacePageStyles();

export const plannerNotificationStyles = readQuickPlannerStyles();

export const globalStyles = readGlobalStyles();

export const colorThemeStyles = readColorThemeStyles();

export const themeTokenStyles = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../styles/tokens.css'), 'utf8');

let inMemoryDraftStore: PersistedDraftStore;

let telegramStatusListener: ((status: unknown) => void) | null = null;

export const workspaceTestState = {
  get inMemoryDraftStore(): PersistedDraftStore { return inMemoryDraftStore; },
  set inMemoryDraftStore(value: PersistedDraftStore) { inMemoryDraftStore = value; },
  get telegramStatusListener(): ((status: unknown) => void) | null { return telegramStatusListener; },
  set telegramStatusListener(value: ((status: unknown) => void) | null) { telegramStatusListener = value; },
};

export function getInMemoryWorkspaceDraft(): WorkspaceDraft {
  const workspaceDraft = inMemoryDraftStore.workspaceDraft;
  if (!workspaceDraft || typeof workspaceDraft !== 'object') {
    throw new Error('Expected an in-memory workspace draft.');
  }
  return workspaceDraft as WorkspaceDraft;
}

export function seedVersionHistoryDialogStore() {
  const currentDocumentId = 'history-dialog-current-document';
  const otherDocumentId = 'history-dialog-other-document';
  const createVersion = (documentId: string, body: string, createdAt: string) => ({
    id: `${documentId}-version`,
    documentId,
    createdAt,
    reason: 'edit' as const,
    snapshot: {
      documentId,
      body,
      entities: [],
      attachments: [],
      selectedChat: chatA,
      date: '2026-10-20',
      time: '09:00',
      repeatMode: 'none' as const,
      repeatDays: [],
      repeatOccurrences: 1,
      savedAt: '12:00',
    },
  });

  inMemoryDraftStore = {
    schemaVersion: 3,
    migrationVersion: 1,
    savedDrafts: [],
    documentHistories: {
      [currentDocumentId]: [createVersion(currentDocumentId, 'Current historical document', '2026-10-01T12:00:00.000Z')],
      [otherDocumentId]: [createVersion(otherDocumentId, 'Other historical document', '2026-10-02T12:00:00.000Z')],
    },
    workspaceDraft: {
      documentId: currentDocumentId,
      body: 'Current editor document',
      entities: [],
      attachments: [],
      savedAt: '12:00',
    },
  };

  return { currentDocumentId, otherDocumentId };
}

export async function renderWorkspacePage(overrides: Partial<React.ComponentProps<typeof WorkspacePage>> = {}) {
  const defaults: React.ComponentProps<typeof WorkspacePage> = {
    connected: false,
    chats: [chatA],
    selectedChat: chatA,
    setSelectedChat: vi.fn(),
    onAddChat: vi.fn(),
    onRemoveChat: vi.fn(),
    removeModal: { show: false, chat: null },
    setRemoveModal: vi.fn(),
    confirmRemoveChat: vi.fn(),
    upcoming: [],
    date: '2026-01-10',
    time: '09:00',
    scheduling: false,
    successPulse: false,
    lastAction: null,
    setDate: vi.fn(),
    setTime: vi.fn(),
    handleSchedule: vi.fn(),
    handleCancelMessage: vi.fn(),
    handleSendDraftNow: vi.fn().mockResolvedValue(true),
    publishingDraft: false,
  };

  const view = render(<LocaleProvider><ConfirmDialogProvider><WorkspacePage {...defaults} {...overrides} /></ConfirmDialogProvider></LocaleProvider>);
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return {
    showNotification: overrides.showNotification,
    rerender: (nextOverrides: Partial<React.ComponentProps<typeof WorkspacePage>> = {}) => act(() => {
      view.rerender(<LocaleProvider><ConfirmDialogProvider><WorkspacePage {...defaults} {...overrides} {...nextOverrides} /></ConfirmDialogProvider></LocaleProvider>);
    }),
    unmount: view.unmount,
  };
}

export async function openDraftsStage() {
    await act(async () => {
      (document.querySelector('.workspace-page-publish-menu-toggle') as HTMLButtonElement).click();
    });
    const saveDraftOption = Array.from(document.querySelectorAll('.workspace-page-publish-option'))
      .find((button) => button.textContent?.trim() === 'Save draft') as HTMLButtonElement;
    await act(async () => {
      saveDraftOption.click();
    });
    const draftButton = Array.from(document.querySelectorAll('.workspace-page-action-left-group > button'))
      .find((button) => button.textContent?.trim() === 'Draft') as HTMLButtonElement;
    await act(async () => {
      draftButton.click();
    });
  }

export async function saveEditorAsDraft() {
    await act(async () => {
      (document.querySelector('.workspace-page-publish-menu-toggle') as HTMLButtonElement).click();
    });
    const saveDraftOption = Array.from(document.querySelectorAll('.workspace-page-publish-option'))
      .find((button) => button.textContent?.trim() === 'Save draft') as HTMLButtonElement;
    await act(async () => saveDraftOption.click());
    await act(async () => {
      (document.querySelector('.workspace-page-publish-main') as HTMLButtonElement).click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 400));
    });
  }

export async function editComposerText(text: string) {
    const editor = document.querySelector('[aria-label="Post content"]') as HTMLDivElement;
    await act(async () => {
      editor.textContent = text;
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
    });
  }

export async function waitForWorkspaceAutosave() {
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    });
  }

export async function typeEditorText(value: string) {
    const editor = document.querySelector('[role="textbox"]') as HTMLDivElement;
    await act(async () => {
      editor.textContent = value;
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
    });
  }

export async function openExportMenu() {
    const exportTrigger = document.querySelector('.workspace-page-editor-export-trigger') as HTMLButtonElement;
    await act(async () => {
      exportTrigger.click();
    });
    return document.querySelector('.workspace-page-editor-export-menu') as HTMLDivElement;
  }

export function pickExportFormat(menu: HTMLDivElement, extension: '.txt' | '.json') {
    return Array.from(menu.querySelectorAll('button'))
      .find((button) => button.textContent?.includes(extension)) as HTMLButtonElement;
  }

export function resetWorkspacePageTestEnvironment() {
    (globalThis as typeof globalThis & { ResizeObserver?: { new (): { observe: (node: Element) => void; unobserve: (node: Element) => void; disconnect: () => void } } }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.scrollTo = vi.fn();

    document.body.innerHTML = '';
    localStorage.clear();
    localStorage.setItem('awaitmsg_locale', 'en');
    localStorage.setItem('xmsgi-default-draft-seeded-v1', '1');
    localStorage.setItem('xmsgi-default-template-seeded-v1', '1');
    localStorage.setItem('xmsgi-built-in-templates-seeded-v1', '1');
    localStorage.setItem('awaitmsg-workspace-draft', JSON.stringify({
      body: 'Hello world',
      entities: [],
      attachments: [],
      savedAt: '12:00',
      date: '2026-01-10',
      time: '09:00',
      repeatMode: 'none',
      repeatDays: [],
      repeatOccurrences: 5,
    }));
    Object.defineProperty(window, 'telegram', {
      value: {
        onStatus: vi.fn((callback: (status: unknown) => void) => {
          telegramStatusListener = callback;
          return () => {
            if (telegramStatusListener === callback) telegramStatusListener = null;
          };
        }),
        findChat: vi.fn().mockResolvedValue({ success: false, error: 'Chat not found.' }),
        getChatHistory: vi.fn().mockResolvedValue({
          success: true,
          history: {
            chat: { id: chatA.id, title: chatA.name },
            messages: [],
          },
        }),
        getFilePath: vi.fn((file: File) => `/${file.name}`),
      },
      configurable: true,
    });
    inMemoryDraftStore = {
      schemaVersion: 2,
      migrationVersion: 0,
      savedDrafts: [],
      workspaceDraft: null,
    };
    Object.defineProperty(window, 'draftStorage', {
      value: {
        load: vi.fn(async () => ({
          success: true,
          store: JSON.parse(JSON.stringify(inMemoryDraftStore)),
          needsMigration: inMemoryDraftStore.migrationVersion === 0,
        })),
        migrate: vi.fn(async (legacy) => {
          inMemoryDraftStore = {
            schemaVersion: 2,
            migrationVersion: 1,
            savedDrafts: legacy.savedDrafts,
            workspaceDraft: legacy.workspaceDraft,
          };
          return { success: true, migrated: true, store: JSON.parse(JSON.stringify(inMemoryDraftStore)) };
        }),
        save: vi.fn(async (store) => {
          inMemoryDraftStore = JSON.parse(JSON.stringify(store));
          return { success: true, store: JSON.parse(JSON.stringify(inMemoryDraftStore)) };
        }),
        flush: vi.fn((store) => {
          inMemoryDraftStore = JSON.parse(JSON.stringify(store));
          return { success: true, store: JSON.parse(JSON.stringify(inMemoryDraftStore)) };
        }),
        restoreBackup: vi.fn(async () => ({ success: false, error: 'No backup' })),
        exportBackup: vi.fn(async () => ({ success: true })),
        importBackup: vi.fn(async () => ({ success: false, cancelled: true })),
        exportText: vi.fn(async () => ({ success: true })),
        importText: vi.fn(async () => ({ success: true, text: 'Imported from text file' })),
        copyAttachment: vi.fn(async (file: File) => ({
          success: true,
          attachment: { name: file.name, path: `/stored/${file.name}`, size: file.size },
        })),
        readImageDataUrl: vi.fn(async () => ({
          success: true,
          dataUrl: 'data:image/png;base64,dGVzdA==',
        })),
          copyAttachmentPath: vi.fn(async (sourcePath: string) => {
            const name = sourcePath.split(/[\\/]/).pop() || sourcePath;
            return {
              success: true,
              attachment: { name, path: `/stored/${name}`, size: 123 },
            };
          }),
      },
      configurable: true,
    });
  }
