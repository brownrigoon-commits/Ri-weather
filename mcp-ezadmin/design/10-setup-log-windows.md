# 10. 실제 설치 기록 (Windows) — 2026-07-27 집 PC

첫 PC에 실제로 설치하며 확인된 사실과 막혔던 지점을 그대로 남긴다.
**회사 PC에서 설치할 때는 이 문서만 따라 하면 된다.**

## 확인된 환경 (집 PC)

| 항목 | 실제 값 |
|---|---|
| Python | `C:\Program Files\Python311\python.exe` (3.11.2) — **경로에 공백이 있어 항상 큰따옴표 필요** |
| git | `C:\Program Files\Git\cmd\git.exe` (설치됨) |
| 프로젝트 위치 | `C:\work\Ri-weather\mcp-ezadmin` |
| Claude Desktop | **Microsoft Store 버전** — 설정 파일 경로가 일반 설치와 다름 (아래 참고) |
| 결과 | `ezadmin` **running** ✅ |

> ⚠️ 루트 `CLAUDE.md` 에 적힌 `C:\Python314\python.exe` 는 골프 앱 프로젝트 기준이며,
> 이 PC에는 없었다. **PC마다 다르므로 반드시 `where python` 으로 먼저 확인할 것.**

## 회사 PC 설치 절차 (그대로 따라 하기)

### 0. ⚠️ 반드시 '명령 프롬프트(cmd)' 에서 실행할 것

아래 명령은 전부 **cmd 문법**이다. **PowerShell 에서는 동작하지 않는다.**
회사 PC에서 실제로 이 함정에 걸렸다.

- PowerShell 에서는 `&`(명령 연결), `2>nul`, `rmdir /s /q` 가 전부 오류가 난다
- 더 위험한 것: PowerShell 의 **`where` 는 `Where-Object` 의 별칭**이라
  `where python` 이 **아무것도 출력하지 않는다.** 이걸 "Python 이 없다"로 오해하기 쉽다

**cmd 여는 법**: `윈도우키 + R` → `cmd` → Enter
(PowerShell 창이 이미 열려 있다면 거기에 `cmd` 라고 입력해도 cmd 로 전환된다)

PowerShell 을 꼭 써야 한다면 대응표:

| cmd | PowerShell |
|---|---|
| `where python` | `where.exe python` 또는 `Get-Command python` |
| `A & B` | `A; B` |
| `mkdir C:\work 2>nul` | `New-Item -ItemType Directory -Force C:\work` |
| `rmdir /s /q <경로>` | `Remove-Item -Recurse -Force <경로>` |
| `cd /d C:\work` | `cd C:\work` |
| `copy A B` | `Copy-Item A B` |
| `taskkill /f /im claude.exe` | `Stop-Process -Name claude -Force` |

### 1. Python·git 위치 확인
```bat
where python
where git
```
Python이 없으면 python.org에서 설치(3.10 이상, 설치 화면에서 **Add python.exe to PATH** 체크).

### 2. 코드 받기
```bat
mkdir C:\work 2>nul & cd /d C:\work & git clone --depth 1 -b claude/mcp-inventory-order-server-fwzy33 https://github.com/brownrigoon-commits/Ri-weather.git
```
비공개 저장소라 로그인 창이 뜬다. GitHub 계정으로 로그인.
(전체 저장소가 약 780MB이므로 `--depth 1` 로 받아야 빠르다.)

### 3. 의존성 설치 + 설정 파일
```bat
"C:\Program Files\Python311\python.exe" -m pip install -r C:\work\Ri-weather\mcp-ezadmin\requirements.txt
copy C:\work\Ri-weather\mcp-ezadmin\.env.example C:\work\Ri-weather\mcp-ezadmin\.env
```
`Successfully installed ... mcp-1.28.1 ...` 이 나오면 성공.
`WARNING: The script ... is not on PATH` 경고는 무시해도 된다.

### 4. 동작 확인
```bat
cd /d C:\work\Ri-weather\mcp-ezadmin
"C:\Program Files\Python311\python.exe" scripts\make_sample_data.py
"C:\Program Files\Python311\python.exe" scripts\selftest.py
```
→ `총 78개 검증 · 통과 78 · 실패 0` 이면 서버는 완전 정상.
집 PC에서 78/78 통과 확인함.

### 5. Claude Desktop 설정 파일 열기

**앱 안에서 여는 것이 가장 확실하다** (버전마다 경로가 다르므로):

> 앱 → `Ctrl + ,` (설정) → 왼쪽 **데스크톱 앱 › 개발자** → **로컬 MCP 서버** → **구성 편집**

