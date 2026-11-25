import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ClipboardCopy,
  FileText,
  Folder,
  Globe,
  HardDrive,
  Monitor,
  Power,
  Terminal as TerminalIcon,
} from 'lucide-react';
import {
  ActionRecord,
  ForegroundAppId,
  FsEntry,
  KeySpriteConfig,
  TargetOS,
} from '../types/keysprite';
import { formatShortcutCompact, matchesShortcut } from '../utils/shortcutUtils';
import { KeySpriteTraySvg } from './AppLogo';

interface WorkflowSandboxViewProps {
  config: KeySpriteConfig;
  onUpdateConfig: (updater: (prev: KeySpriteConfig) => KeySpriteConfig) => void;
  onOpenSettings: () => void;
  onShowToast: (title: string, detail: string) => void;
}

const MAC_DIR_PATH = '/Users/alex/Projects/KeySprite';
const MAC_DESKTOP_PATH = '/Users/alex/Desktop';
const WIN_DIR_PATH = 'D:\\Projects\\KeySprite';
const WIN_DESKTOP_PATH = 'C:\\Users\\alex\\Desktop';
const LINUX_DIR_PATH = '/home/alex/Projects/KeySprite';
const LINUX_DESKTOP_PATH = '/home/alex/Desktop';

function getEntriesForContext(
  fg: ForegroundAppId,
  targetOS: TargetOS
): { currentDir: string; entries: FsEntry[] } {
  const isWindows = targetOS === 'windows';
  const isLinux = targetOS === 'linux';

  if (fg === 'desktop') {
    const deskDir = isWindows
      ? WIN_DESKTOP_PATH
      : isLinux
      ? LINUX_DESKTOP_PATH
      : MAC_DESKTOP_PATH;
    const sep = isWindows ? '\\' : '/';
    return {
      currentDir: deskDir,
      entries: [
        {
          id: 'desk-1',
          name: '项目归档',
          path: `${deskDir}${sep}项目归档`,
          isDir: true,
          size: '—',
          modified: '今天 14:20',
        },
        {
          id: 'desk-2',
          name: 'PRD-KeySprite.md',
          path: `${deskDir}${sep}PRD-KeySprite.md`,
          isDir: false,
          size: '12 KB',
          modified: '今天 10:05',
        },
      ],
    };
  }

  const base = isWindows ? WIN_DIR_PATH : isLinux ? LINUX_DIR_PATH : MAC_DIR_PATH;
  const sep = isWindows ? '\\' : '/';
  return {
    currentDir: base,
    entries: [
      {
        id: 'fs-1',
        name: 'src-tauri',
        path: `${base}${sep}src-tauri`,
        isDir: true,
        size: '—',
        modified: '今天 17:45',
      },
      {
        id: 'fs-2',
        name: 'src',
        path: `${base}${sep}src`,
        isDir: true,
        size: '—',
        modified: '今天 17:12',
      },
      {
        id: 'fs-3',
        name: 'Cargo.toml',
        path: `${base}${sep}src-tauri${sep}Cargo.toml`,
        isDir: false,
        size: '1.4 KB',
        modified: '今天 16:30',
      },
      {
        id: 'fs-4',
        name: 'package.json',
        path: `${base}${sep}package.json`,
        isDir: false,
        size: '890 B',
        modified: '昨天 21:18',
      },
      {
        id: 'fs-5',
        name: 'README.md',
        path: `${base}${sep}README.md`,
        isDir: false,
        size: '3.2 KB',
        modified: '昨天 19:04',
      },
    ],
  };
}

function getParentDirectory(fullPath: string, isWindows: boolean): string {
  const sep = isWindows ? '\\' : '/';
  const idx = fullPath.lastIndexOf(sep);
  if (idx <= 0) return fullPath;
  return fullPath.slice(0, idx);
}

