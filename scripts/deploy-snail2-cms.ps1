param([ValidateSet('deploy', 'rollback', 'verify')][string]$Action = 'deploy')
$ErrorActionPreference = 'Stop'
$taskProjectRoot = Split-Path $PSScriptRoot -Parent
$taskSshHost = 'ssh-snail-2'
$taskRemoteBase = '/var/www/tigapilardewata/cms'
function Invoke-CmsChecked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed (exit $LASTEXITCODE)." }
}
Push-Location $taskProjectRoot
try {
    Invoke-CmsChecked 'ssh' @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', $taskSshHost, "test -x $taskRemoteBase/release.sh")
    if ($Action -eq 'deploy') {
        if (-not $env:SITE_URL -or $env:SITE_URL -notmatch '^https://[^/\s]+/?$') { throw 'Set SITE_URL to the final public HTTPS origin. See docs/ADMIN_BLOG.md.' }
        Invoke-CmsChecked 'npm.cmd' @('run', 'check')
        Invoke-CmsChecked 'npm.cmd' @('run', 'build')
        Invoke-CmsChecked 'npm.cmd' @('run', 'test:cms')
        $taskBuildOrigin = ([uri]$env:SITE_URL).GetLeftPart([System.UriPartial]::Authority)
        [IO.File]::WriteAllText((Join-Path $taskProjectRoot 'dist/cms-build.json'), (@{ origin = $taskBuildOrigin } | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
        $taskReleaseId = (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
        $taskArchive = Join-Path ([IO.Path]::GetTempPath()) "$taskReleaseId-cms.tar.gz"
        try {
            Invoke-CmsChecked 'tar' @('-czf', $taskArchive, 'dist', 'package.json', 'package-lock.json', 'scripts/admin.mjs')
            Invoke-CmsChecked 'scp' @('-O', '-o', 'BatchMode=yes', $taskArchive, "${taskSshHost}:$taskRemoteBase/incoming/$taskReleaseId.tar.gz")
            Invoke-CmsChecked 'ssh' @('-o', 'BatchMode=yes', $taskSshHost, "bash $taskRemoteBase/release.sh deploy $taskReleaseId")
        } finally {
            if (Test-Path -LiteralPath $taskArchive) { Remove-Item -LiteralPath $taskArchive }
        }
    } else {
        Invoke-CmsChecked 'ssh' @('-o', 'BatchMode=yes', $taskSshHost, "bash $taskRemoteBase/release.sh $Action")
    }
} finally { Pop-Location }
