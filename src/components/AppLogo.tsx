import { useState } from 'react';

export const OPTIMIZED_ICON_URL = '/assets/aistudio/app-icon_660d6822.png';
export const ORIGINAL_LOGO_URL = '/assets/aistudio/_______Key_Sprite___-3_37510879.png';

export const TRAY_TEMPLATE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M5 6V18M5 12L12.5 6M8.5 10.2L13.5 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M18 4L19 7L22 8L19 9L18 12L17 9L14 8L17 7L18 4Z" fill="currentColor" />
</svg>`;

interface AppIconProps {
  size?: number;
  className?: string;
}

export function KeySpriteAppIcon({ size = 40, className = '' }: AppIconProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`rounded-[22%] bg-[#0E2439] flex items-center justify-center text-white shrink-0 ${className}`}
        aria-label="KeySprite 图标"
      >
        <svg
          width={Math.round(size * 0.65)}
          height={Math.round(size * 0.65)}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M5 6V18M5 12L12.5 6M8.5 10.2L13.5 18"
            stroke="#FFFFFF"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M18 4L19 7L22 8L19 9L18 12L17 9L14 8L17 7L18 4Z"
            fill="#00C46B"
          />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={OPTIMIZED_ICON_URL}
      alt="KeySprite 应用图标"
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      style={{ width: size, height: size }}
      className={`rounded-[22%] object-cover shrink-0 ${className}`}
    />
  );
}

export function KeySpriteTraySvg({
  size = 18,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="2.75"
        y="2.75"
        width="18.5"
        height="18.5"
        rx="4.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M10.5 7.5L7.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M13 8.5L16.5 12L13 15.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
