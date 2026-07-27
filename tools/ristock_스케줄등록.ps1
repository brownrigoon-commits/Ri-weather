<#
=====================================================================
 Ri_Stock 자동 실행 예약 - 윈도우 작업 스케줄러 등록/해제

 쓰는 법 (시작 메뉴에서 "PowerShell" 을 열고 붙여넣기)

   cd C:\Ri-weather                                     <- 저장소 폴더
   powershell -ExecutionPolicy Bypass -File tools\ristock_스케줄등록.ps1 -등록
   powershell -ExecutionPolicy Bypass -File tools\ristock_스케줄등록.ps1 -상태
   powershell -ExecutionPolicy Bypass -File tools\ristock_스케줄등록.ps1 -해제

 등록하면 매일 두 번 자동으로 돕니다.
   16:40  한국 장 마감 직후   (RiStock_오후갱신)
   07:10  미국 장 마감 반영   (RiStock_아침갱신)

 · 관리자 권한이 필요 없습니다. 지금 로그인한 계정으로만 등록됩니다.
 · PC가 꺼져 있어 시간을 놓쳤다면, 켜서 로그인한 뒤 곧바로 한 번 돕니다.
 · 실행 자체는 tools\ristock_실행.bat 이 담당합니다(창이 뜨지 않게 auto 로 부릅니다).
=====================================================================
#>
[CmdletBinding()]
param(
    [Alias('install', 'on')][switch]$등록,
    [Alias('remove', 'off')][switch]$해제,
    [Alias('status')][switch]$상태
)

$ErrorActionPreference = 'Stop'
$접두사 = 'RiStock_'

# 이 스크립트는 tools\ 안에 있으므로 한 단계 위가 저장소 루트입니다.
$저장소 = Split-Path -Parent $PSScriptRoot
$실행배치 = Join-Path $PSScriptRoot 'ristock_실행.bat'

# 등록할 작업 두 개 (이름, 시각, 설명)
$작업들 = @(
    @{ 이름 = "${접두사}오후갱신"; 시 = 16; 분 = 40; 설명 = 'Ri_Stock 데이터 갱신 - 한국 장 마감 직후' },
    @{ 이름 = "${접두사}아침갱신"; 시 = 7;  분 = 10; 설명 = 'Ri_Stock 데이터 갱신 - 미국 장 마감 반영' }
)

function 안내($글) { Write-Host $글 }

function 환경점검 {
    if (-not (Test-Path $실행배치)) {
        안내 "[오류] 실행 파일을 찾지 못했습니다: $실행배치"
        안내 "       저장소 폴더 안에서 실행했는지 확인해 주세요."
        return $false
    }
    # 파이썬 경로 확인 (CLAUDE.md 환경: C:\Python314\python.exe, 없으면 python)
    $파이썬 = 'C:\Python314\python.exe'
    if (-not (Test-Path $파이썬)) {
        $찾음 = Get-Command python -ErrorAction SilentlyContinue
        if ($찾음) {
            $파이썬 = $찾음.Source
        } else {
            안내 '[주의] 파이썬을 찾지 못했습니다. 예약은 등록되지만 실행은 실패합니다.'
            안내 '       C:\Python314\python.exe 를 설치하거나 python 을 PATH 에 넣어 주세요.'
            $파이썬 = '(없음)'
        }
    }
    안내 "  저장소   : $저장소"
    안내 "  실행 파일: $실행배치"
    안내 "  파이썬   : $파이썬"
    return $true
}

function 스케줄러확인 {
    if (Get-Command Register-ScheduledTask -ErrorAction SilentlyContinue) { return $true }
    안내 '[오류] 이 윈도우에서는 작업 스케줄러 명령을 쓸 수 없습니다.'
    안내 '       시작 메뉴 > "작업 스케줄러" 를 열어 직접 등록해 주세요.'
    안내 "       프로그램: $실행배치   인수: auto"
    return $false
}

