param(
  [Parameter(Mandatory = $true)]
  [string]$AdminKey
)

$ErrorActionPreference = "Stop"
$here = $PSScriptRoot

$exportScript = Join-Path $here "export_intakes.ps1"
$htmlScript   = Join-Path $here "csv_to_html.ps1"
$csvPath      = Join-Path $here "intakes.csv"
$htmlPath     = Join-Path $here "intakes.html"

if (-not (Test-Path $exportScript)) { throw "Missing file: $exportScript" }
if (-not (Test-Path $htmlScript))   { throw "Missing file: $htmlScript" }

& $exportScript -AdminKey $AdminKey -OutDir $here
& $htmlScript -CsvPath $csvPath -HtmlPath $htmlPath

Write-Host "Done. Opening HTML report..."
Start-Process $htmlPath
