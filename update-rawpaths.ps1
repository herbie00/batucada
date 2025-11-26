# update-rawpaths.ps1
# Scans the media/ folder and updates the rawPaths array in tous-les-fichiers.html

$mediaPath = ".\media"
$htmlFile = ".\tous-les-fichiers.html"

# Get all files recursively, format paths
$files = Get-ChildItem -Path $mediaPath -Recurse -File |
  Where-Object { $_.Name -notmatch '^\.git' } |
  ForEach-Object { $_.FullName.Replace((Get-Location).Path + '\', '').Replace('\', '/') } |
  Sort-Object

# Build JS array
$lines = $files | ForEach-Object { "      `"$_`"" }
$arrayContent = $lines -join ",`n"

# Read HTML
$html = Get-Content $htmlFile -Raw

# Replace rawPaths array
$pattern = '(?s)(const rawPaths = \[)[^\]]+(\];)'
$replacement = "`$1`n$arrayContent`n    `$2"
$newHtml = $html -replace $pattern, $replacement

# Write back
Set-Content $htmlFile -Value $newHtml -NoNewline

Write-Host "✓ Updated rawPaths with $($files.Count) files" -ForegroundColor Green