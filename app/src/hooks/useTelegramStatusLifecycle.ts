import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useLocale } from '@/lib/i18n';
import {
  hasTelegramBridge,
  telegramGetRateLimitState,
  telegramGetStatus,
  telegramOnStatus,
} from '../services/telegramAppService';

export type TelegramStatusSnapshot = {
  accountId: string;
  status: 'normal' | 'rate-limited' | 'slowmode' | 'auth required' | 'network/retrying' | 'error';
  category?: 'flood' | 'slowmode' | 'auth' | 'permission' | 'network' | 'unknown' | null;
  error?: string;
  waitSecondsText?: string;
};

function sameTelegramStatus(left: TelegramStatusSnapshot, right: TelegramStatusSnapshot) {
  return left.accountId === right.accountId
    && left.status === right.status
    && (left.category ?? null) === (right.category ?? null)
    && left.error === right.error
    && left.waitSecondsText === right.waitSecondsText;
}

type TelegramStatusApiResult = {
  success: boolean;
  accountId?: string;
  connected?: boolean;
  status?: TelegramStatusSnapshot['status'];
  category?: TelegramStatusSnapshot['category'];
  error?: string;
};

type TelegramRateLimitApiResult = {
  success: boolean;
  current?: TelegramStatusSnapshot & {
    paused: boolean;
    pausedUntil: number | null;
    remainingMs: number;
    waitSecondsText?: string;
  };
};

type Props = {
  signedOutRef: MutableRefObject<boolean>;
  connectionEventVersionRef: MutableRefObject<number>;
  setConnected: Dispatch<SetStateAction<boolean>>;
  setSessionAvailable: Dispatch<SetStateAction<boolean>>;
  setConnecting: Dispatch<SetStateAction<boolean>>;
  setConnectionResolved: Dispatch<SetStateAction<boolean>>;
  setAuthError: Dispatch<SetStateAction<string>>;
};

