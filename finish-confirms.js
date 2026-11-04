const fs = require('fs');
const path = require('path');

const modalLines = [
  '      <ConfirmModal',
  '        open={!!modalState}',
  "        title={modalState?.title ?? ''}",
  "        message={modalState?.message ?? ''}",
  '        confirmLabel={modalState?.confirmLabel}',
  '        cancelLabel={modalState?.cancelLabel}',
  '        tone={modalState?.tone}',
  '        onConfirm={handleConfirm}',
  '        onCancel={handleCancel}',
  '        busy={false}',
  '      />',
];

const hookLine = '  const { confirm, modalState, handleConfirm, handleCancel } = useConfirm();';

function addImports(content) {
  const lines = content.split('\n');
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) lastImportIdx = i;
    else if (lastImportIdx >= 0 && lines[i].trim() !== '') break;
  }
  if (lastImportIdx < 0) throw new Error('No imports found');
  const newImports = [
    "import ConfirmModal from '@/components/ConfirmModal';",
    "import { useConfirm } from '@/lib/use-confirm';",
  ];
  const existing = lines.slice(0, lastImportIdx + 1).join('\n');
  const toAdd = newImports.filter(imp => !existing.includes(imp));
  lines.splice(lastImportIdx + 1, 0, ...toAdd);
  return lines.join('\n');
}

function insertHook(content, funcName) {
  const lines = content.split('\n');
  const marker = `function ${funcName}(`;
  const startIdx = lines.findIndex(l => l.includes(marker));
  if (startIdx < 0) throw new Error(`Function ${funcName} not found`);
  if (lines[startIdx + 1] && lines[startIdx + 1].includes('useConfirm()')) return content;
  let bodyIdx = startIdx;
  for (let i = startIdx; i < Math.min(startIdx + 10, lines.length); i++) {
    if (/\)\s*\{\s*$/.test(lines[i])) { bodyIdx = i; break; }
  }
  lines.splice(bodyIdx + 1, 0, hookLine);
  return lines.join('\n');
}

function replaceConfirm(content, oldTrimmed, newLines, context) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === oldTrimmed) {
      const indent = lines[i].match(/^\s*/)[0];
      const replacement = newLines.map(l => indent + l).join('\n');
      lines[i] = replacement;
      return lines.join('\n');
    }
  }
  throw new Error(`[${context}] not found: ${oldTrimmed.slice(0, 60)}...`);
}

function insertModal(content, funcName, closer) {
  const lines = content.split('\n');
  const startIdx = lines.findIndex(l => l.includes(`function ${funcName}(`));
  if (startIdx < 0) throw new Error(`Function ${funcName} not found`);
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^(export (default )?)?(async )?function /.test(lines[i])) { endIdx = i; break; }
  }
  for (let i = endIdx - 1; i > startIdx; i--) {
    if (lines[i].trim() === closer) {
      const nearEnd = lines.slice(Math.max(0, i - 5), i).join('\n');
      if (nearEnd.includes('<ConfirmModal')) return content;
      lines.splice(i, 0, ...modalLines);
      return lines.join('\n');
    }
  }
  throw new Error(`No '${closer}' found in ${funcName}`);
}

