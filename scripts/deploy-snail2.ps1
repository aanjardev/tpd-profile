param([ValidateSet('deploy', 'rollback', 'verify')][string]$Action = 'deploy')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$sshHost = 'ssh-snail-2'
$remoteBase = '/var/www/tigapilardewata'

# The CMS uses server rendering. Keep the existing npm commands while selecting
# the runtime deployment flow; never upload server code into the static root.
if ((Get-Content -LiteralPath (Join-Path $projectRoot 'astro.config.mjs') -Raw) -match "output:\s*'server'") {
    & (Join-Path $PSScriptRoot 'deploy-snail2-cms.ps1') -Action $Action
    exit $LASTEXITCODE
}

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE)." }
}

Push-Location $projectRoot
try {
    # Fail before building if unattended SSH authentication is unavailable.
    Invoke-Checked 'ssh' @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', $sshHost, 'true')
    if ($Action -eq 'deploy') {
        Invoke-Checked 'npm.cmd' @('run', 'build')
        Invoke-Checked 'npm.cmd' @('run', 'test:i18n')
        $releaseId = (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
        $archive = Join-Path ([IO.Path]::GetTempPath()) "$releaseId.tar.gz"
        try {
            Invoke-Checked 'tar' @('-czf', $archive, '-C', 'dist', '.')
            Invoke-Checked 'scp' @('-O', '-o', 'BatchMode=yes', $archive, "${sshHost}:$remoteBase/incoming/$releaseId.tar.gz")
            Invoke-Checked 'ssh' @('-o', 'BatchMode=yes', $sshHost, "bash $remoteBase/release.sh deploy $releaseId")
        } finally {
            if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive }
        }
    } else {
        Invoke-Checked 'ssh' @('-o', 'BatchMode=yes', $sshHost, "bash $remoteBase/release.sh $Action")
    }
} finally {
    Pop-Location
}
