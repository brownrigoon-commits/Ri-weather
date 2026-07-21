# Ri-Weather 작업 이어하기 가이드 (2026-07-21 퇴근 백업)

집/회사 어디서든: `git pull` 후 이 문서대로. 로컬 서버: `python -m http.server 8734`

## 현재 상태 (v57 배포됨)

**등록 완료 8항목 198홀 (전부 홀 완전체 검증됨):**
서서울(18) · 몽베르(18) · 더스타휴(18) · 샴발라(18) · 신라CC(27) · 파주CC(18) · 클럽72 하늘(18) · 클럽72 바다(63)

**절대 원칙 (사장님 확정):**
1. 홀이 하나라도 빠지면 등록 금지 (공식 홀 수 = 등록 홀 수 검증 필수. 사이트가 OUT만 보여주면 `_2` 같은 숨은 IN 페이지 확인 — 클럽72에서 실제 발생)
2. 미등록 구장은 앱이 자동으로 "홀별 공략 준비 중" 배너 표시 (index.html #course-prep-note)
3. 홀맵 이미지 표준: 지도만(글자·사진 제거), 흰배경, 세로 600px 고정·가로≤680 (`tools/crop_map_only.py`)
4. 사용량 절약: 단계별 확인 왕복 금지 — 스크립트 일괄 실행 + 자동 검증 + 최종 요약만

## 파이프라인 도구

| 도구 | 역할 |
|---|---|
| `tools/crop_map_only.py` | 홀맵 표준 크롭 (keep="largest" 카드형 / keep="all" 지도+범례형) |
| `tools/build_holeimgdb.py` | homepages/*/parsed.json → js/holeimgdb.js 조립 |
| `tools/release_courses.py "메시지"` | 조립+무결성검사(홀수·이미지존재)+버전업+push 원클릭 배포 |
| `tools/collect_v2_selenium.py` | 수집기 v2 (크롬 렌더링, SPA/프레임 대응, 이어하기 지원) |
| `tools/session_scripts/onetheclub_build.py` | 원더클럽 계열(신라·파주·클럽72) 등록 — 유사 구조 사이트 참고용 |
| `tools/session_scripts/shambhala_build.py` | HTML 파싱형 등록 예시 (TIP·거리가 HTML에 있으면 OCR 불필요) |
| `tools/session_scripts/starhue_ocr.py` | 이미지 카드형 등록 예시 (Gemini OCR + 공식표 교차검증) |

## 진행 중 (회사 PC — 끄지 말 것!)

- **수집기 v2가 미확보 545개 구장을 순회 중** (밤새 돌면 완료 예상)
- 진행 저장: `coursedata/workfiles/collect_v2_progress.json` — 중단돼도 `python tools/collect_v2_selenium.py` 재실행하면 이어서 함
- 끝나면 `python tools/session_scripts/survey_registrable.py` 재실행 → A등급(등록 후보) 갱신됨

## 다음 작업 (집에서 가능)

1. **A등급 구장 등록** — `coursedata/workfiles/registrable_survey.json`의 A등급 76개(수집 완료 후 갱신).
   등록 스크립트는 사이트에서 직접 받아오므로 회사 PC 자료 없이도 집에서 작업 가능.
   같은 솔루션 묶음부터: 에콜리안 4곳(거창·광산·영광·정선), 마이다스 2곳, 테디밸리 2곳
   ⚠️ 반드시 공식 홀 수 확인 → 전 홀 확보된 구장만 등록 (원칙 1)
2. 클럽72 검색 이름: 골프DB에 옛 이름 "스카이72"로 등록돼 있음 — "클럽72" 검색되게 하려면 golfdb.js 이름/별칭 수정 필요
3. 우선순위 잔여: 자유로(ClickIt JS 구조), 노스팜, 서원힐스, 라싸, 포천힐마루, 푸른솔포천

## 자동 등록 진행 메모 (집 PC, 2026-07-21 밤)

- v58~v60: 감곡CC 18홀 등록(그린 경사도맵 신기능 포함), 클럽72 이름 정리, 앱 공유 버튼
- `tools/pattern_scan.py`: 수집 629클럽 솔루션 분류 — tabpane(감곡형) 3, holeinfo(몽베르형) 9, asp_hole(샴발라형) 9
- `tools/tabpane_build.py` (범용 감곡형 등록기) **미완성 이슈**:
  - 같은 코스 페이지가 URL 변형으로 중복 파싱됨 → 홀구성(번호+파 시그니처)으로 dedupe 필요
  - 코스명이 "02" 같은 URL 슬러그로 잡힘 → nav 활성 탭 텍스트 우선으로
  - 파인밸리: 파6 파싱됨(오파싱 의심) → 해당 블록 원문 확인 필요
  - golfzon_holecount 이름 매칭 강화 필요 (공백/CC 변형)
- `tools/refetch_images.py` 백그라운드 실행 중이었음 (408곳 이미지 복원) — 완료 여부 확인 후 `survey_registrable.py` 재실행

## 참고

- Gemini API 키: extract_tips.py 등에 내장된 것 사용 (무료 한도, 429 시 재시도)
- 배포: `release_courses.py`가 알아서 함 (APP_VER·sw.js 캐시 동기화 포함). 수동 시 둘 다 올려야 캐시 갱신됨
- 회사 PC Python: `C:\Python314\python.exe` (selenium·pillow 설치됨)
