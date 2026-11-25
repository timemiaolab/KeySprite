import { TargetOS } from '../types/keysprite';
import { TranslationStrings } from '../i18n/translations';

export type AccessibilityState = 'granted' | 'denied' | 'unknown';

export type ShortcutErrorCode =
  | 'invalid_format'
  | 'register_failed'
  | 'unregister_failed'
  | string;

export interface ShortcutErrorPayload {
  code: ShortcutErrorCode;
  action?: string;
  shortcut?: string;
  message: string;
}

export interface ShortcutBindStatus {
  registered: boolean;
  shortcut: string;
  error?: ShortcutErrorPayload;
}

export interface ShortcutRegistrationStatus {
  copyPath: ShortcutBindStatus;
  openTerminal: ShortcutBindStatus;
}

export type ShortcutStatusInput = {
  isNativeDesktop: boolean;
  targetOS: TargetOS;
  loading: boolean;
  copyPathRegistered: boolean;
  openTerminalRegistered: boolean;
  lastError: ShortcutErrorPayload | null;
  accessibility: AccessibilityState;
};

export type ActivationKey = 'activationMac' | 'activationWin' | 'activationLinux';

export type ShortcutStatusView = {
  banner: 'preview' | 'loading' | 'registered' | 'failed';
  activation: ActivationKey;
  showAccessibilityHint: boolean;
};

export function activationKeyForOS(os: TargetOS): ActivationKey {
  if (os === 'macos') return 'activationMac';
  if (os === 'windows') return 'activationWin';
  return 'activationLinux';
}

export function resolveShortcutStatusView(input: ShortcutStatusInput): ShortcutStatusView {
  const activation = activationKeyForOS(input.targetOS);

  if (!input.isNativeDesktop) {
    return { banner: 'preview', activation, showAccessibilityHint: false };
  }

  if (input.loading) {
    return { banner: 'loading', activation, showAccessibilityHint: false };
  }

  const allRegistered = input.copyPathRegistered && input.openTerminalRegistered;
  const failed = !allRegistered || input.lastError !== null;
  const showAccessibilityHint =
    failed && input.targetOS === 'macos' && input.accessibility === 'denied';

  return {
    banner: failed ? 'failed' : 'registered',
    activation,
    showAccessibilityHint,
  };
}

export function formatShortcutError(
  t: TranslationStrings,
  error: ShortcutErrorPayload | null
): string | null {
  if (!error) return null;
  const prefix =
    error.code === 'invalid_format'
      ? t.errorInvalidFormat
      : error.code === 'unregister_failed'
        ? t.errorUnregisterFailed
        : t.errorRegisterFailed;
  const detail = (error.message ?? '').trim();
  return detail ? `${prefix}: ${detail}` : prefix;
}

export function parseShortcutError(err: unknown): ShortcutErrorPayload | null {
  const raw = extractErrorText(err);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ShortcutErrorPayload>;
    if (parsed && typeof parsed === 'object' && typeof parsed.code === 'string') {
      return {
        code: parsed.code,
        action: typeof parsed.action === 'string' ? parsed.action : undefined,
        shortcut: typeof parsed.shortcut === 'string' ? parsed.shortcut : undefined,
        message: typeof parsed.message === 'string' ? parsed.message : raw,
      };
    }
  } catch {
    // Not JSON — treat the original backend/runtime text as the detail.
  }
  return { code: 'register_failed', message: raw };
}

function extractErrorText(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    if (typeof record.error === 'string') return record.error;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err ?? '');
}
