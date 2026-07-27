# 09. Claude Desktop / Claude Code 연결 안내 (사장님용)

> 구현이 끝난 뒤 사용하는 안내입니다. 여기 나온 파일 경로의 `C:\work\mcp-ezadmin` 부분은
> 실제 프로젝트 폴더 위치로 바꿔 읽으세요.

## 1. 사전 준비 (한 번만)

명령 프롬프트(cmd)에서:
```bat
C:\Python314\python.exe --version                          :: Python 확인
C:\Python314\python.exe -m pip install -r C:\work\mcp-ezadmin\requirements.txt
C:\Python314\python.exe C:\work\mcp-ezadmin\scripts\selftest.py   :: 전부 PASS 확인
```

## 2. Claude Desktop 설정 파일

**위치**: `%APPDATA%\Claude\claude_desktop_config.json`
(탐색기 주소창에 `%APPDATA%\Claude` 입력. 파일이 없으면 Claude Desktop
설정 → 개발자(Developer) → Edit Config로 생성)

**넣을 내용** (다른 MCP 서버가 이미 있으면 `mcpServers` 안에 `"ezadmin"` 블록만 추가):
```json
{
  "mcpServers": {
    "ezadmin": {
      "command": "C:\\Python314\\python.exe",
      "args": ["C:\\work\\mcp-ezadmin\\server.py"]
    }
  }
}
```
⚠️ JSON에서 역슬래시는 두 번(`\\`) 써야 합니다. 저장 후 **Claude Desktop을 완전히
종료**(작업표시줄 트레이 아이콘 우클릭 → Quit)하고 다시 실행해야 적용됩니다.

## 3. 연결 확인 방법

1. 새 대화 입력창 밑의 도구(망치/슬라이더) 아이콘에 `ezadmin` 도구 5개가 보이면 연결 성공
2. 대화로 확인: **"이지어드민 연결 상태 확인해줘"** → `data_status`가 실행되어
   데이터 파일·시각이 표로 나오면 정상
3. 실제 질문 테스트: "미출고 몇 건이야?", "루미네 재고 부족한 것 보여줘"

## 4. 연결이 안 될 때 점검 순서 (위에서부터)

| 순서 | 점검 | 방법 |
|---|---|---|
| 1 | JSON 문법 | 설정 파일을 https://jsonlint.com 같은 검사기에 붙여 확인 (쉼표 누락·역슬래시 한 번이 최다 원인) |
| 2 | Python 경로 | cmd에서 `C:\Python314\python.exe --version` — 안 되면 경로가 다른 것 |
| 3 | 의존성 | `C:\Python314\python.exe -m pip show mcp openpyxl` — 없으면 1번 준비 다시 |
| 4 | 서버 로직 | `...\scripts\selftest.py` 실행 — FAIL이 있으면 서버 문제, 연결 문제 아님 |
| 5 | 수동 기동 | `C:\Python314\python.exe C:\work\mcp-ezadmin\server.py` 실행 시 **아무 출력 없이 대기하는 게 정상**. 오류가 찍히면 그 메시지가 원인 |
| 6 | 완전 재시작 | 트레이에서 Quit 후 재실행 (창만 닫으면 재시작이 아님) |
| 7 | 로그 확인 | `%APPDATA%\Claude\logs\` 의 `mcp-server-ezadmin.log`, `mcp.log` 끝부분 오류 확인 |
| 8 | 백신/보안 | 회사 보안 프로그램이 python 실행을 막는지 확인 |

로그를 봐도 모르겠으면 로그 끝 30줄을 Claude에게 붙여넣고 물어보면 됩니다.

## 5. Claude Code 연결 (터미널)

프로젝트 폴더에서:
```bat
claude mcp add ezadmin -- C:\Python314\python.exe C:\work\mcp-ezadmin\server.py
```
확인: `claude mcp list` 에 ezadmin이 보이고, Claude Code 대화에서
"이지어드민 연결 상태 확인해줘"가 동작하면 성공.
제거는 `claude mcp remove ezadmin`.
