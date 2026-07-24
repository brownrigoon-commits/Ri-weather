# Ri-Weather 작업 이어하기 가이드 (2026-07-22 저녁 갱신)

집/회사 어디서든: **`python tools/sync.py`** 로 시작. 로컬 서버: `python -m http.server 8734`
권한 설정(승인 질문 없애기): `Github_코드백업/_클로드_설정/설정적용.py` 실행 후 클로드 재시작.

---

## 🔴 오늘(7/22 오후) 회사에서 일어난 일 — 반드시 읽을 것

**배포가 사용자에게 도달하지 않는 사고가 두 건 있었습니다.** 원인과 조치:

1. **`.nojekyll` 누락** → GitHub Pages 빌드가 조용히 실패(882MB 저장소를 매번 Jekyll 변환 시도).
   v81·v83·v84 배포가 사용자에게 도달하지 않음. → `.nojekyll` 추가로 해결.
2. **`js/legal.js` 가 배포 목록에서 누락** → 서버에서 404 HTML 이 서빙되어
   약관 관련 버튼(보기·시작하기·처리방침)이 전부 죽음. "나중에 하기"만 살아있어 원인 파악이 늦었음.
   → `release_courses.py` 가 **폴더 통째로** add 하도록 변경.

**그래서 생긴 규칙 (CLAUDE.md 에도 있음):**
```
python tools/release_courses.py "메시지"
python tools/verify_deploy.py --wait      ← 이걸 통과해야 '배포 완료'
```
`verify_deploy.py` 는 실제 서버에서 파일을 받아 404·버전·빌드상태를 확인합니다.
**로컬에서 되는 것과 사용자에게 도달하는 것은 다른 문제입니다.**

또 하나: 화면 검증은 `버튼.click()` 이 아니라 **`document.elementFromPoint`** 로 실제 터치 지점을 확인할 것.
(덮여 있거나 화면 밖으로 나간 버튼을 `.click()` 은 잡지 못함 — 실제로 이것 때문에 놓쳤음)

**진단 도구가 앱에 내장됨(v89, v106 개선):**
- v106: iOS가 만들어내는 '내용 없는 error 이벤트'(메시지·파일·줄번호 전부 없음)는 표시하지 않음
  — 이걸 안 걸러서 빨간 배너가 화면을 덮은 사고(7/24)가 있었음. 같은 오류 반복은 (×N)으로 합침, 최대 8줄.
- 파일 누락·JS 오류가 나면 **폰 화면 상단에 빨간 띠**로 표시된다. 스크린샷 한 장이면 원인 확정.
- 주소 뒤 `?diag` → 버전·기기·UA·화면높이 표시 (사용자 문의 대응용)
- 주소 뒤 `?reset` → 캐시·서비스워커·저장값 전부 삭제 후 최신으로 재시작

**인앱 브라우저 조사 결과 중 반증된 것(다시 삽질하지 말 것):**
- `backdrop-filter` 가 터치를 막는다 → **근거 없음**(오진이었음). style.css 주석은 무시할 것
- `disabled` 속성 → 이미 제거됨. `.consent-start:disabled` 규칙은 죽은 코드
- iOS 는 click 을 합성하지 않는다 → 부정확. 직접 등록한 리스너는 항상 동작함

---

## 현재 상태 (v88 배포·검증 완료)

**등록 완료 233구장 4,257홀** — 전부 홀 완전체 + 이미지 존재 검증 통과 (감사 불합격 0)

| 항목 | 수치 |
|---|---|
| 등록 구장 | 233 (국내 골프장 635곳 중) |
| 등록 홀 | 4,257 |
| 홀맵 이미지 | 4,257 (100%) |
| 골프존 3D 영상 | 3,879 |
| AI 캐디용 영상 프레임 | 3,852홀 × 3컷 |

주력 공급원은 **골프존**(218클럽 전량 등록 완료 = 소진). 나머지는 각 골프장 공식 홈페이지 파싱분.

**맛집 기능**: 카카오 로컬 API 연동 완료 (자유로CC 2곳 → 64곳). 키는 app.js `EMBED_KAKAO_B64`.
카카오 개발자 앱 = "Ri-Weather"(ID 1520230), 카카오맵 API 활성화됨(무료 쿼터 이 앱에 귀속).

## 절대 원칙 (사장님 확정)

1. **홀이 하나라도 빠지면 등록 금지** — 공식 홀 수(골프존) = 파싱 홀 수 일치 필수
2. **틀릴 수 있으면 아예 표시하지 않음** — 거리·코스명이 의심스러우면 그 항목만 제거하고 등록
   · 위성사진 기반 홀 트레이싱, 그린 경사 추정은 **전량 폐기**(`js/holesdb.js` 비움)
