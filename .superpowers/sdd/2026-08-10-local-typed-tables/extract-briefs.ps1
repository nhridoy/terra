$plan = "docs/superpowers/plans/2026-08-10-local-typed-tables.md"
$ws = ".superpowers/sdd/2026-08-10-local-typed-tables"
$content = Get-Content $plan -Raw
for ($i = 0; $i -le 9; $i++) {
    $cur = "T$i"
    $next = "T$($i+1)"
    if ($i -lt 9) {
        $pattern = "(?ms)^### Task ${cur}: .*?(?=^### Task ${next}:)"
    } else {
        $pattern = "(?ms)^### Task ${cur}: .*?(?=^## Plan-level gates)"
    }
    $m = [regex]::Match($content, $pattern)
    if ($m.Success) {
        $brief = $m.Value.TrimEnd()
        $n = $i + 1
        Set-Content -Path "$ws/task-$n-brief.md" -Value $brief -NoNewline
    } else {
        Write-Output "MISSING $cur"
    }
}
Get-ChildItem $ws -Filter "task-*-brief.md" | Select-Object Name, Length