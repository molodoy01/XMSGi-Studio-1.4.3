import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TelegramStatusSnapshot } from '@/hooks/useTelegramAuth';
import { LocaleProvider } from '@/lib/i18n';
import { EDITOR_APPEARANCE_STORAGE_KEY } from '@shared/editorAppearance';
import { COLOR_THEME_STORAGE_KEY } from '@/lib/colorTheme';
import { SettingsView } from './SettingsView';
import { ConfirmDialogProvider } from './ConfirmDialog';
import { readColorThemeStyles, readSettingsStyles } from '../test/globalStyles';

const themeTransitionStyles = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../styles/tokens.css'),
  'utf8',
);
const colorThemeStyles = readColorThemeStyles();
const settingsStyles = readSettingsStyles();

function renderSettings(overrides: Partial<React.ComponentProps<typeof SettingsView>> = {}) {
  const onTelegramDisconnect = vi.fn();
  const onTelegramReconnect = vi.fn();
  const { container } = render(
    <LocaleProvider>
      <ConfirmDialogProvider>
        <SettingsView
          onClose={vi.fn()}
          accountName="Alex Example"
          telegramUsername="alex_example"
          telegramConnected
          telegramConnecting={false}
          telegramAuthStep="phone"
          telegramPhoneNumber=""
          telegramPhoneCode=""
          telegramTwoFactorPassword=""
          telegramAuthBusy={false}
          telegramAuthError=""
          telegramAuthNotice={false}
          telegramStatus={{ accountId: 'account-1', status: 'normal' } satisfies TelegramStatusSnapshot}
          telegramCredentials={{ hasCredentials: true, hasSession: true, connected: true, signedOut: false }}
          telegramApiId=""
          telegramApiHash=""
          telegramCredentialsBusy={false}
          telegramCredentialsError=""
          onTelegramApiIdChange={vi.fn()}
          onTelegramApiHashChange={vi.fn()}
          onSaveTelegramCredentials={vi.fn()}
          onRestoreApplicationCredentials={vi.fn().mockResolvedValue(true)}
          onTelegramPhoneNumberChange={vi.fn()}
          onTelegramPhoneCodeChange={vi.fn()}
          onTelegramTwoFactorPasswordChange={vi.fn()}
          onTelegramAuth={vi.fn()}
          onTelegramReconnect={onTelegramReconnect}
          onTelegramDisconnect={onTelegramDisconnect}
          {...overrides}
        />
      </ConfirmDialogProvider>
    </LocaleProvider>,
  );

  return { container, onTelegramDisconnect, onTelegramReconnect };
}

beforeEach(() => {
  localStorage.removeItem(EDITOR_APPEARANCE_STORAGE_KEY);
  localStorage.removeItem(COLOR_THEME_STORAGE_KEY);
  document.documentElement.dataset.theme = 'light';
  delete document.documentElement.dataset.themeVariant;
  document.documentElement.style.colorScheme = 'light';
  document.documentElement.classList.remove('is-theme-transitioning');
});

