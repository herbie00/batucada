param(
  [int]$Port = 4173
)

$pyLauncher = Get-Command py -ErrorAction SilentlyContinue
$pythonExe = $pyLauncher?.Source
$extraArgs = @('-3')

if (-not $pythonExe) {
  $pythonCommand = Get-Command python -ErrorAction SilentlyContinue
  $pythonExe = $pythonCommand?.Source
  $extraArgs = @()
}

if (-not $pythonExe) {
  Write-Error "Python n'est pas installé ou n'est pas dans le PATH."
  exit 1
}

$scriptArgs = $extraArgs + @('-m','http.server',$Port)
Write-Host "Serving $(Get-Location) at http://localhost:$Port/ (Ctrl+C to stop)"
Write-Host "Use e.g. template.html?s=avienda-slow-test to load a song after the server starts."
& $pythonExe @scriptArgs
