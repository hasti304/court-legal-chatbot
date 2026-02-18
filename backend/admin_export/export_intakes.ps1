param(
  [Parameter(Mandatory = $true)]
  [string]$AdminKey,

  [string]$BaseUrl = "https://court-legal-chatbot.onrender.com",

  [string]$OutDir = "."
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$csvPath = Join-Path $OutDir "intakes.csv"

Invoke-WebRequest `
  -Uri "$BaseUrl/admin/intakes.csv" `
  -Headers @{ "X-Admin-Key" = $AdminKey } `
  -OutFile $csvPath

Write-Host "Saved: $csvPath"
