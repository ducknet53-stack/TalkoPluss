import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace("currentUser?.email === 'ducknet53@gmail.com'", "currentUser?.email === 'ducknet53@gmail.com' || currentUser?.email === 'gogeta.blue053wow@gmail.com'");
fs.writeFileSync('src/App.tsx', content);
