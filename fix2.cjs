const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('grantAdminToGoku = async ()')) {
    lines[i+1] = "      if ((currentUser?.email === 'goku1@gmail.com' || currentUser?.email === 'ducknet53@gmail.com') && userProfile && !userProfile.isAdmin) {";
  }
}
fs.writeFileSync('src/App.tsx', lines.join('\n'));