집 PC에서는 이 버튼이 탐색기를 열고 `claude_desktop_config.json` 을 선택해 줬다.
그 파일을 **우클릭 → 연결 프로그램 → 메모장** 으로 열어 편집한다.
(Windows 11에서 메뉴에 없으면 **추가 옵션 표시** 클릭)

**경로를 못 찾겠으면** 이 한 줄로 바로 메모장에서 열 수 있다:
```bat
for /f "delims=" %f in ('dir /s /b "%LOCALAPPDATA%\claude_desktop_config.json" 2^>nul') do notepad "%f"
```

### 6. 설정 내용
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
- Python 경로·프로젝트 경로는 **그 PC에서 실제 확인한 값**으로 바꿀 것
- 다른 MCP 서버가 이미 있으면 `mcpServers` 안에 `"ezadmin"` 항목만 추가하고 앞 항목 끝에 쉼표

### 7. 완전 재시작
```bat
taskkill /f /im claude.exe
```
창 X 버튼만으로는 백그라운드에 남아 설정이 반영되지 않는다
(집 PC에서 claude.exe 프로세스가 11개 떠 있었음 — Electron 앱이라 정상).
끈 뒤 시작 메뉴에서 Claude 재실행.

### 8. 확인
- 설정 → 개발자 → **`ezadmin` running** 배지가 보이면 성공
- **홈 탭의 새 일반 채팅**에서 "이지어드민 연결 상태 확인해줘"

## 막혔던 지점과 원인 (같은 실수 반복 방지)

