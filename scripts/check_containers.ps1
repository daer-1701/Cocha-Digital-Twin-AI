[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$composePath = Join-Path $PSScriptRoot '..\compose.test.yaml'
$exampleEnvPath = Join-Path $PSScriptRoot '..\.env.example'

function Invoke-TestCompose {
    param([string[]]$ComposeArguments)
    & docker compose --env-file $exampleEnvPath -f $composePath -p cocha-a01-test @ComposeArguments
    if ($LASTEXITCODE -ne 0) {
        throw "Isolated container check failed (exit $LASTEXITCODE)."
    }
}

try {
    Invoke-TestCompose -ComposeArguments @('config', '--quiet')
    # Avoid competing exporters and package installers on development laptops.
    foreach ($service in @('api', 'tests', 'web')) {
        Invoke-TestCompose -ComposeArguments @('build', $service)
    }
    Invoke-TestCompose -ComposeArguments @('up', '-d', '--no-build', '--wait', '--wait-timeout', '240')
    Invoke-TestCompose -ComposeArguments @('run', '--rm', '--no-deps', 'tests', 'python', '-m', 'alembic', 'check')
    Invoke-TestCompose -ComposeArguments @('run', '--rm', '--no-deps', 'tests')
    # Avoid PowerShell/Docker quoting pitfalls by running a module entrypoint.
    Invoke-TestCompose -ComposeArguments @('exec', '-T', 'api', 'python', '-m', 'cocha_api.runtime_guard')
    # This database exists only in the test stack's tmpfs, never in development.
    Invoke-TestCompose -ComposeArguments @('run', '--rm', '--no-deps', 'tests', 'python', '-m', 'alembic', 'downgrade', 'base')
    Invoke-TestCompose -ComposeArguments @('run', '--rm', '--no-deps', 'tests', 'python', '-m', 'alembic', 'upgrade', 'head')
    Invoke-TestCompose -ComposeArguments @('run', '--rm', '--no-deps', 'tests', 'python', '-m', 'alembic', 'check')
    Write-Output 'Isolated Linux stack, tests and migrations passed.'
}
catch {
    & docker compose --env-file $exampleEnvPath -f $composePath -p cocha-a01-test logs --no-color --tail 80
    throw
}
finally {
    & docker compose --env-file $exampleEnvPath -f $composePath -p cocha-a01-test down --remove-orphans
}
