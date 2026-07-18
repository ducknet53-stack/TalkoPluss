const fs = require('fs');
let content = fs.readFileSync('src/lib/assets.ts', 'utf8');
const newAiSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
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
content = content.replace(/export const TALKO_AI_SVG = `[^`]+`;/, 'export const TALKO_AI_SVG = `' + newAiSvg + '`;');
fs.writeFileSync('src/lib/assets.ts', content);
