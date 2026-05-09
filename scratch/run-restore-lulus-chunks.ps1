$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$wrangler = Join-Path $root 'node_modules\.bin\wrangler.cmd'
$chunkDir = Join-Path $PSScriptRoot 'restore-lulus-chunks'

if (-not (Test-Path $wrangler)) {
  throw "wrangler tidak ditemukan di $wrangler"
}

$files = Get-ChildItem -Path $chunkDir -Filter 'restore-chunk-*.sql' | Sort-Object Name
if (-not $files.Count) {
  throw "Tidak ada file chunk di $chunkDir"
}

foreach ($file in $files) {
  Write-Host "Menjalankan $($file.Name)..." -ForegroundColor Cyan
  & $wrangler d1 execute mansatas-db --remote --file="$($file.FullName)"
}

Write-Host "Semua chunk selesai dijalankan." -ForegroundColor Green
