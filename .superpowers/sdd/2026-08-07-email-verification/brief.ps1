param(
  [Parameter(Mandatory=$true)][int]$N,
  [Parameter(Mandatory=$true)][string]$PlanFile = "C:\Users\hrido\Desktop\open-term\docs\superpowers\plans\2026-08-07-email-verification.md",
  [string]$Workspace = "C:\Users\hrido\Desktop\open-term\.superpowers\sdd\2026-08-07-email-verification"
)
$lines = Get-Content -LiteralPath $PlanFile
$start = -1; $end = $lines.Length
for ($i = 0; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -match '^### Task\s+' -and $lines[$i] -notmatch '^### Task\s+0') {
    $m = [regex]::Match($lines[$i], '^### Task\s+(\d+)')
    if ($m.Success) {
      $t = [int]$m.Groups[1].Value
      if ($t -eq $N -and $start -eq -1) { $start = $i }
      elseif ($t -gt $N -and $start -ne -1) { $end = $i; break }
    }
  }
}
if ($start -eq -1) { Write-Error "Task $N not found"; exit 3 }
$out = Join-Path $Workspace "task-$N-brief.md"
($lines[$start..($end-1)] -join "`n") | Set-Content -LiteralPath $out -NoNewline -Encoding utf8
Write-Output "wrote $out ($($end - $start) lines)"
