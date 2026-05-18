import { useId } from 'react';

export default function PathToTechLogo({ size = 34, showWordmark = true, textColor = 'currentColor', wordmark = 'PathToTech', tagline = 'Career Intelligence' }) {
  const logoId = useId().replace(/:/g, '');
  const gradPrimary = `pttGradPrimary-${logoId}`;
  const gradAccent = `pttGradAccent-${logoId}`;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
      <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`${wordmark} logo`}>
        <defs>
          <linearGradient id={gradPrimary} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5f0f1b" />
            <stop offset="55%" stopColor="#8f1d2c" />
            <stop offset="100%" stopColor="#cc5a34" />
          </linearGradient>
          <linearGradient id={gradAccent} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d97b3f" />
            <stop offset="100%" stopColor="#f4c95d" />
          </linearGradient>
        </defs>
        <rect x="3" y="3" width="58" height="58" rx="16" fill="#fff8f3" stroke="#ead8ca" strokeWidth="2" />
        <path d="M18 47V16h18.2c8.8 0 14.6 5 14.6 12.8 0 7.9-5.8 12.9-14.6 12.9H28.4V47" fill="none" stroke={`url(#${gradPrimary})`} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M28.5 31.6h12.8" fill="none" stroke={`url(#${gradAccent})`} strokeWidth="4.8" strokeLinecap="round" />
        <path d="M39.5 42.2 49.2 51.6" fill="none" stroke="#243143" strokeWidth="3.3" strokeLinecap="round" />
        <circle cx="51.7" cy="53" r="3" fill="#243143" />
        <path d="M13.4 53.5c9.8-6 18.8-9 27-9" fill="none" stroke="#edd7c7" strokeWidth="1.7" strokeLinecap="round" opacity="0.95" />
      </svg>
      {showWordmark && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{ fontWeight: 800, fontSize: '1.02rem', color: textColor, letterSpacing: '0.2px' }}>
            {wordmark}
          </span>
          <span style={{ fontSize: '0.58rem', color: textColor, opacity: 0.72, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: '0.18rem' }}>
            {tagline}
          </span>
        </div>
      )}
    </div>
  );
}
