[CmdletBinding()]
param(
    [switch]$PrepareOnly
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$envPath = Join-Path $projectRoot '.env'
$composePath = Join-Path $projectRoot 'compose.yaml'

# Never replace an existing configuration or print its contents.
if (-not (Test-Path -LiteralPath $envPath)) {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $password = -join ($bytes | ForEach-Object { $_.ToString('x2') })
    $template = [IO.File]::ReadAllText((Join-Path $projectRoot '.env.example'))
    $template = $template.Replace('replace-with-a-local-password', $password)
    # CreateNew also protects against another editor creating .env meanwhile.
    $stream = [IO.File]::Open($envPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
    try {
        $encoded = [Text.UTF8Encoding]::new($false).GetBytes($template)
        $stream.Write($encoded, 0, $encoded.Length)
    } finally { $stream.Dispose() }
    Write-Output 'Configuración local creada con contraseña aleatoria; no se muestra en consola.'
}
[void][IO.Directory]::CreateDirectory((Join-Path $projectRoot 'data/processed'))
if ($PrepareOnly) {
    Write-Output 'Archivos locales preparados. No se iniciaron contenedores.'
    return
}

$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$dockerPath = if ($dockerCommand) { $dockerCommand.Source } else { $null }
$installRoots = @(
    (Join-Path $env:ProgramFiles 'Docker/Docker'),
    (Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop')
)
foreach ($registryPath in @(
    'HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall/Docker Desktop',
    'HKLM:/Software/Microsoft/Windows/CurrentVersion/Uninstall/Docker Desktop'
)) {
    $installation = Get-ItemProperty -LiteralPath $registryPath -ErrorAction SilentlyContinue
    if ($installation.InstallLocation) { $installRoots += $installation.InstallLocation }
}
if (-not $dockerPath) {
    foreach ($installRoot in $installRoots) {
        $candidate = Join-Path $installRoot 'resources/bin/docker.exe'
        if (Test-Path -LiteralPath $candidate) { $dockerPath = $candidate; break }
    }
}
if (-not $dockerPath) {
    throw 'Docker Desktop no está instalado. Instálalo con backend WSL 2 y vuelve a ejecutar este script.'
}
# Compose/buildx plugins and docker-credential-desktop must also be discoverable.
$env:PATH = "$(Split-Path $dockerPath);$env:PATH"

function Invoke-ProjectCompose {
    param([string[]]$ComposeArguments)
    & $dockerPath compose --project-directory $projectRoot --env-file $envPath -f $composePath @ComposeArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falló Docker Compose (código $LASTEXITCODE). No se borraron volúmenes."
    }
}

$osType = & $dockerPath info --format '{{.OSType}}' 2>$null
if ($LASTEXITCODE -ne 0 -or -not $osType) {
    $desktopCandidates = @($installRoots | ForEach-Object { Join-Path $_ 'Docker Desktop.exe' })
    $desktopCandidates += [IO.Path]::GetFullPath((Join-Path (Split-Path $dockerPath) '../../Docker Desktop.exe'))
    $desktopPath = $desktopCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($desktopPath) {
        Write-Output 'Iniciando Docker Desktop; esperando el motor Linux...'
        Start-Process -FilePath $desktopPath -WindowStyle Hidden
        $engineDeadline = [DateTime]::UtcNow.AddSeconds(90)
        do {
            Start-Sleep -Seconds 3
            $osType = & $dockerPath info --format '{{.OSType}}' 2>$null
            $engineReady = $LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($osType)
        } while (-not $engineReady -and [DateTime]::UtcNow -lt $engineDeadline)
        if (-not $engineReady) {
            throw 'El motor Docker no pudo iniciar. Revisa Docker Desktop; si WSL acaba de instalarse, reinicia Windows y vuelve a ejecutar este script.'
        }
    } else {
        throw 'El motor Docker no responde y no se encontró Docker Desktop en las rutas estándar.'
    }
}
if ($osType -ne 'linux') { throw 'Este proyecto requiere el motor Linux de Docker Desktop.' }

Invoke-ProjectCompose -ComposeArguments @('config', '--quiet')
Invoke-ProjectCompose -ComposeArguments @('up', '--build', '-d', '--wait', '--wait-timeout', '240')
Invoke-ProjectCompose -ComposeArguments @('ps')

# Check host access as well as Docker healthchecks. Do not print response bodies.
foreach ($url in @('http://localhost:8000/health/ready', 'http://localhost:3000')) {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30
    if ($response.StatusCode -ne 200) { throw "Respuesta inesperada en $url" }
}
Write-Output 'Proyecto disponible: http://localhost:3000 | API: http://localhost:8000/docs'
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'data/processed/explorer.json'))) {
    Write-Output 'Sin snapshot Landsat local: la interfaz mostrará el estado vacío, sin observaciones inventadas.'
}