export function useTelegramStatusLifecycle({
  signedOutRef,
  connectionEventVersionRef,
  setConnected,
  setSessionAvailable,
  setConnecting,
  setConnectionResolved,
  setAuthError,
}: Props) {
  const { t } = useLocale();
  const [telegramStatus, setTelegramStatus] = useState<TelegramStatusSnapshot>({
    accountId: '',
    status: 'normal',
  });

  const refreshTelegramStatus = useCallback(async () => {
    if (!hasTelegramBridge()) {
      setTelegramStatus({ accountId: '', status: 'normal' });
      return;
    }

    try {
      const connectionEventVersion = connectionEventVersionRef.current;
      const [statusResult, rateLimitResult] = await Promise.all([
        telegramGetStatus() as Promise<TelegramStatusApiResult>,
        telegramGetRateLimitState() as Promise<TelegramRateLimitApiResult>,
      ]);
      const current = rateLimitResult.current;
      const status = current?.status || statusResult.status || 'normal';

      const nextStatus: TelegramStatusSnapshot = {
        accountId: current?.accountId || statusResult.accountId || '',
        status,
        category: current?.category ?? statusResult.category ?? null,
        error: current?.error || statusResult.error,
        waitSecondsText: current?.waitSecondsText,
      };
      setTelegramStatus((previous) => sameTelegramStatus(previous, nextStatus) ? previous : nextStatus);

      if (
        statusResult.connected === true
        && connectionEventVersion === connectionEventVersionRef.current
        && !signedOutRef.current
      ) {
        connectionEventVersionRef.current += 1;
        setConnected(true);
        setSessionAvailable(true);
        setConnecting(false);
        setConnectionResolved(true);
      }
    } catch {
      // Status polling is advisory and must not interrupt auth or scheduling.
    }
  }, [connectionEventVersionRef, setConnected, setConnecting, setConnectionResolved, setSessionAvailable, signedOutRef]);

  useEffect(() => {
    if (!hasTelegramBridge()) return;

    const handleStatus = (status: unknown) => {
      if (typeof status === 'object' && status !== null) {
        const value = status as {
          connected?: boolean;
          accountId?: string;
          status?: string;
          category?: TelegramStatusSnapshot['category'];
          error?: string;
          waitSecondsText?: string;
        };

        if (
          typeof value.connected === 'boolean'
          || value.status === 'connected'
          || value.status === 'disconnected'
          || value.status === 'offline'
          || value.status === 'network/retrying'
          || value.status === 'reconnecting'
          || value.status === 'reauth_required'
          || value.status === 'auth required'
          || (value.status === 'error' && !value.category)
        ) {
          connectionEventVersionRef.current += 1;
        }

        const statusMap: Record<string, TelegramStatusSnapshot['status']> = {
          connected: 'normal',
          'rate-limited': 'rate-limited',
          slowmode: 'slowmode',
          'auth required': 'auth required',
          'network/retrying': 'network/retrying',
          error: 'error',
          reauth_required: 'auth required',
          reconnecting: 'network/retrying',
        };

        const mappedStatus = value.status
          ? statusMap[value.status as keyof typeof statusMap]
          : undefined;

        if (mappedStatus) {
          setTelegramStatus((current) => {
            const nextStatus: TelegramStatusSnapshot = {
              ...current,
              accountId: value.accountId || current.accountId,
              status: mappedStatus,
              category: value.category ?? current.category,
              error: value.error,
              waitSecondsText: value.waitSecondsText,
            };
            return sameTelegramStatus(current, nextStatus) ? current : nextStatus;
          });
        }

        if (typeof value.connected === 'boolean' && (!value.connected || !signedOutRef.current)) {
          setConnected(value.connected);
          setConnecting(false);
          setConnectionResolved(true);
        }

        if (value.status === 'connected' && !signedOutRef.current) {
          setConnected(true);
          setSessionAvailable(true);
          setConnecting(false);
          setConnectionResolved(true);
        }

        if (value.status === 'network/retrying' || value.status === 'reconnecting') {
          setConnected(false);
          setConnecting(false);
          setConnectionResolved(true);
        }

        if (value.status === 'reauth_required') {
          setConnected(false);
          setSessionAvailable(false);
          setConnecting(false);
          setConnectionResolved(true);
          if (!signedOutRef.current) {
            setAuthError(value.error || t('auth.sessionExpired'));
          }
        }

        if (value.status === 'auth required') {
          setConnected(false);
          setSessionAvailable(false);
          setConnecting(false);
          setConnectionResolved(true);
          setAuthError(value.error || t('telegramStatus.authRequiredMessage'));
        }

        if (value.status === 'disconnected' || value.status === 'offline') {
          setConnected(false);
          setConnecting(false);
          setConnectionResolved(true);
        }

        if (value.status === 'error' && !value.category) {
          setConnected(false);
          setConnecting(false);
          setConnectionResolved(true);
        }
      }

      if (typeof status === 'string') {
        if (
          status === 'connected'
          || status === 'disconnected'
          || status === 'offline'
          || status === 'network/retrying'
          || status === 'reconnecting'
          || status === 'error'
        ) {
          connectionEventVersionRef.current += 1;
        }

        if (status === 'connected' && !signedOutRef.current) {
          setConnected(true);
          setSessionAvailable(true);
          setConnecting(false);
          setConnectionResolved(true);
        }

        if (
          status === 'disconnected' ||
          status === 'offline' ||
          status === 'network/retrying' ||
          status === 'reconnecting' ||
          status === 'error'
        ) {
          setConnected(false);
          setConnecting(false);
          setConnectionResolved(true);
        }
      }
    };

    return telegramOnStatus(handleStatus);
  }, [connectionEventVersionRef, setAuthError, setConnected, setConnecting, setConnectionResolved, setSessionAvailable, signedOutRef, t]);

  useEffect(() => {
    if (!hasTelegramBridge()) {
      setTelegramStatus({ accountId: '', status: 'normal' });
      return;
    }

    void refreshTelegramStatus();
    const intervalId = window.setInterval(() => {
      void refreshTelegramStatus();
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [refreshTelegramStatus]);

  return { telegramStatus };
}
