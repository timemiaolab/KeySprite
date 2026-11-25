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
  clickToRecord?: string;
  escLabel?: string;
  resetSingleTooltip?: string;
  needModifierError?: string;
  conflictError?: string;
  onChange: (nextShortcut: string) => void;
}

export function ShortcutRecorder({
  id,
  label,
  description,
  value,
  defaultValue,
  conflictWith,
  targetOS,
  pressKeysPrompt = '请按下新组合键…',
  clickToRecord = '点击修改',
  escLabel = 'Esc',
  resetSingleTooltip = '恢复默认快捷键',
  needModifierError = '至少需要包含一个修饰键（Cmd / Ctrl / Alt / Shift）',
  conflictError = '该快捷键已被另一项功能占用，请更换组合键',
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
      onChange(shortcut);
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

  return (
    <div className="py-4 first:pt-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <label htmlFor={id} className="block text-sm font-semibold text-[#0F172A]">
            {label}
          </label>
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            ref={buttonRef}
            id={id}
            type="button"
            onClick={() => {
              setErrorMsg(null);
              setIsRecording((prev) => !prev);
            }}
            className={`min-w-[184px] h-10 px-3 rounded-lg border text-xs font-medium flex items-center justify-between gap-3 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00845A] ${
              isRecording
                ? 'border-[#00845A] bg-[#00845A]/5 text-[#00845A]'
                : 'border-slate-200 bg-slate-50 hover:border-slate-300 text-slate-700'
            }`}
          >
            {isRecording ? (
              <span className="flex items-center gap-2 font-medium">
                <Keyboard className="w-3.5 h-3.5 shrink-0" />
                <span>{pressKeysPrompt}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                {tokens.map((token, idx) => (
                  <kbd
                    key={`${token}-${idx}`}
                    className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded border border-slate-200 bg-white text-[11px] font-mono font-semibold text-[#12273D] shadow-[0_1px_0_0_rgba(15,23,42,0.06)]"
                  >
                    {token}
                  </kbd>
                ))}
              </span>
            )}
            <span className="text-[11px] text-slate-400">
              {isRecording ? escLabel : clickToRecord}
            </span>
          </button>

          {isModified && (
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setIsRecording(false);
                onChange(defaultValue);
              }}
              title={resetSingleTooltip}
              aria-label={`${resetSingleTooltip} ${label}`}
              className="h-10 w-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-[#12273D] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <p className="mt-2 text-xs text-red-600 font-medium" role="alert">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
