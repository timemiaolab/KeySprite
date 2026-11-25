import { useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import {
  checkMacAccessibility,
  isTauriDesktopRuntime,
  openMacAccessibilitySettings,
} from '../services/tauriBridge';
import {
  KeySpriteConfig,
  LinuxTerminal,
  MacTerminal,
  PassthroughStrategy,
  TargetOS,
  WinTerminal,
} from '../types/keysprite';
import {
  formatShortcutCompact,
  getDefaultShortcutsForOS,
} from '../utils/shortcutUtils';
import { KeySpriteAppIcon } from './AppLogo';
import { ShortcutRecorder } from './ShortcutRecorder';

interface PreferencesViewProps {
  config: KeySpriteConfig;
  onUpdateConfig: (updater: (prev: KeySpriteConfig) => KeySpriteConfig) => void;
  onResetDefaults: () => void;
  onShowToast: (title: string, detail: string) => void;
}

export function PreferencesView({
  config,
  onUpdateConfig,
  onResetDefaults,
  onShowToast,
}: PreferencesViewProps) {
  const isNativeDesktop = isTauriDesktopRuntime();
  const [macAccessibilityGranted, setMacAccessibilityGranted] = useState(false);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => {
    if (isNativeDesktop && config.targetOS === 'macos') {
      void checkMacAccessibility().then(setMacAccessibilityGranted);
    }
  }, [isNativeDesktop, config.targetOS]);

  const defaults = getDefaultShortcutsForOS(config.targetOS);

  const handlePlatformSwitch = (nextOS: TargetOS) => {
    const nextDefaults = getDefaultShortcutsForOS(nextOS);
    onUpdateConfig((prev) => ({
      ...prev,
      targetOS: nextOS,
      copyPathShortcut: nextDefaults.copyPathShortcut,
      openTerminalShortcut: nextDefaults.openTerminalShortcut,
    }));
    onShowToast(
      '已切换目标平台配置',
      `已加载 ${
        nextOS === 'macos'
          ? 'macOS (Cmd+9 / Cmd+0)'
          : nextOS === 'windows'
          ? 'Windows (Alt+9 / Alt+0)'
          : 'Linux (Alt+9 / Alt+0)'
      } 默认快捷键`
    );
  };

  const configJson = JSON.stringify(
    {
      copyPathShortcut: config.copyPathShortcut,
      openTerminalShortcut: config.openTerminalShortcut,
      macTerminal: config.macTerminal,
      winTerminal: config.winTerminal,
      linuxTerminal: config.linuxTerminal,
      autostart: config.autostart,
      showNotifications: config.showNotifications,
      passthroughStrategy: config.passthroughStrategy,
    },
    null,
    2
  );

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(configJson);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 1800);
    } catch {
      onShowToast('复制失败', '剪贴板权限受限');
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([configJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCompact = formatShortcutCompact(config.copyPathShortcut, config.targetOS);
  const termCompact = formatShortcutCompact(config.openTerminalShortcut, config.targetOS);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 7 cols: Authentic KeySprite Desktop Client Window */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Window Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <KeySpriteAppIcon size={30} />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-[#0F172A] truncate">
                KeySprite 客户端设置
              </h2>
              <p className="text-xs text-slate-500 truncate">
                兼容 macOS / Windows / Linux · 默认快捷键启动即生效
              </p>
            </div>
          </div>

          {!isNativeDesktop && (
            <div
              className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg shrink-0"
              role="tablist"
              aria-label="切换客户端目标系统"
            >
              {(['macos', 'windows', 'linux'] as TargetOS[]).map((os) => (
                <button
                  key={os}
                  type="button"
                  role="tab"
                  aria-selected={config.targetOS === os}
                  onClick={() => handlePlatformSwitch(os)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    config.targetOS === os
                      ? 'bg-white text-[#12273D] shadow-xs'
                      : 'text-slate-600 hover:text-[#0F172A]'
                  }`}
                >
                  {os === 'macos' ? 'macOS' : os === 'windows' ? 'Windows' : 'Linux'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Ready-out-of-the-box confirmation */}
          <div className="p-3.5 rounded-lg bg-[#00845A]/[0.06] border border-[#00845A]/20 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-[#00845A] shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-[#0F172A]">
              <span className="font-semibold">两个核心快捷键已默认启用：</span>
              <span className="text-slate-600">
                打开软件即可在文件管理器或桌面使用{' '}
                <span className="font-mono font-semibold text-[#12273D]">{copyCompact}</span> 复制路径、
                <span className="font-mono font-semibold text-[#12273D]">{termCompact}</span> 打开终端。如需修改，直接点击下方按键框重新录制。
              </span>
            </div>
          </div>

          {/* Section 1: Global Shortcut Recorders */}
          <section>
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="text-sm font-semibold text-[#12273D]">全局快捷键</h3>
              <span className="text-xs text-slate-500">
                仅在系统文件管理器或桌面处于前台时生效
              </span>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg px-4">
              <ShortcutRecorder
                id="copy-path-shortcut"
                label="复制文件或文件夹路径"
                description="多选使用换行符 (\\n) 分隔绝对路径；未选中项时复制当前打开目录。"
                value={config.copyPathShortcut}
                defaultValue={defaults.copyPathShortcut}
                conflictWith={config.openTerminalShortcut}
                targetOS={config.targetOS}
                onChange={(next) => {
                  onUpdateConfig((prev) => ({ ...prev, copyPathShortcut: next }));
                  onShowToast(
                    '全局快捷键已更新',
                    `已注销旧绑定并实时注册「复制路径」: ${next}`
                  );
                }}
              />

              <ShortcutRecorder
                id="open-terminal-shortcut"
                label="打开命令行并定位到目录"
                description="选中文件夹直接进入；选中文件提取父级目录；多选时取首项所在目录。"
                value={config.openTerminalShortcut}
                defaultValue={defaults.openTerminalShortcut}
                conflictWith={config.copyPathShortcut}
                targetOS={config.targetOS}
                onChange={(next) => {
                  onUpdateConfig((prev) => ({ ...prev, openTerminalShortcut: next }));
                  onShowToast(
                    '全局快捷键已更新',
                    `已注销旧绑定并实时注册「打开终端」: ${next}`
                  );
                }}
              />
            </div>
          </section>

          <hr className="border-slate-100" />

          {/* Section 2: Terminal Preference */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-[#12273D]">默认命令行终端</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {config.targetOS === 'macos'
                    ? '默认打开 Terminal.app，支持切换 iTerm2 与 Warp'
                    : config.targetOS === 'windows'
                    ? '优先检测并打开 Windows Terminal (wt.exe)，未安装时降级至 PowerShell / CMD'
                    : '支持自动探测或指定 GNOME Terminal / Konsole / Alacritty / Kitty'}
                </p>
              </div>
              <Terminal className="w-4 h-4 text-slate-400 shrink-0" />
            </div>

            {config.targetOS === 'macos' && (
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'terminal', label: 'Terminal.app', sub: '系统默认' },
                    { id: 'iterm2', label: 'iTerm2', sub: 'AppleScript' },
                    { id: 'warp', label: 'Warp', sub: 'Open App' },
                  ] as { id: MacTerminal; label: string; sub: string }[]
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      onUpdateConfig((prev) => ({ ...prev, macTerminal: item.id }))
                    }
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      config.macTerminal === item.id
                        ? 'border-[#00845A] bg-[#00845A]/5'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="text-xs font-semibold text-[#0F172A]">{item.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{item.sub}</div>
                  </button>
                ))}
              </div>
            )}

            {config.targetOS === 'windows' && (
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'windows_terminal', label: 'Windows Terminal', sub: 'wt -d 优先' },
                    { id: 'power_shell', label: 'PowerShell', sub: 'Set-Location' },
                    { id: 'cmd', label: '命令提示符 CMD', sub: 'cmd /K cd /d' },
                  ] as { id: WinTerminal; label: string; sub: string }[]
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      onUpdateConfig((prev) => ({ ...prev, winTerminal: item.id }))
                    }
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      config.winTerminal === item.id
                        ? 'border-[#00845A] bg-[#00845A]/5'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="text-xs font-semibold text-[#0F172A]">{item.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{item.sub}</div>
                  </button>
                ))}
              </div>
            )}

            {config.targetOS === 'linux' && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(
                  [
                    { id: 'auto', label: '自动探测', sub: 'xdg-terminal' },
                    { id: 'gnome_terminal', label: 'GNOME', sub: 'Ubuntu 默认' },
                    { id: 'konsole', label: 'Konsole', sub: 'KDE 桌面' },
                    { id: 'alacritty', label: 'Alacritty', sub: 'GPU 终端' },
                    { id: 'kitty', label: 'Kitty', sub: '轻量终端' },
                  ] as { id: LinuxTerminal; label: string; sub: string }[]
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      onUpdateConfig((prev) => ({ ...prev, linuxTerminal: item.id }))
                    }
                    className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      config.linuxTerminal === item.id
                        ? 'border-[#00845A] bg-[#00845A]/5'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="text-xs font-semibold text-[#0F172A] truncate">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {item.sub}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <hr className="border-slate-100" />

          {/* Section 3: System & Anti-Conflict Options */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-[#12273D]">系统集成与防冲突策略</h3>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-[#0F172A]">
                  开机自启动 (Launch at Startup)
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  通过 <span className="font-mono">tauri-plugin-autostart</span> 随系统静默启动并驻留托盘。
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config.autostart}
                onClick={() =>
                  onUpdateConfig((prev) => ({ ...prev, autostart: !prev.autostart }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00845A] ${
                  config.autostart ? 'bg-[#00845A]' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                    config.autostart ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-[#0F172A]">
                  操作成功系统通知 (Notification)
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  复制路径后通过 <span className="font-mono">tauri-plugin-notification</span> 发送“已复制路径”提示。
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config.showNotifications}
                onClick={() =>
                  onUpdateConfig((prev) => ({
                    ...prev,
                    showNotifications: !prev.showNotifications,
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00845A] ${
                  config.showNotifications ? 'bg-[#00845A]' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transition-transform ${
                    config.showNotifications ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="space-y-2 pt-1">
              <div className="text-sm font-medium text-[#0F172A]">
                非文件管理器前台防冲突处理
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: 'ignore_non_file_manager',
                      title: '静默忽略（默认无冲突组合）',
                      desc: '前台非文件管理器时直接返回不拦截，推荐搭配 Cmd/Alt + 9/0。',
                    },
                    {
                      id: 'simulate_key_passthrough',
                      title: '模拟按键放行（enigo 扩展）',
                      desc: '检测到浏览器或编辑器前台时，将快捷键模拟转发给前台窗口。',
                    },
                  ] as { id: PassthroughStrategy; title: string; desc: string }[]
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      onUpdateConfig((prev) => ({ ...prev, passthroughStrategy: item.id }))
                    }
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      config.passthroughStrategy === item.id
                        ? 'border-[#12273D] bg-[#12273D]/[0.03]'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="text-xs font-semibold text-[#0F172A]">{item.title}</div>
                    <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {item.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Footer Action Row */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
            <span className="text-xs text-slate-500">
              持久化存储：<span className="font-mono text-[#12273D]">config.json</span>
            </span>
            <button
              type="button"
              onClick={onResetDefaults}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>恢复默认设置</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right 5 cols: Cross-platform System Support & config.json Live Inspector */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#0F172A]">
                {config.targetOS === 'macos'
                  ? 'macOS 系统权限与无 Dock 运行'
                  : config.targetOS === 'windows'
                  ? 'Windows Win32 & COM 适配状态'
                  : 'Linux 桌面环境适配状态'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {config.targetOS === 'macos'
                  ? '通过 ActivationPolicy::Accessory 隐藏 Dock 图标，使用 AppleScript 与 NSWorkspace 读取 Finder 状态。'
                  : config.targetOS === 'windows'
                  ? '通过 GetForegroundWindow 与 IShellWindows COM 接口读取资源管理器选中项，无需管理员权限。'
                  : '兼容 GNOME Files (Nautilus)、KDE Dolphin、Nemo、Thunar 与桌面窗口，通过 xdotool/xprop 与 xdg-terminal-exec 协同工作。'}
              </p>
            </div>
            {config.targetOS === 'macos' ? (
              macAccessibilityGranted ? (
                <ShieldCheck className="w-5 h-5 text-[#00845A] shrink-0" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              )
            ) : (
              <ShieldCheck className="w-5 h-5 text-[#00845A] shrink-0" />
            )}
          </div>

          {config.targetOS === 'macos' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5">
                <div className="font-semibold text-[#12273D]">
                  AXIsProcessTrusted() 状态：
                  <span
                    className={
                      macAccessibilityGranted ? 'text-[#00845A]' : 'text-amber-700'
                    }
                  >
                    {macAccessibilityGranted ? ' 已授权' : ' 未授权（首次启动需勾选）'}
                  </span>
                </div>
                <p className="text-slate-500 leading-relaxed">
                  系统设置 · 隐私与安全性 · 辅助功能 · 勾选 KeySprite
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isNativeDesktop) {
                      void openMacAccessibilitySettings();
                    } else {
                      setShowPermissionGuide((prev) => !prev);
                    }
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[#12273D] hover:bg-[#1a3552] text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isNativeDesktop
                    ? '打开系统辅助功能设置'
                    : showPermissionGuide
                    ? '收起权限引导弹窗'
                    : '预览首次启动授权弹窗'}
                </button>
                {!isNativeDesktop && (
                  <button
                    type="button"
                    onClick={() => setMacAccessibilityGranted((prev) => !prev)}
                    className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {macAccessibilityGranted ? '模拟撤销权限' : '模拟已勾选'}
                  </button>
                )}
              </div>

              {showPermissionGuide && !isNativeDesktop && (
                <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/70 space-y-2.5">
                  <div className="text-xs font-semibold text-[#0F172A]">
                    需要「辅助功能」权限以识别 Finder 窗口
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    KeySprite 仅在 Finder 或桌面处于前台时触发快捷键。请在系统设置中勾选 KeySprite。
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMacAccessibilityGranted(true);
                      setShowPermissionGuide(false);
                      onShowToast(
                        '已跳转系统辅助功能设置',
                        'open x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
                      );
                    }}
                    className="px-3 py-1.5 rounded-md bg-[#00845A] hover:bg-[#006e4b] text-white text-xs font-medium cursor-pointer"
                  >
                    前往系统设置并授权
                  </button>
                </div>
              )}
            </div>
          )}

          {config.targetOS === 'windows' && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
              <div>
                窗口类名识别：<span className="font-mono text-[#12273D]">CabinetWClass</span> ·{' '}
                <span className="font-mono text-[#12273D]">Progman</span> ·{' '}
                <span className="font-mono text-[#12273D]">WorkerW</span>
              </div>
              <div>
                COM 查询链路：<span className="font-mono text-[#12273D]">IShellWindows → IShellBrowser → IFolderView</span>
              </div>
            </div>
          )}

          {config.targetOS === 'linux' && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
              <div>
                识别文件管理器：<span className="font-mono text-[#12273D]">nautilus</span> ·{' '}
                <span className="font-mono text-[#12273D]">dolphin</span> ·{' '}
                <span className="font-mono text-[#12273D]">nemo</span> ·{' '}
                <span className="font-mono text-[#12273D]">thunar</span>
              </div>
              <div>
                运行时依赖：<span className="font-mono text-[#12273D]">xdotool / xprop / libappindicator3</span>
              </div>
            </div>
          )}
        </div>

        {/* Local Store config.json Live Inspector */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#0F172A]">config.json 持久化配置</h3>
              <p className="text-xs text-slate-500">tauri-plugin-store 本地配置快照</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCopyJson}
                className="px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
              >
                {copiedJson ? (
                  <Check className="w-3.5 h-3.5 text-[#00845A]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedJson ? '已复制' : '复制'}</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>下载</span>
              </button>
            </div>
          </div>
          <pre className="p-4 bg-[#0F172A] text-slate-100 text-xs font-mono leading-relaxed overflow-x-auto">
            {configJson}
          </pre>
        </div>
      </div>
    </div>
  );
}
