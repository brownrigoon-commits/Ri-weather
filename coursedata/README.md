# coursedata — 코스공략용 원천 데이터 보관소

앱에 바로 쓰는 데이터가 아니라, 홀별 공략을 정확하게 만들기 위한 **원천 자료 아카이브**.
(수집일: 2026-07-20)

## golfzon/ — 골프존 코스 DB (lobby.golfzon.com API)

- `search_*.json` — 검색 결과 원본
- `cc_{ciCode}_{이름}.json` — 코스 상세 + 홀별 정보
  - `holeInfo.holeInfoList[코스][홀]`: holeNo, basicPar, 티별 거리(champTee/backTee/frontTee/seniorTee/ladyTee, 미터),
    티별 고도차(height*Tee), **description(골프존 공식 홀 공략 텍스트)**, mapUrl(야디지맵), videoMapUrl(3D영상)
- `yardage/` — 홀별 야디지맵 이미지 (원본: `https://o.gzcdn.net/images/cc{mapUrl}`)
- 이미지 파일명 규칙: `yardage_entire_{ccMasterSeq}_{코스번호}_{홀번호}.jpg`

### 골프존에 있는 구장 (사장님 방문 구장 기준)
서서울 CC(102949121), 자유로 CC(대한/민국/통일 3조합), 노스팜 CC, 서원힐스 CC(EAST/WEST/SOUTH 3조합),
동강시스타 CC, 샴발라 CC, 라싸 GC(3조합), 원더클럽 신라(=신라CC, 남/동/서 3조합), 타이거 CC, 필로스 CC(3조합)

### 골프존에 없는 구장 → 공식 홈페이지에서 수집
몽베르, 베스트밸리, 스마트KU, 더스타휴(완료), 감곡, 포천힐마루, 알프스대영, 푸른솔포천, 클럽72, 스프링힐스, 파주(원더클럽 파주)
- 주의: "동훈힐마루 CC"(경남)와 "푸른솔 GC 장성"(전남)은 동명이인 구장 — 사장님 방문 구장 아님

## thestarhue/ — 더스타휴 공식 홈페이지 자료
- `starhue_official.json` — STAR 1-9 / HUE 10-18 파·거리 (공식)
- `starhue_layout.jpg` — 공식 코스 레이아웃 (홀 번호 표시)
- `shole_01~09.jpg` / `hhole_01~09.jpg` — 홀별 상세 다이어그램

## API 참고 (골프존)
- 검색: `GET https://lobby.golfzon.com/v1/dotcom/courses/course/search/list?searchWord={이름}&page=1&size=20`
- 상세: `GET .../courses/course/{ciCode}/details`
- 홀정보: `GET .../courses/course/{ciCode}/details/hole-info`
- 홀별 유저공략 글: `GET .../courses/{ciCode}/strategies/{홀번호}?page=1`
- 저작권 주의: description·이미지는 골프존 자산 — 앱에는 그대로 싣지 말고 참고자료로만 사용, 공략 문구는 재작성할 것.
