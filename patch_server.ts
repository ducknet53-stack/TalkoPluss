import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');
content = content.replace("const { FieldValue } = require('firebase-admin/firestore');", "const { FieldValue } = await import('firebase-admin/firestore');");
fs.writeFileSync('server.ts', content);
console.log('Patched server.ts');
