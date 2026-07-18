const fs = require('fs');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" style="width: 100%; height: 100%; display: block;">
  <path d="M 500 20 L 617.43 138.6 L 782.14 111.67 L 807.43 276.64 L 956.51 351.67 L 880 500 L 956.51 648.33 L 807.43 723.36 L 782.14 888.33 L 617.43 861.4 L 500 980 L 382.57 861.4 L 217.86 888.33 L 192.57 723.36 L 43.49 648.33 L 120 500 L 43.49 351.67 L 192.57 276.64 L 217.86 111.67 L 382.57 138.6 Z" fill="#0866FF" />
  <path d="M420 700 L230 510 L300 440 L420 560 L720 260 L790 330 Z" fill="#FFFFFF" />
</svg>`;

let content = fs.readFileSync('src/lib/assets.ts', 'utf8');

content = content.replace(
  /export const TALKO_VERIFIED_SVG = `<svg[\s\S]*?<\/svg>`;/,
  `export const TALKO_VERIFIED_SVG = \`${svg}\`;`
);

fs.writeFileSync('src/lib/assets.ts', content);
