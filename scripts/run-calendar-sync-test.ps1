$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$secretVariableNames = @(
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'CALENDAR_SYNC_WORKER_EMAIL',
  'CALENDAR_SYNC_WORKER_PASSWORD',
  'ICLOUD_CALDAV_USERNAME',
  'ICLOUD_CALDAV_APP_PASSWORD',
  'NEXT_PUBLIC_SITE_URL'
)

try {
  $env:NEXT_PUBLIC_SUPABASE_URL = Read-Host 'Mars Calendar Test Supabase Project URL'
  $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = Read-Host 'Mars Calendar Test publishable key'
  $env:CALENDAR_SYNC_WORKER_EMAIL = Read-Host 'Test calendar worker email'

  $workerPassword = Read-Host 'Test calendar worker password' -AsSecureString
  $workerCredential = [System.Net.NetworkCredential]::new('', $workerPassword)
  $env:CALENDAR_SYNC_WORKER_PASSWORD = $workerCredential.Password

  $env:ICLOUD_CALDAV_USERNAME = Read-Host 'Mars Apple Account email'
  $applePassword = Read-Host 'Mars Calendar Sync app-specific password' -AsSecureString
  $appleCredential = [System.Net.NetworkCredential]::new('', $applePassword)
  $env:ICLOUD_CALDAV_APP_PASSWORD = $appleCredential.Password

  $env:NEXT_PUBLIC_SITE_URL = 'https://www.marslaundromat.com'

  Push-Location $repoRoot
  try {
    npm run calendar:sync-once
    if ($LASTEXITCODE -ne 0) {
      throw "Calendar sync command exited with code $LASTEXITCODE"
    }
  }
  finally {
    Pop-Location
  }
}
finally {
  foreach ($variableName in $secretVariableNames) {
    Remove-Item -LiteralPath "Env:$variableName" -ErrorAction SilentlyContinue
  }
  Remove-Variable workerPassword, workerCredential, applePassword, appleCredential -ErrorAction SilentlyContinue
}
