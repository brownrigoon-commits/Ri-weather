@echo off
rem =====================================================================
rem  Ri_Stock 데이터 갱신 - 더블클릭 한 번이면 끝납니다.
rem
rem  하는 일 (순서대로)
rem    1) 상대 PC 작업 받기      git pull --rebase
rem    2) 원격 데이터와 맞추기    publish --sync
rem    3) 미국+한국 수집          pipeline    (8~15분 걸립니다)
rem    4) 결과물 점검             ristock_출고점검.py
rem    5) 바뀐 데이터만 올리기    publish --push
rem
rem  결과 코드: 0 정상 / 4 반쪽만 갱신 / 1 실패 / 2 올리기 실패 / 3 합치다 만 파일 / 9 준비물 없음
rem
rem  실행 기록은 ristock\data\last_run.log 에 남습니다.
rem  엑셀 분석표는 내 문서\Ri_Stock 폴더에 저장됩니다.
rem
rem  예약 실행(작업 스케줄러)은 뒤에 auto 를 붙여 부릅니다 - 창이 멈추지 않습니다.
rem      tools\ristock_실행.bat auto
rem =====================================================================
chcp 65001 > nul
setlocal EnableExtensions
title Ri_Stock 데이터 갱신

rem 이 파일은 tools\ 안에 있으므로 한 단계 위가 저장소 루트입니다.
cd /d "%~dp0.."

rem --- 파이썬 찾기 (CLAUDE.md 환경: C:\Python314\python.exe) ---
set "PY=C:\Python314\python.exe"
if not exist "%PY%" set "PY=python"

set "DATA=%CD%\ristock\data"
if not exist "%DATA%" mkdir "%DATA%"
set "LOG=%DATA%\last_run.log"

rem 엑셀은 저장소 밖(내 문서)에 저장합니다. 저장소가 무거워지지 않게 하기 위함입니다.
set "XLSX=%USERPROFILE%\Documents\Ri_Stock"
if not exist "%XLSX%" mkdir "%XLSX%"

set "AUTO=0"
if /i "%~1"=="auto" set "AUTO=1"

set "RC=0"

rem --- 로그 새로 시작 ---
> "%LOG%"  echo ============================================================
>> "%LOG%" echo  Ri_Stock 실행 기록  %DATE% %TIME%
>> "%LOG%" echo ============================================================

call :say "============================================================"
call :say " Ri_Stock 데이터 갱신"
call :say " 시작 시각: %DATE% %TIME%"
call :say " 8~15분 걸립니다. 이 창을 닫지 마세요."
call :say "============================================================"

rem --- 준비물 확인 ---
where git >nul 2>&1
if errorlevel 1 (
  call :say "[오류] git 이 설치되어 있지 않습니다."
  call :say "       https://git-scm.com 에서 설치한 뒤 다시 실행해 주세요."
  set "RC=9"
  goto :finish
)

"%PY%" --version >> "%LOG%" 2>&1
if errorlevel 1 (
  call :say "[오류] 파이썬을 찾지 못했습니다."
  call :say "       C:\Python314\python.exe 가 있는지 확인해 주세요."
  set "RC=9"
  goto :finish
)

rem --- 1) 상대 PC 작업 받기 -------------------------------------------
call :say ""
call :say "[1/5] 상대 PC 작업 받는 중..."
git pull --rebase --autostash >> "%LOG%" 2>&1
if errorlevel 1 (
  call :say "  주의: 받기에 실패했습니다. 되돌림을 시도합니다."
  git rebase --abort >> "%LOG%" 2>&1
)

rem --- 1-1) 충돌 표시가 파일에 박힌 채로 계속 가면 안 됩니다 -------------
rem  --autostash 는 보관해 둔 작업을 되돌리다 충돌하면 파일에
rem  "<<<<<<< Updated upstream" 같은 표시를 그대로 써 넣습니다.
rem  그때는 리베이스가 이미 끝나 있어서 --abort 도 소용이 없습니다.
rem  이 상태로 진행하면 나중에 sync.py 가 충돌 표시를 그대로 커밋해
rem  앱이 깨진 채 배포됩니다. 그래서 여기서 멈춥니다.
set "UNMERGED="
git ls-files --unmerged > "%TEMP%\ristock_unmerged.txt" 2>nul
rem  파일이 아예 없거나(=크기 빈칸) 0바이트면 정상입니다. 그 외에는 남아 있다는 뜻입니다.
for %%A in ("%TEMP%\ristock_unmerged.txt") do if not "%%~zA"=="" if not "%%~zA"=="0" set "UNMERGED=1"
if defined UNMERGED (
  call :say "  [오류] 합치다 만 파일이 남아 있습니다. 사람이 정리해야 합니다."
  call :say "         아래 파일에 충돌 표시가 박혀 있을 수 있습니다:"
  call :say "         (이 상태로 저장하면 앱이 깨진 채 배포됩니다)"
  type "%TEMP%\ristock_unmerged.txt"
  type "%TEMP%\ristock_unmerged.txt" >> "%LOG%"
  call :say "         python tools\sync.py --status 로 확인해 주세요."
  call :say "         보관된 작업이 있는지도 보세요: git stash list"
  set "RC=3"
  goto :finish
)

