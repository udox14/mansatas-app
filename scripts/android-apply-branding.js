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
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

$resDir = '${psString(resDir)}'
$iconSource = [System.Drawing.Image]::FromFile('${psString(icon)}')
$splashSource = [System.Drawing.Image]::FromFile('${psString(splash)}')
$transparent = [System.Drawing.Color]::Transparent
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
  foreach ($name in @('ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png')) {
    Save-ScaledPng $iconSource (Join-Path $dir $name) $entry.Value $entry.Value $transparent 1
  }
}

$splashSizes = @{
  'drawable' = @(320, 320)
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
