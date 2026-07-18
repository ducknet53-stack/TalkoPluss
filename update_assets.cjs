const fs = require('fs');

const rOuter = 480;
const rInner = 380;
const cx = 500;
const cy = 500;
const points = 10;
let path = "";

for(let i=0; i<points*2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    // to round to 2 decimals
    const x = Math.round((cx + r * Math.cos(angle)) * 100) / 100;
    const y = Math.round((cy + r * Math.sin(angle)) * 100) / 100;
    if(i===0) path += `M ${x} ${y} `;
    else path += `L ${x} ${y} `;
}
path += "Z";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="100%" height="100%">
  <path d="${path}" fill="#0866FF" />
  <path d="M420 680 L250 510 L320 440 L420 540 L730 230 L800 300 Z" fill="#FFFFFF" />
</svg>`;

let content = fs.readFileSync('src/lib/assets.ts', 'utf8');

// Replace the old SVG entirely
content = content.replace(
  /export const TALKO_VERIFIED_SVG = `<svg[\s\S]*?<\/svg>`;/,
  `export const TALKO_VERIFIED_SVG = \`${svg}\`;`
);

fs.writeFileSync('src/lib/assets.ts', content);
