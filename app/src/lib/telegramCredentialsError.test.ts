import { describe, expect, it } from 'vitest';
import { getTelegramCredentialsErrorKey } from './telegramCredentialsError';

describe('getTelegramCredentialsErrorKey', () => {
  it.each([
    ['Invalid IPC input: API_ID has an invalid format', 'settings.apiIdInvalid'],
    ['Invalid IPC input: API_HASH is required', 'settings.apiHashRequired'],
    ['Invalid IPC input: API_HASH is too long', 'settings.apiHashTooLong'],
    ['Invalid IPC input: API_HASH contains an invalid character', 'settings.apiHashInvalid'],
    ['desktopBridgeRequired', 'settings.telegramCredentialsDesktopRequired'],
    ['Telegram API credentials could not be saved securely.', 'settings.telegramCredentialsSaveFailed'],
    [new Error('unexpected IPC failure'), 'settings.telegramCredentialsSaveFailed'],
  ] as const)('maps %s to a user-facing message key', (error, expectedKey) => {
    expect(getTelegramCredentialsErrorKey(error)).toBe(expectedKey);
  });
});
