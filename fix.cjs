const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(/if \(currentUser if .*? \!userProfile.isAdmin\) \{/g, "if ((currentUser?.email === 'goku1@gmail.com' || currentUser?.email === 'ducknet53@gmail.com') && userProfile && !userProfile.isAdmin) {");
fs.writeFileSync('src/App.tsx', content);
