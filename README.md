# Ri-Weather ⛳ — 골프장 날씨 (베타)

가려는 골프장의 날씨를 한눈에 확인하는 모바일 웹앱입니다. 로그인 없이 바로 사용합니다.
**🇰🇷 한국 · 🇯🇵 일본 · 🇨🇳 중국** 골프장 약 2,900곳을 검색할 수 있습니다.

## 주요 기능

1. **골프장 검색 & 저장** — 한/일/중 골프장을 이름(현지어·영문)으로 검색, ☆ 버튼으로 홈 목록에 저장됩니다 (기기 로컬 저장, 로그인 불필요).
2. **시간별 날씨** — 24시간 기온·강수확률·날씨 아이콘.
3. **강수 레이더** — 시간별 비구름 이동 애니메이션. 하단 타임라인(과거→예측 30분), 골프장 위치는 **녹색점**으로 표시되고 그 지점의 강수량(mm/h)이 칩으로 표시됩니다.
4. **상세 지표** — 강수량(현재/오늘 누적), 습도(이슬점·체감), 바람(풍속·풍향·돌풍), 가시거리(미세먼지 등급 포함).

## 실행 방법

브라우저에서 `index.html`을 열면 됩니다. 로컬 서버로 여는 것을 권장합니다:

```
cd Ri-weather
python -m http.server 8123
# 브라우저에서 http://localhost:8123 접속
```

핸드폰에서 보려면 같은 와이파이에서 `http://<PC IP>:8123` 으로 접속하세요.

## 사용 데이터 (모두 무료, API 키 불필요)

| 용도 | 서비스 |
|---|---|
| 날씨 예보 (기온/강수/습도/바람/가시거리) | [Open-Meteo](https://open-meteo.com) |
| 미세먼지 (PM10/PM2.5) | Open-Meteo Air Quality |
| 강수 레이더 타일 | [RainViewer](https://www.rainviewer.com) |
| 장소 검색 | Nominatim (OpenStreetMap) |
| 지도 | Leaflet + CARTO 다크 타일 |

## 파일 구조

```
Ri-weather/
├── index.html      # 화면 구조 (홈 + 상세)
├── css/style.css   # 모바일 다크 테마 스타일
└── js/app.js       # 검색/저장/예보/레이더 로직
```

## 참고

- 검색은 OpenStreetMap 데이터 기반이라 일부 골프장은 정식 명칭으로 검색해야 나올 수 있습니다.
- 베타 버전으로 참고용이며, 실제 기상 정보와 다를 수 있습니다.

---

# Ri_Stock 📈 — 주식 분석표 자동 갱신 (같은 저장소, 별도 앱)

이 저장소에는 앱이 **두 개** 있습니다. 위쪽이 골프장 날씨 앱, 여기부터가 주식 앱입니다.
파일이 겹치지 않아 서로 영향을 주지 않습니다.

- 앱 주소: `https://brownrigoon-commits.github.io/Ri-weather/ristock/`
- 폴더: **`ristock/`** 하나 (골프앱은 저장소 최상단)

## 무엇을 하나

시가총액 상위 300종목(한국·미국)을 **하루 두 번 자동으로 수집·평가**해서 폰에서 바로 보게 합니다.
13개 항목으로 점수를 매기고, 전략 8종에 맞는 종목을 섹터별로 골라 줍니다.

| 화면 | 내용 |
|---|---|
| 오늘 브리핑 | 시장 분위기 한 줄 · 섹터 순위 · **어제 대비 신규 편입/이탈** · 데이터 신선도 |
| 전략 | 전략 8종 → 한국·미국 섹터별 5종목 카드 |
| 나만의 전략 | 필터 8개 토글 + 순위 기준 → 즉시 재계산 (폰에 저장) |
| 종목 | 시총 300 목록 · 검색 · 섹터 필터 · 점수 상세 · ☆ 관심종목 |
| 내보내기 | 현재 결과를 CSV로 (엑셀에서 바로 열림) |

> ⚠️ **스크리닝 참고자료일 뿐 투자 권유가 아닙니다.** 투자 판단과 책임은 본인에게 있습니다.

## 자동 갱신

| 한국시간 | 누가 |
|---|---|
| 16:30 월~금 · 07:00 화~토 | 깃허브 서버 (`.github/workflows/ristock-daily.yml`) |
| 16:40 · 07:10 매일 | 집 PC (`tools/ristock_실행.bat`) |

깃허브 서버는 해외 IP라 네이버 금융이 한국 데이터를 막을 때가 있습니다.
그래서 **두 겹**으로 돌립니다. 한쪽만 성공해도 데이터가 채워지고,
실패한 시장은 **이전 데이터를 그대로 유지**합니다(빈 데이터로 덮어쓰지 않습니다).
한쪽만 며칠 계속 실패하면 저장소 Issues 탭에 알림이 자동으로 열립니다.

## 폴더

```
ristock/
├── index.html  css/  js/  sw.js  icons/     화면 (PWA)
├── data/                                    자동 생성물 — 손으로 고치지 말 것
├── engine/                                  파이썬 수집·평가 엔진 (+ tests/)
└── tests/                                   화면 검증 (헤드리스 크로미움)

tools/ristock_실행.bat          집 PC 갱신 (더블클릭)
tools/ristock_스케줄등록.ps1     윈도우 예약 등록/해제
tools/ristock_출고점검.py        올리기 전·후 관문
docs/ristock_사용안내.md         사장님용 사용 설명서
docs/ristock_설계.md             엔진·화면·자동화 공유 계약서
```

## 직접 돌려 보기

```
# 화면만 보기
python -m http.server 8791          # 저장소 최상단에서
# → http://localhost:8791/ristock/

# 데이터 새로 만들기 (8~15분, 인터넷 필요)
pip install -r ristock/engine/requirements.txt
python -m ristock.engine.pipeline --market all --top 300 --archive --runner pc

# 검증 (네트워크 없이 동작)
python -m pytest ristock/engine/tests -q
node ristock/engine/tests/test_js_golden.mjs
node ristock/tests/verify_pwa.mjs
node ristock/tests/verify_phone_e2e.mjs
```

**점수 체계와 전략 선정 결과는 기존 프로그램과 완전히 같아야 합니다.**
`ristock/engine/tests/` 의 정답지가 이를 지킵니다.

## 사용 데이터

| 용도 | 서비스 |
|---|---|
| 시세·재무 (미국·한국) | Yahoo Finance (`yfinance`) |
| 한국 재무·수급 | 네이버 금융 |
| 10개국 뉴스 | Google 뉴스 RSS |
