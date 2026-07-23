import fs from 'fs';
let content = fs.readFileSync('src/components/VerifiedBadge.tsx', 'utf-8');

if (!content.includes('createPortal')) {
    content = content.replace("import { useState } from 'react';", "import { useState } from 'react';\nimport { createPortal } from 'react-dom';");
    content = content.replace("<AnimatePresence>", "{typeof document !== 'undefined' && createPortal(\n      <AnimatePresence>");
    content = content.replace("</AnimatePresence>", "</AnimatePresence>,\n      document.body\n    )}");
    fs.writeFileSync('src/components/VerifiedBadge.tsx', content);
    console.log('patched');
}