describe('SettingsView Telegram integration', () => {
  it('opens a credentials-only dialog from the login setup action', () => {
    const { container } = renderSettings({ openTelegramCredentials: true });

    expect(screen.getByRole('dialog', { name: 'Telegram API keys' })).toBeInTheDocument();
    expect(document.querySelector('.telegram-manager-backdrop')).toHaveClass('is-credentials-only');
    expect(settingsStyles).toMatch(/\.telegram-manager-backdrop\.is-credentials-only\s*\{\s*background:\s*var\(--void\);\s*\}/);
    expect(settingsStyles).toMatch(/\.telegram-manager-backdrop\.is-credentials-only::before\s*\{\s*display:\s*none;\s*\}/);
    expect(screen.getByLabelText('API ID')).toHaveAttribute('maxlength', '10');
    expect(screen.getByLabelText('API Hash')).toHaveAttribute('maxlength', '256');
    expect(screen.getByText('my.telegram.org')).toHaveAttribute('href', 'https://my.telegram.org');
    expect(screen.getByText('my.telegram.org')).toHaveAttribute('target', '_blank');
    expect(screen.getByText('my.telegram.org')).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Create an app in API development tools, then enter its API ID and Hash.')).toBeInTheDocument();
    expect(screen.queryByText(/STEP 1|Шаг 1/)).not.toBeInTheDocument();
    expect(screen.getByText('Keep your API Hash private')).toBeInTheDocument();
    expect(screen.getByText(/The app stores these keys locally/)).toBeInTheDocument();
    expect(settingsStyles).toMatch(/\.telegram-api-credentials-only \.telegram-credentials-form\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;\s*margin-top:\s*8px;\s*\}/);
    expect(settingsStyles).toMatch(/\.telegram-api-credentials-only \.telegram-api-fields\s*\{\s*margin-top:\s*0;\s*\}/);
    expect(settingsStyles).toMatch(/\.telegram-api-fields label\s*\{[^}]*align-content:\s*start;[^}]*align-items:\s*start;/);
    expect(settingsStyles).toMatch(/\.telegram-api-fields label > span:first-child\s*\{\s*position:\s*relative;\s*top:\s*3px;\s*\}/);
    expect(settingsStyles).toMatch(/\.telegram-credentials-form \.telegram-api-fields input:hover:not\(:focus\):not\(:disabled\)\s*\{[^}]*border-color:\s*color-mix\(/);
    expect(settingsStyles).toMatch(/\.telegram-credentials-form \.telegram-api-fields input:focus\s*\{[^}]*outline:\s*none;[^}]*box-shadow:\s*0 0 0 3px color-mix\(/);
    expect(settingsStyles).toMatch(/\.telegram-api-actions \.telegram-api-save:hover:not\(:disabled\)\s*\{[^}]*box-shadow:/);
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restore app keys' })).not.toBeInTheDocument();
    expect(settingsStyles).toMatch(/\.telegram-api-instructions > a\s*\{[^}]*font-size:\s*15px;[^}]*font-weight:\s*700;/);
    expect(settingsStyles).toMatch(/\.telegram-api-instructions\s*\{[^}]*justify-items:\s*start;[^}]*text-align:\s*left;/);
    expect(settingsStyles).toMatch(/\.telegram-api-instructions > p\s*\{[^}]*position:\s*relative;[^}]*top:\s*3px;[^}]*padding-right:\s*12px;[^}]*font-size:\s*12px;[^}]*white-space:\s*nowrap;/);
    expect(settingsStyles).toMatch(/\.telegram-api-security-note strong\s*\{[^}]*font-size:\s*12px;[^}]*font-weight:\s*650;/);
    expect(settingsStyles).toMatch(/\.telegram-manager-dialog\.topbar-logout-modal\.is-credentials-only\s*\{\s*width:\s*min\(440px,\s*100%\);/);
    expect(settingsStyles).toMatch(/\.telegram-manager-backdrop\.is-credentials-only\s*\{\s*background:\s*var\(--void\);\s*\}/);
    expect(screen.queryByLabelText('Phone')).not.toBeInTheDocument();
    expect(container.querySelector('.telegram-manager-status')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect Telegram' })).not.toBeInTheDocument();
  });

  it('does not show an active API ID beneath the editable field', () => {
    renderSettings({
      openTelegramCredentials: true,
      telegramCredentials: { hasCredentials: true, apiId: '42329817', hasSession: false, connected: false, signedOut: false },
    });

    expect(screen.queryByText('Currently active: 4232…')).not.toBeInTheDocument();
    expect(screen.queryByText('42329817')).not.toBeInTheDocument();
  });

  it('shows a compact restore action only for custom keys and confirms without implying session removal', async () => {
    const onRestoreApplicationCredentials = vi.fn().mockResolvedValue(true);
    renderSettings({
      openTelegramCredentials: true,
      telegramCredentials: {
        hasCredentials: true,
        hasCustomCredentials: true,
        apiId: '42329817',
        hasSession: true,
        connected: false,
        signedOut: false,
      },
      onRestoreApplicationCredentials,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Restore app keys' }));

    const confirmation = screen.getByRole('alertdialog', { name: 'Restore app keys?' });
    expect(confirmation).toHaveTextContent('Your saved API ID and API Hash will be removed. XMSGi Studio will use its built-in keys.');
    expect(confirmation).not.toHaveTextContent('session');
    expect(onRestoreApplicationCredentials).not.toHaveBeenCalled();

    const actions = document.querySelector('.telegram-api-actions');
    expect(actions).toContainElement(within(actions as HTMLElement).getByRole('button', { name: 'Restore app keys' }));
    expect(actions).toContainElement(within(actions as HTMLElement).getByRole('button', { name: 'Save' }));

    fireEvent.click(within(confirmation).getByRole('button', { name: 'Restore app keys' }));
    await waitFor(() => expect(onRestoreApplicationCredentials).toHaveBeenCalledOnce());
  });

  it('shows credential errors as readable user-facing alerts', () => {
    renderSettings({
      openTelegramCredentials: true,
      telegramCredentialsError: 'API ID должен быть положительным числом длиной до 10 цифр.',
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'API ID должен быть положительным числом длиной до 10 цифр.',
    );
    expect(screen.queryByText(/Error invoking remote method|Invalid IPC input/)).not.toBeInTheDocument();
  });

  it('returns to login after the API credentials are saved from the credentials-only dialog', async () => {
    const onClose = vi.fn();
    const onSaveTelegramCredentials = vi.fn().mockResolvedValue(true);
    renderSettings({
      openTelegramCredentials: true,
      onClose,
      onSaveTelegramCredentials,
      telegramApiId: '12345',
      telegramApiHash: 'secret-hash',
    });

    await fireEvent.submit(screen.getByLabelText('API Hash').closest('form')!);

    expect(onSaveTelegramCredentials).toHaveBeenCalledOnce();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(screen.queryByRole('dialog', { name: 'Telegram API keys' })).not.toBeInTheDocument();
  });

  it('clears topbar focus when Escape closes Settings', () => {
    const onClose = vi.fn();
    const topbar = document.createElement('div');
    topbar.className = 'topbar';
    const topbarAction = document.createElement('button');
    topbarAction.className = 'settings-action';
    topbarAction.textContent = 'Settings';
    topbar.append(topbarAction);
    document.body.append(topbar);

    try {
      renderSettings({ onClose });
      topbarAction.focus();

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledOnce();
      expect(document.activeElement).not.toBe(topbarAction);
    } finally {
      topbar.remove();
    }
  });

  it('shows the Studio tagline and requested Settings version', () => {
    renderSettings();

    expect(screen.getByText('XMSGi Studio — Create and schedule Telegram posts in one workspace.')).toBeInTheDocument();
    expect(screen.getByText('Version 1.4.3')).toBeInTheDocument();
  });

  it('aligns the language selector to the right of its heading', () => {
    const { container } = renderSettings();
    const heading = within(container).getByRole('heading', { name: 'Language' });
    const switchGroup = within(container).getByRole('group', { name: 'Language' });

    expect(heading.parentElement).toHaveClass('settings-language-heading-row');
    expect(heading.parentElement).toContainElement(switchGroup);
  });

  it('shows the requested Russian Studio description in About', () => {
    const originalLocale = window.localStorage.getItem('awaitmsg_locale');
    window.localStorage.setItem('awaitmsg_locale', 'ru');

    try {
      renderSettings();
      expect(screen.getByText('XMSGi Studio — Создавайте и планируйте публикации в Telegram в одном рабочем пространстве.')).toBeInTheDocument();
    } finally {
      if (originalLocale === null) window.localStorage.removeItem('awaitmsg_locale');
      else window.localStorage.setItem('awaitmsg_locale', originalLocale);
    }
  });

  it('shows the saved Telegram API_ID without exposing the API hash', () => {
    const { container } = renderSettings({
      telegramCredentials: { hasCredentials: true, apiId: '17349', hasSession: true, connected: true, signedOut: false },
    });
    fireEvent.click(container.querySelector('.settings-telegram-summary')!);
    fireEvent.click(screen.getByText('Advanced API settings'));

    const credentialsStatuses = document.querySelector('.telegram-api-statuses');
    const instructions = document.querySelector('.telegram-api-instructions');
    expect(credentialsStatuses).toHaveTextContent('API_ID: 1734••••');
    expect(credentialsStatuses).not.toHaveTextContent('17349');
    expect(credentialsStatuses).not.toHaveTextContent('API_HASH');
    expect(credentialsStatuses).toHaveTextContent('Session: READY');
    expect(credentialsStatuses).toHaveTextContent('API keys: READY');
    expect(instructions?.nextElementSibling).toBe(credentialsStatuses);
    expect(credentialsStatuses?.querySelectorAll('span')).toHaveLength(3);
    expect(settingsStyles).toMatch(/\.telegram-api-statuses\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/);
  });

  it('labels the theme switch in English and Russian', () => {
    const originalLocale = window.localStorage.getItem('awaitmsg_locale');

    try {
      window.localStorage.setItem('awaitmsg_locale', 'en');
      const english = renderSettings();
      expect(within(english.container).getByText('App theme')).toBeInTheDocument();
      expect(within(english.container).getByText('Choose a light or dark theme for the entire app.')).toBeInTheDocument();
      expect(within(english.container).getByRole('group', { name: 'Color' })).toBeInTheDocument();
      expect(within(english.container).getByRole('button', { name: 'Light' })).toBeInTheDocument();
      expect(within(english.container).getByRole('button', { name: 'Dark' })).toBeInTheDocument();
      expect(within(english.container).queryByRole('button', { name: /graphite/i })).not.toBeInTheDocument();

      window.localStorage.setItem('awaitmsg_locale', 'ru');
      const russian = renderSettings();
      expect(within(russian.container).getByText('Тема приложения')).toBeInTheDocument();
      expect(within(russian.container).getByText('Выберите светлую или тёмную тему для всего приложения.')).toBeInTheDocument();
      expect(within(russian.container).getByRole('group', { name: 'Цвет' })).toBeInTheDocument();
      expect(within(russian.container).getByRole('button', { name: 'Светлая' })).toBeInTheDocument();
      expect(within(russian.container).getByRole('button', { name: 'Тёмная' })).toBeInTheDocument();
      expect(within(russian.container).queryByRole('button', { name: /графит/i })).not.toBeInTheDocument();
    } finally {
      if (originalLocale === null) window.localStorage.removeItem('awaitmsg_locale');
      else window.localStorage.setItem('awaitmsg_locale', originalLocale);
    }
  });

  it('keeps the appearance section free of framed previews and custom color controls', () => {
    const { container } = renderSettings();
    const appearance = screen.getByRole('region', { name: 'App theme' });

    expect(within(appearance).queryByRole('region', { name: 'Editor preview' })).not.toBeInTheDocument();
    expect(appearance).not.toHaveTextContent('Saved on this device');
    expect(container.querySelector('.settings-editor-mode-colors')).not.toBeInTheDocument();
    expect(container.querySelector('input[type="color"]')).not.toBeInTheDocument();
  });

  it('switches and persists the app color theme', () => {
    renderSettings();

    const themeGroup = screen.getByRole('group', { name: 'Color' });
    const darkButton = within(themeGroup).getByRole('button', { name: 'Dark' });
    const lightButton = within(themeGroup).getByRole('button', { name: 'Light' });

    fireEvent.click(darkButton);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(document.documentElement).toHaveClass('is-theme-transitioning');
    expect(localStorage.getItem(COLOR_THEME_STORAGE_KEY)).toBe('dark');
    expect(darkButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(lightButton);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.dataset.themeVariant).toBeUndefined();
    expect(localStorage.getItem(COLOR_THEME_STORAGE_KEY)).toBe('light');
    expect(lightButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('uses the shared text color timing throughout Settings', () => {
    const settingsTransitionRule = themeTransitionStyles.match(
      /html\.is-theme-transitioning,[\s\S]*?\{([^}]*)\}/,
    )?.[1] ?? '';

    expect(settingsTransitionRule).toMatch(/transition-duration:\s*320ms/);
    expect(settingsTransitionRule).toMatch(/transition-delay:\s*0ms,\s*0ms/);
    expect(settingsTransitionRule).toMatch(/transition-timing-function:\s*cubic-bezier\(0\.22, 0\.61, 0\.36, 1\)/);
    expect(themeTransitionStyles).not.toMatch(/::view-transition/);
  });

  it('uses glass only for the dark sign-out prompt and keeps connection settings opaque', () => {
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='dark'\] \.topbar-logout-modal-backdrop:not\(\.telegram-manager-backdrop\) \.topbar-logout-modal\s*\{[^}]*backdrop-filter:\s*blur\(16px\) saturate\(135%\);/,
    );
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='dark'\] \.telegram-manager-dialog\.topbar-logout-modal\s*\{[^}]*border-color:\s*rgba\(215, 230, 240, 0\.32\);[^}]*box-shadow:\s*var\(--shadow-soft\), inset 0 1px 0 rgba\(230, 240, 246, 0\.06\);/,
    );
    expect(colorThemeStyles).not.toMatch(
      /html\[data-theme='dark'\] \.telegram-manager-dialog\.topbar-logout-modal\s*\{[^}]*backdrop-filter:/,
    );
  });

  it('styles the dark Telegram summary as glass and keeps its text on one line', () => {
    expect(colorThemeStyles).toMatch(
      /html\[data-theme='dark'\] \.settings-telegram-summary\s*\{[\s\S]*?backdrop-filter:\s*blur\(16px\) saturate\(135%\);/,
    );
    expect(settingsStyles).toMatch(
      /\.settings-telegram-summary-main\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;/,
    );
    expect(settingsStyles).toMatch(
      /\.settings-telegram-summary-account\s*\{[^}]*order:\s*1;/,
    );
    expect(settingsStyles).toMatch(
      /\.settings-telegram-summary-main > \.settings-telegram-status-dot\s*\{[^}]*order:\s*2;/,
    );
    expect(settingsStyles).toMatch(
      /\.settings-telegram-summary-state\s*\{[^}]*order:\s*4;[^}]*flex:\s*0 0 auto;[^}]*margin-left:\s*auto;[^}]*white-space:\s*nowrap;/,
    );
    expect(settingsStyles).toMatch(
      /\.settings-telegram-summary-account\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/,
    );
  });

  it('supports an isolated theme storage key for the settings testbench', () => {
    const testbenchThemeStorageKey = 'settings-testbench-theme';
    renderSettings({ colorThemeStorageKey: testbenchThemeStorageKey });

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));

    expect(localStorage.getItem(testbenchThemeStorageKey)).toBe('dark');
    expect(localStorage.getItem(COLOR_THEME_STORAGE_KEY)).toBeNull();
  });

  it('ignores previously saved custom colors and keeps theme choices unframed', () => {
    localStorage.setItem(EDITOR_APPEARANCE_STORAGE_KEY, JSON.stringify({
      style: 'outline',
      palette: 'custom',
      modeColors: { send: '#287fa6', schedule: '#b482f5', draft: '#f58b37' },
    }));
    renderSettings();
    const appearance = screen.getByRole('region', { name: 'App theme' });

    expect(within(appearance).queryByRole('region', { name: 'Editor preview' })).not.toBeInTheDocument();
    expect(within(appearance).getByRole('group', { name: 'Color' })).toBeInTheDocument();
    expect(within(appearance).queryByRole('group', { name: 'Editor appearance style' })).not.toBeInTheDocument();
    expect(appearance.querySelector('.settings-editor-mode-colors')).not.toBeInTheDocument();
    expect(appearance.querySelectorAll('input[type="color"]')).toHaveLength(0);
  });

  it('keeps API fields out of the main settings screen', () => {
    const { container } = renderSettings();

    expect(within(container).getByRole('heading', { name: 'Telegram' })).toBeInTheDocument();
    expect(settingsStyles).toMatch(/\.settings-telegram-section\s*\{\s*padding-bottom:\s*64px;/);
    expect(settingsStyles).toMatch(/\.settings-telegram-entry\s*\{[^}]*width:\s*calc\(100% \+ 34px\);[^}]*margin-left:\s*-17px;/);
    const summary = screen.getByRole('button', { name: /alex_example/ });
    const statusDot = summary.querySelector('.settings-telegram-status-dot');
    const summaryMain = summary.querySelector('.settings-telegram-summary-main');
    expect(summaryMain?.firstElementChild).toHaveTextContent('@alex_example');
    expect(summaryMain?.children[1]).toBe(statusDot);
    expect(statusDot).toHaveClass('is-connected');
    expect(summary).not.toHaveTextContent('Telegram');
    expect(summary).toHaveTextContent('Manage');
    expect(summary).not.toHaveTextContent('Connected');
    expect(summary.querySelector('.settings-telegram-mark')).not.toBeInTheDocument();
    expect(container.querySelector('.settings-telegram-mark')).not.toBeInTheDocument();
    expect(container.querySelector('.telegram-credentials-form')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('API_ID')).not.toBeInTheDocument();
  });

  it('shows a non-green status dot and not-connected label when Telegram is disconnected', () => {
    const { container } = renderSettings({
      telegramConnected: false,
      telegramCredentials: { hasCredentials: true, hasSession: true, connected: false, signedOut: false },
    });
    const summary = container.querySelector('.settings-telegram-summary')!;
    const statusDot = summary.querySelector('.settings-telegram-status-dot');
    const summaryMain = summary.querySelector('.settings-telegram-summary-main');

    expect(summaryMain?.firstElementChild).toHaveTextContent('Not connected');
    expect(summaryMain?.children[1]).toBe(statusDot);
    expect(statusDot).not.toHaveClass('is-connected');
    expect(summary).toHaveTextContent('Not connected');
  });

  it('does not open Telegram setup automatically for an empty profile', () => {
    renderSettings({
      telegramConnected: false,
      telegramCredentials: { hasCredentials: false, hasSession: false, connected: false, signedOut: false },
    });

    expect(screen.queryByRole('dialog', { name: 'Manage connection' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('API_ID')).not.toBeInTheDocument();
  });

  it('opens connection controls and reveals API fields only on demand', () => {
    const { onTelegramDisconnect } = renderSettings();

    const summary = screen.getByRole('button', { name: /alex_example/ });
    expect(summary).not.toHaveTextContent('Connected');

    fireEvent.click(summary);

    const dialog = screen.getByRole('dialog', { name: 'Manage connection' });
    expect(within(dialog).getByText('Connected')).toBeInTheDocument();
    const dialogStatus = dialog.querySelector('.telegram-manager-status')!;
    const statusLabel = dialogStatus.querySelector('.telegram-manager-status-label')!;
    const dialogStatusDot = statusLabel.querySelector('.settings-telegram-status-dot');
    expect(statusLabel).toContainElement(dialogStatusDot as HTMLElement);
    expect(statusLabel).toContainElement(within(dialog).getByText('Connected'));
    expect(dialogStatusDot).toHaveClass('is-connected');
    expect(settingsStyles).toMatch(/\.telegram-manager-status-label\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*gap:\s*8px;/);
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(Array.from(dialog.querySelectorAll('.telegram-manager-actions > button')).map((button) => button.textContent?.trim()))
      .toEqual(['Disconnect account', 'Cancel']);
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect account' }));
    expect(onTelegramDisconnect).toHaveBeenCalledOnce();

    const advancedSettings = document.querySelector('.telegram-manager-advanced') as HTMLDetailsElement;
    const technicalDetails = document.querySelector('.telegram-api-statuses');
    expect(advancedSettings.open).toBe(false);
    expect(technicalDetails).not.toBeVisible();
    fireEvent.click(screen.getByText('Advanced API settings'));
    expect(advancedSettings.open).toBe(true);
    expect(technicalDetails).toBeVisible();
    expect(screen.getByLabelText('API ID')).toBeInTheDocument();
    expect(screen.getByLabelText('API Hash')).toBeInTheDocument();
  });

  it('opens the API credential form for a saved session missing credentials', async () => {
    renderSettings({
      telegramConnected: false,
      telegramCredentials: { hasCredentials: false, hasSession: true, connected: false, signedOut: true },
    });

    const dialog = await screen.findByRole('dialog', { name: 'Manage connection' });
    expect(dialog.querySelector('.telegram-manager-advanced')).toHaveAttribute('open');
    expect(screen.getByLabelText('API ID')).toBeInTheDocument();
    expect(screen.getByLabelText('API Hash')).toBeInTheDocument();
  });

  it('opens phone sign-in controls for a remembered account with no session', async () => {
    renderSettings({
      telegramConnected: false,
      telegramCredentials: { hasCredentials: true, hasSession: false, connected: false, signedOut: true },
    });

    const dialog = await screen.findByRole('dialog', { name: 'Manage connection' });
    expect(dialog).toHaveTextContent('Signed out');
    expect(within(dialog).getByLabelText('Phone')).toBeInTheDocument();
  });

  it('shows the two-factor prompt as an informational status in Telegram settings', async () => {
    const message = 'Code accepted. Your Telegram account has two-step verification enabled. Enter your password to continue.';
    renderSettings({
      telegramConnected: false,
      telegramAuthStep: 'password',
      telegramAuthError: message,
      telegramAuthNotice: true,
      telegramCredentials: { hasCredentials: true, hasSession: false, connected: false, signedOut: true },
    });

    const dialog = await screen.findByRole('dialog', { name: 'Manage connection' });
    const notice = within(dialog).getByText(message);

    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveClass('settings-view-notice');
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers reconnect for an existing Telegram session when disconnected', () => {
    const { onTelegramReconnect } = renderSettings({
      telegramConnected: false,
      telegramCredentials: { hasCredentials: true, hasSession: true, connected: false, signedOut: false },
    });

    fireEvent.click(screen.getByRole('button', { name: /Not connected/ }));
    expect(screen.queryByText('Ready')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));

    expect(onTelegramReconnect).toHaveBeenCalledOnce();
  });
});