import { useCallback, useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { KeySpriteAppIcon } from './components/AppLogo';
import { ShortcutRecorder } from './components/ShortcutRecorder';
import {
  fetchDesktopConfig,
  isTauriDesktopRuntime,
  resetDesktopConfig,
  saveDesktopConfig,
} from './services/tauriBridge';
import { KeySpriteConfig, TargetOS } from './types/keysprite';
import {
  DEFAULT_CONFIG_LINUX,
  DEFAULT_CONFIG_MACOS,
  DEFAULT_CONFIG_WINDOWS,
  getDefaultConfigForOS,
  getDefaultShortcutsForOS,
} from './utils/shortcutUtils';

const STORAGE_KEY = 'keysprite.config.v1';

function detectInitialConfig(): KeySpriteConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<KeySpriteConfig>;
      const base = getDefaultConfigForOS(parsed.targetOS ?? 'macos');
      return { ...base, ...parsed };
    }
  } catch {
    // Fallback to OS detection
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
  if (ua.includes('mac')) return DEFAULT_CONFIG_MACOS;
  if (ua.includes('linux')) return DEFAULT_CONFIG_LINUX;
  return DEFAULT_CONFIG_WINDOWS;
}

export default function App() {
  const isNativeDesktop = isTauriDesktopRuntime();
  const [config, setConfig] = useState<KeySpriteConfig>(detectInitialConfig);
  const [statusMessage, setStatusMessage] = useState<string>(
    '默认快捷键已启用 · 仅在文件管理器或桌面前台时触发'
  );

  useEffect(() => {
    if (!isNativeDesktop) return;
    void fetchDesktopConfig()
      .then((desktopCfg) => {
        if (desktopCfg) {
          setConfig(desktopCfg);
        }
      })
      .catch(() => {
        // Fallback to local defaults if IPC unavailable
      });
  }, [isNativeDesktop]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore storage quota errors
    }
  }, [config]);

  const updateConfig = useCallback(
    (updater: (prev: KeySpriteConfig) => KeySpriteConfig, feedback?: string) => {
      setConfig((prev) => {
        const next = updater(prev);
        if (isNativeDesktop) {
          void saveDesktopConfig(next).catch((err) => {
            setStatusMessage(`快捷键更新失败: ${String(err)}`);
          });
        }
        return next;
      });
      if (feedback) {
        setStatusMessage(feedback);
      }
    },
    [isNativeDesktop]
  );

  const handlePlatformChange = (nextOS: TargetOS) => {
    const nextDefaults = getDefaultShortcutsForOS(nextOS);
    updateConfig(
      (prev) => ({
        ...prev,
        targetOS: nextOS,
        copyPathShortcut: nextDefaults.copyPathShortcut,
        openTerminalShortcut: nextDefaults.openTerminalShortcut,
      }),
      `已切换至 ${nextOS === 'macos' ? 'macOS' : nextOS === 'windows' ? 'Windows' : 'Linux'} 默认快捷键`
    );
  };

  const handleResetDefaults = () => {
    if (isNativeDesktop) {
      void resetDesktopConfig(config.targetOS)
        .then((resetCfg) => {
          if (resetCfg) setConfig(resetCfg);
          setStatusMessage('已恢复默认快捷键');
        })
        .catch((err) => {
          setStatusMessage(`恢复默认失败: ${String(err)}`);
        });
      return;
    }

    setConfig((prev) => getDefaultConfigForOS(prev.targetOS));
    setStatusMessage('已恢复默认快捷键');
  };

  const defaults = getDefaultShortcutsForOS(config.targetOS);
  const isModified =
    config.copyPathShortcut !== defaults.copyPathShortcut ||
    config.openTerminalShortcut !== defaults.openTerminalShortcut;

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex items-center justify-center p-6">
      <div className="w-full max-w-[560px] bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {/* Header */}
        <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <KeySpriteAppIcon size={36} />
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight text-[#12273D] truncate">
                KeySprite <span className="text-[#00845A]">快捷键精灵</span>
              </h1>
              <p className="text-xs text-slate-500 truncate">
                全局快捷键设置 · 默认已开启
              </p>
            </div>
          </div>

          {!isNativeDesktop && (
            <div
              className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0"
              role="tablist"
              aria-label="系统平台"
            >
              {(['macos', 'windows', 'linux'] as TargetOS[]).map((os) => (
                <button
                  key={os}
                  type="button"
                  role="tab"
                  aria-selected={config.targetOS === os}
                  onClick={() => handlePlatformChange(os)}
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
        </header>

        {/* Two Shortcut Settings Only */}
        <div className="px-6 py-4 divide-y divide-slate-100">
          <ShortcutRecorder
            id="copy-path-shortcut"
            label="复制文件/文件夹路径"
            description="选中项绝对路径（多选用换行分隔）；未选中时复制当前目录。"
            value={config.copyPathShortcut}
            defaultValue={defaults.copyPathShortcut}
            conflictWith={config.openTerminalShortcut}
            targetOS={config.targetOS}
            onChange={(next) =>
              updateConfig(
                (prev) => ({ ...prev, copyPathShortcut: next }),
                '已更新「复制路径」快捷键并保存'
              )
            }
          />

          <ShortcutRecorder
            id="open-terminal-shortcut"
            label="打开命令行并定位到目录"
            description="打开终端并自动切换至选中文件夹或文件所在目录。"
            value={config.openTerminalShortcut}
            defaultValue={defaults.openTerminalShortcut}
            conflictWith={config.copyPathShortcut}
            targetOS={config.targetOS}
            onChange={(next) =>
              updateConfig(
                (prev) => ({ ...prev, openTerminalShortcut: next }),
                '已更新「打开命令行」快捷键并保存'
              )
            }
          />
        </div>

        {/* Footer */}
        <footer className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-4">
          <span className="text-xs text-slate-500 truncate">{statusMessage}</span>
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={!isModified}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              isModified
                ? 'border-slate-200 bg-white hover:bg-slate-50 text-[#12273D] cursor-pointer'
                : 'border-slate-200/60 bg-slate-100/60 text-slate-400 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>恢复默认</span>
          </button>
        </footer>
      </div>
    </main>
  );
}
