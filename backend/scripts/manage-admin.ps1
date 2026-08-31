[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('grant', 'revoke')]
    [string]$Action,

    [Parameter(Mandatory = $true, Position = 1)]
    [ValidateNotNullOrEmpty()]
    [string]$User
)

$ErrorActionPreference = 'Stop'
$backendDirectory = Split-Path -Parent $PSScriptRoot
$newRole = if ($Action -eq 'grant') { 'ADMIN' } else { 'USER' }
$actionLabel = if ($Action -eq 'grant') { '授予管理员权限' } else { '撤销管理员权限' }

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw '未找到 Docker。请先安装并启动 Docker Desktop。'
}

$sql = @'
UPDATE users
SET role = :'new_role',
    session_version = session_version + 1,
    updated_at = NOW()
WHERE (username = :'target'
   OR uid = :'target'
   OR LOWER(email) = LOWER(:'target'))
  AND (:'new_role' = 'ADMIN' OR id <> (SELECT MIN(id) FROM users))
RETURNING uid, username, email, role;
'@

Push-Location $backendDirectory
try {
    $runningServices = @(& docker compose ps --status running --services)
    if ($LASTEXITCODE -ne 0) {
        throw '无法读取 Docker Compose 状态。'
    }
    if ($runningServices -notcontains 'postgres') {
        throw 'PostgreSQL 容器未运行。请先执行 start.bat 或在 backend 目录运行 docker compose up -d。'
    }

    $output = @(
        $sql | & docker compose exec -T postgres psql `
            -U mathsea `
            -d mathsea `
            -v ON_ERROR_STOP=1 `
            -v "target=$User" `
            -v "new_role=$newRole" `
            --quiet `
            --tuples-only `
            --no-align
    )

    if ($LASTEXITCODE -ne 0) {
        throw '数据库权限更新失败。'
    }

    $updatedUser = $output | Where-Object { $_ -match '^[^|]+\|[^|]+\|[^|]+\|(ADMIN|USER)$' } | Select-Object -First 1
    if (-not $updatedUser) {
        throw "没有找到用户，或该用户是不可撤销权限的第一位永久管理员：$User"
    }

    $fields = $updatedUser -split '\|', 4
    Write-Host "成功：$actionLabel" -ForegroundColor Green
    Write-Host "UID：$($fields[0])"
    Write-Host "用户名：$($fields[1])"
    Write-Host "邮箱：$($fields[2])"
    Write-Host "当前角色：$($fields[3])"
    Write-Host '目标用户的旧登录会话已失效，需要重新登录。'
}
finally {
    Pop-Location
}
