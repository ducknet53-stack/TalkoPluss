const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');
content = content.replace("const user = await adminApp.auth().getUserByEmail('goku1@gmail.com');", "const { getAuth } = await import('firebase-admin/auth'); const auth = getAuth(adminApp); const user = await auth.getUserByEmail('goku1@gmail.com');");
fs.writeFileSync('server.ts', content);
