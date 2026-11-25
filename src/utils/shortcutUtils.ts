import { KeySpriteConfig, TargetOS } from '../types/keysprite';

export const DEFAULT_CONFIG_MACOS: KeySpriteConfig = {
  language: 'zh-CN',
  targetOS: 'macos',
  copyPathShortcut: 'Super+9',
  openTerminalShortcut: 'Super+0',
  macTerminal: 'terminal',
  winTerminal: 'windows_terminal',
  linuxTerminal: 'auto',
  autostart: false,
  showNotifications: true,
  passthroughStrategy: 'ignore_non_file_manager',
};

export const DEFAULT_CONFIG_WINDOWS: KeySpriteConfig = {
  language: 'zh-CN',
  targetOS: 'windows',
  copyPathShortcut: 'Alt+9',
  openTerminalShortcut: 'Alt+0',
  macTerminal: 'terminal',
  winTerminal: 'windows_terminal',
  linuxTerminal: 'auto',
  autostart: false,
  showNotifications: true,
  passthroughStrategy: 'ignore_non_file_manager',
};

export const DEFAULT_CONFIG_LINUX: KeySpriteConfig = {
  language: 'zh-CN',
  targetOS: 'linux',
  copyPathShortcut: 'Alt+9',
  openTerminalShortcut: 'Alt+0',
  macTerminal: 'terminal',
  winTerminal: 'windows_terminal',
  linuxTerminal: 'auto',
  autostart: false,
  showNotifications: true,
  passthroughStrategy: 'ignore_non_file_manager',
};

export function getDefaultConfigForOS(os: TargetOS): KeySpriteConfig {
  if (os === 'macos') return DEFAULT_CONFIG_MACOS;
  if (os === 'windows') return DEFAULT_CONFIG_WINDOWS;
  return DEFAULT_CONFIG_LINUX;
}

export function getDefaultShortcutsForOS(os: TargetOS): {
  copyPathShortcut: string;
  openTerminalShortcut: string;
} {
  if (os === 'macos') {
    return {
      copyPathShortcut: 'Super+9',
      openTerminalShortcut: 'Super+0',
    };
  }
  return {
    copyPathShortcut: 'Alt+9',
    openTerminalShortcut: 'Alt+0',
  };
}

const MODIFIER_KEYS = new Set([
  'Meta',
  'Control',
  'Alt',
  'Shift',
  'OS',
  'Super',
  'AltGraph',
]);

export function normalizeKeyToken(event: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(event.key)) {
    return null;
  }

  if (event.code.startsWith('Digit')) {
    return event.code.replace('Digit', '');
  }
  if (event.code.startsWith('Key')) {
    return event.code.replace('Key', '');
  }
  if (/^F\d{1,2}$/.test(event.code)) {
    return event.code;
  }

  const keyMap: Record<string, string> = {
    Space: 'Space',
    ' ': 'Space',
    Enter: 'Enter',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Slash: '/',
    Backslash: '\\',
    Period: '.',
    Comma: ',',
    Semicolon: ';',
    Minus: '-',
    Equal: '=',
  };

  if (keyMap[event.code]) {
    return keyMap[event.code];
  }
  if (event.key.length === 1) {
    return event.key.toUpperCase();
  }
  return null;
}

export function buildShortcutFromKeyboardEvent(
  event: KeyboardEvent,
  needModifierError = '至少需要包含一个修饰键（Cmd / Ctrl / Alt / Shift）'
): {
  shortcut: string | null;
  error: string | null;
} {
  const key = normalizeKeyToken(event);
  if (!key) {
    return { shortcut: null, error: null };
  }

  const mods: string[] = [];
  if (event.metaKey) mods.push('Super');
  if (event.ctrlKey) mods.push('Control');
  if (event.altKey) mods.push('Alt');
  if (event.shiftKey) mods.push('Shift');

  if (mods.length === 0) {
    return {
      shortcut: null,
      error: needModifierError,
    };
  }

  return {
    shortcut: [...mods, key].join('+'),
    error: null,
  };
}

export function matchesShortcut(event: KeyboardEvent, shortcutStr: string): boolean {
  const parts = shortcutStr.split('+').filter(Boolean);
  if (parts.length < 2) return false;

  const targetKey = parts[parts.length - 1].toUpperCase();
  const mods = new Set(parts.slice(0, -1).map((m) => m.toLowerCase()));

  const needSuper = mods.has('super') || mods.has('cmd') || mods.has('command');
  const needCtrl = mods.has('control') || mods.has('ctrl');
  const needAlt = mods.has('alt') || mods.has('option');
  const needShift = mods.has('shift');

  if (
    event.metaKey !== needSuper ||
    event.ctrlKey !== needCtrl ||
    event.altKey !== needAlt ||
    event.shiftKey !== needShift
  ) {
    return false;
  }

  const pressed = normalizeKeyToken(event);
  return pressed !== null && pressed.toUpperCase() === targetKey;
}

export function formatShortcutTokens(shortcut: string, os: TargetOS): string[] {
  const parts = shortcut.split('+').filter(Boolean);
  return parts.map((part) => {
    const lower = part.toLowerCase();
    if (lower === 'super' || lower === 'command' || lower === 'cmd') {
      return os === 'macos' ? '⌘' : os === 'windows' ? 'Win' : 'Super';
    }
    if (lower === 'control' || lower === 'ctrl') {
      return os === 'macos' ? '⌃' : 'Ctrl';
    }
    if (lower === 'alt' || lower === 'option') {
      return os === 'macos' ? '⌥' : 'Alt';
    }
    if (lower === 'shift') {
      return os === 'macos' ? '⇧' : 'Shift';
    }
    return part;
  });
}

export function formatShortcutCompact(shortcut: string, os: TargetOS): string {
  return formatShortcutTokens(shortcut, os).join(os === 'macos' ? '' : '+');
}
