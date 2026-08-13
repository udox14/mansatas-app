const { existsSync } = require('node:fs')
const { readFile } = require('node:fs/promises')
const { join, resolve } = require('node:path')
const { spawnSync } = require('node:child_process')

const root = join(__dirname, '..')
const configPath = join(root, 'config', 'mobile-branding.json')

function psString(value) {
  return String(value).replace(/'/g, "''")
}

async function main() {
  if (!existsSync(configPath)) return

  const config = JSON.parse(await readFile(configPath, 'utf8'))
  const icon = resolve(root, config.icon || 'resources/android/icon.png')
  const splash = resolve(root, config.splash || icon)
  const iconBackground = config.iconBackground || config.splashBackground || '#0d4f4a'
  const splashBackground = config.splashBackground || '#0d4f4a'
  const resDir = join(root, 'android', 'app', 'src', 'main', 'res')

  if (!existsSync(icon)) throw new Error(`Icon source not found: ${icon}`)
  if (!existsSync(splash)) throw new Error(`Splash source not found: ${splash}`)

  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function Convert-HexColor([string]$hex) {
  $clean = $hex.TrimStart('#')
  if ($clean.Length -ne 6) { return [System.Drawing.Color]::FromArgb(13, 79, 74) }
  return [System.Drawing.Color]::FromArgb(
    [Convert]::ToInt32($clean.Substring(0, 2), 16),
    [Convert]::ToInt32($clean.Substring(2, 2), 16),
    [Convert]::ToInt32($clean.Substring(4, 2), 16)
  )
}

function Save-ScaledPng([System.Drawing.Image]$source, [string]$path, [int]$width, [int]$height, [System.Drawing.Color]$background, [double]$scale) {
  $bmp = New-Object System.Drawing.Bitmap($width, $height)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear($background)
  $targetSize = [Math]::Min($width, $height) * $scale
  $x = ($width - $targetSize) / 2
  $y = ($height - $targetSize) / 2
  $g.DrawImage($source, [int]$x, [int]$y, [int]$targetSize, [int]$targetSize)
  $g.Dispose()
  $tempPath = "$path.$([Guid]::NewGuid().ToString('N')).tmp.png"
  $bmp.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Move-Item -LiteralPath $tempPath -Destination $path -Force
}

function Save-RoundPng([System.Drawing.Image]$source, [string]$path, [int]$size, [System.Drawing.Color]$background, [double]$scale) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $clip = New-Object System.Drawing.Drawing2D.GraphicsPath
  $clip.AddEllipse(0, 0, $size, $size)
  $brush = New-Object System.Drawing.SolidBrush($background)
  $g.FillEllipse($brush, 0, 0, $size, $size)
  $brush.Dispose()
  $g.SetClip($clip)
  $targetSize = [Math]::Floor($size * $scale)
  $offset = [Math]::Floor(($size - $targetSize) / 2)
  $g.DrawImage($source, $offset, $offset, $targetSize, $targetSize)
  $clip.Dispose()
  $g.Dispose()
  $tempPath = "$path.$([Guid]::NewGuid().ToString('N')).tmp.png"
  $bmp.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Move-Item -LiteralPath $tempPath -Destination $path -Force
}

$resDir = '${psString(resDir)}'
$iconSource = [System.Drawing.Image]::FromFile('${psString(icon)}')
$splashSource = [System.Drawing.Image]::FromFile('${psString(splash)}')
$transparent = [System.Drawing.Color]::Transparent
$iconBg = Convert-HexColor '${psString(iconBackground)}'
$splashBg = Convert-HexColor '${psString(splashBackground)}'

$iconSizes = @{
  'mipmap-mdpi' = 48
  'mipmap-hdpi' = 72
  'mipmap-xhdpi' = 96
  'mipmap-xxhdpi' = 144
  'mipmap-xxxhdpi' = 192
}

foreach ($entry in $iconSizes.GetEnumerator()) {
  $dir = Join-Path $resDir $entry.Key
  New-Item -ItemType Directory -Force $dir | Out-Null
  Save-ScaledPng $iconSource (Join-Path $dir 'ic_launcher.png') $entry.Value $entry.Value $iconBg 1.04
  Save-RoundPng $iconSource (Join-Path $dir 'ic_launcher_round.png') $entry.Value $iconBg 1.04
  Save-ScaledPng $iconSource (Join-Path $dir 'ic_launcher_foreground.png') $entry.Value $entry.Value $transparent 0.82
}

$splashSizes = @{
  'drawable-nodpi' = @(320, 320)
  'drawable-port-mdpi' = @(320, 480)
  'drawable-port-hdpi' = @(480, 720)
  'drawable-port-xhdpi' = @(640, 960)
  'drawable-port-xxhdpi' = @(960, 1440)
  'drawable-port-xxxhdpi' = @(1280, 1920)
  'drawable-land-mdpi' = @(480, 320)
  'drawable-land-hdpi' = @(720, 480)
  'drawable-land-xhdpi' = @(960, 640)
  'drawable-land-xxhdpi' = @(1440, 960)
  'drawable-land-xxxhdpi' = @(1920, 1280)
}

$legacySplash = Join-Path $resDir 'drawable\\splash.png'
if (Test-Path -LiteralPath $legacySplash) {
  Remove-Item -LiteralPath $legacySplash -Force
}

foreach ($entry in $splashSizes.GetEnumerator()) {
  $dir = Join-Path $resDir $entry.Key
  New-Item -ItemType Directory -Force $dir | Out-Null
  Save-ScaledPng $splashSource (Join-Path $dir 'splash.png') $entry.Value[0] $entry.Value[1] $splashBg 0.34
}

$iconSource.Dispose()
$splashSource.Dispose()
Write-Output "Android branding applied"
`

  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    cwd: root,
    stdio: 'inherit',
  })

  if (result.status !== 0) process.exit(result.status || 1)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