export function WorkflowSandboxView({
  config,
  onUpdateConfig,
  onOpenSettings,
  onShowToast,
}: WorkflowSandboxViewProps) {
  const isWindows = config.targetOS === 'windows';
  const isLinux = config.targetOS === 'linux';
  const [trayOpen, setTrayOpen] = useState(true);
  const [daemonRunning, setDaemonRunning] = useState(true);
  const [foregroundApp, setForegroundApp] = useState<ForegroundAppId>(
    isWindows ? 'explorer' : isLinux ? 'nautilus' : 'finder'
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(['fs-1', 'fs-3']);
  const [clipboardPreview, setClipboardPreview] = useState<string>('');
  const [terminalSession, setTerminalSession] = useState<{
    appTitle: string;
    spawnCommand: string;
    cwd: string;
    lines: string[];
  } | null>(null);
  const [terminalInput, setTerminalInput] = useState('');
  const [actionLog, setActionLog] = useState<ActionRecord[]>([]);

  useEffect(() => {
    setForegroundApp((prev) => {
      if (prev === 'desktop' || prev === 'chrome' || prev === 'vscode') return prev;
      if (isWindows) return 'explorer';
      if (isLinux) return 'nautilus';
      return 'finder';
    });
  }, [isWindows, isLinux]);

  const fsContext = useMemo(
    () => getEntriesForContext(foregroundApp, config.targetOS),
    [foregroundApp, config.targetOS]
  );

  const selectedEntries = useMemo(
    () => fsContext.entries.filter((entry) => selectedIds.includes(entry.id)),
    [fsContext.entries, selectedIds]
  );

  const isFileManagerFront =
    foregroundApp === 'finder' ||
    foregroundApp === 'explorer' ||
    foregroundApp === 'nautilus' ||
    foregroundApp === 'desktop';

  const foregroundDisplayName = useMemo(() => {
    switch (foregroundApp) {
      case 'finder':
        return 'Finder (macOS)';
      case 'explorer':
        return '资源管理器 Explorer (CabinetWClass)';
      case 'nautilus':
        return '文件管理器 Nautilus / Dolphin (Linux)';
      case 'desktop':
        return isWindows
          ? '桌面 (Progman / WorkerW)'
          : isLinux
          ? 'Linux 桌面 (desktop_window)'
          : 'Finder 桌面';
      case 'chrome':
        return 'Google Chrome';
      case 'vscode':
        return 'Visual Studio Code';
    }
  }, [foregroundApp, isWindows, isLinux]);

  const appendLog = useCallback((record: Omit<ActionRecord, 'id' | 'timestamp'>) => {
    const now = new Date();
    const timestamp = now.toTimeString().slice(0, 8);
    setActionLog((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp,
        ...record,
      },
      ...prev.slice(0, 7),
    ]);
  }, []);

  const executeCopyPath = useCallback(
    async (triggeredShortcut: string) => {
      if (!daemonRunning) {
        onShowToast('KeySprite 未运行', '托盘常驻服务已退出，请先点击“重新启动”。');
        return;
      }

      if (!isFileManagerFront) {
        appendLog({
          shortcut: triggeredShortcut,
          foregroundApp: foregroundDisplayName,
          outcome: 'passthrough',
          detail: `检测到非文件管理器窗口处于前台，已放行快捷键给 ${foregroundDisplayName}`,
        });
        onShowToast(
          '上下文防冲突已放行',
          `当前前台为 ${foregroundDisplayName}，快捷键未拦截`
        );
        return;
      }

      const resolvedText =
        selectedEntries.length > 0
          ? selectedEntries.map((item) => item.path).join('\n')
          : fsContext.currentDir;

      setClipboardPreview(resolvedText);
      try {
        await navigator.clipboard.writeText(resolvedText);
      } catch {
        // Ignore clipboard permissions error
      }

      appendLog({
        shortcut: triggeredShortcut,
        foregroundApp: foregroundDisplayName,
        outcome: 'copied',
        detail:
          selectedEntries.length > 1
            ? `已复制 ${selectedEntries.length} 条路径（换行符分隔）`
            : `已复制路径: ${resolvedText}`,
      });

      if (config.showNotifications) {
        onShowToast('已复制路径', resolvedText);
      }
    },
    [
      daemonRunning,
      isFileManagerFront,
      foregroundDisplayName,
      selectedEntries,
      fsContext.currentDir,
      config.showNotifications,
      appendLog,
      onShowToast,
    ]
  );

  const executeOpenTerminal = useCallback(
    (triggeredShortcut: string) => {
      if (!daemonRunning) {
        onShowToast('KeySprite 未运行', '托盘常驻服务已退出，请先点击“重新启动”。');
        return;
      }

      if (!isFileManagerFront) {
        appendLog({
          shortcut: triggeredShortcut,
          foregroundApp: foregroundDisplayName,
          outcome: 'passthrough',
          detail: `检测到非文件管理器窗口处于前台，已放行快捷键给 ${foregroundDisplayName}`,
        });
        onShowToast(
          '上下文防冲突已放行',
          `当前前台为 ${foregroundDisplayName}，快捷键未拦截`
        );
        return;
      }

      let targetDir = fsContext.currentDir;
      if (selectedEntries.length > 0) {
        const first = selectedEntries[0];
        targetDir = first.isDir ? first.path : getParentDirectory(first.path, isWindows);
      }

      let appTitle = 'Terminal.app';
      let spawnCommand = `open -a Terminal "${targetDir}"`;
      if (config.targetOS === 'macos') {
        if (config.macTerminal === 'iterm2') {
          appTitle = 'iTerm2';
          spawnCommand = `osascript -e 'tell app "iTerm" ... cd "${targetDir}"'`;
        } else if (config.macTerminal === 'warp') {
          appTitle = 'Warp';
          spawnCommand = `open -a Warp "${targetDir}"`;
        }
      } else if (config.targetOS === 'windows') {
        if (config.winTerminal === 'windows_terminal') {
          appTitle = 'Windows Terminal (wt.exe)';
          spawnCommand = `wt -d "${targetDir}"`;
        } else if (config.winTerminal === 'power_shell') {
          appTitle = 'Windows PowerShell';
          spawnCommand = `powershell -NoExit -Command "Set-Location -LiteralPath '${targetDir}'"`;
        } else {
          appTitle = 'CMD 命令提示符';
          spawnCommand = `cmd /K "cd /d \\"${targetDir}\\""`;
        }
      } else {
        if (config.linuxTerminal === 'konsole') {
          appTitle = 'KDE Konsole';
          spawnCommand = `konsole --workdir "${targetDir}"`;
        } else if (config.linuxTerminal === 'alacritty') {
          appTitle = 'Alacritty';
          spawnCommand = `alacritty --working-directory "${targetDir}"`;
        } else if (config.linuxTerminal === 'kitty') {
          appTitle = 'Kitty';
          spawnCommand = `kitty --directory "${targetDir}"`;
        } else if (config.linuxTerminal === 'gnome_terminal') {
          appTitle = 'GNOME Terminal';
          spawnCommand = `gnome-terminal --working-directory "${targetDir}"`;
        } else {
          appTitle = 'Linux 终端 (自动探测)';
          spawnCommand = `xdg-terminal-exec --dir "${targetDir}"`;
        }
      }

      setTerminalSession({
        appTitle,
        spawnCommand,
        cwd: targetDir,
        lines: [`$ ${spawnCommand}`, `已自动定位工作目录 → ${targetDir}`],
      });

      appendLog({
        shortcut: triggeredShortcut,
        foregroundApp: foregroundDisplayName,
        outcome: 'terminal',
        detail: `已唤起 ${appTitle} 并定位至 ${targetDir}`,
      });
    },
    [
      daemonRunning,
      isFileManagerFront,
      foregroundDisplayName,
      fsContext.currentDir,
      selectedEntries,
      isWindows,
      config.targetOS,
      config.macTerminal,
      config.winTerminal,
      config.linuxTerminal,
      appendLog,
      onShowToast,
    ]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (matchesShortcut(event, config.copyPathShortcut)) {
        event.preventDefault();
        void executeCopyPath(formatShortcutCompact(config.copyPathShortcut, config.targetOS));
      } else if (matchesShortcut(event, config.openTerminalShortcut)) {
        event.preventDefault();
        executeOpenTerminal(formatShortcutCompact(config.openTerminalShortcut, config.targetOS));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    config.copyPathShortcut,
    config.openTerminalShortcut,
    config.targetOS,
    executeCopyPath,
    executeOpenTerminal,
  ]);

  const handleRowClick = (entryId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (event.metaKey || event.ctrlKey) {
      setSelectedIds((prev) =>
        prev.includes(entryId) ? prev.filter((id) => id !== entryId) : [...prev, entryId]
      );
    } else {
      setSelectedIds([entryId]);
    }
  };

  const handleTerminalCommand = (event: React.FormEvent) => {
    event.preventDefault();
    if (!terminalSession || !terminalInput.trim()) return;
    const cmd = terminalInput.trim();
    let output = '';
    if (cmd === 'pwd') {
      output = terminalSession.cwd;
    } else if (cmd === 'ls' || cmd === 'dir') {
      output = fsContext.entries.map((e) => (e.isDir ? `${e.name}/` : e.name)).join('  ');
    } else if (cmd === 'clear' || cmd === 'cls') {
      setTerminalSession({ ...terminalSession, lines: [] });
      setTerminalInput('');
      return;
    } else {
      output = `模拟终端已定位到 ${terminalSession.cwd}（支持 pwd / ls / clear）`;
    }

    setTerminalSession({
      ...terminalSession,
      lines: [...terminalSession.lines, `$ ${cmd}`, output],
    });
    setTerminalInput('');
  };

  const copyShortcutDisplay = formatShortcutCompact(config.copyPathShortcut, config.targetOS);
  const termShortcutDisplay = formatShortcutCompact(
    config.openTerminalShortcut,
    config.targetOS
  );

  const fmTabId: ForegroundAppId = isWindows
    ? 'explorer'
    : isLinux
    ? 'nautilus'
    : 'finder';
  const fmTabLabel = isWindows ? '资源管理器' : isLinux ? '文件管理器' : 'Finder';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 4 cols: System Tray + 7-item PRD Menu Preview */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#0F172A]">系统托盘常驻菜单</h2>
              <p className="text-xs text-slate-500">
                无 Dock / 任务栏主窗口 · 仅托盘图标常驻
              </p>
            </div>
            {!daemonRunning && (
              <button
                type="button"
                onClick={() => {
                  setDaemonRunning(true);
                  setTrayOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-md bg-[#00845A] text-white text-xs font-medium cursor-pointer"
              >
                重新启动
              </button>
            )}
          </div>

          <div className="p-5 bg-slate-50/70 space-y-3">
            <div
              className={`rounded-lg px-3 py-2 flex items-center justify-between text-xs border ${
                isWindows || isLinux
                  ? 'bg-[#1E293B] text-slate-100 border-slate-700'
                  : 'bg-white/95 text-[#0F172A] border-slate-200'
              }`}
            >
              <span className="font-medium opacity-75">
                {isWindows
                  ? 'Windows 系统托盘'
                  : isLinux
                  ? 'Linux 顶栏指示器'
                  : 'macOS 菜单栏'}
              </span>
              <div className="flex items-center gap-3">
                {daemonRunning ? (
                  <button
                    type="button"
                    onClick={() => setTrayOpen((prev) => !prev)}
                    className={`px-2 py-1 rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                      trayOpen
                        ? isWindows || isLinux
                          ? 'bg-white/15'
                          : 'bg-slate-200/80'
                        : 'hover:bg-slate-500/10'
                    }`}
                    title="点击展开/收起 KeySprite 托盘菜单"
                  >
                    <KeySpriteTraySvg size={15} />
                    <span className="text-[11px] font-medium">KeySprite</span>
                  </button>
                ) : (
                  <span className="text-[11px] opacity-60">已退出驻留</span>
                )}
                <span className="font-mono text-[11px] opacity-75">18:08</span>
              </div>
            </div>

            {daemonRunning && trayOpen && (
              <div className="bg-white border border-slate-200 rounded-xl py-1.5 shadow-sm text-xs select-none">
                <div className="px-3 py-2 text-slate-400 flex items-center justify-between">
                  <span>复制路径</span>
                  <span className="font-mono">{copyShortcutDisplay}</span>
                </div>
                <div className="px-3 py-2 text-slate-400 flex items-center justify-between">
                  <span>打开终端</span>
                  <span className="font-mono">{termShortcutDisplay}</span>
                </div>

                <div className="my-1 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="w-full px-3 py-2 text-left text-[#0F172A] hover:bg-[#12273D] hover:text-white transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span>设置 (Settings)</span>
                  <span className="opacity-60 font-mono">⌘,</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onUpdateConfig((prev) => ({ ...prev, autostart: !prev.autostart }))
                  }
                  className="w-full px-3 py-2 text-left text-[#0F172A] hover:bg-[#12273D] hover:text-white transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span>开机自启 (Launch at Startup)</span>
                  <span className="w-4 flex justify-end">
                    {config.autostart && <Check className="w-3.5 h-3.5 text-[#00845A]" />}
                  </span>
                </button>

                <div className="my-1 border-t border-slate-100" />

                <button
                  type="button"
                  onClick={() => {
                    setDaemonRunning(false);
                    setTrayOpen(false);
                    onShowToast('KeySprite 已退出', '常驻托盘进程已结束，可点击“重新启动”恢复');
                  }}
                  className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span>退出 (Quit KeySprite)</span>
                  <Power className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Clipboard Snapshot Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#0F172A]">系统剪贴板快照</h3>
            <ClipboardCopy className="w-4 h-4 text-slate-400" />
          </div>
          {clipboardPreview ? (
            <pre className="p-3 rounded-lg bg-slate-900 text-emerald-300 text-xs font-mono leading-relaxed whitespace-pre-wrap break-all">
              {clipboardPreview}
            </pre>
          ) : (
            <div className="p-4 rounded-lg border border-dashed border-slate-200 text-xs text-slate-500 text-center">
              暂未触发复制操作。在右侧选择文件或空白处后按下{' '}
              <span className="font-mono text-[#12273D]">{copyShortcutDisplay}</span>。
            </div>
          )}
        </div>
      </div>

      {/* Right 8 cols: Foreground Window Context Simulator & Terminal Preview */}
      <div className="lg:col-span-8 space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: fmTabId, label: fmTabLabel, icon: HardDrive },
                  { id: 'desktop', label: '桌面', icon: Monitor },
                  { id: 'chrome', label: 'Chrome 浏览器', icon: Globe },
                  { id: 'vscode', label: 'VS Code', icon: TerminalIcon },
                ] as { id: ForegroundAppId; label: string; icon: typeof HardDrive }[]
              ).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setForegroundApp(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      foregroundApp === tab.id
                        ? 'bg-white text-[#12273D] shadow-xs'
                        : 'text-slate-600 hover:text-[#0F172A]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void executeCopyPath(copyShortcutDisplay)}
                className="px-3 py-1.5 rounded-lg bg-[#12273D] hover:bg-[#1a3552] text-white text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>复制路径</span>
                <span className="font-mono opacity-80">{copyShortcutDisplay}</span>
              </button>
              <button
                type="button"
                onClick={() => executeOpenTerminal(termShortcutDisplay)}
                className="px-3 py-1.5 rounded-lg bg-[#00845A] hover:bg-[#006e4b] text-white text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>打开终端</span>
                <span className="font-mono opacity-85">{termShortcutDisplay}</span>
              </button>
            </div>
          </div>

          {isFileManagerFront ? (
            <div
              onClick={() => setSelectedIds([])}
              className="p-5 min-h-[270px] flex flex-col justify-between cursor-default"
            >
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <div className="font-mono text-[#12273D] truncate">
                    当前目录：{fsContext.currentDir}
                  </div>
                  <div>
                    支持单击单选 · {isWindows || isLinux ? 'Ctrl' : 'Cmd'}+点击多选 · 点击空白处取消选择
                  </div>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                  {fsContext.entries.map((entry) => {
                    const isSelected = selectedIds.includes(entry.id);
                    return (
                      <div
                        key={entry.id}
                        onClick={(e) => handleRowClick(entry.id, e)}
                        className={`px-3.5 py-2.5 flex items-center justify-between gap-4 text-xs transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-[#12273D] text-white'
                            : 'bg-white hover:bg-slate-50 text-[#0F172A]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {entry.isDir ? (
                            <Folder
                              className={`w-4 h-4 shrink-0 ${
                                isSelected ? 'text-emerald-300' : 'text-[#00845A]'
                              }`}
                            />
                          ) : (
                            <FileText
                              className={`w-4 h-4 shrink-0 ${
                                isSelected ? 'text-slate-200' : 'text-slate-400'
                              }`}
                            />
                          )}
                          <span className="font-medium truncate">{entry.name}</span>
                        </div>

                        <div
                          className={`flex items-center gap-6 font-mono text-[11px] shrink-0 ${
                            isSelected ? 'text-slate-200' : 'text-slate-400'
                          }`}
                        >
                          <span>{entry.size}</span>
                          <span>{entry.modified}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  已选中{' '}
                  <strong className="text-[#0F172A] tabular-nums">
                    {selectedEntries.length}
                  </strong>{' '}
                  项
                  {selectedEntries.length === 0 && '（将自动回退至当前文件夹目录）'}
                </span>
                <span className="font-mono text-[#00845A]">
                  前台判定：文件管理器已激活 · 允许执行热键
                </span>
              </div>
            </div>
          ) : (
            <div className="p-6 min-h-[270px] flex flex-col justify-between bg-slate-50/50">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#0F172A]">
                    当前前台窗口：{foregroundDisplayName}
                  </span>
                  <span className="text-amber-700 font-medium">
                    非文件管理器 · 触发防冲突保护
                  </span>
                </div>
                <div className="p-5 rounded-lg border border-slate-200 bg-white space-y-2">
                  <div className="text-sm font-medium text-[#0F172A]">
                    {foregroundApp === 'chrome'
                      ? '浏览器原生快捷键保护中'
                      : '代码编辑器快捷键保护中'}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {foregroundApp === 'chrome'
                      ? `在 Google Chrome 中按下 ${copyShortcutDisplay} 时，KeySprite 检测到当前前台应用并非文件管理器，不会拦截操作或篡改剪贴板。`
                      : `在 VS Code 中按下 ${termShortcutDisplay} 时，KeySprite 自动识别非文件管理器上下文并放行，避免影响编辑器原生快捷键。`}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/70 text-xs text-slate-500">
                现在点击右上角触发按钮或直接按键，可验证防冲突放行行为。
              </div>
            </div>
          )}
        </div>

        {terminalSession && (
          <div className="bg-[#0F172A] text-slate-100 rounded-xl border border-slate-800 overflow-hidden">
            <div className="px-4 py-2.5 bg-[#12273D] border-b border-slate-700/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-medium">
                <TerminalIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>{terminalSession.appTitle}</span>
                <span className="text-slate-400 font-mono">· {terminalSession.cwd}</span>
              </div>
              <button
                type="button"
                onClick={() => setTerminalSession(null)}
                className="text-slate-300 hover:text-white text-xs cursor-pointer"
              >
                关闭窗口
              </button>
            </div>
            <div className="p-4 font-mono text-xs space-y-1.5 max-h-48 overflow-y-auto">
              {terminalSession.lines.map((line, i) => (
                <div
                  key={i}
                  className={line.startsWith('$') ? 'text-emerald-300' : 'text-slate-300'}
                >
                  {line}
                </div>
              ))}
              <form onSubmit={handleTerminalCommand} className="flex items-center gap-2 pt-1">
                <span className="text-emerald-400 shrink-0">{terminalSession.cwd} %</span>
                <input
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  placeholder="输入 pwd、ls 或 clear 验证目录定位..."
                  className="w-full bg-transparent text-slate-100 placeholder:text-slate-500 focus:outline-none"
                />
              </form>
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0F172A]">最近触发记录</h3>
            <span className="text-xs text-slate-500 tabular-nums">
              共 {actionLog.length} 条
            </span>
          </div>
          {actionLog.length === 0 ? (
            <div className="p-5 text-xs text-slate-500 text-center">
              暂无触发记录，点击上方操作按钮或直接按快捷键即可开始测试。
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {actionLog.map((item) => (
                <div
                  key={item.id}
                  className="px-5 py-2.5 flex items-center justify-between gap-4 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-slate-400 shrink-0 tabular-nums">
                      {item.timestamp}
                    </span>
                    <span className="font-mono font-semibold text-[#12273D] shrink-0">
                      {item.shortcut}
                    </span>
                    <span className="text-slate-400 shrink-0">·</span>
                    <span className="text-slate-700 truncate">{item.detail}</span>
                  </div>
                  <span
                    className={`text-[11px] font-medium shrink-0 ${
                      item.outcome === 'passthrough'
                        ? 'text-amber-700'
                        : 'text-[#00845A]'
                    }`}
                  >
                    {item.outcome === 'copied'
                      ? '剪贴板已写入'
                      : item.outcome === 'terminal'
                      ? '终端已定位'
                      : '防冲突放行'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
