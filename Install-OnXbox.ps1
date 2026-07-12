<#
.SYNOPSIS
  One-click installer: builds (if needed), uploads and installs Maxi Coast Rush
  on an Xbox in Developer Mode via the Windows Device Portal REST API.

.USAGE
  .\Install-OnXbox.ps1 -XboxIP 192.168.1.42 -Username devuser -Password devpass
  .\Install-OnXbox.ps1 -XboxIP 192.168.1.42   # will prompt for credentials

.NOTES
  Xbox must be in Dev Mode with Device Portal enabled (Settings > Remote access).
  Requires Windows 10/11 with PowerShell 5.1+ and the Windows 10 SDK
  (for makeappx.exe / signtool.exe, only if the .msix hasn't been built yet).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)] [string] $XboxIP,
    [string] $Username,
    [string] $Password,
    [string] $MsixPath = "$PSScriptRoot\dist\MaxiCoastRush.msix",
    [string] $CerPath  = "$PSScriptRoot\dist\MaxiCoastRush.cer",
    [switch] $SkipCert,
    [switch] $Rebuild
)

$ErrorActionPreference = 'Stop'
Write-Host "== Maxi Coast Rush - Xbox one-click installer ==" -ForegroundColor Cyan

# 1) Build package if missing (or -Rebuild)
if ($Rebuild -or -not (Test-Path $MsixPath)) {
    Write-Host "[1/5] Building .msix ..." -ForegroundColor Yellow
    & "$PSScriptRoot\Build-Xbox.ps1"
} else {
    Write-Host "[1/5] Using existing package: $MsixPath" -ForegroundColor Green
}
if (-not (Test-Path $MsixPath)) { throw "MSIX not found at $MsixPath" }

# 2) Credentials
if (-not $Username -or -not $Password) {
    $cred = Get-Credential -Message "Xbox Device Portal credentials (set in Dev Home)"
    $Username = $cred.UserName
    $Password = $cred.GetNetworkCredential().Password
}
$basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${Username}:${Password}"))
$base  = "https://${XboxIP}:11443"

# Trust the Xbox self-signed WDP cert for this session
Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TrustAll : ICertificatePolicy {
    public bool CheckValidationResult(ServicePoint sp, X509Certificate c, WebRequest r, int p) { return true; }
}
"@ -ErrorAction SilentlyContinue
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAll
[System.Net.ServicePointManager]::SecurityProtocol  = [System.Net.SecurityProtocolType]::Tls12

$headers = @{ Authorization = "Basic $basic" }

# 3) Ping device
Write-Host "[2/5] Connecting to $base ..." -ForegroundColor Yellow
try {
    $info = Invoke-RestMethod -Uri "$base/api/os/machinename" -Headers $headers -Method GET
    Write-Host "  Connected to '$($info.ComputerName)'" -ForegroundColor Green
} catch { throw "Cannot reach Xbox Device Portal at $base. Check IP, Dev Mode, and credentials.`n$_" }

# 4) Upload + install
$msixName = [IO.Path]::GetFileName($MsixPath)
$cerName  = [IO.Path]::GetFileName($CerPath)
Write-Host "[3/5] Uploading $msixName ..." -ForegroundColor Yellow

$boundary = [Guid]::NewGuid().ToString()
$LF = "`r`n"
$bodyLines = New-Object System.Collections.ArrayList

function Add-FilePart($name, $path) {
    $bytes = [IO.File]::ReadAllBytes($path)
    $enc   = [Text.Encoding]::GetEncoding('iso-8859-1')
    [void]$bodyLines.Add("--$boundary")
    [void]$bodyLines.Add("Content-Disposition: form-data; name=`"$name`"; filename=`"$([IO.Path]::GetFileName($path))`"")
    [void]$bodyLines.Add("Content-Type: application/octet-stream")
    [void]$bodyLines.Add("")
    [void]$bodyLines.Add($enc.GetString($bytes))
}
Add-FilePart $msixName $MsixPath
if (-not $SkipCert -and (Test-Path $CerPath)) { Add-FilePart $cerName $CerPath }
[void]$bodyLines.Add("--$boundary--")
[void]$bodyLines.Add("")

$body = ($bodyLines -join $LF)
$enc  = [Text.Encoding]::GetEncoding('iso-8859-1')
$bodyBytes = $enc.GetBytes($body)

$uploadUri = "$base/api/app/packagemanager/package?package=$msixName"
$response  = Invoke-WebRequest -Uri $uploadUri -Method POST -Headers $headers `
    -ContentType "multipart/form-data; boundary=$boundary" -Body $bodyBytes -UseBasicParsing
if ($response.StatusCode -ge 300) { throw "Upload failed: HTTP $($response.StatusCode)" }
Write-Host "  Upload accepted." -ForegroundColor Green

# 5) Poll install state
Write-Host "[4/5] Installing on Xbox ..." -ForegroundColor Yellow
$deadline = (Get-Date).AddMinutes(5)
do {
    Start-Sleep -Seconds 2
    try {
        $state = Invoke-RestMethod -Uri "$base/api/app/packagemanager/state" -Headers $headers -Method GET
        $code  = $state.Code
        $msg   = $state.CodeText
        Write-Host "  state=$code $msg"
        if ($code -eq 0)      { break }        # Complete
        if ($code -ge 5)      { throw "Install error: $msg" }   # Error codes
    } catch { Write-Host "  (waiting...)" }
} while ((Get-Date) -lt $deadline)

# 6) Launch it
Write-Host "[5/5] Launching game ..." -ForegroundColor Yellow
$apps = Invoke-RestMethod -Uri "$base/api/app/packagemanager/packages" -Headers $headers
$pkg  = $apps.InstalledPackages | Where-Object { $_.Name -match 'MaxiCoastRush' } | Select-Object -First 1
if ($pkg) {
    $appId = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pkg.PackageRelativeId))
    $pkgId = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pkg.PackageFullName))
    Invoke-RestMethod -Uri "$base/api/taskmanager/app?appid=$appId&package=$pkgId" -Headers $headers -Method POST | Out-Null
    Write-Host "  Launched $($pkg.Name) on Xbox." -ForegroundColor Green
} else {
    Write-Warning "Installed, but couldn't find package to auto-launch. Start it from the Xbox home."
}

Write-Host "== Done ==" -ForegroundColor Cyan
