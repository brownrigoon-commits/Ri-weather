# Ri-Weather 작업 이어하기 가이드 (2026-07-22 갱신)

집/회사 어디서든: `git pull` 후 이 문서대로. 로컬 서버: `python -m http.server 8734`
권한 설정(승인 질문 없애기): `Github_코드백업/_클로드_설정/설정적용.py` 실행 후 클로드 재시작.

## 현재 상태 (v78 배포됨)

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

## 다음 작업

1. **부분수집 25곳** — 홀 이미지를 이미 받아놨으므로 사이트별 전용 파서만 붙이면 등록 가능.
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
