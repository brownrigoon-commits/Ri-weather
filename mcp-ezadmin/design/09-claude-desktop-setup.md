# 09. Claude Desktop / Claude Code 연결 안내 (사장님용)

> 2026-07-27 집 PC에서 실제로 연결에 성공한 절차입니다.
> 실제 설치 기록과 막혔던 지점은 [10-setup-log-windows.md](10-setup-log-windows.md) 를 보세요.

## 0. 먼저 알아둘 것 — 어디서 써야 하나

| 사용처 | 이지어드민 조회 |
|---|---|
| **설치형 Claude 앱의 일반 채팅 (홈 탭)** | ✅ 여기서 씁니다 |
| Claude Code 세션 | ❌ 클라우드(Linux)에서 실행되어 PC에 닿지 않음 |
| 브라우저 claude.ai | ❌ 로컬 프로그램 접근 불가 |

## 1. 사전 준비 (한 번만)

**Python 위치는 PC마다 다릅니다. 먼저 확인하세요.**
```bat
where python
```

확인된 경로로 (아래는 실제 예시. 공백이 있으므로 **큰따옴표 필수**):
```bat
"C:\Program Files\Python311\python.exe" -m pip install -r C:\work\Ri-weather\mcp-ezadmin\requirements.txt
copy C:\work\Ri-weather\mcp-ezadmin\.env.example C:\work\Ri-weather\mcp-ezadmin\.env
```

동작 확인 (여기까지 통과하면 서버는 정상):
```bat
cd /d C:\work\Ri-weather\mcp-ezadmin
"C:\Program Files\Python311\python.exe" scripts\make_sample_data.py
"C:\Program Files\Python311\python.exe" scripts\selftest.py
```
→ `총 78개 검증 · 통과 78 · 실패 0`

## 2. 설정 파일 열기

**앱 안에서 여는 것이 가장 확실합니다.** Microsoft Store 버전은 `%APPDATA%\Claude` 가 아니라
`...\LocalCache\Roaming\Claude\` 로 가상화되어 있어, 경로를 직접 찾으면 헤맵니다.

> 앱 → `Ctrl + ,` (설정) → 왼쪽 **데스크톱 앱 › 개발자** → **로컬 MCP 서버** → **구성 편집**

탐색기가 열리며 `claude_desktop_config.json` 이 선택됩니다.
그 파일을 **우클릭 → 연결 프로그램 → 메모장** 으로 엽니다
(Windows 11에서 메뉴에 없으면 **추가 옵션 표시**).

경로를 못 찾겠으면 이 한 줄로 바로 메모장에서 열립니다:
```bat
for /f "delims=" %f in ('dir /s /b "%LOCALAPPDATA%\claude_desktop_config.json" 2^>nul') do notepad "%f"
```

## 3. 넣을 내용

```json
{
  "mcpServers": {
    "ezadmin": {
      "command": "C:\\Program Files\\Python311\\python.exe",
      "args": ["C:\\work\\Ri-weather\\mcp-ezadmin\\server.py"]
    }
  }
}
```

- 역슬래시는 **두 번**(`\\`)
- 경로는 그 PC에서 확인한 실제 값으로
- 다른 MCP 서버가 이미 있으면 `mcpServers` 안에 `"ezadmin"` 항목만 추가 (앞 항목 끝에 쉼표)

## 4. 완전 재시작

창 X 버튼만으로는 백그라운드에 남아 설정이 반영되지 않습니다.
```bat
taskkill /f /im claude.exe
```
그다음 시작 메뉴에서 Claude 재실행.

## 5. 연결 확인

1. 설정 → 개발자 → **`ezadmin`** 옆에 **running** 배지가 보이면 성공
2. **홈 탭의 새 일반 채팅**에서 **"이지어드민 연결 상태 확인해줘"**
3. 이어서 "미출고 몇 건이야?", "루미네 재고 부족한 것 보여줘"

## 6. 안 될 때 점검 순서

| 순서 | 점검 | 방법 |
|---|---|---|
| 1 | 어디서 물어봤는지 | **홈 탭 일반 채팅**이어야 함 (Code 탭·브라우저 ❌) |
| 2 | 서버 등록 상태 | 설정 → 개발자 → `running` 배지 확인 |
| 3 | 서버 로그 | 그 화면의 **로그 보기** 버튼 → 내용을 Claude에게 붙여넣기 |
| 4 | JSON 문법 | 쉼표 누락·역슬래시 한 번이 최다 원인 |
| 5 | Python 경로 | `where python` 결과와 설정값이 같은지 (공백 있으면 큰따옴표) |
| 6 | 의존성 | `"<python경로>" -m pip show mcp openpyxl` |
| 7 | 서버 로직 | `scripts\selftest.py` 실행 — FAIL이면 서버 문제, 연결 문제 아님 |
| 8 | 완전 재시작 | `taskkill /f /im claude.exe` 후 재실행 |

## 7. Claude Code(로컬 CLI)에 연결하려면

```bat
claude mcp add ezadmin -- "C:\Program Files\Python311\python.exe" "C:\work\Ri-weather\mcp-ezadmin\server.py"
```
확인은 `claude mcp list`, 제거는 `claude mcp remove ezadmin`.
(이 PC에 Claude Code CLI가 설치돼 있어야 합니다. 클라우드 Code 세션과는 다릅니다.)
