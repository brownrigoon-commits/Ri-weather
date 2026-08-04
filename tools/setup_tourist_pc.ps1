param(
    [string]$Vault = "",
    [switch]$SkipArtifacts,
    [switch]$SkipNode
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$VenvRoot = Join-Path $RepoRoot ".venv-tourist"
$VenvPython = Join-Path $VenvRoot "Scripts\python.exe"

Set-Location $RepoRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git을 먼저 설치해 주세요."
}
$GitUserName = [string](& git config --get user.name)
$GitUserName = $GitUserName.Trim()
if (-not $GitUserName) {
    & git config user.name "Ri-Weather"
    if ($LASTEXITCODE -ne 0) { throw "저장소 Git user.name 설정에 실패했습니다." }
}
$GitUserEmail = [string](& git config --get user.email)
$GitUserEmail = $GitUserEmail.Trim()
if (-not $GitUserEmail) {
    & git config user.email "brownrigoon-commits@users.noreply.github.com"
    if ($LASTEXITCODE -ne 0) { throw "저장소 Git user.email 설정에 실패했습니다." }
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python 3.11 이상을 먼저 설치해 주세요."
}

$VersionText = & python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"
if ($LASTEXITCODE -ne 0) {
    throw "Python 버전을 확인하지 못했습니다."
}
if ([version]$VersionText -lt [version]"3.11") {
    throw "Python 3.11 이상이 필요합니다. 현재: $VersionText"
}

if (-not (Test-Path -LiteralPath $VenvPython)) {
    Write-Host "· 투어리스트 전용 Python 환경 생성"
    & python -m venv $VenvRoot
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $VenvPython)) {
        throw "Python 가상환경 생성에 실패했습니다."
    }
}

Write-Host "· Python 의존성 설치"
& $VenvPython -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) {
    throw "pip 업그레이드에 실패했습니다. 네트워크 연결을 확인하세요."
}
& $VenvPython -m pip install -r (Join-Path $RepoRoot "requirements-tourist.txt")
if ($LASTEXITCODE -ne 0) {
    throw "Python 의존성 설치에 실패했습니다."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue) -or
    -not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "Node.js 20 이상과 npm을 먼저 설치해 주세요."
}
$NodeVersionText = (& node -p "process.versions.node").Trim()
if ($LASTEXITCODE -ne 0 -or [version]$NodeVersionText -lt [version]"20.0") {
    throw "Node.js 20 이상이 필요합니다. 현재: $NodeVersionText"
}

if (-not $SkipNode) {
    Write-Host "· Node 의존성 재현 설치"
    & npm ci
    if ($LASTEXITCODE -ne 0) {
        throw "npm ci에 실패했습니다."
    }
}

if (-not $SkipArtifacts) {
    $ArtifactArgs = @((Join-Path $RepoRoot "tools\artifact_sync.py"))
    if ($Vault) {
        $ArtifactArgs += @("--vault", $Vault)
    }
    Write-Host "· 기존 Google Drive 원본 보관소 연결"
    & $VenvPython @ArtifactArgs init
    if ($LASTEXITCODE -ne 0) {
        throw "기존 원본 보관소 연결 실패. Google Drive 로그인과 --vault 경로를 확인하세요."
    }
    Write-Host "· 홀맵 원본 복원"
    & $VenvPython @ArtifactArgs pull
    if ($LASTEXITCODE -ne 0) {
        throw "홀맵 원본 복원 실패. Google Drive 동기화 완료 후 다시 실행하세요."
    }
}

$CheckArgs = @((Join-Path $RepoRoot "tools\check_tourist_environment.py"))
if ($SkipArtifacts) {
    $CheckArgs += "--skip-artifacts"
}
& $VenvPython @CheckArgs
if ($LASTEXITCODE -ne 0) {
    throw "환경 점검에 실패했습니다."
}

Write-Host ""
Write-Host "✔ 이 PC에서 투어리스트 작업을 이어갈 준비가 끝났습니다."
Write-Host "  이 프로젝트에서는 아래 전용 Python을 사용하세요:"
Write-Host "  $VenvPython"
Write-Host "  시작: .\tourist.cmd tools\sync.py --start '작업명'"
Write-Host "        .\tourist.cmd tools\sync.py"
