import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  TranslationStrings,
  resolveTranslations,
} from '../i18n/translations.ts';
import {
  formatShortcutError,
  parseShortcutError,
  resolveShortcutStatusView,
} from './preferencesStatus.ts';

const requiredKeys = Object.keys(TRANSLATIONS.en) as (keyof TranslationStrings)[];

describe('translations', () => {
  it('covers all 10 languages with every key filled', () => {
    assert.equal(SUPPORTED_LANGUAGES.length, 10);
    for (const { code } of SUPPORTED_LANGUAGES) {
      const table = TRANSLATIONS[code];
      assert.ok(table, `missing locale ${code}`);
      for (const key of requiredKeys) {
        assert.equal(typeof table[key], 'string', `${code}.${key}`);
        assert.ok(table[key].trim().length > 0, `${code}.${key} is empty`);
      }
    }
  });

  it('does not leave Chinese claims in the English table', () => {
    const en = TRANSLATIONS.en;
    for (const key of requiredKeys) {
      assert.equal(/[\u4e00-\u9fff]/.test(en[key]), false, `en.${key} contains CJK`);
    }
    assert.match(en.previewOnlyStatus, /Browser preview/i);
    assert.match(en.pressKeysPrompt, /Press the new shortcut/i);
    assert.equal(en.appSubtitle.includes('default'), false);
  });

  it('falls back to English when a key is empty', () => {
    const resolved = resolveTranslations('en');
    assert.equal(resolved.previewOnlyStatus, TRANSLATIONS.en.previewOnlyStatus);
  });
});

describe('resolveShortcutStatusView', () => {
  it('never reports native registration state in a web preview', () => {
    const view = resolveShortcutStatusView({
      isNativeDesktop: false,
      targetOS: 'macos',
      loading: false,
      copyPathRegistered: true,
      openTerminalRegistered: true,
      fileHashRegistered: true,
      lastError: null,
      accessibility: 'denied',
    });
    assert.equal(view.banner, 'preview');
    assert.equal(view.activation, 'activationMac');
    assert.equal(view.showAccessibilityHint, false);
  });

  it('uses Windows activation copy for Windows', () => {
    const view = resolveShortcutStatusView({
      isNativeDesktop: false,
      targetOS: 'windows',
      loading: true,
      copyPathRegistered: false,
      openTerminalRegistered: false,
      fileHashRegistered: false,
      lastError: null,
      accessibility: 'unknown',
    });
    assert.equal(view.banner, 'preview');
    assert.equal(view.activation, 'activationWin');
  });

  it('shows loading only in the desktop runtime', () => {
    const view = resolveShortcutStatusView({
      isNativeDesktop: true,
      targetOS: 'macos',
      loading: true,
      copyPathRegistered: false,
      openTerminalRegistered: false,
      fileHashRegistered: false,
      lastError: null,
      accessibility: 'denied',
    });
    assert.equal(view.banner, 'loading');
    assert.equal(view.showAccessibilityHint, false);
  });

  it('reports success only when all three shortcuts registered without an error', () => {
    const view = resolveShortcutStatusView({
      isNativeDesktop: true,
      targetOS: 'windows',
      loading: false,
      copyPathRegistered: true,
      openTerminalRegistered: true,
      fileHashRegistered: true,
      lastError: null,
      accessibility: 'unknown',
    });
    assert.equal(view.banner, 'registered');
    assert.equal(view.showAccessibilityHint, false);
  });

  it('surfaces a real registration failure', () => {
    const view = resolveShortcutStatusView({
      isNativeDesktop: true,
      targetOS: 'windows',
      loading: false,
      copyPathRegistered: true,
      openTerminalRegistered: false,
      fileHashRegistered: true,
      lastError: { code: 'register_failed', action: 'openTerminal', message: 'already registered' },
      accessibility: 'unknown',
    });
    assert.equal(view.banner, 'failed');
    assert.equal(view.showAccessibilityHint, false);
  });

  it('surfaces failure when fileHash shortcut is not registered', () => {
    const view = resolveShortcutStatusView({
      isNativeDesktop: true,
      targetOS: 'macos',
      loading: false,
      copyPathRegistered: true,
      openTerminalRegistered: true,
      fileHashRegistered: false,
      lastError: null,
      accessibility: 'unknown',
    });
    assert.equal(view.banner, 'failed');
  });

  it('shows the macOS accessibility hint only when the real check is denied', () => {
    const denied = resolveShortcutStatusView({
      isNativeDesktop: true,
      targetOS: 'macos',
      loading: false,
      copyPathRegistered: false,
      openTerminalRegistered: false,
      fileHashRegistered: false,
      lastError: { code: 'register_failed', message: 'os error' },
      accessibility: 'denied',
    });
    assert.equal(denied.showAccessibilityHint, true);

    const unknown = resolveShortcutStatusView({
      isNativeDesktop: true,
      targetOS: 'macos',
      loading: false,
      copyPathRegistered: false,
      openTerminalRegistered: false,
      fileHashRegistered: false,
      lastError: { code: 'register_failed', message: 'os error' },
      accessibility: 'unknown',
    });
    assert.equal(unknown.showAccessibilityHint, false);
  });
});

describe('formatShortcutError', () => {
  it('uses translated prefixes and keeps the backend message', () => {
    const t = TRANSLATIONS.en;
    assert.equal(
      formatShortcutError(t, { code: 'invalid_format', message: 'bad token' }),
      `${t.errorInvalidFormat}: bad token`
    );
    assert.equal(
      formatShortcutError(t, { code: 'register_failed', message: '' }),
      t.errorRegisterFailed
    );
    assert.equal(formatShortcutError(t, null), null);
  });

  it('parses structured backend JSON and falls back to the raw string', () => {
    const parsed = parseShortcutError(
      '{"code":"unregister_failed","message":"plugin error"}'
    );
    assert.deepEqual(parsed, { code: 'unregister_failed', action: undefined, shortcut: undefined, message: 'plugin error' });
    const raw = parseShortcutError('OS refused the hotkey');
    assert.equal(raw?.code, 'register_failed');
    assert.equal(raw?.message, 'OS refused the hotkey');
  });
});