3. 홀맵 이미지 표준: 지도만, 흰배경, 세로 600px 고정·가로≤680 (`tools/crop_map_only.py`)
4. 미등록 구장은 앱이 **위성 전경 + "홀별 공략 준비 중"** 배너 자동 표시
5. 사용량 절약: 단계별 확인 왕복 금지 — 일괄 실행 + 자동 검증 + 최종 요약

## 골프존 파이프라인 (주력)

```
tools/golfzon_collect.py        골프존 로비 API로 클럽·홀 JSON 수집 → coursedata/golfzon/cc_*.json
tools/gz_link_kakao.py          골프존 클럽명 ↔ golfdb.js 연결 (카카오 주소/POI 검증)  [--write]
tools/golfzon_build.py          골프존 JSON → parsed.json (홀맵 이미지 크롭 + 영상 URL) [--write]
tools/extract_video_frames.py   3D 영상에서 3컷 추출 → parsed.json 에 frames 기록
```

**골프존 JSON 구조 주의**: 홀 목록은 `holeInfo.holeInfoList` 가 **코스별 2차원 배열**이다.
(`len(holeInfoList)` = 코스 수, 홀 수는 `sum(len(c) for c in holeInfoList)`)

**클럽명 매칭이 핵심 난관**. 과거 37곳이 데이터를 갖고도 누락됐던 원인:
- `golfzon_build.load_golfdb()` 가 별칭 필드 `a`를 안 읽었음 → `coursedata/gz_alias.json` 참조로 해결
- Nominatim이 한국 지번주소(`산 39-1`)를 못 찾음 → **카카오 로컬 API**로 교체(실패 0건)

**연결 판정 규칙** (오연결 방지, `gz_link_kakao.py`):
1. `CONFIRMED` 표 — 카카오 주소가 완전히 같아 사람이 확인한 개명 구장 (H1 CLUB=에이치원클럽,
   포웰CC 안성=루나힐스안성CC, 청우GC=알프스대영CC, 한림용인CC=레이크힐스용인CC, 화순엘리체CC=엘리체CC)
2. 정규화 이름 완전일치 → 지오코딩 없이 연결 (오지오코딩 방지)
3. 좌표 2.5km 이내 + 이름 유사 후보가 **정확히 1곳**일 때만 연결
4. `FORCE_NEW` — 이름은 비슷해도 주소가 다른 별개 구장은 신규 항목으로 추가
   (골프존카운티 구미≠구미CC, 골프존카운티 순천≠순천CC, 해비치 제주≠해비치CC 등)

**같은 구장이 앱DB에 2항목**인 경우 `build_holeimgdb.py` 의 `MIRROR` 로 키 복제
(예: 샤인빌파크 PALM/RIVER → 어느 쪽으로 찾아도 같은 데이터).

## 홈페이지 파이프라인 (보조)

```
tools/analyze_registrable.py    수집 자산 → 등급 A~E 판정 (registrable_analysis.json)
tools/universal_build.py        사이트 유형 자동판별 파싱 → 검증 → 등록
      --club "타이거CC" --db "타이거CC" --slug tiger [--write]
      --batch --grades ABCD --write        (일괄, 이어하기 자동)
tools/cleanup_registrations.py  중복·코스명불량·거리이상 자동 정리
tools/audit_registered.py       품질 감사 (파합계·이미지·TIP·거리 상식)  [--fix 시 불합격 삭제]
tools/match_dbnames.py          등록 구장명 ↔ golfdb.js 표기 일치 교정
tools/build_holeimgdb.py        parsed.json → js/holeimgdb.js 조립
tools/release_courses.py "메시지"  조립+무결성+버전업+push 원클릭 배포
tools/export_status_excel.py    골프장DB.xlsx 현황 분류표 생성
```

**지원 사이트 유형** (universal_build.py): `holebox`(타이거형) · `tabpane`(감곡형) · `holeinfo`(몽베르형)
· `generic`/`generic-loose`(홀번호 이미지 + 주변 문맥 해석) · `perhole`(홀별 개별 페이지).
페이지마다 전 파서를 시도해 **연속 홀 세트를 만드는 최선**을 채택.

**검증 게이트** (하나라도 실패 시 등록 안 함): 홀번호 연속 · 공식 홀수 일치 · 9의 배수 · 이미지 존재
· 이미지 세로형 · 9홀 파합계 33~39(파3코스 예외) · 동일 도메인 중복 등록 방지

## AI 캐디

`js/app.js` 가 홀맵 이미지 + **골프존 3D 영상 프레임 3컷**을 함께 Gemini에 보내 공략 생성.
모델 `gemini-flash-latest`, 실패 시 `gemini-flash-lite-latest`. 영상은 AI 캐디 **아래쪽**에 별도 배치.

## 골프장DB.xlsx (현황 분류표)