rem --- 2) 원격 데이터와 맞추기 -----------------------------------------
call :say "[2/5] 원격 데이터와 맞추는 중..."
"%PY%" -m ristock.engine.publish --sync >> "%LOG%" 2>&1
if errorlevel 1 (
  call :say "  [오류] 데이터를 맞추지 못했습니다. 사람이 확인해야 합니다."
  call :say "         python tools\sync.py --status 로 상태를 확인해 보세요."
  set "RC=1"
  goto :finish
)

rem --- 3) 수집 ---------------------------------------------------------
call :say "[3/5] 미국+한국 시총 300종목 수집 중... 가장 오래 걸립니다."
"%PY%" -m ristock.engine.pipeline --market all --top 300 --archive --runner pc --excel-dir "%XLSX%" >> "%LOG%" 2>&1
if errorlevel 1 (
  call :say "  [오류] 미국과 한국 모두 수집에 실패했습니다."
  call :say "         기존 데이터는 그대로 두었습니다. 앱은 어제 데이터로 계속 보입니다."
  call :say "         인터넷 연결을 확인하고 잠시 뒤 다시 실행해 주세요."
  set "RC=1"
  goto :finish
)

rem --- 3-1) 반쪽만 갱신된 것을 조용히 넘기지 않습니다 ---------------------
rem  엔진은 한 시장만 성공해도 정상(0)으로 끝납니다. 그대로 두면 한국 데이터가
rem  며칠째 멈춰 있어도 창에는 "완료되었습니다" 만 뜹니다.
rem  그래서 manifest 의 실행.성공 을 직접 보고 반쪽이면 화면에 띄웁니다.
rem  ※ 아래 파이썬 한 줄에 한글을 직접 쓰지 않고 \uXXXX 로 적은 이유:
rem    콘솔 코드페이지에 따라 한글이 깨지면 조건이 조용히 어긋나 경보가 안 뜹니다.
rem    (실행=실행, 성공=성공, 메모=메모)
set "PARTIAL="
"%PY%" -c "import json,os,sys;p=r'%DATA%\manifest.json';d=json.load(open(p,encoding='utf-8')) if os.path.exists(p) else {};e=d.get('\uc2e4\ud589') or {};print(e.get('\uba54\ubaa8') or '');sys.exit(0 if (not d or e.get('\uc131\uacf5')) else 1)" > "%TEMP%\ristock_memo.txt" 2>nul
if errorlevel 1 set "PARTIAL=1"
if defined PARTIAL (
  call :say ""
  call :say "  [주의] 일부만 갱신됐습니다. 갱신되지 않은 쪽은 어제 데이터가 그대로 보입니다."
  call :say "         앱은 정상 동작합니다. 데이터가 지워진 것이 아닙니다."
  call :say "         이유:"
  type "%TEMP%\ristock_memo.txt"
  type "%TEMP%\ristock_memo.txt" >> "%LOG%"
  call :say "         한국만 비었다면 이 PC에서 잠시 뒤 한 번 더 실행해 보세요."
  set "RC=4"
)

rem --- 4) 출고 점검 — 올리기 전에 결과물이 멀쩡한지 확인 ------------------
rem  수집이 0 을 돌려줘도 안심할 수 없습니다. 야후가 절반만 응답하면
rem  300종목이 12종목이 되어도 "성공"으로 끝납니다. 그걸 올리면
rem  어제까지 멀쩡하던 앱이 오늘 텅 빈 화면이 됩니다.
call :say "[4/5] 결과물 점검 중..."
"%PY%" tools\ristock_출고점검.py >> "%LOG%" 2>&1
if errorlevel 1 (
  call :say "  [오류] 결과물이 올릴 만한 상태가 아닙니다. 올리지 않았습니다."
  call :say "         앱에는 이전 데이터가 그대로 보입니다 (사용자 피해 없음)."
  call :say "         자세한 사유는 기록 파일 마지막 부분을 봐 주세요."
  set "RC=1"
  goto :finish
)

rem --- 5) 올리기 -------------------------------------------------------
call :say "[5/5] 바뀐 데이터 올리는 중..."
"%PY%" -m ristock.engine.publish --push --runner pc >> "%LOG%" 2>&1
if errorlevel 1 (
  call :say "  주의: 올리기에 실패했습니다. 데이터는 이 PC에 저장돼 있습니다."
  call :say "        인터넷을 확인한 뒤 다시 실행하면 그때 함께 올라갑니다."
  set "RC=2"
  goto :finish
)

call :say ""
if defined PARTIAL (
  call :say "일부만 갱신되어 올렸습니다. 위의 [주의] 를 읽어 주세요."
) else (
  call :say "완료되었습니다. 1~2분 뒤 폰에서 새로고침하면 오늘 데이터가 보입니다."
)
call :say "  https://brownrigoon-commits.github.io/Ri-weather/ristock/"
goto :finish

rem --- 화면과 로그에 함께 남기기 ---
:say
echo(%~1
>> "%LOG%" echo(%~1
goto :eof

:finish
call :say ""
call :say "끝난 시각: %DATE% %TIME%   (결과 코드 %RC%)"
call :say "자세한 기록: %LOG%"

if "%AUTO%"=="1" goto :bye
if not "%RC%"=="0" (
  echo.
  echo 마지막 기록 20줄:
  powershell -NoProfile -Command "Get-Content -Path '%LOG%' -Tail 20 -Encoding UTF8" 2>nul
  echo.
  pause
) else (
  timeout /t 10 /nobreak >nul
)

:bye
endlocal & exit /b %RC%
