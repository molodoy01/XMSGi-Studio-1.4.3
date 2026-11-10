import { createElement } from 'react';
import type { ReactNode } from 'react';
import { fireEvent, render as renderTestingLibrary } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ScheduledMessage } from '@/types';
import { LocaleProvider } from '@/lib/i18n';
import { readColorThemeStyles, readGlobalStyles, readQuickPlannerStyles } from '../test/globalStyles';

export const quickPlannerStyles = readQuickPlannerStyles();
export const activityStyles = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'QuickPlannerActivity.css'), 'utf8');
export const globalStyles = readGlobalStyles();
export const colorThemeStyles = readColorThemeStyles();
export const fontStyles = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../styles/fonts.css'), 'utf8');
export function render(ui: ReactNode, initialMode: 'Send now' | 'Schedule' = 'Schedule') {
  const view = renderTestingLibrary(createElement(LocaleProvider, null, ui));
  if (initialMode === 'Schedule') {
    const scheduleMode = view.container.querySelectorAll<HTMLButtonElement>('.quick-planner-mode-switch button')[1];
    fireEvent.click(scheduleMode);
  }
  return view;
}
export function createScheduledMessage(overrides: Partial<ScheduledMessage> = {}): ScheduledMessage {
  return {
    id: 'message-1',
    chatId: 'chat-1',
    chatName: 'Test chat',
    text: 'A scheduled message',
    when: '2035-05-12T15:00:00.000Z',
    createdAt: '2035-05-10T10:00:00.000Z',
    status: 'scheduled',
    ...overrides,
  };
}
