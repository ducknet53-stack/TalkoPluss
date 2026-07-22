const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');
content = content.replace("const { getFirebaseAdmin } = require('./server'); // no, let's just use it inline", "");
fs.writeFileSync('server.ts', content);
