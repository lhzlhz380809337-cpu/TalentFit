$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'build.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
& (Join-Path $projectRoot 'python/python.exe') -B (Join-Path $projectRoot 'scripts/package.py')
if ($LASTEXITCODE -ne 0) { throw 'Packaging failed.' }