const plan = [
  { path: 'components/content/EventsTab.tsx', funcName: 'EventsTab', closer: '</div>',
    confirms: [{
      old: "if (!confirm('Delete this event?')) return;",
      newLines: ["const ok = await confirm({", "  title: 'Delete event?',", "  message: 'This event will be permanently deleted. This cannot be undone.',", "  confirmLabel: 'Delete',", "  tone: 'danger',", "});", "if (!ok) return;"],
      context: 'EventsTab delete'
    }]
  },
  { path: 'components/content/HeroTab.tsx', funcName: 'HeroTab', closer: '</div>',
    confirms: [{
      old: "if (!confirm('Delete this slide?')) return;",
      newLines: ["const ok = await confirm({", "  title: 'Delete slide?',", "  message: 'This slide will be removed from the homepage. This cannot be undone.',", "  confirmLabel: 'Delete',", "  tone: 'danger',", "});", "if (!ok) return;"],
      context: 'HeroTab delete'
    }]
  },
  { path: 'components/content/ShowcasesTab.tsx', funcName: 'ShowcasesTab', closer: '</div>',
    confirms: [{
      old: "if (!confirm(`Delete showcase ${slot}?`)) return;",
      newLines: ["const ok = await confirm({", "  title: `Delete showcase ${slot}?`,", "  message: 'The image and message for this showcase slot will be removed. This cannot be undone.',", "  confirmLabel: 'Delete',", "  tone: 'danger',", "});", "if (!ok) return;"],
      context: 'ShowcasesTab delete'
    }]
  },
  { path: 'components/content/SettingsTab.tsx', funcName: 'SettingsTab', closer: '</div>',
    confirms: [{
      old: "if (!logo || !confirm('Remove the logo from the site?')) return;",
      newLines: ["if (!logo) return;", "const ok = await confirm({", "  title: 'Remove logo?',", "  message: 'The logo will be removed from the top bar. You can upload a new one at any time.',", "  confirmLabel: 'Remove logo',", "  tone: 'danger',", "});", "if (!ok) return;"],
      context: 'SettingsTab remove logo'
    }]
  },
  { path: 'components/content/ArticlesTab.tsx', funcName: 'ArticlesTab', closer: '</div>',
    confirms: [{
      old: "if (!confirm('Delete this article?')) return;",
      newLines: ["const ok = await confirm({", "  title: 'Delete article?',", "  message: 'This article will be permanently deleted. This cannot be undone.',", "  confirmLabel: 'Delete',", "  tone: 'danger',", "});", "if (!ok) return;"],
      context: 'ArticlesTab delete'
    }]
  },
  { path: 'components/content/CommitteeTab.tsx', funcName: 'CommitteeTab', closer: '</div>',
    confirms: [
      { old: "if (!confirm('Start a new term on ' + newStart + '? The current committee will become the previous committee.')) return;",
        newLines: ["const ok = await confirm({", "  title: 'Start a new committee term?',", "  message: `Start a new term on ${newStart}? The current committee becomes the previous committee.`,", "  confirmLabel: 'Start term',", "  tone: 'neutral',", "});", "if (!ok) return;"],
        context: 'CommitteeTab startTerm' },
      { old: "if (!confirm(`Delete the term ${t.starts_on} to ${t.ends_on ?? 'present'} and its ${list.length} member(s)? This cannot be undone.`)) return;",
        newLines: ["const ok = await confirm({", "  title: 'Delete committee term?',", "  message: `Delete the term ${t.starts_on} to ${t.ends_on ?? 'present'} and its ${list.length} member(s)? This cannot be undone.`,", "  confirmLabel: 'Delete term',", "  tone: 'danger',", "});", "if (!ok) return;"],
        context: 'CommitteeTab deleteTerm' },
      { old: "if (!confirm('Remove ' + m.full_name + ' from the committee?')) return;",
        newLines: ["const ok = await confirm({", "  title: 'Remove committee member?',", "  message: `Remove ${m.full_name} from the committee?`,", "  confirmLabel: 'Remove',", "  tone: 'danger',", "});", "if (!ok) return;"],
        context: 'CommitteeTab remove member' }
    ]
  },
  { path: 'components/member/ArticlesSection.tsx', funcName: 'ArticlesSection', closer: '</section>',
    confirms: [
      { old: "if (editing?.status === 'approved' && !confirm('Saving sends this article for approval again, and it is hidden from visitors until it is approved. Continue?')) return;",
        newLines: ["if (editing?.status === 'approved') {", "  const ok = await confirm({", "    title: 'Resubmit for approval?',", "    message: 'Saving sends this article for approval again, and it is hidden from visitors until it is approved. Continue?',", "    confirmLabel: 'Resubmit',", "    tone: 'neutral',", "  });", "  if (!ok) return;", "}"],
        context: 'ArticlesSection resubmit' },
      { old: "if (!confirm('Delete this article?')) return;",
        newLines: ["const ok = await confirm({", "  title: 'Delete article?',", "  message: 'This article will be permanently deleted. This cannot be undone.',", "  confirmLabel: 'Delete',", "  tone: 'danger',", "});", "if (!ok) return;"],
        context: 'ArticlesSection delete' }
    ]
  },
  { path: 'components/member/CareerSection.tsx', funcName: 'CareerSection', closer: '</section>',
    confirms: [{
      old: "if (!confirm('Delete this entry?')) return;",
      newLines: ["const ok = await confirm({", "  title: 'Delete career entry?',", "  message: 'This entry will be permanently deleted. This cannot be undone.',", "  confirmLabel: 'Delete',", "  tone: 'danger',", "});", "if (!ok) return;"],
      context: 'CareerSection delete'
    }]
  },
  { path: 'components/member/CpdSection.tsx', funcName: 'CpdSection', closer: '</section>',
    confirms: [{
      old: "if (!confirm('Delete this CPD entry?')) return;",
      newLines: ["const ok = await confirm({", "  title: 'Delete CPD entry?',", "  message: 'This entry will be permanently deleted. This cannot be undone.',", "  confirmLabel: 'Delete',", "  tone: 'danger',", "});", "if (!ok) return;"],
      context: 'CpdSection delete'
    }]
  },
  { path: 'components/ArticleEngagement.tsx', funcName: 'ArticleEngagement', closer: '</section>',
    confirms: [{
      old: "if (!confirm(n ? `Delete this comment and its ${n} repl${n === 1 ? 'y' : 'ies'}?` : 'Delete this comment?')) return;",
      newLines: ["const ok = await confirm({", "  title: n ? 'Delete comment and replies?' : 'Delete comment?',", "  message: n", "    ? `This comment has ${n} repl${n === 1 ? 'y' : 'ies'}. Deleting it also deletes ${n === 1 ? 'that reply' : 'all replies'}. This cannot be undone.`", "    : 'Delete this comment? This cannot be undone.',", "  confirmLabel: 'Delete',", "  tone: 'danger',", "});", "if (!ok) return;"],
      context: 'ArticleEngagement delete'
    }]
  }
];

