export const TALKO_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <rect width="1000" height="1000" rx="220" fill="#0066ff" />
  <path d="M 370 260 H 630 A 140 140 0 0 1 770 400 V 510 A 140 140 0 0 1 630 650 H 470 L 350 730 V 650 A 120 120 0 0 1 230 530 V 400 A 140 140 0 0 1 370 260 Z" fill="white" />
  <rect x="320" y="345" width="360" height="80" rx="20" fill="#0066ff" />
  <path d="M 425 425 L 390 585 L 490 535 L 540 425 Z" fill="#0066ff" />
  <rect x="545" y="432" width="100" height="46" rx="14" fill="#0066ff" />
</svg>`;
export const TALKO_LOGO_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(TALKO_LOGO_SVG)}`;

export const TALKO_AI_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="talkoBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E3A8A" />
      <stop offset="60%" stop-color="#0F172A" />
      <stop offset="100%" stop-color="#311042" />
    </linearGradient>

    <!-- Metallic/Glossy body color -->
    <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="30%" stop-color="#F1F5F9" />
      <stop offset="100%" stop-color="#CBD5E1" />
    </linearGradient>

    <!-- Visor/Screen Gradient -->
    <linearGradient id="visorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#020617" />
      <stop offset="100%" stop-color="#1E1B4B" />
    </linearGradient>

    <!-- Eyes Cyan Glow -->
    <linearGradient id="cyanGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#22D3EE" />
      <stop offset="100%" stop-color="#0891B2" />
    </linearGradient>

    <!-- Glowing Pink/Orange Headphone Trim -->
    <linearGradient id="trimGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#818CF8" />
      <stop offset="100%" stop-color="#C084FC" />
    </linearGradient>

    <!-- Sleek Neon Drop Shadows -->
    <filter id="neonBlur" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="2" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Base App Icon Card Container -->
  <rect width="100" height="100" rx="22" fill="url(#talkoBg)" />

  <!-- Ambient Light from behind -->
  <circle cx="50" cy="50" r="32" fill="#38BDF8" opacity="0.15" filter="url(#neonBlur)" />

  <!-- Headphones / Ears Connector Band -->
  <path d="M 24 50 C 24 22 76 22 76 50" stroke="url(#bodyGrad)" stroke-width="4.5" fill="none" stroke-linecap="round" filter="url(#softShadow)" />
  <!-- Inside glow of band -->
  <path d="M 26 50 C 26 24 74 24 74 50" stroke="url(#trimGrad)" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.8" />

  <!-- Headphone Cup Left -->
  <rect x="14" y="44" width="8" height="18" rx="4" fill="url(#bodyGrad)" filter="url(#softShadow)" />
  <rect x="19" y="47" width="2" height="12" rx="1" fill="url(#trimGrad)" />

  <!-- Headphone Cup Right -->
  <rect x="78" y="44" width="8" height="18" rx="4" fill="url(#bodyGrad)" filter="url(#softShadow)" />
  <rect x="79" y="47" width="2" height="12" rx="1" fill="url(#trimGrad)" />

  <!-- Main Chassis / Face Shield (Super Rounded Sleek Capsule) -->
  <rect x="22" y="36" width="56" height="42" rx="18" fill="url(#bodyGrad)" filter="url(#softShadow)" />

  <!-- Glossy Glass Visor Screen -->
  <rect x="26" y="41" width="48" height="28" rx="11" fill="url(#visorGrad)" />

  <!-- Inner Cyber Grids/Circuits on Visor -->
  <line x1="30" y1="55" x2="70" y2="55" stroke="#38BDF8" stroke-width="0.3" opacity="0.15" />
  <line x1="50" y1="45" x2="50" y2="65" stroke="#38BDF8" stroke-width="0.3" opacity="0.15" />

  <!-- Happy Expressive Glowing Cyber Eyes -->
  <path d="M 34 54 Q 40 48 44 54" stroke="url(#cyanGlow)" stroke-width="3" stroke-linecap="round" fill="none" filter="url(#neonBlur)" />
  <path d="M 56 54 Q 60 48 66 54" stroke="url(#cyanGlow)" stroke-width="3" stroke-linecap="round" fill="none" filter="url(#neonBlur)" />

  <!-- Blushing Cheek Lights -->
  <circle cx="32" cy="62" r="2.5" fill="#F43F5E" opacity="0.3" filter="url(#neonBlur)" />
  <circle cx="68" cy="62" r="2.5" fill="#F43F5E" opacity="0.3" filter="url(#neonBlur)" />

  <!-- Super Friendly Glowing Smile -->
  <path d="M 45 61 Q 50 65 55 61" stroke="url(#cyanGlow)" stroke-width="2.2" stroke-linecap="round" fill="none" filter="url(#neonBlur)" />

  <!-- Glass reflection/glossy overlay on visor -->
  <path d="M 28 43 L 72 43 C 62 48 38 48 28 43 Z" fill="#FFFFFF" opacity="0.12" />

  <!-- Small details: Status light on helmet -->
  <circle cx="50" cy="33" r="1.5" fill="#10B981" filter="url(#neonBlur)" />

  <!-- Cute Little Top Antenna -->
  <line x1="50" y1="31" x2="50" y2="21" stroke="url(#bodyGrad)" stroke-width="2" stroke-linecap="round" />
  <circle cx="50" cy="19" r="3.5" fill="url(#trimGrad)" filter="url(#softShadow)" />
  <circle cx="50" cy="19" r="1.5" fill="#FFFFFF" />
</svg>`;
export const TALKO_AI_LOGO_DATA_URL = `data:image/svg+xml;base64,${btoa(TALKO_AI_SVG)}`;

export const TALKO_VERIFIED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" style="width: 100%; height: 100%; display: block;">
  <path d="M 500 20 L 617.43 138.6 L 782.14 111.67 L 807.43 276.64 L 956.51 351.67 L 880 500 L 956.51 648.33 L 807.43 723.36 L 782.14 888.33 L 617.43 861.4 L 500 980 L 382.57 861.4 L 217.86 888.33 L 192.57 723.36 L 43.49 648.33 L 120 500 L 43.49 351.67 L 192.57 276.64 L 217.86 111.67 L 382.57 138.6 Z" fill="#0866FF" />
  <path d="M 320 520 L 440 640 L 720 360" stroke="#FFFFFF" stroke-width="80" stroke-linecap="round" stroke-linejoin="round" fill="none" />
</svg>`;
export const TALKO_VERIFIED_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(TALKO_VERIFIED_SVG)}`;
