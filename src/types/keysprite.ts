export type TargetOS = 'macos' | 'windows' | 'linux';

export type MacTerminal = 'terminal' | 'iterm2' | 'warp';
export type WinTerminal = 'windows_terminal' | 'power_shell' | 'cmd';
export type LinuxTerminal = 'auto' | 'gnome_terminal' | 'konsole' | 'alacritty' | 'kitty';
export type PassthroughStrategy = 'ignore_non_file_manager' | 'simulate_key_passthrough';

export interface KeySpriteConfig {
  targetOS: TargetOS;
  copyPathShortcut: string;
  openTerminalShortcut: string;
  macTerminal: MacTerminal;
  winTerminal: WinTerminal;
  linuxTerminal: LinuxTerminal;
  autostart: boolean;
  showNotifications: boolean;
  passthroughStrategy: PassthroughStrategy;
}

export type ForegroundAppId = 'finder' | 'explorer' | 'nautilus' | 'desktop' | 'chrome' | 'vscode';

export interface FsEntry {
  id: string;
  name: string;
  path: string;
  isDir: boolean;
  size: string;
  modified: string;
}

export interface ActionRecord {
  id: string;
  timestamp: string;
  shortcut: string;
  foregroundApp: string;
  outcome: 'copied' | 'terminal' | 'passthrough';
  detail: string;
}
