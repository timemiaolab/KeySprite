import { KeySpriteConfig, LanguageCode, TargetOS } from '../types/keysprite';

interface TauriInternals {
  invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals;
  }
}

export function isTauriDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && typeof window.__TAURI_INTERNALS__?.invoke === 'function';
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!window.__TAURI_INTERNALS__?.invoke) {
    throw new Error('Not running inside Tauri runtime');
  }
  return window.__TAURI_INTERNALS__.invoke<T>(cmd, args);
}

export interface RustAppConfigPayload {
  language: LanguageCode;
  copyPathShortcut: string;
  openTerminalShortcut: string;
  macTerminal: 'terminal' | 'iterm2' | 'warp';
  winTerminal: 'windows_terminal' | 'power_shell' | 'cmd';
  linuxTerminal: 'auto' | 'gnome_terminal' | 'konsole' | 'alacritty' | 'kitty';
  autostart: boolean;
  showNotifications: boolean;
  passthroughStrategy: 'ignore_non_file_manager' | 'simulate_key_passthrough';
}

export async function fetchDesktopConfig(): Promise<KeySpriteConfig | null> {
  if (!isTauriDesktopRuntime()) return null;
  const [os, rustCfg] = await Promise.all([
    tauriInvoke<TargetOS>('get_platform_os'),
    tauriInvoke<RustAppConfigPayload>('get_config'),
  ]);
  return {
    targetOS: os,
    ...rustCfg,
    language: rustCfg.language || 'zh-CN',
  };
}

export async function saveDesktopConfig(config: KeySpriteConfig): Promise<KeySpriteConfig | null> {
  if (!isTauriDesktopRuntime()) return null;
  const payload: RustAppConfigPayload = {
    language: config.language,
    copyPathShortcut: config.copyPathShortcut,
    openTerminalShortcut: config.openTerminalShortcut,
    macTerminal: config.macTerminal,
    winTerminal: config.winTerminal,
    linuxTerminal: config.linuxTerminal,
    autostart: config.autostart,
    showNotifications: config.showNotifications,
    passthroughStrategy: config.passthroughStrategy,
  };
  const saved = await tauriInvoke<RustAppConfigPayload>('save_and_reload_config', {
    newConfig: payload,
  });
  return {
    targetOS: config.targetOS,
    ...saved,
  };
}

export async function resetDesktopConfig(targetOS: TargetOS): Promise<KeySpriteConfig | null> {
  if (!isTauriDesktopRuntime()) return null;
  const saved = await tauriInvoke<RustAppConfigPayload>('reset_default_config');
  return {
    targetOS,
    ...saved,
  };
}

export async function hideWindowToTray(): Promise<void> {
  if (!isTauriDesktopRuntime()) return;
  await tauriInvoke<void>('hide_to_tray');
}

export async function checkMacAccessibility(): Promise<boolean> {
  if (!isTauriDesktopRuntime()) return false;
  return tauriInvoke<boolean>('check_permissions');
}

export async function openMacAccessibilitySettings(): Promise<void> {
  if (!isTauriDesktopRuntime()) return;
  await tauriInvoke<void>('request_accessibility_settings');
}
