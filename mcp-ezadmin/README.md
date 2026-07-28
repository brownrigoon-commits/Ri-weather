# ezadmin-mcp — 이지어드민 조회 전용 MCP 서버

이지어드민 WMS의 재고·주문·배송 데이터를 Claude가 대화로 조회하게 해 주는
**내 PC에서만 도는 읽기 전용 서버**입니다. Claude Desktop이나 Claude Code에 연결해 두면
"미출고 몇 건이야?", "루미네 재고 부족한 것 보여줘" 처럼 물어볼 수 있습니다.

데이터는 **엑셀과 API 두 가지 방법**으로 읽을 수 있게 만들어져 있습니다.
지금은 엑셀로 동작하고, 나중에 이지어드민 API 명세를 받으면 설정만 채워 API로 바꿀 수 있습니다.

## 기능 (4개 + 상태확인 1개)

| 기능 | 무엇을 하나 | 이렇게 물어보면 됩니다 |
|---|---|---|
| **재고조회** | SKU·브랜드로 현재 수량과 재고 위치 | "루미네 재고 얼마 남았어?" / "LM-001 어디 있어?" |
| **주문조회** | 기간이나 주문번호로 주문 내역 | "이번주 주문 몇 건이야?" / "주문번호 20260727-0012 상세" |
| **미출고목록** | 접수됐지만 출고 안 된 건 | "미출고 몇 건이야?" / "지연된 것 오래된 순으로" |
| **배송조회** | 출고·반품 배송 상황 + 택배사 송장 조회 링크 | "송장 1234… 어디쯤이야?" / "반품 수거 진행 상황" |
| 상태확인 | 연결·데이터 시점 진단 | "이지어드민 연결 상태 확인해줘" |

**조회 전용입니다.** 데이터를 바꾸거나 지우는 기능은 아예 들어 있지 않습니다.

---

## 1. 설치 (Windows, 한 번만)

> ⚠️ **명령 프롬프트(cmd)에서 실행하세요. PowerShell 에서는 동작하지 않습니다.**
> cmd 여는 법: `윈도우키 + R` → `cmd` → Enter
> (PowerShell 창에 `cmd` 를 입력해도 전환됩니다)
> PowerShell 대응 명령은 [design/10](design/10-setup-log-windows.md) 의 표를 보세요.

아래를 순서대로 실행합니다.

**먼저 이 PC의 Python 위치를 확인합니다** (PC마다 다릅니다):
```bat
where python
```

확인된 경로로 설치합니다. 아래는 실제 설치한 PC의 예시입니다
(경로에 공백이 있으므로 **큰따옴표 필수**):
```bat
"C:\Program Files\Python311\python.exe" -m pip install -r C:\work\Ri-weather\mcp-ezadmin\requirements.txt
```

> 코드를 아직 안 받으셨다면 먼저:
> ```bat
> mkdir C:\work 2>nul & cd /d C:\work & git clone --depth 1 -b claude/mcp-inventory-order-server-fwzy33 https://github.com/brownrigoon-commits/Ri-weather.git
> ```

그다음 `.env.example` 파일을 복사해서 이름을 **`.env`** 로 바꿉니다.
처음에는 안을 고칠 필요가 없습니다(엑셀 모드·개인정보 마스킹이 기본값).

> `.env` 와 `config.json`, `data/` 폴더는 깃에 올라가지 않습니다. 인증키와 고객정보가
> 저장소에 남지 않도록 처음부터 막아 둔 것입니다.

## 2. 데이터 준비 (매일 아침 권장)

이지어드민에서 엑셀을 내려받아 아래 폴더에 넣기만 하면 됩니다. **파일명은 자유**이고,
여러 개를 넣어도 최신 파일이 자동으로 우선합니다.

```
C:\work\Ri-weather\mcp-ezadmin\data\orders\      ← 주문 목록 엑셀 (송장·배송상태 포함)
C:\work\Ri-weather\mcp-ezadmin\data\inventory\   ← 재고 엑셀
C:\work\Ri-weather\mcp-ezadmin\data\returns\     ← 반품·교환 엑셀 (없어도 동작합니다)
```

