import { useCallback, useEffect, useState } from 'react';
import { Check, Power, RotateCcw } from 'lucide-react';
import { KeySpriteAppIcon, KeySpriteTraySvg } from './components/AppLogo';
import { LanguageSelect } from './components/LanguageSelect';
import { ShortcutRecorder } from './components/ShortcutRecorder';
import { TRANSLATIONS, resolveTranslations } from './i18n/translations';
import {
  checkMacAccessibility,
  fetchDesktopConfig,
  fetchShortcutRegistration,
  isTauriDesktopRuntime,
  openMacAccessibilitySettings,
  resetDesktopConfig,
  saveDesktopConfig,
} from './services/tauriBridge';
import { KeySpriteConfig, LanguageCode, TargetOS } from './types/keysprite';
import {
  AccessibilityState,
  ShortcutErrorPayload,
  ShortcutRegistrationStatus,
  formatShortcutError,
  resolveShortcutStatusView,
} from './utils/preferencesStatus';
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

function lastErrorFromRegistration(
  status: ShortcutRegistrationStatus | null
): ShortcutErrorPayload | null {
  if (!status) return null;
  return status.copyPath.error ?? status.openTerminal.error ?? null;
}

export default function App() {
  const isNativeDesktop = isTauriDesktopRuntime();
  const [config, setConfig] = useState<KeySpriteConfig>(detectInitialConfig);
  const [statusKey, setStatusKey] = useState<
    | 'statusCopyUpdated'
    | 'statusTerminalUpdated'
    | 'statusAutostartEnabled'
    | 'statusAutostartDisabled'
    | 'statusResetDone'
    | 'statusMinimized'
    | null
  >(null);
  const [isMinimizedToTray, setIsMinimizedToTray] = useState(false);
  const [trayMenuOpen, setTrayMenuOpen] = useState(true);
  const [trayRunning, setTrayRunning] = useState(true);
  const [registration, setRegistration] = useState<ShortcutRegistrationStatus | null>(null);
  const [registrationLoading, setRegistrationLoading] = useState(isNativeDesktop);
  const [registrationError, setRegistrationError] = useState<ShortcutErrorPayload | null>(null);
  const [accessibility, setAccessibility] = useState<AccessibilityState>('unknown');
  const [shortcutFieldError, setShortcutFieldError] = useState<{
    field: 'copyPathShortcut' | 'openTerminalShortcut';
    message: string;
  } | null>(null);

  const t = resolveTranslations(config.language);

  useEffect(() => {
    document.documentElement.lang = config.language;
  }, [config.language]);

  const applyRegistration = useCallback((status: ShortcutRegistrationStatus | null) => {
    setRegistration(status);
    setRegistrationError(lastErrorFromRegistration(status));
  }, []);

  useEffect(() => {
    if (!isNativeDesktop) {
      setRegistrationLoading(false);
      setAccessibility('unknown');
      return;
    }

    let cancelled = false;
    setRegistrationLoading(true);

    const loadDesktopState = async () => {
      let desktopCfg: KeySpriteConfig | null = null;
      try {
        desktopCfg = await fetchDesktopConfig();
        if (cancelled) return;
        if (desktopCfg) setConfig(desktopCfg);
      } catch {
        // Keep local defaults if IPC is unavailable.
      }

      try {
        const status = await fetchShortcutRegistration();
        if (cancelled) return;
        applyRegistration(status);
      } catch (error) {
        if (cancelled) return;
        setRegistration(null);
        setRegistrationError({
          code: 'register_failed',
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (!cancelled) setRegistrationLoading(false);
      }

      try {
        const os =
          desktopCfg?.targetOS ??
          (/mac/i.test(`${navigator.platform} ${navigator.userAgent}`) ? 'macos' : null);
        if (cancelled) return;
        if (os === 'macos') {
          const granted = await checkMacAccessibility();
          if (!cancelled) setAccessibility(granted ? 'granted' : 'denied');
        } else {
          setAccessibility('unknown');
        }
      } catch {
        if (!cancelled) setAccessibility('unknown');
      }
    };

    void loadDesktopState();
    return () => {
      cancelled = true;
    };
  }, [isNativeDesktop, applyRegistration]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Ignore storage quota errors
    }
  }, [config]);

  const persistConfig = useCallback(
    async (next: KeySpriteConfig): Promise<KeySpriteConfig> => {
      if (!isNativeDesktop) return next;
      const saved = await saveDesktopConfig(next);
      try {
        const status = await fetchShortcutRegistration();
        applyRegistration(status);
      } catch {
        // Registration status is still reflected by the save error path.
      }
      if (next.targetOS === 'macos' || config.targetOS === 'macos') {
        try {
          const granted = await checkMacAccessibility();
          setAccessibility(granted ? 'granted' : 'denied');
        } catch {
          setAccessibility('unknown');
        }
      }
      return saved;
    },
    [applyRegistration, config.targetOS, isNativeDesktop]
  );

  const updateConfig = useCallback(
    (
      updater: (prev: KeySpriteConfig) => KeySpriteConfig,
      nextStatus?: typeof statusKey
    ) => {
      setConfig((prev) => {
        const next = updater(prev);
        if (isNativeDesktop) {
          void persistConfig(next).catch(() => {
            // Keep the already applied non-shortcut preference visible.
          });
        }
        return next;
      });
      if (nextStatus) {
        setStatusKey(nextStatus);
      }
    },
    [isNativeDesktop, persistConfig]
  );

  const handleShortcutChange = useCallback(
    async (
      field: 'copyPathShortcut' | 'openTerminalShortcut',
      nextShortcut: string,
      nextStatus: 'statusCopyUpdated' | 'statusTerminalUpdated'
    ) => {
      const previous = config;
      const next = { ...config, [field]: nextShortcut };
      setShortcutFieldError(null);

      if (!isNativeDesktop) {
        setConfig(next);
        setStatusKey(nextStatus);
        return;
      }

      try {
        const saved = await persistConfig(next);
        setConfig(saved);
        setStatusKey(nextStatus);
      } catch (error) {
        const parsed =
          (error as { shortcutError?: ShortcutErrorPayload | null }).shortcutError ??
          registrationError;
        const message = formatShortcutError(t, parsed) ?? t.statusRegisterFailed;
        setShortcutFieldError({ field, message });
        setRegistrationError(parsed);
        setConfig(previous);
        setStatusKey(null);
      }
    },
    [config, isNativeDesktop, persistConfig, registrationError, t]
  );

  const handlePlatformChange = (nextOS: TargetOS) => {
    const nextDefaults = getDefaultShortcutsForOS(nextOS);
    updateConfig((prev) => ({
      ...prev,
      targetOS: nextOS,
      copyPathShortcut: nextDefaults.copyPathShortcut,
      openTerminalShortcut: nextDefaults.openTerminalShortcut,
    }));
    setStatusKey(null);
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

  const handleResetDefaults = () => {
    if (isNativeDesktop) {
      void resetDesktopConfig(config.targetOS)
        .then(async (resetCfg) => {
          if (resetCfg) setConfig(resetCfg);
          try {
            applyRegistration(await fetchShortcutRegistration());
          } catch {
            // Keep previous registration snapshot
          }
          setShortcutFieldError(null);
          setStatusKey('statusResetDone');
        })
        .catch((error) => {
          const parsed =
            (error as { shortcutError?: ShortcutErrorPayload | null }).shortcutError ?? null;
          setRegistrationError(parsed);
          setShortcutFieldError({
            field: 'copyPathShortcut',
            message: formatShortcutError(t, parsed) ?? t.statusRegisterFailed,
          });
        });
      return;
    }

    setConfig((prev) => ({
      ...getDefaultConfigForOS(prev.targetOS),
      language: prev.language,
      autostart: prev.autostart,
    }));
    setShortcutFieldError(null);
    setStatusKey('statusResetDone');
  };

  const defaults = getDefaultShortcutsForOS(config.targetOS);
  const isModified =
    config.copyPathShortcut !== defaults.copyPathShortcut ||
    config.openTerminalShortcut !== defaults.openTerminalShortcut;

  // Overlay titlebar inset + drag region only on the real macOS Tauri window.
  const isMacNative =
    isNativeDesktop &&
    (config.targetOS === 'macos' ||
      (typeof navigator !== 'undefined' &&
        /mac/i.test(`${navigator.platform} ${navigator.userAgent}`)));

  const copyCompact = formatShortcutCompact(config.copyPathShortcut, config.targetOS);
  const termCompact = formatShortcutCompact(config.openTerminalShortcut, config.targetOS);

  const statusView = resolveShortcutStatusView({
    isNativeDesktop,
    targetOS: config.targetOS,
    loading: registrationLoading,
    copyPathRegistered: registration?.copyPath.registered ?? false,
    openTerminalRegistered: registration?.openTerminal.registered ?? false,
    lastError: registrationError,
    accessibility,
  });

  const bannerText =
    statusView.banner === 'preview'
      ? t.previewOnlyStatus
      : statusView.banner === 'loading'
        ? t.statusLoading
        : statusView.banner === 'registered'
          ? t.statusRegistered
          : formatShortcutError(t, registrationError) ?? t.statusRegisterFailed;

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
                  setStatusKey(null);
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
    <main
      className={`min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col overflow-x-hidden relative ${
        isMacNative ? 'pt-8' : ''
      }`}
    >
      {isMacNative && (
        <div
          data-tauri-drag-region
          className="absolute inset-x-0 top-0 h-8 z-20"
          aria-hidden="true"
        />
      )}

      <header className="px-4 pt-3 pb-2 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <KeySpriteAppIcon size={28} />
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-[#12273D] leading-snug break-words">
              {t.appName}
            </h1>
            <p className="text-xs text-slate-500 leading-snug break-words">{t.appSubtitle}</p>
          </div>
        </div>

        {!isNativeDesktop && (
          <div
            className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-md shrink-0"
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
                className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00845A] ${
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
      </header>

      <div className="flex-1 px-4 pb-3 overflow-y-auto overflow-x-hidden">
        <ShortcutRecorder
          id="copy-path-shortcut"
          label={t.copyPathLabel}
          description={t.copyPathDesc}
          value={config.copyPathShortcut}
          defaultValue={defaults.copyPathShortcut}
          conflictWith={config.openTerminalShortcut}
          targetOS={config.targetOS}
          pressKeysPrompt={t.pressKeysPrompt}
          cancelRecordingHint={t.cancelRecordingHint}
          recordShortcutAria={t.recordShortcutAria}
          resetSingleTooltip={t.resetSingleTooltip}
          needModifierError={t.needModifierError}
          conflictError={t.conflictError}
          externalError={
            shortcutFieldError?.field === 'copyPathShortcut' ? shortcutFieldError.message : null
          }
          onChange={(next) => handleShortcutChange('copyPathShortcut', next, 'statusCopyUpdated')}
        />

        <div className="border-t border-slate-200">
          <ShortcutRecorder
            id="open-terminal-shortcut"
            label={t.openTerminalLabel}
            description={t.openTerminalDesc}
            value={config.openTerminalShortcut}
            defaultValue={defaults.openTerminalShortcut}
            conflictWith={config.copyPathShortcut}
            targetOS={config.targetOS}
            pressKeysPrompt={t.pressKeysPrompt}
            cancelRecordingHint={t.cancelRecordingHint}
            recordShortcutAria={t.recordShortcutAria}
            resetSingleTooltip={t.resetSingleTooltip}
            needModifierError={t.needModifierError}
            conflictError={t.conflictError}
            externalError={
              shortcutFieldError?.field === 'openTerminalShortcut'
                ? shortcutFieldError.message
                : null
            }
            onChange={(next) =>
              handleShortcutChange('openTerminalShortcut', next, 'statusTerminalUpdated')
            }
          />
        </div>

        <section className="border-t border-slate-200 pt-2.5 pb-1 space-y-1.5" aria-live="polite">
          <p
            className={`text-xs leading-relaxed break-words ${
              statusView.banner === 'failed' ? 'text-red-600 font-medium' : 'text-slate-600'
            }`}
          >
            {bannerText}
          </p>
          <p className="text-xs text-slate-500 leading-relaxed break-words">
            {t[statusView.activation]}
          </p>
          {statusView.showAccessibilityHint && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-amber-700 leading-relaxed break-words min-w-0 flex-1">
                {t.macAccessibilityHint}
              </p>
              <button
                type="button"
                onClick={() => {
                  void openMacAccessibilitySettings().catch(() => {
                    // The button is only shown when the real macOS check exists.
                  });
                }}
                className="px-2 py-1 rounded-md border border-amber-200 bg-white text-xs font-medium text-amber-800 hover:bg-amber-50 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00845A]"
              >
                {t.openAccessibilitySettings}
              </button>
            </div>
          )}
          {statusKey && (
            <p className="text-xs text-slate-500 leading-relaxed break-words">{t[statusKey]}</p>
          )}
        </section>

        <div className="border-t border-slate-200 py-2.5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#0F172A] leading-snug break-words">
              {t.autostartLabel}
            </div>
            <p className="mt-0.5 text-xs text-slate-500 leading-relaxed break-words">
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

      <footer className="px-4 py-2.5 border-t border-slate-200 flex items-center justify-between gap-3">
        <LanguageSelect
          id="keysprite-language"
          label={t.languageLabel}
          value={config.language}
          onChange={handleLanguageChange}
        />
        <button
          type="button"
          onClick={handleResetDefaults}
          disabled={!isModified}
          className={`px-3 py-1.5 rounded-md border text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00845A] ${
            isModified
              ? 'border-slate-200 bg-white hover:bg-slate-50 text-[#12273D] cursor-pointer'
              : 'border-slate-200/60 bg-slate-100/60 text-slate-400 cursor-not-allowed'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t.resetDefaults}</span>
        </button>
      </footer>
    </main>
  );
}
