@echo off
chcp 65001 >nul
title 골프존 자료 내리기 (리스크 제거)
cd /d "%~dp0.."

echo ============================================================
echo   골프존 자료 내리기
echo.
echo   권리자에게서 "내려달라"는 연락을 받았을 때 누르는 버튼입니다.
echo   골프존에서 받아온 홀맵·영상이 앱에서 전부 사라지고,
echo   해당 구장은 위성 화면 + "캐디 공략 준비중" 으로 바뀝니다.
echo.
echo   지우기 전에 저장소 바깥에 백업(zip)을 먼저 만들고,
echo   백업이 온전한지 확인한 뒤에만 지웁니다. 되돌릴 수 있습니다.
echo ============================================================
echo.

echo [1/4] 상대 PC 작업 받기...
python tools\sync.py
if errorlevel 1 goto :fail

echo.
echo [2/4] 지금 무엇이 올라가 있는지...
python tools\golfzon_takedown.py --status
if errorlevel 1 goto :fail

echo.
echo [3/4] 내리기 (여기서 '내리기' 를 입력해야 진행됩니다)
python tools\golfzon_takedown.py --remove
if errorlevel 1 (
  echo.
  echo 내리기를 하지 않았거나 확인할 것이 남았습니다. 위 내용을 읽어보세요.
  goto :end
)

echo.
echo [4/4] 배포 + 확인...
python tools\release_courses.py "코스 자료 정리"
if errorlevel 1 goto :fail
python tools\verify_deploy.py --wait
if errorlevel 1 (
  echo.
  echo ⚠ 배포는 요청됐지만 확인이 통과하지 못했습니다.
  echo    1~2분 뒤 다시 확인하세요:  python tools\verify_deploy.py --wait
  goto :end
)

echo.
echo ============================================================
echo   완료: 골프존 자료가 앱에서 내려갔고 배포 확인까지 통과했습니다.
echo   되돌리려면:  python tools\golfzon_takedown.py --restore
echo ============================================================
goto :end

:fail
echo.
echo ✖ 중간에 멈췄습니다. 위 메시지를 그대로 클로드에게 보여주세요.

:end
echo.
pause