- 브랜드별로 이지어드민 계정이 나뉘어 있으면 `data\orders\루미네\` 처럼 하위 폴더로 나눠 넣어도 됩니다
- 파일이 24시간보다 오래되면 Claude가 답변할 때 "데이터가 오래됐다"고 알려 줍니다
- `.xls`(구형)는 읽지 못합니다 → 이지어드민에서 xlsx로 받거나 "다른 이름으로 저장"

## 3. 실행 방법

**서버를 직접 켤 필요는 없습니다.** Claude Desktop / Claude Code가 필요할 때 알아서 실행합니다.
(4번에서 연결 설정만 해 주면 됩니다.)

직접 점검하고 싶을 때만 아래를 씁니다.

```bat
"C:\Program Files\Python311\python.exe" C:\work\Ri-weather\mcp-ezadmin\scripts\selftest.py
```

## 4. 테스트 방법

실데이터 없이도 가짜 샘플 데이터로 전체 동작을 확인할 수 있습니다.

```bat
cd /d C:\work\Ri-weather\mcp-ezadmin
"C:\Program Files\Python311\python.exe" scripts\make_sample_data.py    :: 가상 샘플 엑셀 생성
"C:\Program Files\Python311\python.exe" scripts\selftest.py            :: 조회 로직 78개 검증
"C:\Program Files\Python311\python.exe" scripts\mcp_smoke_test.py      :: MCP 연결 왕복 확인
```

기대 결과:

- `selftest.py` → 마지막 줄에 `총 78개 검증 · 통과 78 · 실패 0`
- `mcp_smoke_test.py` → `MCP 스모크 테스트: 통과 9 · 실패 0`

하나라도 FAIL이 나오면 그 줄에 이유가 함께 표시됩니다.
샘플 데이터는 전부 가상 인물·가상 브랜드이며 `data/` 폴더에만 생깁니다.

## 5. Claude Desktop 연결

**설정 파일은 앱 안에서 여는 것이 가장 확실합니다.** 버전(일반 설치/Microsoft Store)에 따라
저장 위치가 다르기 때문입니다.

> 앱 → `Ctrl + ,` (설정) → 왼쪽 **데스크톱 앱 › 개발자** → **로컬 MCP 서버** → **구성 편집**

열린 `claude_desktop_config.json` 을 메모장으로 편집합니다
(탐색기가 열리면 파일 **우클릭 → 연결 프로그램 → 메모장**).

경로를 못 찾겠으면 이 한 줄로 바로 열 수 있습니다:
```bat
for /f "delims=" %f in ('dir /s /b "%LOCALAPPDATA%\claude_desktop_config.json" 2^>nul') do notepad "%f"
```

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

⚠️ 역슬래시는 반드시 **두 번**(`\\`). Python·프로젝트 경로는 그 PC에서 확인한 실제 값으로.

저장 후 **완전히 종료**해야 반영됩니다 (창 X 버튼만으로는 부족):
```bat
taskkill /f /im claude.exe
```
그다음 시작 메뉴에서 Claude 다시 실행.

**연결 확인 2가지**
1. 설정 → 개발자 → **`ezadmin` running** 배지가 보이면 성공
2. **홈 탭의 새 일반 채팅**에서 "이지어드민 연결 상태 확인해줘"

> ⚠️ **Claude Code 세션이나 브라우저 claude.ai 에서는 동작하지 않습니다.**
> Code 세션은 클라우드(Linux)에서 돌고, 브라우저는 PC 프로그램에 접근할 수 없습니다.
> 반드시 **설치형 앱의 일반 채팅**에서 쓰세요.

실제 설치 기록과 막혔던 지점은 [design/10-setup-log-windows.md](design/10-setup-log-windows.md),
자세한 점검 순서는 [design/09-claude-desktop-setup.md](design/09-claude-desktop-setup.md) 참고.

## 6. 브랜드 등록

`config.json`(첫 실행 때 자동 생성)의 `brands` 항목에 브랜드를 추가합니다.
이지어드민에서 브랜드가 상품코드로도, 판매처로도 구분되므로 둘 다 적어 두면 정확해집니다.

```json
"brands": {
  "우리브랜드": {
    "aliases": ["ourbrand", "우리브랜드코리아"],
    "product_keywords": ["OB-"],
    "malls": ["우리브랜드 자사몰", "스마트스토어-우리브랜드"],
    "accounts": []
  }
}
```

등록된 브랜드는 "이지어드민 연결 상태 확인해줘" 결과의 `브랜드` 항목에서 확인할 수 있습니다.
코드 수정 없이 이 파일만 고치면 됩니다.

## 7. 개인정보 설정

기본값은 **마스킹**입니다 (홍길동 → 홍*동, 010-1234-5678 → 010-****-5678,
주소는 동까지만). `.env` 의 `EZMCP_PII_MODE` 로 바꿀 수 있습니다.

| 값 | 동작 | 언제 |
|---|---|---|
| `masked` | 일부만 표시 (기본) | 평소 |
| `summary` | 고객정보 아예 제외 | 건수·금액만 볼 때, 나중에 슬랙 연동할 때 |
| `full` | 원본 표시 | 업무상 원본이 꼭 필요할 때만. 쓰고 나면 되돌리기 |

주문번호·송장번호는 업무에 필요하므로 어느 모드에서도 마스킹하지 않습니다.

## 8. 나중에 API로 바꾸기

이지어드민 API는 신청제입니다(법인 대상, 건당 과금, 세팅 약 3일 / 문의 apidev@pimz.co.kr).
명세를 받으면 **그 문서를 Claude에게 주고 "config.json의 api 섹션을 채워줘"** 라고 하면 됩니다.
코드는 이미 API를 받을 수 있게 만들어져 있어서, 설정만 채우고 `.env` 의
`EZMCP_SOURCE_MODE` 를 `auto`(API 우선, 실패하면 엑셀) 나 `api` 로 바꾸면 전환됩니다.
엑셀이 더 정확하다고 느껴지면 `excel` 로 두면 됩니다. 절차는
[design/03-datasource-api.md](design/03-datasource-api.md) 참고.

## 9. 문제 해결

| 증상 | 확인 |
|---|---|
| Claude에 도구가 안 보임 | 설정 JSON 문법(쉼표·역슬래시 두 번), 트레이에서 완전 종료 후 재실행 |
| "파일이 없습니다" | `data\orders` 등에 엑셀을 넣었는지, 확장자가 `.xlsx`/`.csv` 인지 |
| 머리글을 못 찾음 | 엑셀 위쪽에 조회조건 행이 10줄 넘게 붙어 있는지 (10줄까지만 탐색) |
| 상태가 "기타"로 나옴 | "연결 상태 확인" 결과의 `기타상태값` 을 보고 `config.json` 의 `status_keywords` 에 추가 |
| 파일이 열려 있음 오류 | 엑셀에서 해당 파일을 닫고 다시 질문 |
| 앱에 `running` 이 안 뜸 | 설정 → 개발자 → **로그 보기** 클릭 후 내용을 Claude에게 붙여넣기 |
| 연결은 됐는데 답이 안 옴 (타임아웃) | 해결된 문제입니다 → `git pull` 로 최신 코드를 받고 앱 재시작. 원인은 [design/10](design/10-setup-log-windows.md) 참고 |
| 그 외 | 설치 기록 문서 [design/10-setup-log-windows.md](design/10-setup-log-windows.md) 의 '막혔던 지점' 표 참고 |

---

## 개발자용 참고

- 프로젝트 규칙(절대 지켜야 할 것): [CLAUDE.md](CLAUDE.md)
- 설계 문서 10편: [design/](design/) — 개요·아키텍처·엑셀/API 소스·도구 명세·브랜드·개인정보·설정·구현계획·연결안내
- 구조: `server.py`(MCP 도구 정의) → `ezmcp/service.py`(조회 로직) →
  `ezmcp/sources/`(엑셀·API·라우팅). 로직은 MCP와 분리되어 있어 `selftest.py`가 직접 호출해 검증합니다.
