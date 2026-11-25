import { useCallback, useEffect, useState } from 'react';
import { Check, Globe, Minimize2, Power, RotateCcw } from 'lucide-react';
import { KeySpriteAppIcon, KeySpriteTraySvg } from './components/AppLogo';
import { ShortcutRecorder } from './components/ShortcutRecorder';
import { SUPPORTED_LANGUAGES, TRANSLATIONS } from './i18n/translations';
import {
  fetchDesktopConfig,
  hideWindowToTray,
  isTauriDesktopRuntime,
  resetDesktopConfig,
  saveDesktopConfig,
} from './services/tauriBridge';
import { KeySpriteConfig, LanguageCode, TargetOS } from './types/keysprite';
import {
  DEFAULT_CONFIG_LINUX,
  DEFAULT_CONFIG_MACOS,
  DEFAULT_CONFIG_WINDOWS,
  formatShortcutCompact,
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
      return {
        ...base,
        ...parsed,
        language:
          parsed.language && parsed.language in TRANSLATIONS
            ? parsed.language
            : 'zh-CN',
      };
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
  const [statusKey, setStatusKey] = useState<
    | 'statusReady'
    | 'statusCopyUpdated'
    | 'statusTerminalUpdated'
    | 'statusAutostartEnabled'
    | 'statusAutostartDisabled'
    | 'statusResetDone'
    | 'statusMinimized'
  >('statusReady');
  const [isMinimizedToTray, setIsMinimizedToTray] = useState(false);
  const [trayMenuOpen, setTrayMenuOpen] = useState(true);
  const [trayRunning, setTrayRunning] = useState(true);

  const t = TRANSLATIONS[config.language] ?? TRANSLATIONS['zh-CN'];

  useEffect(() => {
    document.documentElement.lang = config.language;
  }, [config.language]);

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
    (
      updater: (prev: KeySpriteConfig) => KeySpriteConfig,
      nextStatus?: typeof statusKey
    ) => {
      setConfig((prev) => {
        const next = updater(prev);
        if (isNativeDesktop) {
          void saveDesktopConfig(next).catch(() => {
            // Keep UI responsive
          });
        }
        return next;
      });
      if (nextStatus) {
        setStatusKey(nextStatus);
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
      'statusReady'
    );
  };

  const handleLanguageChange = (nextLang: LanguageCode) => {
    updateConfig((prev) => ({ ...prev, language: nextLang }));
  };

  const handleToggleAutostart = () => {
    const nextAutostart = !config.autostart;
    updateConfig(
      (prev) => ({ ...prev, autostart: nextAutostart }),
      nextAutostart ? 'statusAutostartEnabled' : 'statusAutostartDisabled'
    );
  };

  const handleMinimizeToTray = () => {
    if (isNativeDesktop) {
      void hideWindowToTray();
      return;
    }
    setIsMinimizedToTray(true);
    setTrayMenuOpen(true);
    setTrayRunning(true);
    setStatusKey('statusMinimized');
  };

  const handleResetDefaults = () => {
    if (isNativeDesktop) {
      void resetDesktopConfig(config.targetOS)
        .then((resetCfg) => {
          if (resetCfg) setConfig(resetCfg);
          setStatusKey('statusResetDone');
        })
        .catch(() => {
          // Keep current state
        });
      return;
    }

    setConfig((prev) => ({
      ...getDefaultConfigForOS(prev.targetOS),
      language: prev.language,
      autostart: prev.autostart,
    }));
    setStatusKey('statusResetDone');
  };

  const defaults = getDefaultShortcutsForOS(config.targetOS);
  const isModified =
    config.copyPathShortcut !== defaults.copyPathShortcut ||
    config.openTerminalShortcut !== defaults.openTerminalShortcut;

  const copyCompact = formatShortcutCompact(config.copyPathShortcut, config.targetOS);
  const termCompact = formatShortcutCompact(config.openTerminalShortcut, config.targetOS);

  // Minimized to System Tray view (browser preview of tray resident state)
  if (isMinimizedToTray) {
    const isDarkTray = config.targetOS === 'windows' || config.targetOS === 'linux';
    const trayTitle =
      config.targetOS === 'macos'
        ? t.trayBarTitleMac
        : config.targetOS === 'windows'
        ? t.trayBarTitleWin
        : t.trayBarTitleLinux;

    return (
      <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex items-center justify-center p-6">
        <div className="w-full max-w-[440px] space-y-4">
          <div
            className={`rounded-xl px-4 py-2.5 flex items-center justify-between text-xs border ${
              isDarkTray
                ? 'bg-[#1E293B] text-slate-100 border-slate-700'
                : 'bg-white text-[#0F172A] border-slate-200'
            }`}
          >
            <span className="font-medium opacity-80">{trayTitle}</span>
            <div className="flex items-center gap-3">
              {trayRunning ? (
                <button
                  type="button"
                  onClick={() => setTrayMenuOpen((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                    trayMenuOpen
                      ? isDarkTray
                        ? 'bg-white/15'
                        : 'bg-slate-100'
                      : 'hover:bg-slate-500/10'
                  }`}
                >
                  <KeySpriteTraySvg size={15} />
                  <span className="font-medium">KeySprite</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTrayRunning(true);
                    setTrayMenuOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-md bg-[#00845A] text-white text-xs font-medium cursor-pointer"
                >
                  {t.trayResumeButton}
                </button>
              )}
              <span className="font-mono opacity-75">19:46</span>
            </div>
          </div>

          {trayRunning && trayMenuOpen ? (
            <div className="bg-white border border-slate-200 rounded-xl py-1.5 shadow-sm text-xs select-none">
              <div className="px-4 py-2 text-slate-400 flex items-center justify-between">
                <span>{t.trayCopyItem}</span>
                <span className="font-mono">{copyCompact}</span>
              </div>
              <div className="px-4 py-2 text-slate-400 flex items-center justify-between">
                <span>{t.trayTerminalItem}</span>
                <span className="font-mono">{termCompact}</span>
              </div>

              <div className="my-1 border-t border-slate-100" />

              <button
                type="button"
                onClick={() => {
                  setIsMinimizedToTray(false);
                  setStatusKey('statusReady');
                }}
                className="w-full px-4 py-2 text-left font-medium text-[#0F172A] hover:bg-[#12273D] hover:text-white transition-colors cursor-pointer"
              >
                {t.traySettingsItem}
              </button>

              <button
                type="button"
                onClick={handleToggleAutostart}
                className="w-full px-4 py-2 text-left text-[#0F172A] hover:bg-[#12273D] hover:text-white transition-colors flex items-center justify-between cursor-pointer"
              >
                <span>{t.trayAutostartItem}</span>
                <span className="w-4 flex justify-end">
                  {config.autostart && <Check className="w-3.5 h-3.5 text-[#00845A]" />}
                </span>
              </button>

              <div className="my-1 border-t border-slate-100" />

              <button
                type="button"
                onClick={() => {
                  setTrayRunning(false);
                  setTrayMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 transition-colors flex items-center justify-between cursor-pointer"
              >
                <span>{t.trayQuitItem}</span>
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : !trayRunning ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 text-center space-y-3">
              <p className="text-xs text-slate-600">{t.trayPausedTitle}</p>
              <button
                type="button"
                onClick={() => {
                  setTrayRunning(true);
                  setTrayMenuOpen(true);
                  setIsMinimizedToTray(false);
                }}
                className="px-4 py-2 rounded-lg bg-[#12273D] text-white text-xs font-medium cursor-pointer"
              >
                {t.trayResumeButton}
              </button>
            </div>
          ) : null}

          <p className="text-center text-xs text-slate-500 px-2">{t.trayHint}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex items-center justify-center p-6">
      <div className="w-full max-w-[600px] bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {/* Header */}
        <header className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <KeySpriteAppIcon size={36} />
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight text-[#12273D] truncate">
                {t.appName}
              </h1>
              <p className="text-xs text-slate-500 truncate">{t.appSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* 10-Language Selector (Default: 简体中文) */}
            <label className="relative flex items-center">
              <Globe
                className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute left-2.5"
                aria-hidden="true"
              />
              <select
                aria-label={t.languageLabel}
                value={config.language}
                onChange={(e) => handleLanguageChange(e.target.value as LanguageCode)}
                className="h-8 pl-7 pr-6 rounded-lg border border-slate-200 bg-slate-50 hover:border-slate-300 text-xs font-medium text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00845A] cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeName}
                  </option>
                ))}
              </select>
            </label>

            {!isNativeDesktop && (
              <div
                className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg shrink-0"
                role="tablist"
                aria-label="OS"
              >
                {(['macos', 'windows', 'linux'] as TargetOS[]).map((os) => (
                  <button
                    key={os}
                    type="button"
                    role="tab"
                    aria-selected={config.targetOS === os}
                    onClick={() => handlePlatformChange(os)}
                    className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      config.targetOS === os
                        ? 'bg-white text-[#12273D] shadow-xs'
                        : 'text-slate-600 hover:text-[#0F172A]'
                    }`}
                  >
                    {os === 'macos' ? 'macOS' : os === 'windows' ? 'Win' : 'Linux'}
                  </button>
                ))}
              </div>
            )}

            {/* Minimize to System Tray Button */}
            <button
              type="button"
              onClick={handleMinimizeToTray}
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title={t.minimizeToTray}
            >
              <Minimize2 className="w-3.5 h-3.5 text-[#12273D]" />
              <span>{t.minimizeToTray}</span>
            </button>
          </div>
        </header>

        {/* Core Body: Two Shortcut Settings + System Launch at Startup */}
        <div className="px-6 py-4 divide-y divide-slate-100">
          <ShortcutRecorder
            id="copy-path-shortcut"
            label={t.copyPathLabel}
            description={t.copyPathDesc}
            value={config.copyPathShortcut}
            defaultValue={defaults.copyPathShortcut}
            conflictWith={config.openTerminalShortcut}
            targetOS={config.targetOS}
            pressKeysPrompt={t.pressKeysPrompt}
            clickToRecord={t.clickToRecord}
            escLabel={t.escLabel}
            resetSingleTooltip={t.resetSingleTooltip}
            needModifierError={t.needModifierError}
            conflictError={t.conflictError}
            onChange={(next) =>
              updateConfig(
                (prev) => ({ ...prev, copyPathShortcut: next }),
                'statusCopyUpdated'
              )
            }
          />

          <ShortcutRecorder
            id="open-terminal-shortcut"
            label={t.openTerminalLabel}
            description={t.openTerminalDesc}
            value={config.openTerminalShortcut}
            defaultValue={defaults.openTerminalShortcut}
            conflictWith={config.copyPathShortcut}
            targetOS={config.targetOS}
            pressKeysPrompt={t.pressKeysPrompt}
            clickToRecord={t.clickToRecord}
            escLabel={t.escLabel}
            resetSingleTooltip={t.resetSingleTooltip}
            needModifierError={t.needModifierError}
            conflictError={t.conflictError}
            onChange={(next) =>
              updateConfig(
                (prev) => ({ ...prev, openTerminalShortcut: next }),
                'statusTerminalUpdated'
              )
            }
          />

          {/* Launch at Startup */}
          <div className="py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#0F172A]">
                {t.autostartLabel}
              </div>
              <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                {t.autostartDesc}
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={config.autostart}
              aria-label={t.autostartLabel}
              onClick={handleToggleAutostart}
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
        </div>

        {/* Footer */}
        <footer className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-4">
          <span className="text-xs text-slate-500 truncate">{t[statusKey]}</span>
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
            <span>{t.resetDefaults}</span>
          </button>
        </footer>
      </div>
    </main>
  );
}
