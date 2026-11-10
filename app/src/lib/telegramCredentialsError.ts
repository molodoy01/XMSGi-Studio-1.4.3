export type TelegramCredentialsErrorKey =
  | 'settings.apiIdInvalid'
  | 'settings.apiHashRequired'
  | 'settings.apiHashTooLong'
  | 'settings.apiHashInvalid'
  | 'settings.telegramCredentialsDesktopRequired'
  | 'settings.telegramCredentialsSaveFailed'
  | 'settings.restoreAppKeysFailed';

export function getTelegramCredentialsErrorKey(error: unknown): TelegramCredentialsErrorKey {
  const message = error instanceof Error ? error.message : String(error ?? '');

  if (/desktopBridgeRequired/i.test(message)) {
    return 'settings.telegramCredentialsDesktopRequired';
  }
  if (/restore/i.test(message)) {
    return 'settings.restoreAppKeysFailed';
  }
  if (/API_ID/i.test(message)) {
    return 'settings.apiIdInvalid';
  }
  if (/API_HASH/i.test(message)) {
    if (/required/i.test(message)) return 'settings.apiHashRequired';
    if (/too long/i.test(message)) return 'settings.apiHashTooLong';
    return 'settings.apiHashInvalid';
  }
  return 'settings.telegramCredentialsSaveFailed';
}
