const fs = require('fs');
const files = [
  'components/content/EventsTab.tsx',
  'components/content/HeroTab.tsx',
  'components/content/ShowcasesTab.tsx',
  'components/content/SettingsTab.tsx',
  'components/content/ArticlesTab.tsx',
  'components/content/CommitteeTab.tsx',
  'components/member/ArticlesSection.tsx',
  'components/member/CareerSection.tsx',
  'components/member/CpdSection.tsx',
  'components/ArticleEngagement.tsx',
];
for (const f of files) {
  if (!fs.existsSync(f)) { console.log(`MISSING: ${f}`); continue; }
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (/!confirm\(/.test(lines[i])) hits.push({ n: i + 1, t: lines[i].trim() });
  }
  if (hits.length) {
    console.log(`\n=== ${f} ===`);
    for (const h of hits) console.log(`  L${h.n}: ${h.t}`);
  }
}