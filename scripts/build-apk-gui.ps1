# MANSATAS App - GUI APK Builder & Provisioner (Windows Native GUI)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$root = (Resolve-Path "$scriptDir\..").Path

$form = New-Object System.Windows.Forms.Form
$form.Text = "MANSATAS App - APK Provisioner & Builder"
$form.Size = New-Object System.Drawing.Size(740, 580)
$form.StartPosition = "CenterScreen"
$form.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$form.ForeColor = [System.Drawing.Color]::White
$form.FormBorderStyle = "FixedSingle"
$form.MaximizeBox = $false

# Title
$title = New-Object System.Windows.Forms.Label
$title.Text = "MANSATAS APK Builder"
$title.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = [System.Drawing.Color]::FromArgb(52, 211, 153)
$title.Location = New-Object System.Drawing.Point(20, 15)
$title.AutoSize = $true
$form.Controls.Add($title)

# Subtitle
$sub = New-Object System.Windows.Forms.Label
$sub.Text = "Provisioner otomatis untuk build APK Android MANSATAS App (Realtime Log Output)"
$sub.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)
$sub.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$sub.Location = New-Object System.Drawing.Point(22, 46)
$sub.AutoSize = $true
$form.Controls.Add($sub)

# Panel Group 1: Buttons
$panel = New-Object System.Windows.Forms.FlowLayoutPanel
$panel.Location = New-Object System.Drawing.Point(20, 80)
$panel.Size = New-Object System.Drawing.Size(685, 50)
$panel.FlowDirection = [System.Windows.Forms.FlowDirection]::LeftToRight
$panel.WrapContents = $false
$form.Controls.Add($panel)

function CreateButton($text, $bgColor) {
    $btn = New-Object System.Windows.Forms.Button
    $btn.Text = $text
    $btn.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $btn.BackColor = $bgColor
    $btn.ForeColor = [System.Drawing.Color]::White
    $btn.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $btn.FlatAppearance.BorderSize = 0
    $btn.Size = New-Object System.Drawing.Size(160, 38)
    $btn.Margin = New-Object System.Windows.Forms.Padding(0, 0, 10, 0)
    $btn.Cursor = [System.Windows.Forms.Cursors]::Hand
    return $btn
}

$btnBuild = CreateButton "BUILD RELEASE APK" ([System.Drawing.Color]::FromArgb(5, 150, 105))
$btnFolder = CreateButton "BUKA FOLDER APK" ([System.Drawing.Color]::FromArgb(37, 99, 235))
$btnSync = CreateButton "SYNC ASSETS" ([System.Drawing.Color]::FromArgb(217, 119, 6))
$btnStudio = CreateButton "ANDROID STUDIO" ([System.Drawing.Color]::FromArgb(124, 58, 237))

$panel.Controls.Add($btnBuild)
$panel.Controls.Add($btnFolder)
$panel.Controls.Add($btnSync)
$panel.Controls.Add($btnStudio)

# Log Label
$lblLog = New-Object System.Windows.Forms.Label
$lblLog.Text = "Output Log Proses (Realtime Output):"
$lblLog.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$lblLog.ForeColor = [System.Drawing.Color]::FromArgb(226, 232, 240)
$lblLog.Location = New-Object System.Drawing.Point(20, 140)
$lblLog.AutoSize = $true
$form.Controls.Add($lblLog)

# Log Text Box
$txtLog = New-Object System.Windows.Forms.TextBox
$txtLog.Multiline = $true
$txtLog.ScrollBars = [System.Windows.Forms.ScrollBars]::Both
$txtLog.WordWrap = $false
$txtLog.ReadOnly = $true
$txtLog.BackColor = [System.Drawing.Color]::FromArgb(2, 6, 23)
$txtLog.ForeColor = [System.Drawing.Color]::FromArgb(52, 211, 153)
$txtLog.Font = New-Object System.Drawing.Font("Consolas", 8.5)
$txtLog.Location = New-Object System.Drawing.Point(20, 162)
$txtLog.Size = New-Object System.Drawing.Size(685, 350)
$txtLog.Text = "Siap untuk build APK. Klik tombol di atas.`r`n"
$form.Controls.Add($txtLog)

