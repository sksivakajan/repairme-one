# Signs the given files with your company code-signing certificate, if one is configured.
# Windows 11 "Smart App Control" and SmartScreen only trust programs signed by a trusted certificate authority.
#
#   $env:REPAIRME_SIGN_PFX      path to the .pfx certificate file
#   $env:REPAIRME_SIGN_PASSWORD the certificate password
#   $env:REPAIRME_SIGN_TIMESTAMP (optional) timestamp server, default http://timestamp.digicert.com
#
# Usage: powershell -File sign.ps1 dist\RepairMeDesktop.exe dist\RepairMeSetup.exe
param([Parameter(Mandatory, ValueFromRemainingArguments)][string[]]$Files)
$pfx = $env:REPAIRME_SIGN_PFX
if (-not $pfx -or -not (Test-Path $pfx)) {
  Write-Host 'No signing certificate configured (REPAIRME_SIGN_PFX). Files are NOT signed; Windows may block them on PCs with Smart App Control.'
  exit 0
}
$stamp = if ($env:REPAIRME_SIGN_TIMESTAMP) { $env:REPAIRME_SIGN_TIMESTAMP } else { 'http://timestamp.digicert.com' }
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($pfx, $env:REPAIRME_SIGN_PASSWORD)
foreach ($file in $Files) {
  $result = Set-AuthenticodeSignature -FilePath $file -Certificate $cert -HashAlgorithm SHA256 -TimestampServer $stamp
  if (-not $result.SignerCertificate) { Write-Error "Could not sign $file : $($result.StatusMessage)"; exit 1 }
  Write-Host "Signed $file as $($result.SignerCertificate.Subject)"
}
