# Ri-Weather — 집·회사 동시 작업 프로젝트

골프장 날씨 + 코스공략 PWA. GitHub Pages 자동 배포.
**사장님이 집 PC와 회사 PC 두 곳에서 동시에 작업합니다.** 아래 프로토콜을 반드시 따르세요.

> ⚠️ **이 저장소에는 앱이 두 개 있습니다** (2026-07-27 부터)
>
> | 앱 | 경로 | 무엇 |
> |---|---|---|
> | **골프라이프** (원래 앱) | 저장소 최상단 `index.html` `js/` `css/` | 골프장 날씨 + 코스공략 |
> | **Ri_Stock** (새 앱) | `ristock/` 폴더 전체 | 주식 분석표 자동 갱신 |
>
> 두 앱은 **파일이 전혀 겹치지 않습니다.** 골프 작업을 할 때 `ristock/` 을 건드릴 일이 없고,
> 그 반대도 마찬가지입니다. 배포 도구도 서로 다릅니다(아래 도구 표 참고).
> Ri_Stock 의 지금 상태와 다음 할 일은 `HANDOFF.md` 맨 앞에 있습니다.

## 🔄 동시 작업 프로토콜 (가장 중요)

### 1. 세션을 시작하면 무조건 먼저 실행
```
python tools/sync.py --start "이번에 할 작업"
python tools/sync.py
```
상대 PC 작업을 받아오고, 내가 뭘 하는지 상대에게 알립니다.
**이걸 건너뛰고 파일을 수정하면 안 됩니다.**

### 2. 작업이 한 덩어리 끝날 때마다 저장 (30~60분마다)
```
python tools/sync.py "무엇을 했는지 한 줄"
```
커밋 → 상대 작업 받기 → 충돌 자동 해결 → 보내기를 한 번에 처리합니다.
**오래 쥐고 있지 말 것.** 자주 저장할수록 충돌이 작아집니다.

### 3. 앱 배포는 이것만 사용 — 그리고 반드시 확인까지
```
python tools/release_courses.py "배포 메시지"
python tools/verify_deploy.py --wait
```
`APP_VER`나 `sw.js` 캐시 버전을 **직접 손으로 고치지 마세요.**

> ⛔ **`verify_deploy.py` 를 통과하기 전에는 절대 "배포 완료"라고 보고하지 마세요.**
> 2026-07-22 실제 사고: 새로 만든 `js/legal.js` 가 배포 목록에서 빠져 서버에 404 페이지가 서빙됐고,
> 앱의 약관 버튼이 전부 죽었습니다. 로컬 테스트는 전부 통과해서 며칠 헤맬 뻔했습니다.
> 같은 날 `.nojekyll` 누락으로 GitHub Pages 빌드가 조용히 실패해 5번의 배포가 사용자에게 도달하지 않았습니다.
> **로컬에서 되는 것과 사용자에게 도달하는 것은 완전히 다른 문제입니다.**

### 3-1. 화면 동작 검증은 실제 터치 지점으로
`버튼.click()` 으로 테스트하면 **다른 요소가 버튼을 덮고 있어도 통과**합니다. 반드시 이렇게 확인하세요:
```js
const r = el.getBoundingClientRect();
const hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
const 진짜눌림 = (hit === el || el.contains(hit));
```
화면 밖으로 밀려나지 않았는지(`r.bottom <= innerHeight`)도 함께 봐야 합니다.

### 4. 상대가 뭘 하는지 확인
```
python tools/sync.py --status
```

### 충돌은 자동 해결됩니다 (사람이 손대지 않음)
| 파일 | 처리 |
|---|---|
| `js/holeimgdb.js` | 조립 산출물 → 자동 재생성 |
| `js/app.js` APP_VER · `sw.js` 캐시 | 두 버전 중 큰 값 자동 채택 |
| `holeimg/`, `coursedata/` | 서로 다른 구장이므로 양쪽 모두 보존 |
| `ristock/data/` | **자동 생성물** → 손으로 고치지 말 것. 충돌 시 재생성이 답 (아래 참고) |
| 그 외 같은 줄 동시 수정 | 자동 해결 불가 → 사람에게 보고 |

마지막 줄만 사람이 개입합니다. 그래서 **영역을 나눠 작업하면 충돌이 사실상 0**입니다.

### `ristock/data/` 는 손으로 고치지 않습니다

