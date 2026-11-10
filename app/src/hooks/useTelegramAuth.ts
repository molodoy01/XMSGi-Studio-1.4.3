import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Chat } from '@/types';
import { useLocale, type TranslationKey } from '@/lib/i18n';
import { useTelegramStatusLifecycle } from './useTelegramStatusLifecycle';
import { useTelegramAuthActions } from './useTelegramAuthActions';
export type { TelegramStatusSnapshot } from './useTelegramStatusLifecycle';
import {
  hasTelegramBridge,
  telegramConnect,
  telegramGetAuthState,
} from '../services/telegramAppService';

export type TelegramAuthOptions = {
  setIsSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setChats: Dispatch<SetStateAction<Chat[]>>;
  setSelectedChat: Dispatch<SetStateAction<Chat | null>>;
};

function isConfirmedAuthFailure(error: string) {
  return /auth required|reauth_required|session expired|authorization revoked|not authorized/i.test(error);
}

export function useTelegramAuth({
  setIsSettingsOpen,
  setChats,
  setSelectedChat,
}: TelegramAuthOptions) {
  const { t } = useLocale();
  const [connected, setConnected] = useState(false);
  const [sessionAvailable, setSessionAvailable] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const signedOutRef = useRef(false);
  const connectionEventVersionRef = useRef(0);
  const [returningUserName, setReturningUserName] = useState('');
  const [returningUserUsername, setReturningUserUsername] = useState('');
  const [connecting, setConnecting] = useState(true);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [connectionResolved, setConnectionResolved] = useState(false);
  const [authStep, setAuthStep] = useState<'phone' | 'code' | 'password'>('phone');
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [twoFactorPassword, setTwoFactorPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthErrorValue] = useState('');
  const [authErrorTranslationKey, setAuthErrorTranslationKey] = useState<TranslationKey | null>(null);
  const setAuthError = useCallback<Dispatch<SetStateAction<string>>>((value) => {
    setAuthErrorTranslationKey(null);
    setAuthErrorValue(value);
  }, []);
  const setLocalizedAuthError = useCallback((key: TranslationKey) => {
    setAuthErrorTranslationKey(key);
    setAuthErrorValue(t(key));
  }, [t]);
  const visibleAuthError = authErrorTranslationKey ? t(authErrorTranslationKey) : authError;
  const authNotice = authErrorTranslationKey === 'auth.enterTwoFactor'
    || authErrorTranslationKey === 'auth.codeResent';
  const [isConfirmingLogout, setIsConfirmingLogout] = useState(false);
  const { telegramStatus } = useTelegramStatusLifecycle({
    signedOutRef,
    connectionEventVersionRef,
    setConnected,
    setSessionAvailable,
    setConnecting,
    setConnectionResolved,
    setAuthError,
  });

  const {
    handleTelegramAuth,
    handleDisconnect,
    handleWelcomeBack,
    handleForgetAccount,
  } = useTelegramAuthActions({
    authBusy,
    authStep,
    phoneNumber,
    phoneCode,
    twoFactorPassword,
    returningUserName,
    returningUserUsername,
    signedOutRef,
    setAuthBusy,
    setAuthStep,
    setPhoneCode,
    setTwoFactorPassword,
    setAuthError,
    setLocalizedAuthError,
    setConnecting,
    setConnected,
    setSessionAvailable,
    setSessionResolved,
    setSignedOut,
    setShowAuthForm,
    setReturningUserName,
    setReturningUserUsername,
    setConnectionResolved,
    setIsConfirmingLogout,
    setIsSettingsOpen,
    setChats,
    setSelectedChat,
  });

  useEffect(() => {
    const loadAuth = async () => {
      if (!hasTelegramBridge()) {
        setConnecting(false);
        setConnected(false);
        setSessionResolved(true);
        setConnectionResolved(true);
        return;
      }

      const connectionEventVersion = connectionEventVersionRef.current;
      telegramGetAuthState()
        .then((authResult) => {
          if (!authResult.success || !authResult.authState) {
            throw new Error(authResult.error || t('auth.readStateFailed'));
          }

          const authState = authResult.authState;
          const hasSession = authState.hasSession;

          setSessionResolved(true);
          signedOutRef.current = hasSession && authState.signedOut;
          setSignedOut(signedOutRef.current);
          setSessionAvailable(hasSession && !authState.signedOut);
          if (connectionEventVersion === connectionEventVersionRef.current) {
            setConnected(authState.connected);
          }
          setReturningUserName(authState.userName || '');
          setReturningUserUsername(authState.username || '');

          if (!hasSession || authState.signedOut || authState.connected) {
            setConnecting(false);
            setConnectionResolved(true);
          }
        })
        .catch(() => {
          setConnecting(false);
          setConnected(false);
          setSessionResolved(true);
          setConnectionResolved(true);
          setLocalizedAuthError('auth.readStateFailed');
        });
    };

    loadAuth();
  }, [setAuthError, setLocalizedAuthError, t]);

  useEffect(() => {
    if (!sessionResolved || !sessionAvailable || signedOut || connected) return undefined;

    let active = true;
    const connectionEventVersion = connectionEventVersionRef.current;
    telegramConnect()
      .then((result) => {
        if (!active) return;
        if (connectionEventVersion !== connectionEventVersionRef.current) return;
        setConnecting(false);
        setConnected(result.success);
        setConnectionResolved(true);

        if (!result.success && isConfirmedAuthFailure(result.error || '')) {
          setSessionAvailable(false);
          setAuthError(result.error || t('auth.sessionExpired'));
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (connectionEventVersion !== connectionEventVersionRef.current) return;
        const message = error instanceof Error ? error.message : '';
        setConnecting(false);
        setConnected(false);
        setConnectionResolved(true);
        if (isConfirmedAuthFailure(message)) {
          setSessionAvailable(false);
          setAuthError(message || t('auth.sessionExpired'));
        }
      });

    return () => {
      active = false;
    };
  }, [connected, sessionAvailable, sessionResolved, setAuthError, signedOut, t]);

  return {
    connected,
    setConnected,
    sessionAvailable,
    setSessionAvailable,
    sessionResolved,
    signedOut,
    setSignedOut,
    returningUserName,
    setReturningUserName,
    returningUserUsername,
    connecting,
    setConnecting,
    connectionResolved,
    setConnectionResolved,
    authStep,
    setAuthStep,
    showAuthForm,
    setShowAuthForm,
    phoneNumber,
    setPhoneNumber,
    phoneCode,
    setPhoneCode,
    twoFactorPassword,
    setTwoFactorPassword,
    authBusy,
    setAuthBusy,
    authError: visibleAuthError,
    authNotice,
    telegramStatus,
    setAuthError,
    isConfirmingLogout,
    setIsConfirmingLogout,
    handleTelegramAuth,
    handleDisconnect,
    handleWelcomeBack,
    handleForgetAccount,
  };
}
