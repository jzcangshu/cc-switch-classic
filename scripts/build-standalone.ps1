param(
    [string]$RustToolchain
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$outputName = 'standalone-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
$outputDir = Join-Path $repoRoot "release/$outputName"
$rendererDir = Join-Path $outputDir 'renderer'
$configPath = Join-Path $outputDir 'tauri-build.json'
$savedToolchain = $env:RUSTUP_TOOLCHAIN

# A Windows drive path is parsed as a URL by Tauri and disables asset embedding.
# Vite resolves from src; Tauri resolves from src-tauri. Both have the same parent.
$relativeRendererDir = "../release/$outputName/renderer"

New-Item -ItemType Directory -Path $outputDir | Out-Null
@{
    build = @{
        frontendDist = $relativeRendererDir
        beforeBuildCommand = ''
    }
} | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding utf8

Push-Location $repoRoot
try {
    if ($RustToolchain) {
        $env:RUSTUP_TOOLCHAIN = $RustToolchain
    }

    # A fresh output directory preserves previous builds without deleting files.
    & pnpm exec vite build --outDir $relativeRendererDir --emptyOutDir false
    if ($LASTEXITCODE -ne 0) { throw 'Renderer build failed.' }
    if (-not (Test-Path -LiteralPath (Join-Path $rendererDir 'index.html'))) {
        throw 'Renderer index.html was not generated.'
    }

    & pnpm tauri build --no-bundle --ci --config $configPath
    if ($LASTEXITCODE -ne 0) { throw 'Standalone build failed.' }

    $appPath = Join-Path $outputDir 'cc-switch.exe'
    Copy-Item -LiteralPath (Join-Path $repoRoot 'src-tauri/target/release/cc-switch.exe') -Destination $appPath
    $hash = (Get-FileHash -LiteralPath $appPath -Algorithm SHA256).Hash.ToLowerInvariant()
    Set-Content -LiteralPath (Join-Path $outputDir 'SHA256SUMS.txt') -Value "$hash  cc-switch.exe" -Encoding utf8
    Write-Output "Standalone app: $appPath"
} finally {
    $env:RUSTUP_TOOLCHAIN = $savedToolchain
    Pop-Location
}