function 등록하기 {
    if (-not (환경점검)) { return }
    if (-not (스케줄러확인)) { return }

    # 지금 로그인한 계정으로, 관리자 권한 없이, 로그온 중일 때만 실행합니다.
    $주체 = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" `
                                       -LogonType Interactive -RunLevel Limited
    $설정 = New-ScheduledTaskSettingsSet -StartWhenAvailable `
                                         -AllowStartIfOnBatteries `
                                         -DontStopIfGoingOnBatteries `
                                         -MultipleInstances IgnoreNew `
                                         -ExecutionTimeLimit (New-TimeSpan -Hours 2)

    foreach ($작업 in $작업들) {
        $시각 = Get-Date -Hour $작업.시 -Minute $작업.분 -Second 0
        $동작 = New-ScheduledTaskAction -Execute $실행배치 -Argument 'auto' -WorkingDirectory $저장소
        $방아쇠 = New-ScheduledTaskTrigger -Daily -At $시각
        Register-ScheduledTask -TaskName $작업.이름 -Action $동작 -Trigger $방아쇠 `
                               -Principal $주체 -Settings $설정 `
                               -Description $작업.설명 -Force | Out-Null
        안내 ("  등록 완료: {0}  매일 {1:00}:{2:00}" -f $작업.이름, $작업.시, $작업.분)
    }
    안내 ''
    안내 '이제 아무것도 누르지 않아도 매일 두 번 데이터가 갱신됩니다.'
    안내 '확인: powershell -ExecutionPolicy Bypass -File tools\ristock_스케줄등록.ps1 -상태'
}

function 해제하기 {
    if (-not (스케줄러확인)) { return }
    $목록 = @(Get-ScheduledTask | Where-Object { $_.TaskName -like "$접두사*" })
    if ($목록.Count -eq 0) {
        안내 '등록된 Ri_Stock 예약이 없습니다.'
        return
    }
    foreach ($t in $목록) {
        Unregister-ScheduledTask -TaskName $t.TaskName -Confirm:$false
        안내 "  해제 완료: $($t.TaskName)"
    }
    안내 ''
    안내 '자동 갱신이 멈췄습니다. 다시 켜려면 -등록 으로 실행하세요.'
    안내 '(그동안에는 tools\ristock_실행.bat 을 더블클릭해 직접 갱신하면 됩니다)'
}

function 상태보기 {
    if (-not (스케줄러확인)) { return }
    $목록 = @(Get-ScheduledTask | Where-Object { $_.TaskName -like "$접두사*" })
    if ($목록.Count -eq 0) {
        안내 '등록된 Ri_Stock 예약이 없습니다.  -등록 으로 켤 수 있습니다.'
        return
    }
    안내 "등록된 예약 $($목록.Count)개"
    foreach ($t in $목록) {
        $정보 = Get-ScheduledTaskInfo -TaskName $t.TaskName
        안내 ''
        안내 "  이름     : $($t.TaskName)"
        안내 "  상태     : $($t.State)"
        안내 "  다음 실행: $($정보.NextRunTime)"
        안내 "  지난 실행: $($정보.LastRunTime)   결과코드 $($정보.LastTaskResult)  (0 이면 정상)"
    }
    $로그 = Join-Path $저장소 'ristock\data\last_run.log'
    if (Test-Path $로그) {
        안내 ''
        안내 "마지막 실행 기록: $로그"
        # 로그는 UTF-8 로 저장되므로 인코딩을 지정해야 한글이 깨지지 않습니다.
        Get-Content -Path $로그 -Tail 5 -Encoding UTF8 | ForEach-Object { 안내 "    $_" }
    }
}

안내 '=========================================='
안내 ' Ri_Stock 자동 실행 예약'
안내 '=========================================='

function 사용법 {
    안내 '무엇을 할지 골라 주세요.'
    안내 ''
    안내 '  예약 켜기 : powershell -ExecutionPolicy Bypass -File tools\ristock_스케줄등록.ps1 -등록'
    안내 '  현황 보기 : powershell -ExecutionPolicy Bypass -File tools\ristock_스케줄등록.ps1 -상태'
    안내 '  예약 끄기 : powershell -ExecutionPolicy Bypass -File tools\ristock_스케줄등록.ps1 -해제'
    안내 ''
    안내 '등록하면 매일 16:40 과 07:10 에 자동으로 데이터를 갱신합니다.'
}

try {
    if ($등록)      { 등록하기 }
    elseif ($해제)  { 해제하기 }
    elseif ($상태)  { 상태보기 }
    else { 사용법 }
}
catch {
    안내 ''
    안내 "[오류] $($_.Exception.Message)"
    안내 '작업 스케줄러(시작 메뉴 > 작업 스케줄러)에서 직접 등록할 수도 있습니다.'
    안내 "  프로그램: $실행배치    인수: auto    시각: 매일 16:40 과 07:10"
    exit 1
}