# Helper log function
function Append-Log($msg) {
    if ([string]::IsNullOrWhiteSpace($msg)) { return }
    $txtLog.AppendText("$msg`r`n")
    $txtLog.SelectionStart = $txtLog.Text.Length
    $txtLog.ScrollToCaret()
}

function Set-ButtonsEnabled($enable) {
    $btnBuild.Enabled = $enable
    $btnFolder.Enabled = $enable
    $btnSync.Enabled = $enable
    $btnStudio.Enabled = $enable
}

# Function to run command and stream live output to GUI log window
function Run-CommandStream($cmdStr) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cmd.exe"
    $psi.Arguments = "/c cd /d `"$root`" & $cmdStr"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi

    $outAction = {
        param($sender, $e)
        if ($e.Data) {
            $txtLog.Invoke([Action[string]]{ param($line) Append-Log $line }, $e.Data)
        }
    }

    $process.add_OutputDataReceived($outAction)
    $process.add_ErrorDataReceived($outAction)

    $process.Start() | Out-Null
    $process.BeginOutputReadLine()
    $process.BeginErrorReadLine()

    while (-not $process.HasExited) {
        [System.Windows.Forms.Application]::DoEvents()
        Start-Sleep -Milliseconds 50
    }

    return $process.ExitCode
}

# Button Click Actions
$btnBuild.Add_Click({
    Set-ButtonsEnabled $false
    Append-Log "========================================="
    Append-Log "[START] Memulai proses Build Release APK..."
    Append-Log "========================================="
    
    $exitCode = Run-CommandStream "npm run android:build:release"
    
    if ($exitCode -eq 0) {
        Append-Log "========================================="
        Append-Log "[SUCCESS] BUILD RELEASE APK BERHASIL!"
        $apkPath = "$root\android\app\build\outputs\apk\release"
        Append-Log "Lokasi File APK: $apkPath"
        Append-Log "========================================="
        [System.Windows.Forms.MessageBox]::Show("Build APK Berhasil!`r`n`r`nFile tersimpan di:`r`n$apkPath", "MANSATAS APK Builder", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
    } else {
        Append-Log "[ERROR] Process exit code: $exitCode"
        [System.Windows.Forms.MessageBox]::Show("Gagal melakukan build APK. Periksa log di atas.", "Build Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
    Set-ButtonsEnabled $true
})

$btnFolder.Add_Click({
    $apkDir = "$root\android\app\build\outputs\apk\release"
    if (-not (Test-Path $apkDir)) {
        $apkDir = "$root\android\app\build\outputs\apk"
    }
    if (-not (Test-Path $apkDir)) {
        New-Item -ItemType Directory -Path $apkDir -Force | Out-Null
    }
    Start-Process "explorer.exe" -ArgumentList "`"$apkDir`""
    Append-Log "Membuka folder output APK: $apkDir"
})

$btnSync.Add_Click({
    Set-ButtonsEnabled $false
    Append-Log "========================================="
    Append-Log "[START] Menjalankan npm run cap:sync..."
    Append-Log "========================================="
    
    $exitCode = Run-CommandStream "npm run cap:sync"
    
    if ($exitCode -eq 0) {
        Append-Log "[SUCCESS] Capacitor Sync Selesai."
    } else {
        Append-Log "[ERROR] Sync Gagal."
    }
    Set-ButtonsEnabled $true
})

$btnStudio.Add_Click({
    Set-ButtonsEnabled $false
    Append-Log "[PROGRESS] Membuka Android Studio..."
    $cmdArg = "/c cd /d `"$root`" & npm run android:open"
    Start-Process -FilePath "cmd.exe" -ArgumentList $cmdArg -NoNewWindow
    Append-Log "Android Studio sedang diluncurkan..."
    Set-ButtonsEnabled $true
})

[void]$form.ShowDialog()