`ristock/data/*.json` 은 전부 **엔진이 매번 통째로 다시 만드는 산출물**입니다.
집 PC·회사 PC·깃허브 서버 세 곳에서 하루 두 번씩 같은 파일을 덮어씁니다.

- ❌ 값을 손으로 고치지 마세요. 다음 갱신 때 흔적 없이 사라집니다.
- ❌ 충돌이 났다고 `<<<<<<<` 표시를 사람이 지워서 맞추지 마세요. **재생성이 정답입니다.**
  ```
  git checkout --theirs -- ristock/data   (또는 origin 쪽으로 맞추고)
  python -m ristock.engine.pipeline --market all --top 300 --archive --runner pc
  ```
- 잘못된 값이 보이면 고칠 곳은 **엔진(`ristock/engine/`)** 이지 데이터가 아닙니다.
- `ristock/engine/publish.py --sync` 가 애초에 원격 상태를 받아 통째로 다시 쓰기 때문에
  정상 경로(`tools/ristock_실행.bat`)로만 돌리면 충돌 자체가 나지 않습니다.

### 영역 분담 (동시 작업 시 권장)
- **구장 등록**(`universal_build.py` 배치, `holeimg/`, `coursedata/homepages/`) ↔
  **앱 화면·기능**(`index.html`, `css/style.css`, `js/app.js` 기능부)
- 이 둘은 파일이 겹치지 않아 동시에 진행해도 안전합니다.
- 같은 영역을 양쪽에서 동시에 하려면 먼저 `--status`로 확인하고 서로 다른 화면/구장을 맡으세요.

**Ri_Stock 이 생기면서 영역이 하나 더 늘었습니다.** 세 영역은 서로 파일이 겹치지 않습니다.

| 영역 | 건드리는 파일 |
|---|---|
| ① 구장 등록 | `holeimg/`, `coursedata/`, `tools/universal_build.py` 등 |
| ② 골프앱 화면·기능 | `index.html`, `css/style.css`, `js/*.js` |
| ③ **Ri_Stock** | `ristock/` 전체, `tools/ristock_*`, `.github/workflows/ristock-daily.yml`, `docs/ristock_*` |

- 한쪽 PC에서 골프(①②)를, 다른 PC에서 Ri_Stock(③)을 하면 **충돌이 나지 않습니다.**
- Ri_Stock 안에서 또 나눈다면 **엔진(`ristock/engine/`) ↔ 화면(`ristock/js/`·`ristock/css/`)** 입니다.
  이 둘의 약속은 `docs/ristock_설계.md` 에 적혀 있습니다. **필드 이름 하나만 어긋나도 화면이 빕니다.**

## ⛳ 절대 원칙 (사장님 확정 — 예외 없음)

1. **홀이 하나라도 빠지면 등록 금지.** 공식 홀 수(골프존) = 파싱 홀 수 일치 필수.
   27홀 구장에 18홀만 등록하면 앱 신뢰를 잃습니다.
2. **틀릴 수 있으면 아예 표시하지 않음.** 거리·코스명이 의심스러우면 그 항목만 제거하고 등록.
3. **미등록 구장은 "홀별 공략 준비 중" 배너** 자동 표시 (이미 구현됨).
4. **홀맵 이미지 표준**: 지도만(글자·사진 제거), 흰 배경, 세로 600px 고정 · 가로 ≤ 680
   (`tools/crop_map_only.py`)
5. **사용량 절약**: 단계별 확인 왕복 금지. 일괄 실행 → 자동 검증 → 최종 요약만 보고.
6. **구장이 하나 완성될 때마다 즉시 리포트.** 사장님이 폰으로 바로 확인합니다.

## 🛠 도구

| 도구 | 역할 |
|---|---|
| `tools/sync.py` | **동시 작업 동기화** (받기/저장/현황) |
| `tools/release_courses.py` | 조립 + 무결성 검사 + 버전업 + 배포 |
| `tools/universal_build.py` | 사이트 유형 자동판별 구장 등록 (`--batch --grades ABCD --write`) |
| `tools/analyze_registrable.py` | 수집 자산 → 등급 A~E 판정 |
| `tools/audit_registered.py` | 품질 감사 (파합계·이미지·TIP·거리) |
| `tools/cleanup_registrations.py` | 중복·불량 자동 정리 |
| `tools/match_dbnames.py` | 등록 구장명 ↔ `golfdb.js` 표기 일치 |
| `tools/build_holeimgdb.py` | `parsed.json` → `js/holeimgdb.js` 조립 |
| `tools/crop_map_only.py` | 홀맵 표준 크롭 |
| `tools/collect_v2_selenium.py` | 크롬 렌더링 수집기 (SPA 대응) |
| `tools/export_status_excel.py` | 골프장DB 현황 엑셀 |

