const fs = require('fs');
const path = require('path');

const ROOT_DIRS = ['app', 'components', 'lib'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'backup-', 'share-extracted']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if ([...SKIP_DIRS].some(s => entry.name.startsWith(s))) continue;
      walk(path.join(dir, entry.name), out);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const files = [];
for (const d of ROOT_DIRS) if (fs.existsSync(d)) walk(d, files);

const tables = new Set();
const rpcs = new Set();
const buckets = new Set();
const rpcCalls = [];

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  // sb.from('name') or supabase.from('name') or db.from('name')
  for (const m of src.matchAll(/(?:\bsb|\bsupabase|\bdb|\bclient)\.from\(\s*['"]([a-z_][a-z0-9_]*)['"]/gi)) {
    tables.add(m[1]);
  }
  // .rpc('name', { args })  or .rpc('name')
  for (const m of src.matchAll(/\.rpc\(\s*['"]([a-z_][a-z0-9_]*)['"]\s*(?:,\s*(\{[^}]*\}))?/gi)) {
    rpcs.add(m[1]);
    if (m[2]) rpcCalls.push({ fn: m[1], args: m[2].trim(), file: f });
  }
  // .storage.from('bucket')
  for (const m of src.matchAll(/\.storage\.from\(\s*['"]([a-z_][a-z0-9_-]*)['"]/gi)) {
    buckets.add(m[1]);
  }
}

const sortArr = a => [...a].sort();
console.log('=== TABLES ===');
for (const t of sortArr(tables)) console.log('  ' + t);
console.log('\n=== RPC FUNCTIONS ===');
for (const r of sortArr(rpcs)) console.log('  ' + r);
console.log('\n=== STORAGE BUCKETS ===');
for (const b of sortArr(buckets)) console.log('  ' + b);
console.log('\n=== RPC CALL SITES (with args) ===');
for (const c of rpcCalls) console.log(`  ${c.fn}(${c.args})  [${c.file}]`);