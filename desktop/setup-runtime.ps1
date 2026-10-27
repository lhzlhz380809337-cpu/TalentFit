$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$downloads = Join-Path $projectRoot 'build\downloads'
$runtimeDir = Join-Path $projectRoot 'python'
New-Item -ItemType Directory -Force -Path $downloads, $runtimeDir | Out-Null
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
function Fetch-Verified($Url, $Destination, $Sha256) {
    if (-not (Test-Path -LiteralPath $Destination) -or (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash -ne $Sha256) {
        Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Destination
    }
    if ((Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash -ne $Sha256) { throw "Checksum failed: $Destination" }
}
$embed = Join-Path $downloads 'python-embed.zip'
Fetch-Verified 'https://www.python.org/ftp/python/3.14.10/python-3.14.10-embed-amd64.zip' $embed '90905E64A840557D8C1BC4F5B74DB3D7EE85E3FFB217611CAC1C7813ACEA4159'
Expand-Archive -LiteralPath $embed -DestinationPath $runtimeDir -Force
$wheelName = 'pypdf-6.21.2-py3-none-any.whl'
$wheel = Join-Path $runtimeDir $wheelName
if (-not (Test-Path -LiteralPath $wheel)) {
    $metadata = Invoke-RestMethod 'https://pypi.org/pypi/pypdf/6.21.2/json'
    $wheelUrl = ($metadata.urls | Where-Object { $_.filename -eq $wheelName }).url
    Fetch-Verified $wheelUrl $wheel '1D44D1A3A200F25062ADFF0085B02040E4646431AC2CCAC22E42679E91466084'
}
if ((Get-FileHash -LiteralPath $wheel -Algorithm SHA256).Hash -ne '1D44D1A3A200F25062ADFF0085B02040E4646431AC2CCAC22E42679E91466084') { throw 'pypdf checksum failed.' }
@('python314.zip', '.', '..', '../app', $wheelName) | Set-Content -LiteralPath (Join-Path $runtimeDir 'python314._pth') -Encoding ASCII
& (Join-Path $runtimeDir 'python.exe') -B -c "import sqlite3, ssl, pypdf; print('Portable runtime ready')"
if ($LASTEXITCODE -ne 0) { throw 'Runtime validation failed.' }
