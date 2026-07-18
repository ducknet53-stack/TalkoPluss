const fs = require('fs');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%">
  <path d="M11.232 1.348a1.5 1.5 0 0 1 1.536 0l1.968 1.157c.453.266 1 .326 1.493.16l2.19-.739a1.5 1.5 0 0 1 1.916 1.01l.666 2.203c.153.508.536.93 1.042 1.144l2.128.898a1.5 1.5 0 0 1 .843 1.996l-1.026 2.067c-.237.477-.237 1.043 0 1.52l1.026 2.067a1.5 1.5 0 0 1-.843 1.996l-2.128.898c-.506.214-.89.636-1.042 1.144l-.666 2.203a1.5 1.5 0 0 1-1.916 1.01l-2.19-.739c-.493-.166-1.04-.106-1.493.16l-1.968 1.157a1.5 1.5 0 0 1-1.536 0l-1.968-1.157c-.453-.266-1-.326-1.493-.16l-2.19.739a1.5 1.5 0 0 1-1.916-1.01l-.666-2.203c-.153-.508-.536-.93-1.042-1.144l-2.128-.898a1.5 1.5 0 0 1-.843-1.996l1.026-2.067c.237-.477.237-1.043 0-1.52l-1.026-2.067a1.5 1.5 0 0 1 .843-1.996l2.128-.898c.506-.214.89-.636 1.042-1.144l.666-2.203a1.5 1.5 0 0 1 1.916-1.01l2.19.739c.493.166 1.04.106 1.493-.16l1.968-1.157Z" fill="#0866FF"/>
  <path d="M16.5 7.5L10 15.5L7.5 13" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

let content = fs.readFileSync('src/lib/assets.ts', 'utf8');

content = content.replace(
  /export const TALKO_VERIFIED_SVG = `<svg[\s\S]*?<\/svg>`;/,
  `export const TALKO_VERIFIED_SVG = \`${svg}\`;`
);

fs.writeFileSync('src/lib/assets.ts', content);
