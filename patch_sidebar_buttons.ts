import fs from 'fs';
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');

// Replace the return <button> in renderChatButton
content = content.replace(/<button\n\s*key={chat\.id}/g, '<div\n        role="button"\n        tabIndex={0}\n        key={chat.id}');
// Replace the closing </button> in renderChatButton
content = content.replace(/<\/div>\n\s*<\/button>\n\s*\);\n\s*};\n\s*const renderUserButton/g, '</div>\n      </div>\n    );\n  };\n\n  const renderUserButton');

// Replace the return <button> in renderUserButton
content = content.replace(/<button\n\s*key={user\.uid}/g, '<div\n        role="button"\n        tabIndex={0}\n        key={user.uid}');
// Replace the closing </button> in renderUserButton
content = content.replace(/<\/div>\n\s*<\/button>\n\s*\);\n\s*};\n\s*return \(/g, '</div>\n      </div>\n    );\n  };\n\n  return (');

fs.writeFileSync('src/components/Sidebar.tsx', content);