### Ri_Stock 전용 도구 (골프앱과 섞이지 않습니다)

| 도구 | 역할 |
|---|---|
| `ristock/engine/pipeline.py` | 수집→평가→JSON 산출 (`python -m ristock.engine.pipeline`) |
| `ristock/engine/publish.py` | `ristock/data` 만 골라 커밋·푸시 (`--sync` / `--push`) |
| `tools/ristock_출고점검.py` | **올리기 전·후 관문.** 종목 수·필드 검사 + 공개 주소 도달 확인 |
| `tools/ristock_실행.bat` | 집 PC 수동/예약 실행 (더블클릭 1회) |
| `tools/ristock_스케줄등록.ps1` | 윈도우 작업 스케줄러 등록·해제·상태 |
| `.github/workflows/ristock-daily.yml` | 깃허브 서버 자동 실행 (하루 2회) |

**Ri_Stock 은 `release_courses.py` 를 쓰지 않습니다.** 골프앱 배포 도구와 별개입니다.
`APP_VER` 도 없습니다 — `ristock/sw.js` 는 골프앱과 달리 **네트워크 우선**이라
(`fetch(..., {cache:'no-cache'})`) 화면 파일을 고치면 폰이 다음 실행에 바로 새 파일을 받습니다.
`CACHE = "ristock-v1"` 은 **옛 캐시를 통째로 버리고 싶을 때만** 올리면 됩니다.

Ri_Stock 을 고쳤으면 배포 확인은 이것으로 합니다(골프앱의 `verify_deploy.py` 가 아닙니다).
```
python tools/ristock_출고점검.py                 # 올리기 전 — 로컬 산출물
python tools/ristock_출고점검.py --skip-local --url --wait   # 올린 뒤 — 공개 주소 도달
```

## 📁 앱 구조

화면 6개: `home-view`(검색·저장목록) · `detail-view`(날씨) · `hub-view`(4메뉴) ·
`course-view`(코스공략) · `food-view`(주변맛집) · `score-view`(MY스코어)

- `js/app.js` — 전체 로직 (약 3,500줄)
- `js/golfdb.js` — 골프장 위치 DB (한/일/중)
- `js/holeimgdb.js` — **자동 생성물, 직접 편집 금지**
- `js/holesdb.js` — 골프존 홀 정보(3D영상·티별거리·고도차)

## 📈 Ri_Stock 구조 (`ristock/`)

```
ristock/
├── index.html  css/style.css  sw.js  manifest.webmanifest  icons/
├── js/   app.js(화면) · data.js(불러오기) · strategy.js(전략 계산) · export.js(CSV)
├── data/     ← 자동 생성물. 손대지 말 것 (위 규칙 참고)
├── engine/   ← 파이썬 엔진 + tests/
└── tests/    verify_pwa.mjs · verify_phone_e2e.mjs (헤드리스 크로미움)
```

**절대 바뀌면 안 되는 것**: 점수 체계(13항목)와 전략 8종의 종목 선정 결과.
`ristock/engine/tests/` 의 정답지가 이를 지킵니다. 고치기 전에 반드시 이 4개를 돌려 기준을 잡으세요.

```
python -m pytest ristock/engine/tests -q          # 파이썬 엔진
node ristock/engine/tests/test_js_golden.mjs      # JS 전략 = 정답지 재현
python3 -m http.server 8791                       # (저장소 최상단에서 띄워 두고)
node ristock/tests/verify_pwa.mjs                 # 화면 로딩·터치
node ristock/tests/verify_phone_e2e.mjs           # 폰 크기 전체 동선
```

전략 계산은 **JS(`ristock/js/strategy.js`)가 정본**이고 파이썬은 같은 규칙을 복제합니다.
한쪽만 고치면 두 결과가 달라집니다. 규칙은 `docs/ristock_설계.md` 3장에 글자 그대로 적혀 있습니다.

## 💻 환경

- Python: `C:\Python314\python.exe` (selenium·pillow 설치됨)
- 로컬 서버: `python -m http.server 8734` → http://localhost:8734
- 배포처: GitHub Pages (push 후 1~2분)
- 상세 이력·다음 작업은 `HANDOFF.md` 참고