시트: 한국 전체(635) / 등록완료(233) / 제작가능(0) / 부분수집(25) / 자료부족(181) / 자료없음(197) / 일본 / 중국
상태별 색상 구분, 각 행에 홀이미지 수·공식 홀수·실패 사유·홈페이지 URL 기록.
`python tools/export_status_excel.py` 로 언제든 갱신 (파일 열려 있으면 골프장DB_현황.xlsx로 저장).

## 7/22 회사에서 새로 만든 기능 (전부 배포·검증 완료)

| 기능 | 파일 | 비고 |
|---|---|---|
| **집·회사 동시작업 동기화** | `tools/sync.py` | 충돌 자동해결. 13개 시나리오 검증 통과 |
| **배포 검증** | `tools/verify_deploy.py` | 실제 서버에서 404·버전·빌드 확인 |
| **홈 화면 추가 버튼** | `#install-cta`, `#guide-sheet` | 아이폰/안드로이드/인앱 자동 감지. 설치하면 자동으로 사라짐 |
| **이용약관 동의 화면** | `#consent-view`, `js/legal.js` | 14세·약관 필수 / 위치·연령대성별·마케팅 선택 |
| **약관 미동의 안내** | `#nag-sheet`, `CONSENT_NAG` | '나중에' 누르면 화면이동 5회마다 재안내 |
| **AI 캐디 개인화** | `playerTraits()`, `playerTraitGuide()` | 연령대·성별·**구력**을 실제 공략에 반영 |
| **업데이트 알림** | `#update-toast`, `APP_NOTE` | 버전 오르면 무엇이 바뀌었는지 4.5초 표시(배포 메시지 자동 반영) |
| **캐시 강제 초기화** | `?reset` | 주소 뒤에 붙이면 캐시·SW·저장값 삭제 후 최신으로 |

### 약관 관련 법적 근거 (조사 완료 — 변경 시 주의)
- **위치 좌표를 서버로 보내지 않는 한 위치기반서비스사업 신고 의무 없음**
  (방통위 해설서 명문). 좌표를 서버 저장하면 신고 필요 + 미신고 시 3년 이하 징역/3천만원 이하 벌금.
  → **절대 좌표를 서버로 보내지 말 것.** 통계가 필요하면 '조회한 골프장 ID'만 보낼 것.
- **선택 항목 미동의를 이유로 서비스 전체를 막으면 과태료 3천만원**(개인정보보호법 제16조③).
  그래서 위치·연령대·성별은 전부 **선택**이고, 미동의해도 모든 기능이 동작해야 함.
- 선택 항목 **기본 체크 금지**(다크패턴), 면책 조항에 **"고의 또는 중대한 과실이 없는 한"** 단서 필수.
- 회사 정보 미기입 상태: `js/legal.js` 의 `COMPANY` 에 사업자등록번호·주소·전화 넣어야 함(사장님 확인 필요).




## 2026-07-24 집 PC 작업 요약 (v105 배포됨)

**백엔드(Apps Script) 가동** — 사장님 계정에 '골프라이프 백엔드' 설치·배포 완료 (버전 7).
- URL은 js/stats.js `RIW_BACKEND` 에 있음. 시트 '골프라이프 통계'(log)로 이용통계 수집 중.
- 기능: doPost(통계 수집) / fn=placephotos(카카오 사진탭, 음식→메뉴→실내→실외 순) /
  fn=placemeta(평점·리뷰수 일괄) / fn=summary&pw=(관리자 요약, 비번 Code.gs ADMIN_PW)
- 코드 수정 시: tools/apps_script/Code.gs 수정 → script.google.com에서 붙여넣기 → 저장 →
  배포 관리 → ✏️ → 새 버전 → 배포 (URL 불변). **사진 소스는 반드시 '사진탭(tab/photos)' 유지** —
  이미지 검색·블로그 썸네일은 다른 가게 사진이 섞였던 사고 원인.

**맛집 완성** — 추천순(카카오 평점, 가게ID 정확) 기본 + 거리순/종류 칩 + 전면 펼침 카드(v2)
+ 사진 위에서부터 lazy 로딩 + 네이버 검증 링크. 예전 접이식은 app.js `FOOD_UI_V2=false` 로 복귀 가능.
가격순은 데이터가 없어 미구현(추측 금지).

**레이더 교체** — RainViewer가 무료 예측 중단(과거만 제공)해서, 한국 구장은
기상청 공식 '실황+2시간 예측' GIF(`weather.go.kr/w/repositary/image/rdr/img/qpr_{tm10분}.gif`)로 교체.
내 골프장 확대(2.4x)+빨간 점: 위경도→픽셀 아핀 보정(제주·울릉·독도·백령 4점, 잔차 ±2px) — app.js kmaPx().
상단 시각 띠 = 같은 GIF의 제목부(0,0~340,26)를 잘라 확대(동일 URL GIF는 프레임 동기 재생).
해외 구장은 기존 RainViewer 유지.

