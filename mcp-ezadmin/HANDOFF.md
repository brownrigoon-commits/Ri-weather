# mcp-ezadmin 인수인계 (2026-07-28 · 회사 PC 세션용)

> **이 문서를 읽는 Claude에게**: 사장님은 코드를 직접 짜지 않습니다.
> 명령어는 복사해 붙여넣을 수 있게 **한 줄씩** 주고, 실행 결과를 받아 판단하세요.
> 로컬 실행이 가능한 세션이면 직접 실행하고 **결과 요약만** 보고하세요.
> 단계별 확인 왕복을 최소화하고, 일괄 실행 → 자동 검증 → 최종 요약이 원칙입니다.

---

## 1. 지금 상태

- **서버·도구 로직 완성.** `selftest.py` 78개, `mcp_smoke_test.py` 9개 전부 PASS (집 PC 확인).
- **집 PC에서 Claude Desktop 연결 성공.** `ezadmin` running 확인 완료.
- ⛔ **아직 실제 이지어드민 데이터에 붙지 않았다.** `data/` 는 전부 가짜 샘플,
  `config.json` 의 브랜드도 예시("루미네", "베르디"), `api.enabled` 는 `false`.
  **지금 나오는 숫자는 전부 가짜다.**

## 2. 기능 (확정 — 이 5개 외 추가 금지)

| 도구 | 설명 |
|---|---|
| `inventory_lookup` | 재고조회 — SKU·브랜드로 현재 수량과 재고 위치 |
| `order_lookup` | 주문조회 — 기간이나 주문번호로 내역 |
| `unshipped_list` | 미출고목록 — 접수됐지만 출고(송장 등록) 안 된 건 |
| `shipping_lookup` | 배송조회 — 출고·반품 배송 상황 + 택배사 송장 조회 링크 |
| `data_status` | 연결·데이터 상태 진단 |

## 3. 회사 PC 환경 (2026-07-28 실측)

| 항목 | 값 |
|---|---|
| Python 후보 | `C:\Python314\python.exe` (1순위, 공백 없음) · `C:\Programs files\Python311\python.exe` · WindowsApps |
| git | `C:\Program Files\Git\cmd\git.exe` |
| 코드 위치 | `C:\work\Ri-weather\mcp-ezadmin` (clone 완료) |
| 진행 상황 | clone까지 완료. **pip install 부터 남음** |

> 집 PC는 `C:\Program Files\Python311` 이었다. **PC마다 다르므로 항상 `where python` 확인.**
> 3.14 에서 pip install 이 실패하면 3.11 로 전환할 것(집 PC에서 3.11 검증 완료).

## 4. 오늘 할 일 (순서대로)

### 4-1. 설치 마무리
```bat
C:\Python314\python.exe -m pip install -r C:\work\Ri-weather\mcp-ezadmin\requirements.txt
copy C:\work\Ri-weather\mcp-ezadmin\.env.example C:\work\Ri-weather\mcp-ezadmin\.env
cd /d C:\work\Ri-weather\mcp-ezadmin
C:\Python314\python.exe scripts\make_sample_data.py
C:\Python314\python.exe scripts\selftest.py
```
→ `총 78개 검증 · 통과 78 · 실패 0` 확인

### 4-2. Claude Desktop 등록
앱 → `Ctrl + ,` → **데스크톱 앱 › 개발자** → **로컬 MCP 서버** → **구성 편집**
```json
{
  "mcpServers": {
    "ezadmin": {
      "command": "C:\\Python314\\python.exe",
      "args": ["C:\\work\\Ri-weather\\mcp-ezadmin\\server.py"]
    }
  }
}
```
저장 → `taskkill /f /im claude.exe` → 앱 재실행 → **running 배지** 확인

### 4-3. ⭐ 실데이터 투입 (오늘의 핵심)
1. 샘플 지우기: `rmdir /s /q C:\work\Ri-weather\mcp-ezadmin\data`
2. 이지어드민에서 내려받은 엑셀을 아래에 넣기 (파일명 자유, 폴더 없으면 만들기)
   ```
   C:\work\Ri-weather\mcp-ezadmin\data\orders       ← 주문 (최근 2주 권장)
   C:\work\Ri-weather\mcp-ezadmin\data\inventory    ← 재고
   C:\work\Ri-weather\mcp-ezadmin\data\returns      ← 반품·교환 (없어도 동작)
   ```
3. "이지어드민 연결 상태 확인해줘" → **행수·기간이 실제와 맞는지** 확인
   - 행수가 0이거나 "머리글을 찾지 못했습니다" → 컬럼명이 달라서다.
     `config.json` 의 `columns` 로 매핑 추가 (`design/02` 참고)

### 4-4. ⭐ 상태값 대조 (반드시)
앱에서 이렇게 질문:
```
주문 데이터에 있는 원문 상태값을 전부 뽑아서, 각각 어느 분류로 들어갔는지 표로 보여줘
```
- `data_status` 의 **`기타상태값`** = 분류 못 한 값 → `config.json` 의 `status_keywords` 에 추가
- ⚠️ **더 위험한 것은 엉뚱한 버킷으로 조용히 들어간 값이다.**
  예) `부분취소` 는 '취소' 가 들어 있어 취소로 분류 → **미출고 목록에서 빠진다.**
  남은 품목이 아직 출고 대상이면 사고다. **사장님과 표를 보며 하나씩 맞출 것.**

