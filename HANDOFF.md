# Ri-Weather 작업 이어하기 가이드 (2026-07-21 백업)

회사 PC에서: `git clone https://github.com/brownrigoon-commits/Ri-weather.git` 후 이 문서대로.
로컬 서버: `python -m http.server 8734` → http://localhost:8734

## 현재 상태 (v50 배포됨)

- **코스공략 서비스 중**: 서서울CC(레이크/마운틴 18홀), 몽베르CC(망무봉 OUT/IN 18홀)
- 확정 포맷: 공식 홀맵 이미지(흰배경, 여백 최대크롭, 70% 표시) → 티별 거리 텍스트 → 공식 공략 TIP 원문 → AI 캐디(구질 맞춤, Gemini)
- 원칙: **틀릴 수 있는 정보는 표시하지 않음** (공식 자료만, 출처 표기)

## 데이터 위치

| 경로 | 내용 |
|---|---|
| `coursedata/golfzon/` | 골프존 전체 DB 498코스 (홀정보 JSON + 야디지맵 9,054장) |
| `coursedata/homepages/` | 수동 수집·가공 (서서울, 몽베르, 더스타휴) + `parsed.json` |
| `coursedata/homepages_auto/` | 자동 수집 218클럽 — 페이지·meta는 깃에 있음, **이미지는 `python tools/refetch_images.py`로 복원** |
| `coursedata/homepages_missing.json` | 골프존 미보유 423구장 홈페이지 검색 결과 (진행 중) |
| `coursedata/workfiles/` | 세션 작업 데이터 (서서울 tips/dists JSON 등) |
| `js/holeimgdb.js` | 앱에 표시되는 홀맵 DB (조립 산출물) |
| `tools/session_scripts/` | 세션에서 쓴 모든 스크립트 사본 |

## 남은 작업 (재개 순서)

1. **누락 구장 홈페이지 재검색**: 1차는 검색엔진 차단으로 실패(2/423).
   `python tools/find_missing_homepages.py --retry-missing --delay 8`
   (연속 실패 8회 → 5분 대기 로직 내장. 몇 시간 소요, 로컬 실행)
2. **찾은 홈페이지 수집**: `python tools/collect_course_homepages.py --seeds coursedata/homepages_missing.json`
3. **구장 등록 파이프라인** (클럽별):
   - 이미지 표준화: `python tools/standardize_holemaps.py <img폴더> <출력폴더>`
   - 파/TIP/거리 추출: `tools/session_scripts/extract_tips.py, extract_dists.py` 참고 (Gemini OCR, 검증 필수)
   - `coursedata/homepages/<구장>/parsed.json` 작성 → `tools/session_scripts/build_holeimg_all.py`로 `js/holeimgdb.js` 조립
   - 이미지는 `holeimg/<구장>/`에 두고 APP_VER·sw.js 캐시 버전 올려 배포
4. 우선순위 구장: 자유로(jayurocc.com, ClickIt JS 구조), 노스팜, 서원힐스, 샴발라(30장 수집됨), 더스타휴(18장 수집됨), 라싸, 신라(원더클럽), 포천힐마루(pocheon.hillmaru.com), 푸른솔포천(purunsol.co.kr)

## 참고

- Gemini API 키는 앱에 내장된 것 사용 (무료 한도, 429 시 재시도)
- 골프존 API: `https://lobby.golfzon.com/v1/dotcom/...` (coursedata/README.md 참고)
- 배포: git push → GitHub Pages 자동 (버전 배지 = APP_VER, sw.js 캐시명 동기화 필수)
