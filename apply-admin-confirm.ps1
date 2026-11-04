[CmdletBinding()]
param([switch]$DryRun)
$ErrorActionPreference = 'Stop'
$root = $PWD.Path
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root "backup-adminconfirm-$stamp"
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$file = 'app\admin\page.tsx'
$path = Join-Path $root $file
$original = [System.IO.File]::ReadAllText($path)
$content = $original
$steps = @()

function Apply-Change {
    param([string]$Description, [scriptblock]$Mutator)
    $global:content = & $Mutator $global:content
    $global:steps += $Description
}

# 1. Add imports after the last existing import line at top
Apply-Change 'Add ConfirmModal + useConfirm imports' {
    param($c)
    if ($c -match "from '@/lib/use-confirm'") { return $c }
    # Insert after the ui-sound import (or after the last import)
    $c -replace "(import \{ playUiSound \} from '@/lib/ui-sound';)", "`$1`r`nimport ConfirmModal from '@/components/ConfirmModal';`r`nimport { useConfirm } from '@/lib/use-confirm';"
}

# 2. Insert useConfirm hook in CpdTab (after function line)
Apply-Change 'Insert useConfirm in CpdTab' {
    param($c)
    if ($c -match '(?s)function CpdTab\(\{ sb \}[^{]+\{\s*[^\r\n]*\r?\n\s*const \{ confirm') { return $c }
    $c -replace '(function CpdTab\(\{ sb \}: \{ sb: SB \}\) \{\r?\n)', "`$1  const { confirm, modalState, handleConfirm, handleCancel } = useConfirm();`r`n"
}

