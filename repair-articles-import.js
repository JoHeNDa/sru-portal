const fs = require('fs');
const p = 'components/content/ArticlesTab.tsx';
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);

// Find the broken line (ends with 'from' but no path/quote)
let fixed = false;
for (let i = 0; i < lines.length; i++) {
  if (/from\s*$/.test(lines[i]) && !lines[i].includes("'./")) {
    const indentPart = lines[i];
    // Find the next line that starts with a quote (the path)
    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      if (/^\s*'[^']+';/.test(lines[j])) {
        lines[i] = indentPart.trimEnd() + ' ' + lines[j].trim();
        lines.splice(j, 1);
        fixed = true;
        console.log(`Fixed: merged line ${i + 1} with broken import path`);
        break;
      }
    }
    if (fixed) break;
  }
}

if (!fixed) { console.error('Could not find broken import'); process.exit(1); }
fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log('Written.');