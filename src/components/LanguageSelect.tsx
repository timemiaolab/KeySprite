import { SUPPORTED_LANGUAGES } from '../i18n/translations';
import { LanguageCode } from '../types/keysprite';

interface LanguageSelectProps {
  id: string;
  label: string;
  value: LanguageCode;
  onChange: (language: LanguageCode) => void;
}

export function LanguageSelect({ id, label, value, onChange }: LanguageSelectProps) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <label htmlFor={id} className="text-xs text-slate-500 whitespace-nowrap">
        {label}
      </label>
      <div className="relative min-w-0">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value as LanguageCode)}
          className="keysprite-language-select h-8 max-w-[11rem] pl-2 pr-8 rounded-md border border-slate-200 bg-white text-xs font-medium text-[#0F172A] hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00845A] cursor-pointer"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.nativeName}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500"
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