console.log('Verifying patterns in all files...');
const staged = [];
const errors = [];
for (const p of plan) {
  if (!fs.existsSync(p.path)) { errors.push(`${p.path}: file not found`); continue; }
  try {
    let content = fs.readFileSync(p.path, 'utf8');
    content = addImports(content);
    content = insertHook(content, p.funcName);
    for (const c of p.confirms) content = replaceConfirm(content, c.old, c.newLines, c.context);
    content = insertModal(content, p.funcName, p.closer);
    staged.push({ path: p.path, content });
    console.log(`  OK: ${p.path}`);
  } catch (e) {
    errors.push(`${p.path}: ${e.message}`);
  }
}

if (errors.length) {
  console.error('\nERRORS:');
  for (const e of errors) console.error('  ' + e);
  console.error('\nAborting - no files written.');
  process.exit(1);
}

let totalConfirms = 0, totalHooks = 0, totalModals = 0;
for (const s of staged) {
  totalConfirms += (s.content.match(/!confirm\(/g) || []).length;
  totalHooks += (s.content.match(/useConfirm\(\)/g) || []).length;
  totalModals += (s.content.match(/<ConfirmModal/g) || []).length;
}
console.log('\n=== Sanity ===');
console.log(`  remaining !confirm(: ${totalConfirms}  (want 0)`);
console.log(`  useConfirm() calls:  ${totalHooks}  (want 10)`);
console.log(`  <ConfirmModal:       ${totalModals}  (want 10)`);

if (totalConfirms !== 0 || totalHooks !== 10 || totalModals !== 10) {
  console.error('\nSanity check FAILED - no files written.');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = `backup-confirms-${stamp}`;
for (const s of staged) {
  const dst = path.join(backupDir, s.path);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(s.path, dst);
  fs.writeFileSync(s.path, s.content, 'utf8');
}
console.log(`\nBackup: ${backupDir}/`);
console.log(`Files written: ${staged.length}`);
console.log('\nNext: npx tsc --noEmit');