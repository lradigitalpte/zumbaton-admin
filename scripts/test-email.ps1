param(
  [string]$TestEmail
)

Write-Host "Zumbaton SMTP email test (Gmail/Workspace via Nodemailer)" -ForegroundColor Cyan

if (-not $TestEmail) {
  $TestEmail = Read-Host "Enter the email address to send the test email to"
}

$smtpPassword = Read-Host "Enter your SMTP app-specific password (for hello@zumbaton.sg)" 

if ([string]::IsNullOrWhiteSpace($smtpPassword)) {
  throw "SMTP password is required."
}

$env:SMTP_PASSWORD = $smtpPassword
$env:TEST_EMAIL = $TestEmail

$adminDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $adminDir

Write-Host "Sending test email to: $TestEmail" -ForegroundColor Yellow
node scripts/test-smtp.js

