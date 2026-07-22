const fs = require('fs');
const code = fs.readFileSync('src/components/AdminPanel.tsx', 'utf8');
let stack = [];
for (let i = 0; i < code.length; i++) {
  if (code[i] === '{') stack.push(i);
  else if (code[i] === '}') stack.pop();
}
console.log("Unclosed braces at indices:", stack);
if (stack.length > 0) {
  const i = stack[stack.length - 1];
  console.log("Context:", code.substring(i - 50, i + 100));
}
