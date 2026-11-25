import { useEffect, useRef, useState } from 'react';
import { Keyboard, RotateCcw } from 'lucide-react';
import { TargetOS } from '../types/keysprite';
import {
  buildShortcutFromKeyboardEvent,
  formatShortcutTokens,
} from '../utils/shortcutUtils';

interface ShortcutRecorderProps {
  id: string;
  label: string;
  description: string;
  value: string;
  defaultValue: string;
  conflictWith?: string;
  targetOS: TargetOS;
  pressKeysPrompt?: string;
  cancelRecordingHint?: string;
  recordShortcutAria?: string;
  resetSingleTooltip?: string;
  needModifierError?: string;
  conflictError?: string;
  externalError?: string | null;
  onChange: (nextShortcut: string) => void | Promise<void>;
}

export function ShortcutRecorder({
  id,
  label,
  description,
  value,
  defaultValue,
  conflictWith,
  targetOS,
  pressKeysPrompt = 'Press the new shortcut',
  cancelRecordingHint = 'Esc',
  recordShortcutAria,
  resetSingleTooltip = 'Reset to default shortcut',
  needModifierError = 'Include at least one modifier key (Cmd / Ctrl / Alt / Shift)',
  conflictError = 'This shortcut is already assigned to the other action',
  externalError = null,
  onChange,
}: ShortcutRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === 'Escape') {
        setIsRecording(false);
        setErrorMsg(null);
        return;
      }

      const { shortcut, error } = buildShortcutFromKeyboardEvent(event, needModifierError);
      if (error) {
        setErrorMsg(error);
        return;
      }
      if (!shortcut) {
        return;
      }

      if (conflictWith && shortcut === conflictWith) {
        setErrorMsg(conflictError);
        return;
      }

      setErrorMsg(null);
      setIsRecording(false);
      void Promise.resolve(onChange(shortcut)).catch(() => {
        // Parent reports registration failures via externalError and keeps the previous value.
      });
    };

    const handleBlur = () => {
      setIsRecording(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isRecording, conflictWith, needModifierError, conflictError, onChange]);

  const tokens = formatShortcutTokens(value, targetOS);
  const isModified = value !== defaultValue;
  const visibleError = errorMsg ?? externalError;

  return (
    <div className="py-2.5 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="block text-sm font-semibold text-[#0F172A] leading-snug break-words">
            {label}
          </label>
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed break-words">{description}</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            ref={buttonRef}
            id={id}
            type="button"
            aria-label={recordShortcutAria ? `${recordShortcutAria}: ${label}` : label}
            aria-pressed={isRecording}
            onClick={() => {
              setErrorMsg(null);
              setIsRecording((prev) => !prev);
            }}
            className={`min-w-[7.5rem] max-w-[13rem] min-h-8 px-2.5 py-1 rounded-md border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00845A] ${
              isRecording
                ? 'border-[#00845A] bg-[#00845A]/5 text-[#00845A]'
                : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700'
            }`}
          >
            {isRecording ? (
              <span className="flex items-center gap-1.5 text-left whitespace-normal leading-snug">
                <Keyboard className="w-3.5 h-3.5 shrink-0" />
                <span>{pressKeysPrompt}</span>
              </span>
            ) : (
              <span className="flex flex-wrap items-center justify-center gap-1">
                {tokens.map((token, idx) => (
                  <kbd
                    key={`${token}-${idx}`}
                    className="inline-flex items-center justify-center min-w-[22px] h-5 px-1 rounded border border-slate-200 bg-slate-50 text-[11px] font-mono font-semibold text-[#12273D]"
                  >
                    {token}
                  </kbd>
                ))}
              </span>
            )}
          </button>

          {isModified && (
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setIsRecording(false);
                void Promise.resolve(onChange(defaultValue)).catch(() => {
                  // Parent keeps the previous value if registration fails.
                });
              }}
              title={resetSingleTooltip}
              aria-label={`${resetSingleTooltip} ${label}`}
              className="h-8 w-8 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-[#12273D] flex items-center justify-center transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00845A]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isRecording && (
        <p className="mt-1.5 text-xs text-slate-500" aria-live="polite">
          {cancelRecordingHint}
        </p>
      )}

      {visibleError && (
        <p className="mt-1.5 text-xs text-red-600 font-medium break-words" role="alert">
          {visibleError}
        </p>
      )}
    </div>
  );
}
