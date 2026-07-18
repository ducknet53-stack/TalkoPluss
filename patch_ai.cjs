const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');
code = code.replace(
  /await updateDoc\(chatRef, \{\s*lastMessage: aiFullText,\s*lastMessageTimestamp: aiNow,\s*updatedAt: aiNow,\s*\[\`unreadCount\.\$\{currentUser\.uid\}\`\]: increment\(1\)\s*\}\);/,
  `const aiUnreadUpdates: Record<string, any> = {};
            liveChat.participants.forEach(p => {
              if (p !== currentUser.uid) {
                aiUnreadUpdates[\`unreadCount.\${p}\`] = increment(1);
              }
            });

            await updateDoc(chatRef, { 
              lastMessage: aiFullText,
              lastMessageTimestamp: aiNow,
              updatedAt: aiNow,
              ...aiUnreadUpdates
            });`
);
fs.writeFileSync('src/components/ChatArea.tsx', code);
