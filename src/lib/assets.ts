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
    <linearGradient id="aiBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="100%" stop-color="#7C3AED" />
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#aiBg)" />
  <!-- Robot Head -->
  <rect x="25" y="40" width="50" height="40" rx="8" fill="#FFFFFF" />
  <!-- Helmet/Hat -->
  <path d="M 15 45 C 15 25 85 25 85 45 Z" fill="#FACC15" />
  <rect x="10" y="45" width="80" height="5" rx="2" fill="#EAB308" />
  <!-- Antenna -->
  <rect x="47" y="15" width="6" height="15" fill="#CBD5E1" />
  <circle cx="50" cy="12" r="6" fill="#F87171" />
  <!-- Eyes -->
  <circle cx="40" cy="55" r="5" fill="#1E293B" />
  <circle cx="60" cy="55" r="5" fill="#1E293B" />
  <!-- Mouth -->
  <rect x="35" y="68" width="30" height="4" rx="2" fill="#1E293B" />
</svg>`;
export const TALKO_AI_LOGO_DATA_URL = `data:image/svg+xml;base64,${btoa(TALKO_AI_SVG)}`;

export const TALKO_VERIFIED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" style="width: 100%; height: 100%; display: block;">
  <path d="M 500 20 L 617.43 138.6 L 782.14 111.67 L 807.43 276.64 L 956.51 351.67 L 880 500 L 956.51 648.33 L 807.43 723.36 L 782.14 888.33 L 617.43 861.4 L 500 980 L 382.57 861.4 L 217.86 888.33 L 192.57 723.36 L 43.49 648.33 L 120 500 L 43.49 351.67 L 192.57 276.64 L 217.86 111.67 L 382.57 138.6 Z" fill="#0866FF" />
  <path d="M 320 520 L 440 640 L 720 360" stroke="#FFFFFF" stroke-width="80" stroke-linecap="round" stroke-linejoin="round" fill="none" />
</svg>`;
export const TALKO_VERIFIED_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(TALKO_VERIFIED_SVG)}`;
