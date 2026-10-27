# Manual cleanup only: run from the supplied batch file after development ends.
# This script never deletes app, python, dist, data, logs, .env, or the release ZIP.
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
foreach ($marker in @('app\server.py', 'src\App.tsx', 'package.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $marker))) { throw 'Not a TalentFit source workspace; cleanup stopped.' }
}
$generated = @('node_modules', 'runtime', 'build', 'release\TalentFit-Windows-x64', 'app\__pycache__')
foreach ($relative in $generated) {
    $target = [IO.Path]::GetFullPath((Join-Path $projectRoot $relative))
    if (-not $target.StartsWith($projectRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Target outside workspace.' }
    if (-not (Test-Path -LiteralPath $target)) { continue }
    $resolved = (Resolve-Path -LiteralPath $target).Path
    if ($resolved -ne $target -or ((Get-Item -LiteralPath $target).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Linked target refused: $target" }
    if ($relative -eq 'release\TalentFit-Windows-x64') {
        foreach ($private in @('data', 'logs', '.env')) {
            if (Test-Path -LiteralPath (Join-Path $target $private)) { throw "Old release contains user data; keep it and inspect manually: $target" }
        }
    }
    Write-Host "Removing generated files: $target"
    Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop
}
foreach ($relative in @('api', 'prisma', 'docs', 'src\assets', 'src\hooks')) {
    $target = [IO.Path]::GetFullPath((Join-Path $projectRoot $relative))
    if (-not $target.StartsWith($projectRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Target outside workspace.' }
    if (-not (Test-Path -LiteralPath $target)) { continue }
    if ((Get-Item -LiteralPath $target).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked target refused: $target" }
    if (@(Get-ChildItem -LiteralPath $target -File -Recurse -Force).Count -eq 0) {
        Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop
    }
}
Write-Host 'Cleanup complete. Double-click TalentFit.exe to use the application.'
