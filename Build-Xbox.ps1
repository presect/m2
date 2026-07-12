<#
  Build-Xbox.ps1 - Package Maxi Coast Rush as a signed UWP .msix for Xbox Dev Mode.

  Prerequisites (one-time, on any Windows 10/11 PC):
    - Windows 10/11 SDK 10.0.19041 or newer.
      Download: https://developer.microsoft.com/windows/downloads/windows-sdk/
      During install, check "Windows SDK Signing Tools for Desktop Apps".

  Run from this folder:
      Set-ExecutionPolicy -Scope Process Bypass
      .\Build-Xbox.ps1

  Output (in .\dist):
      MaxiCoastRush.msix
      MaxiCoastRush.cer

  Note: makeappx requires the manifest file to be literally named
  AppxManifest.xml inside the content directory. This script stages a clean
  copy of the payload into build\pkg\ and renames Package.appxmanifest ->
  AppxManifest.xml there. Do not rename the source file in the repo.
#>

param([switch]$Keep)

$ErrorActionPreference = 'Stop'
$root  = $PSScriptRoot
$dist  = Join-Path $root 'dist'
$stage = Join-Path $root 'build\pkg'
New-Item -ItemType Directory -Force -Path $dist | Out-Null

# 1. Locate SDK tools
$sdkRoot = "${env:ProgramFiles(x86)}\Windows Kits\10\bin"
if (-not (Test-Path $sdkRoot)) { throw "Windows 10/11 SDK not found. Install it from https://developer.microsoft.com/windows/downloads/windows-sdk/ and rerun." }
$sdkVer  = Get-ChildItem $sdkRoot -Directory | Where-Object { $_.Name -match '^10\.' } |
           Sort-Object Name -Descending | Select-Object -First 1
if (-not $sdkVer) { throw "Windows 10/11 SDK not found. Install it and rerun." }
$tools   = Join-Path $sdkVer.FullName 'x64'
$makeappx = Join-Path $tools 'makeappx.exe'
$signtool = Join-Path $tools 'signtool.exe'
if (-not (Test-Path $makeappx)) { throw "makeappx.exe not found at $makeappx" }
if (-not (Test-Path $signtool)) { throw "signtool.exe not found at $signtool" }

# 2. Self-signed test cert (persisted next to the script)
$pfxPath = Join-Path $root 'MaxiCoastRush.pfx'
$cerPath = Join-Path $root 'MaxiCoastRush.cer'
$pfxPwd  = 'maxi-coast-rush'
if (-not (Test-Path $pfxPath)) {
    Write-Host "Creating self-signed test certificate..."
    $cert = New-SelfSignedCertificate `
        -Type Custom `
        -Subject "CN=EkoAds" `
        -KeyUsage DigitalSignature `
        -FriendlyName "MaxiCoastRush Test Cert" `
        -CertStoreLocation "Cert:\CurrentUser\My" `
        -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3","2.5.29.19={text}")
    $pw = ConvertTo-SecureString -String $pfxPwd -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pw | Out-Null
    Export-Certificate    -Cert $cert -FilePath $cerPath | Out-Null
    Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force
}

# 3. Stage a clean payload folder (only what belongs in the MSIX)
Write-Host "Staging payload -> $stage"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

Copy-Item (Join-Path $root 'default.html')  $stage -Force
Copy-Item (Join-Path $root 'Assets')        $stage -Recurse -Force
Copy-Item (Join-Path $root 'game')          $stage -Recurse -Force
# makeappx requires this exact filename inside the content dir
Copy-Item (Join-Path $root 'Package.appxmanifest') (Join-Path $stage 'AppxManifest.xml') -Force

# 4. Pack -> .msix
$msix = Join-Path $dist 'MaxiCoastRush.msix'
if (Test-Path $msix) { Remove-Item $msix -Force }
Write-Host "Packing MSIX..."
& $makeappx pack /d $stage /p $msix /nv /o | Out-Host
if ($LASTEXITCODE -ne 0) { throw "makeappx failed" }

# 5. Sign
Write-Host "Signing MSIX..."
& $signtool sign /fd SHA256 /a /f $pfxPath /p $pfxPwd $msix | Out-Host
if ($LASTEXITCODE -ne 0) { throw "signtool failed" }

Copy-Item $cerPath (Join-Path $dist 'MaxiCoastRush.cer') -Force

# 6. Cleanup staging (unless -Keep)
if (-not $Keep) {
    Remove-Item (Join-Path $root 'build') -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Done."
Write-Host "  $msix"
Write-Host "  $(Join-Path $dist 'MaxiCoastRush.cer')"
Write-Host ""
Write-Host "Install on Xbox (Dev Mode):"
Write-Host "  1. On Xbox: open Dev Home, note the IP (https://<ip>:11443)."
Write-Host "  2. Easiest: run .\Install-OnXbox.cmd to auto-upload and launch."
Write-Host "  3. Or manual: browse to https://<ip>:11443 -> Add -> upload .msix + .cer -> Start."
