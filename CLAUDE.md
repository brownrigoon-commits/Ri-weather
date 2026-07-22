# Ri-Weather — 집·회사 동시 작업 프로젝트

골프장 날씨 + 코스공략 PWA. GitHub Pages 자동 배포.
**사장님이 집 PC와 회사 PC 두 곳에서 동시에 작업합니다.** 아래 프로토콜을 반드시 따르세요.

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
| 그 외 같은 줄 동시 수정 | 자동 해결 불가 → 사람에게 보고 |

마지막 줄만 사람이 개입합니다. 그래서 **영역을 나눠 작업하면 충돌이 사실상 0**입니다.

### 영역 분담 (동시 작업 시 권장)
- **구장 등록**(`universal_build.py` 배치, `holeimg/`, `coursedata/homepages/`) ↔
  **앱 화면·기능**(`index.html`, `css/style.css`, `js/app.js` 기능부)
- 이 둘은 파일이 겹치지 않아 동시에 진행해도 안전합니다.
- 같은 영역을 양쪽에서 동시에 하려면 먼저 `--status`로 확인하고 서로 다른 화면/구장을 맡으세요.

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

## 📁 앱 구조

화면 6개: `home-view`(검색·저장목록) · `detail-view`(날씨) · `hub-view`(4메뉴) ·
`course-view`(코스공략) · `food-view`(주변맛집) · `score-view`(MY스코어)

- `js/app.js` — 전체 로직 (약 3,500줄)
- `js/golfdb.js` — 골프장 위치 DB (한/일/중)
- `js/holeimgdb.js` — **자동 생성물, 직접 편집 금지**
- `js/holesdb.js` — 골프존 홀 정보(3D영상·티별거리·고도차)

## 💻 환경

- Python: `C:\Python314\python.exe` (selenium·pillow 설치됨)
- 로컬 서버: `python -m http.server 8734` → http://localhost:8734
- 배포처: GitHub Pages (push 후 1~2분)
- 상세 이력·다음 작업은 `HANDOFF.md` 참고
