param(
  [Parameter(Mandatory = $true)]
  [string]$CsvPath,

  [Parameter(Mandatory = $true)]
  [string]$HtmlPath,

  [string]$Title = "Court Legal Chatbot - Intakes"
)

$ErrorActionPreference = "Stop"

$rows = Import-Csv $CsvPath | ForEach-Object -Begin { $i = 0 } -Process {
  $i++
  $_ | Add-Member -NotePropertyName "#" -NotePropertyValue $i -PassThru
}

$generatedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

$head = @"
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: Arial, sans-serif; margin: 18px; color: #111; }
  h1 { font-size: 16px; margin: 0 0 8px 0; }
  .meta { font-size: 11px; color: #444; margin: 0 0 12px 0; }

  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  th, td { border: 1px solid #111; padding: 6px 8px; font-size: 10px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; position: sticky; top: 0; z-index: 2; }

  /* Wrap long strings (emails/urls) instead of overflowing off the page */
  td { overflow-wrap: anywhere; word-break: break-word; }

  tr:nth-child(even) td { background: #fafafa; }

  @page { margin: 12mm; }
</style>
"@


$pre = "<h1>$Title</h1><div class='meta'>Generated: $generatedAt</div>"

$html = $rows | ConvertTo-Html -Head $head -Title $Title -PreContent $pre
Set-Content -Encoding UTF8 $HtmlPath $html

Write-Host "Saved: $HtmlPath"