# 3. Replace CpdTab deleteEntry confirm
Apply-Change 'Replace CpdTab deleteEntry confirm' {
    param($c)
    $old = 'if (!confirm(`Delete ${row.title} for ${row.member_name}? This cannot be undone.`)) return;'
    $new = @'
const ok = await confirm({
      title: 'Delete CPD record?',
      message: `Delete "${row.title}" for ${row.member_name}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
'@
    $c.Replace($old, $new.Trim())
}

# 4. Insert useConfirm hook in CareerTab
Apply-Change 'Insert useConfirm in CareerTab' {
    param($c)
    $c -replace '(function CareerTab\(\{ sb \}: \{ sb: SB \}\) \{\r?\n)', "`$1  const { confirm, modalState, handleConfirm, handleCancel } = useConfirm();`r`n"
}

# 5. Replace CareerTab deleteEntry confirm
Apply-Change 'Replace CareerTab deleteEntry confirm' {
    param($c)
    $old = 'if (!confirm(`Delete ${row.title} for ${row.members?.[0]?.full_name ?? ''this member''}? This cannot be undone.`)) return;'
    # fallback: match with either quote style
    if ($c.Contains($old)) {
        $new = @'
const ok = await confirm({
      title: 'Delete career record?',
      message: `Delete "${row.title}" for ${row.members?.[0]?.full_name ?? 'this member'}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
'@
        return $c.Replace($old, $new.Trim())
    }
    # try alternate pattern
    $pattern = 'if \(!confirm\(`Delete \$\{row\.title\} for \$\{row\.members\?\.\[0\]\?\.full_name \?\? ''this member''\}\? This cannot be undone\.`\)\) return;'
    return ($c -replace $pattern, @'
const ok = await confirm({
      title: 'Delete career record?',
      message: `Delete "${row.title}" for ${row.members?.[0]?.full_name ?? 'this member'}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
'@.Trim())
}

# 6. Insert useConfirm hook in RolesTab
Apply-Change 'Insert useConfirm in RolesTab' {
    param($c)
    $c -replace '(function RolesTab\(\{ sb, chief \}: \{ sb: SB; chief: boolean \}\) \{\r?\n)', "`$1  const { confirm, modalState, handleConfirm, handleCancel } = useConfirm();`r`n"
}

# 7. Replace RolesTab remove confirm
Apply-Change 'Replace RolesTab remove confirm' {
    param($c)
    $old = "if (!confirm('Remove this person’s staff access?')) return;"
    if (-not $c.Contains($old)) {
        # try straight quote
        $old = "if (!confirm('Remove this person's staff access?')) return;"
    }
    $new = @'
const ok = await confirm({
      title: 'Remove staff access?',
      message: 'Remove this person''s access to the admin workspace? This cannot be undone.',
      confirmLabel: 'Remove access',
      tone: 'danger',
    });
    if (!ok) return;
'@
    return $c.Replace($old, $new.Trim())
}

# 8. Insert useConfirm hook in MembershipTypesTab
Apply-Change 'Insert useConfirm in MembershipTypesTab' {
    param($c)
    $c -replace '(function MembershipTypesTab\(\{ sb \}: \{ sb: SB \}\) \{\r?\n)', "`$1  const { confirm, modalState, handleConfirm, handleCancel } = useConfirm();`r`n"
}

# 9. Replace MembershipTypesTab remove confirm
Apply-Change 'Replace MembershipTypesTab remove confirm' {
    param($c)
    $old = 'if (!confirm(`Delete the unused “${type.code}” membership type? This cannot be undone.`)) return;'
    if (-not $c.Contains($old)) {
        # try straight quotes
        $old = 'if (!confirm(`Delete the unused "${type.code}" membership type? This cannot be undone.`)) return;'
    }
    $new = @'
const ok = await confirm({
      title: 'Delete membership type?',
      message: `Delete the unused "${type.code}" membership type? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
'@
    return $c.Replace($old, $new.Trim())
}

# 10-13. Insert <ConfirmModal /> at end of each tab's JSX
# Pattern: each tab returns (...); where the final `</div>` is followed by `\n  );\n}` at the tab's close.
# We match the closing `  );\n}` of each tab and inject before the `</div>` that precedes it.

function Insert-ModalBeforeClosingDiv {
    param($c, $closeMarker, $modal)
    # $closeMarker is the exact closing sequence (e.g. "  );\n}\n\nfunction CareerTab")
    # Find the last `</div>` before $closeMarker
    $idx = $c.IndexOf($closeMarker)
    if ($idx -lt 0) { throw "Marker not found: $closeMarker" }
    $before = $c.Substring(0, $idx)
    $lastDiv = $before.LastIndexOf('</div>')
    if ($lastDiv -lt 0) { throw "No closing </div> found before marker" }
    return $c.Substring(0, $lastDiv) + $modal + "`r`n    " + $c.Substring($lastDiv)
}

$modalTemplate = @'
<ConfirmModal
        open={!!modalState}
        title={modalState?.title ?? ''}
        message={modalState?.message ?? ''}
        confirmLabel={modalState?.confirmLabel}
        cancelLabel={modalState?.cancelLabel}
        tone={modalState?.tone}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        busy={busy}
      />
'@

Apply-Change 'Insert ConfirmModal in CpdTab' {
    param($c)
    if ($c -match '(?s)function CpdTab.*?<ConfirmModal.*?function CareerTab') { return $c }
    Insert-ModalBeforeClosingDiv $c "`r`n  );`r`n}`r`n`r`nfunction CareerTab" $modalTemplate
}

Apply-Change 'Insert ConfirmModal in CareerTab' {
    param($c)
    if ($c -match '(?s)function CareerTab.*?<ConfirmModal.*?function MembersTab') { return $c }
    Insert-ModalBeforeClosingDiv $c "`r`n  );`r`n}`r`n`r`nfunction MembersTab" $modalTemplate
}

Apply-Change 'Insert ConfirmModal in RolesTab' {
    param($c)
    if ($c -match '(?s)function RolesTab.*?<ConfirmModal.*?function MembershipTypesTab') { return $c }
    Insert-ModalBeforeClosingDiv $c "`r`n  );`r`n}`r`n`r`nfunction MembershipTypesTab" $modalTemplate
}

Apply-Change 'Insert ConfirmModal in MembershipTypesTab' {
    param($c)
    # last function in file
    if ($c -match '(?s)function MembershipTypesTab.*?<ConfirmModal\s') { return $c }
    Insert-ModalBeforeClosingDiv $c "`r`n  );`r`n}`r`n" $modalTemplate
}

Write-Host ""
Write-Host "=== Steps ===" -ForegroundColor Cyan
$steps | ForEach-Object { Write-Host "  - $_" }

Write-Host ""
Write-Host "=== Sanity: any 'confirm(' still present? ===" -ForegroundColor Yellow
$remaining = ($content | Select-String -Pattern '!confirm\(' -AllMatches).Matches.Count
if ($remaining -eq 0) { Write-Host "  None — all four replaced." -ForegroundColor Green }
else { Write-Host "  $remaining still present — one or more replacements failed." -ForegroundColor Red }

if ($DryRun) {
    Write-Host ""
    Write-Host "[DryRun] no changes written." -ForegroundColor DarkYellow
    return
}

$dst = Join-Path $backup $file
New-Item -ItemType Directory -Path (Split-Path $dst -Parent) -Force | Out-Null
Copy-Item $path $dst -Force
[System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding $false))
Write-Host ""
Write-Host "Backup: $dst" -ForegroundColor Cyan
Write-Host "Written: $file" -ForegroundColor Green

Write-Host ""
Write-Host "=== tsc --noEmit ===" -ForegroundColor Yellow
Push-Location $root
$output = npx tsc --noEmit 2>&1
$code = $LASTEXITCODE
$output | Write-Host
if ($code -eq 0) { Write-Host "tsc: PASS" -ForegroundColor Green } else { Write-Host "tsc: FAILED ($code)" -ForegroundColor Red }
Pop-Location