**로고 논의 중** — 이름 '골프라이프' 확정 분위기. naming.html(로컬 시안 페이지)에 마지막 후보
('P 문법의 G' 4안) 있음. 미확정.

## 7/24 회사 PC — 멈춤·오류 전수 감사 반영 (v107~v108, 전부 실서버 검증됨)

- **무한 로딩 제거**: `fetchT(url, opts, ms)` 도입(app.js 2350대). 날씨·검색·레이더·카카오·백엔드·사진·경로·AI·타일·프레임 **16곳 전부 시간제한**. 새 fetch 는 반드시 fetchT 사용.
- **회색 화면(스크롤해야 복구) 원인 3종 수정**:
  ① 평점 늦게 도착 시 스크롤 중 목록 재정렬 → 상단(scrollY≤200)일 때만 즉시 재정렬, 스크롤 중엔 배너를 '⭐ 추천순으로 보기' 버튼으로 전환(.food-reco-banner 는 sticky)
  ② body 의 background-attachment:fixed → body::before 고정 레이어로 분리 (iOS 타일 미갱신 버그)
  ③ .float-btn 의 backdrop-filter 제거(스냅샷 미갱신) — 배경 불투명도로 대체
- **지도 라이브러리 내장**: unpkg CDN → js/vendor/leaflet.js + css/leaflet.css (SW CORE 포함).
  설치형 PWA 오프라인에서 L 미정의 → 빨간 배너 연쇄가 원인이었음. openDetail/openCourseView 에 typeof L 가드.
- **오류 표시기**: 빈 이벤트 억제 조건에서 lineno 제외(빈 ErrorEvent 는 lineno=0 이라 v107 조건이 뚫렸음).
- **맛집 평점**: 백엔드 null 응답 검증(캐시 오염 방지) + Number() 강제(문자열 "4.5" → toFixed 크래시 방지) + .then 체인 .catch.
- 사용자 폰이 구버전이면: 홈 배지 APP_VER 확인 → `?reset` 안내.

## 다음 작업

0. **관리자 모드 + 통계 백엔드** ← 사장님이 요청한 다음 순서
   - 설계 방향 확정: Google Apps Script + 스프레드시트(무료), **좌표는 절대 수집 안 함**
   - 수집: 접속수, 조회한 골프장, 사용 기능, 기기종류, 연령대·성별(동의자만)
   - 관리자 화면: 숨은 주소 + 비밀번호. 일별 추이·인기 구장·성별연령 분포
   - ⚠️ 사장님이 직접 해야 하는 준비: 스프레드시트 생성 + Apps Script 배포(약 5분, 안내 필요)
1. **홈 화면 추가 안내 개선** — 고령 이용자가 직접 하기 어려워함.
   iOS는 프로그래매틱 설치가 **불가능**(애플 제약)하므로 안내 UX로 해결해야 함(화살표·그림 등)
2. **부분수집 25곳** — 홀 이미지를 이미 받아놨으므로 사이트별 전용 파서만 붙이면 등록 가능.
   가장 현실적인 다음 타깃. `registrable_analysis.json` 에서 `hole_imgs>=3` 인 항목 참조.
2. **자료부족 181곳** — 수집기 이미지 상한(30장) 상향 후 재수집·재분석
3. **자료없음 197곳** — 홈페이지에 홀맵을 안 올리는 곳이 다수. 추정 금지(원칙 2), 준비중 유지
4. 프레임 추출 실패 27홀 재시도 (`extract_video_frames.py` 는 이어하기 지원)

## 참고

- Gemini API 키: extract_tips.py 등에 내장 (무료 한도, 429 시 재시도)
- 골프존 API: `https://lobby.golfzon.com/v1/dotcom/courses/course/{ciCode}/details/hole-info`
  홀맵 이미지 `https://o.gzcdn.net/images/cc{mapUrl}` · 3D영상 `https://mediathumbnail.golfzon.com/media/cc/hole3d/{videoMapUrl}.mp4`
  (영상은 CORS 미허용 → 브라우저 JS로 바이트 읽기 불가. 프레임은 ffmpeg로 서버에서 추출해 저장)
- 배포: `release_courses.py`가 APP_VER·sw.js 캐시 동기화까지 처리
- 회사 PC Python: `C:\Python314\python.exe` (selenium·pillow 설치됨)
- ⚠️ 이 PC의 Git Bash에는 `pkill`/`pgrep` 없음. 프로세스 종료는 PowerShell로:
  `Get-CimInstance Win32_Process -Filter "Name='python.exe'" | ? {$_.CommandLine -like "*키워드*"} | % {Stop-Process -Id $_.ProcessId -Force}`
- 장시간 작업은 PowerShell `Start-Process ... -RedirectStandardOutput` 으로 백그라운드 실행