| 증상 | 원인 | 해결 |
|---|---|---|
| `지정된 경로를 찾을 수 없습니다` | `C:\Python314` 가 그 PC에 없음 | `where python` 으로 실제 경로 확인 |
| `%APPDATA%\Claude` 폴더 없음 | **Store 버전**이라 `...\LocalCache\Roaming\Claude\` 로 가상화됨 | 앱의 **구성 편집** 버튼 사용 |
| `%LOCALAPPDATA%\AnthropicClaude` 없음 | 같은 이유 (`%LOCALAPPDATA%\Claude` 에 있었음) | 위와 같음 |
| 설정 파일을 문서 폴더에서 검색 → 못 찾음 | 앱 전용 가상 폴더라 일반 검색으로 안 나옴 | 5번의 `for /f` 명령 사용 |
| 브라우저 claude.ai 에서 MCP가 안 보임 | 웹은 로컬 프로그램에 접근 불가 | **설치형 앱**의 일반 채팅에서 사용 |
| Claude Code 세션에서 MCP가 안 보임 | Code 세션은 클라우드(Linux)에서 실행됨 | **홈 탭의 일반 채팅** 사용 |

## 해결된 문제 — 도구 호출 무한 대기 (2026-07-27 밤 수정 완료)

같은 날 밤 집 PC에서 원인을 찾아 고쳤다. 커밋 `0eb381d0`.

- **증상**: `mcp_smoke_test.py` 가 멈추고, Claude 앱에서도 `initialize`·도구 목록은
  정상인데 **실제 도구 호출만 응답이 오지 않고 타임아웃**
- **원인**: `ezmcp/sources/excel_source.py` 의 `_read_xlsx()` 안에 있던 openpyxl 지연 임포트.
  openpyxl 은 numpy 가 설치돼 있으면 numpy 를 함께 임포트하는데
  (`openpyxl/compat/numbers.py`), 이 임포트가 서버 기동 때가 아니라
  **도구 호출 처리 중(이벤트 루프 스레드)** 에 처음 일어나면
  numpy C 확장(`_multiarray_umath`) 로딩이 끝나지 않고 멈춘다.
  스레드 스택 덤프로 위치를 확인했다.
- **조치**: 임포트를 모듈 최상단으로 이동. 되돌리지 말 것(코드에 경고 주석 있음).
  기동 시 0.6초가 늘어날 뿐이다.
- **왜 개발 컨테이너에서는 안 잡혔나**: 컨테이너에 numpy 가 없어서 openpyxl 이
  numpy 를 끌어오지 않았다. 사장님 PC에는 numpy 가 깔려 있어 재현됐다.
  → **PC마다 설치된 패키지가 달라 생기는 문제는 실제 PC에서만 드러난다.**
- 검증: selftest 78/78, mcp_smoke_test 9/9 PASS (집 PC)

## 실데이터 연결 기록 (2026-07-28 회사 PC) — 반드시 읽을 것

### 회사 PC 환경 (집 PC와 다름)

| 항목 | 실제 값 |
|---|---|
| Python | `C:\Python314\python.exe` (3.14.3) — 집 PC의 `Program Files\Python311` 아님 |
| 설치 결과 | `mcp-1.28.1`, `openpyxl-3.1.5` 정상. selftest 78/78, 스모크 9/9 PASS |
| numpy | **없음** — 그래서 어젯밤의 무한대기 버그는 이 PC에서 원래 재현되지 않는다 |

### 함정 1 — 이지어드민 `.xls` 는 진짜 엑셀이 아니다 (HTML)

이지어드민 '엑셀 다운로드'로 받은 `.xls` 는 확장자만 xls 이고 내용은 HTML `<table>` 이다.
파일 앞부분이 `<meta http-equiv=...>` 로 시작한다. openpyxl 은 이 파일을 못 읽는다.

→ `scripts/ezadmin_xls_to_xlsx.py` 로 변환해서 `data/` 에 넣는다. 실제 export 14개 전부 변환 확인.
   변환 중 상품명에 섞인 제어문자 때문에 openpyxl 이 `IllegalCharacterError` 를 내는 파일이 있어
   변환기에서 제거한다.

### 함정 2 — 다운로드 양식마다 컬럼이 다르다

같은 '확장주문검색'인데 받은 시점에 따라 25칸 / 43칸 / 59칸 / 60칸 / 286칸으로 제각각이었다.

→ **`상태` 와 `공급처` 가 포함된 양식(59칸짜리)을 쓴다.**
  `공급처` 가 있어야 브랜드가 자동으로 잡히고, 없으면 판매처 문자열로 추측해야 한다.

### 함정 3 (가장 중요) — `상태` 컬럼이 CS 를 밀어내 취소분이 미출고로 집계된다

이지어드민 주문 엑셀에는 상태성 컬럼이 **두 개**다.

| 컬럼 | 실제 값 | 의미 |
|---|---|---|
| `상태` | 접수 / 송장 / 배송 | 진행 단계 |
| `CS` | 정상 / 배송전 전체 취소 / 배송후 전체 취소 / 배송전 전체 교환 … | 클레임 |

`상태` 는 표준 후보의 `주문상태` 에 정확일치로 먼저 잡히고, `CS` 는 버려진다.
`config.json` 의 `columns` 는 후보를 **추가**만 하므로 설정으로는 이 우선순위를 못 뒤집는다.

그 결과 **취소·교환 주문이 전부 미출고로 잡혔다.**
2026-06 실데이터 교차표로 확인한 값:

| | 건수 |
|---|---|
| 송장번호 없음 (전체) | 1,264 |
| 그중 CS=정상 → **진짜 미출고** | **587** |
| 그중 CS=취소/교환 → 미출고 아님 | 677 |

잘못된 설정으로는 1,253건, 바로잡은 뒤 586건(중복제거 1건 차이)으로 나온다.

→ 조치: 변환기가 헤더를 표준명으로 바꾼다. `CS` → `주문상태`, `상태` → `배송상태`.
  이러면 클레임이 주문상태 버킷을 잡고, 진행단계는 배송상태로 보정에만 쓰인다.
  `config.json` 의 `status_keywords` 에 `배송중 ← "배송"`, `배송준비 ← "송장"` 을 넣어야
  `기타상태값` 이 비워진다.

### 함정 4 — `selftest.py` 는 실데이터를 붙인 뒤에 돌리면 안 된다

- `data/` 가 비어 있으면 **가짜 샘플 엑셀을 `data/` 에 다시 만든다.**
  (`EZMCP_DATA_DIR` 을 다른 곳으로 지정해도 샘플은 프로젝트 `data/` 에 생긴다.)
  실데이터를 넣기 직전에 돌리면 샘플이 섞인다.
- 브랜드를 실제 값으로 바꾸면 샘플 기준 브랜드 검증 2건(`재고: 브랜드 조회`,
  `재고: 합계 현재고 정합`)이 **정상적으로 실패**한다. 76/78 이 나오면 그게 맞는 상태다.

→ selftest 는 **코드 검증용**이다. 실데이터 확인은 Claude 에서 `data_status` 로 한다.

## 다음 작업 (실데이터 전환)

1. 샘플 데이터 지우기: `rmdir /s /q C:\work\Ri-weather\mcp-ezadmin\data`
2. 이지어드민에서 내려받은 엑셀을 `data\orders` · `data\inventory` · `data\returns` 에 넣기
   (폴더가 없으면 앱을 한 번 실행하면 자동 생성됨)
3. "이지어드민 연결 상태 확인해줘" 결과의 **`기타상태값`** 을 확인 →
   분류 안 된 상태가 있으면 `config.json` 의 `status_keywords` 에 추가
4. 원문 상태값이 **엉뚱한 버킷으로 조용히 들어가지 않았는지** 대조 (02 문서 경고 참고)
5. 실제 브랜드를 `config.json` 의 `brands` 에 등록