### 4-5. 브랜드 등록
`config.json` 의 `brands` 를 실제 브랜드로 교체. 이지어드민에서 브랜드는 **두 방식 병행**이다
(① 상품명·상품코드에 식별자 ② 브랜드별 판매처·계정 분리) → **둘 다 적어야 정확하다.**
```json
"brands": {
  "실제브랜드명": {
    "aliases": ["영문표기"],
    "product_keywords": ["코드접두어-"],
    "malls": ["판매처명 그대로"],
    "accounts": []
  }
}
```

### 4-6. 최종 확인 — 이지어드민 화면과 숫자 대조
```
미출고 몇 건이야?
이번주 주문 몇 건이야?
<실제브랜드> 재고 부족한 것 보여줘
반품 수거 진행 상황
```
**숫자가 이지어드민 화면과 일치하는지 사장님이 직접 대조.** 여기까지 맞아야 실사용 가능.

## 5. 절대 규칙

1. **조회 전용.** 쓰기·수정·삭제 도구를 추가하지 않는다. 코드 경로 자체가 없어야 한다.
2. **`pii_mode` 기본값 `masked` 유지.** 실데이터를 붙이는 순간부터 진짜 고객정보다.
3. **`data/`, `.env`, `config.json` 커밋 금지** (`.gitignore` 되어 있음. 확인 후 커밋할 것).
4. **stdout 출력 금지** (`print()` 금지). MCP stdio 가 오염되어 연결이 조용히 죽는다.
5. **기능 추가 금지.** 위 5개 도구 외 임의 추가 금지.
6. 브랜치는 `claude/mcp-inventory-order-server-fwzy33` 만 사용. PR은 사장님이 요청할 때만.
7. 코드를 고쳤으면 `scripts\selftest.py` 를 돌려 **78개 전부 PASS** 확인 후 커밋.

## 6. 이미 겪은 함정 (반복 금지)

| 증상 | 원인 | 해결 |
|---|---|---|
| 명령이 전부 오류 | **PowerShell** 에서 실행 (문서는 cmd 문법) | 창에 `cmd` 입력해 전환. PowerShell 의 `where` 는 별칭이라 **아무것도 출력 안 함** → "Python 없음"으로 오해 금물 |
| `지정된 경로를 찾을 수 없습니다` | Python 경로가 PC마다 다름 | `where python` 확인. 공백 있으면 큰따옴표 |
| `%APPDATA%\Claude` 없음 | Store 버전은 `LocalCache\Roaming\Claude\` 로 가상화 | 앱의 **구성 편집** 버튼 사용 |
| 브라우저·Code 세션에서 MCP 안 보임 | 웹·Code 세션은 클라우드(Linux)에서 실행 | **설치형 앱의 홈 탭 일반 채팅** 에서 사용 |
| 도구 호출이 무한 대기 | openpyxl 지연 임포트가 numpy 를 이벤트 루프에서 로드 | **해결됨**(`0eb381d0`). 임포트가 모듈 최상단에 있어야 함. 되돌리지 말 것 |
| 설정 바꿨는데 반영 안 됨 | 창 X 만 눌러 백그라운드 잔존 | `taskkill /f /im claude.exe` 후 재실행 |

자세한 기록: `design/10-setup-log-windows.md`

## 7. 나중에 할 것 (오늘 아님)

- **이지어드민 API 전환**: 신청제(법인, 건당 과금, 세팅 약 3일 / apidev@pimz.co.kr).
  명세를 받으면 그 문서를 Claude 에게 주고 `config.json` 의 `api` 섹션을 채우면 켜진다.
  인증키는 **반드시 `.env` 에만** (`EZADMIN_API_DOMAIN`, `EZADMIN_API_KEY`).
  절차: `design/03-datasource-api.md`
- **슬랙 연동 (2단계, 최종 목표)**: 그때는 `pii_mode` 를 `masked`/`summary` 로 강제해야 한다.

## 8. 문서 지도

| 문서 | 내용 |
|---|---|
| `README.md` | 사장님용 전체 사용법 |
| `design/10-setup-log-windows.md` | **실제 설치 기록·함정 모음 (가장 실용적)** |
| `design/09-claude-desktop-setup.md` | 앱 연결 절차·점검 순서 |
| `design/02-datasource-excel.md` | 엑셀 머리글 매핑·상태 버킷 규칙 |
| `design/04-mcp-tools.md` | 도구 5개 상세 명세 |
| `design/06-privacy-masking.md` | 개인정보 마스킹 규칙 |
| `CLAUDE.md` | 이 프로젝트 절대 규칙 |

## 9. 작업 이력

| 날짜 | 내용 |
|---|---|
| 07-27 낮 | 설계 문서 10편 작성 |
| 07-27 저녁 | 구현 완료. selftest 78/78, smoke 9/9. 날짜 파싱 결함 2건·예외 격리 수정 |
| 07-27 밤 | 집 PC 설치·연결 성공. 도구 호출 무한 대기(openpyxl/numpy) 원인 규명·수정 |
| 07-28 오전 | 회사 PC clone 완료. PowerShell 함정 문서화 |
| **다음** | **실데이터 투입 → 상태값 대조 → 브랜드 등록 → 숫자 검증** |
