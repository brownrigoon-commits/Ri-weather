# 04. MCP 도구 명세 (5개 — 추가 금지)

## 공통 규칙

- 도구 이름은 영문, description(docstring)은 한국어로 상세히 — Claude가 자연어 질문을
  올바른 도구·파라미터로 변환하는 근거가 된다. 파라미터 설명에 예시 값을 넣을 것
- 반환은 JSON(dict). **키는 한국어**(사장님이 Claude Desktop에서 원본을 봐도 읽히게).
  값의 날짜는 `"YYYY-MM-DD HH:MM"` 문자열로 변환해 직렬화 문제가 없게 한다
- 모든 응답 최상위에 `meta` 블록(01 문서) 포함. 오류도 `{"오류": "한국어 메시지", "meta": ...}`
- 목록 반환 규칙: `limit` 기본값은 도구별 명시, 최대 100. 전체 건수와 표시 건수를
  함께 반환 — `"총건수": 137, "표시": 20`
- PII 마스킹은 service 출력 단계에서 일괄 적용 (06 문서)

## 기간 파라미터 공통 규칙 (`dates.py`)

- `period` 키워드 (KST 기준, 주는 **월요일 시작**):
  `오늘` `어제` `이번주` `지난주` `최근7일` `최근30일` `이번달` `지난달`
- `start_date`/`end_date`(`YYYY-MM-DD`)가 오면 period보다 우선. `end_date`는 **그날 포함**
- 기간 필터 기준 필드: 주문·미출고 = `order_date`, 반품 = `receive_date`
- 응답에 해석된 기간을 명시: `"조회기간": "2026-07-21 ~ 2026-07-27 (이번주)"`

---

## 1) `data_status()` — 연결·데이터 상태 진단

파라미터 없음. Claude Desktop 연결 확인("이지어드민 연결 상태 확인해줘")과 문제 진단에 사용.

반환:
```json
{
  "서버": "ezadmin-mcp",
  "소스모드": "excel(고정)",
  "활성소스": "excel",
  "데이터폴더": "C:/.../mcp-ezadmin/data",
  "데이터": {
    "주문":  {"파일수": 2, "최신파일": "주문_0727.xlsx", "수정시각": "2026-07-27 09:12", "행수": 1863, "기간": "2026-07-01 ~ 2026-07-27"},
    "재고":  {"파일수": 1, "...": "..."},
    "반품":  {"파일수": 0, "안내": "data/returns/ 에 반품 엑셀이 없습니다. 반품 조회는 주문 데이터로 대체합니다."}
  },
  "기타상태값": ["발주대기(3건)"],
  "API": "미설정 (config.json api 섹션 비어 있음)",
  "브랜드": ["루미네", "베르디"],
  "pii_mode": "masked",
  "meta": { "..." : "..." }
}
```
`기타상태값`: 상태 버킷이 "기타"로 빠진 원문 상태들 — config 보강 대상을 바로 보여준다.

## 2) `inventory_lookup(query="", brand="", low_stock_only=False, limit=50)` — 재고조회

SKU 코드·상품명 키워드(`query`) 또는 브랜드명(`brand`)으로 현재 수량과 **재고 위치** 조회.

- `query`: 상품코드·상품명·옵션에 대해 부분 일치(정규화 후)
- `brand`: 05 문서 규칙으로 매칭
- `low_stock_only=True`: 가용재고 ≤ 안전재고(안전재고 컬럼 없으면 config
  `low_stock_threshold`, 기본 3) 인 행만
- 정렬: 가용재고 오름차순 (부족한 것 먼저)

반환 행: `상품코드, 상품명, 옵션, 브랜드, 현재고, 가용재고, 안전재고, 위치, 재고부족` +
합계 블록: `"합계": {"품목수": 12, "현재고": 340, "가용재고": 311, "재고부족": 2}`

가용재고 컬럼이 없거나 0이면 현재고 값을 가용재고로 대신 쓴다. 그렇게 하지 않으면
가용 컬럼이 없는 엑셀에서 모든 품목이 재고부족으로 잡힌다.

## 3) `order_lookup(order_no="", period="", start_date="", end_date="", brand="", status="", query="", limit=20)` — 주문조회

- `order_no`가 있으면 **단건 상세**: 정확 일치 우선, 없으면 부분 일치 목록.
  상세에는 표준 필드 전부 + `extras`(06 문서 PII 필터 통과분) + 반품 데이터에 같은
  주문번호가 있으면 `반품정보` 블록 포함
- `order_no`가 없으면 **기간 목록**: 기간 기본값 `최근7일`. `status`는 버킷명
  (신규주문/배송준비/배송중/배송완료/취소/반품/교환/보류) 또는 원문. `query`는
  상품명·수취인·주문번호 부분 일치
- 목록 정렬: 주문일 내림차순. 목록 행: `주문번호, 판매처, 브랜드, 주문일시, 상태, 상품명, 옵션, 수량, 금액, 수취인(마스킹), 송장번호`
- 집계 블록 포함: `"집계": {"총건수": 137, "상태별": {"배송완료": 90, "배송중": 30, ...}, "총수량": 210, "총금액": 5400000}`

## 4) `unshipped_list(period="", brand="", limit=50)` — 미출고목록

접수됐지만 출고(송장 등록)되지 않은 건.

- **판정 규칙**: `tracking_no 없음` AND `상태 버킷 ∉ {배송중, 배송완료, 취소, 반품, 교환}`
  (버킷이 "기타"여도 송장이 없으면 포함하고 행에 원문 상태를 표시)
- 기간 기본값: **전체** (오래 방치된 미출고가 관심 대상이므로 기간으로 자르지 않는다)
- 정렬: 주문일 오름차순(오래된 것 먼저). 행에 `경과일`(주문일→오늘, KST) 포함
- `지연` 플래그: 경과일 ≥ config `unshipped_delay_days`(기본 2)
- 집계: `"집계": {"총건수": 14, "지연건수": 5, "버킷별": {"신규주문": 4, "배송준비": 9, "보류": 1}}`

## 5) `shipping_lookup(order_no="", tracking_no="", period="", brand="", direction="전체", limit=20)` — 배송조회

출고 배송과 반품(수거) 배송이 지금 어떤 상황인지 확인. 파일상 상태 + **택배사 송장 조회 링크** 제공.

- `direction`: `출고` | `반품` | `전체`(기본)
  - 출고: orders에서 `tracking_no` 있는 행
  - 반품: returns의 수거송장 행 + orders의 반품/교환 버킷 행
- `order_no`/`tracking_no`로 단건 검색(정확→부분), 없으면 기간 목록(기본 `최근7일`,
  기준 필드: 출고=shipped_date 없으면 order_date, 반품=receive_date)
- 행: `구분, 주문번호, 브랜드, 상품명, 옵션, 상태, 원문상태, 택배사, 송장번호, 발송일, 조회링크, 수취인(마스킹)`
- `구분` 값은 세 가지: `출고`(orders의 송장 있는 행) · `반품수거`(returns의 수거 행) ·
  `반품(주문기준)`(returns에 해당 주문번호가 없고 orders 상태만 반품/교환인 행)
- `조회링크`: couriers.py에서 택배사명 부분 일치로 URL 생성

### 택배사 조회 URL 템플릿 (couriers.py, `{t}`=송장번호 숫자만)

| 매칭 키워드 | URL |
|---|---|
| cj, 대한통운 | `https://trace.cjlogistics.com/next/tracking.html?wblNo={t}` |
| 한진 | `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2={t}` |
| 롯데 | `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo={t}` |
| 로젠 | `https://www.ilogen.com/web/personal/trace/{t}` |
| 우체국, epost | `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1={t}` |
| cu | `https://www.cupost.co.kr/postbox/delivery/localResult.cupost?invoice_no={t}` |
| gs, 편의점 | `https://www.cvsnet.co.kr/invoice/tracking.do?invoice_no={t}` |
| 경동 | `https://kdexp.com/service/delivery/etc/delivery.do?barcode={t}` |
| (그 외) | `https://search.naver.com/search.naver?query={택배사명}+송장조회+{t}` |

⚠️ 택배사 URL은 바뀔 수 있다. config `courier_urls`로 덮어쓸 수 있게 하고,
구현 시 위 URL이 유효한지 1회 확인한다(브라우저 확인이면 충분, 코드에서 호출 검증은 불필요).

---

## 자연어 질문 → 도구 매핑 예시 (docstring 작성 가이드)

| 예상 질문 | 호출 |
|---|---|
| "루미네 이번주 재고 얼마 남았어?" | `inventory_lookup(brand="루미네")` (재고는 현재 스냅샷 — 기간 개념 없음을 답변에서 설명) |
| "재고 부족한 것만 보여줘" | `inventory_lookup(low_stock_only=True)` |
| "LM-001 재고 어디 있어?" | `inventory_lookup(query="LM-001")` → 위치 컬럼 |
| "이번주 주문 몇 건이야?" | `order_lookup(period="이번주")` → 집계 |
| "주문번호 20260727-0012 상세" | `order_lookup(order_no="20260727-0012")` |
| "미출고 몇 건? 오래된 것부터" | `unshipped_list()` |
| "베르디 미출고 지연된 것" | `unshipped_list(brand="베르디")` → 지연 플래그 |
| "송장 6789… 지금 어디쯤이야?" | `shipping_lookup(tracking_no="6789...")` → 조회링크 안내 |
| "반품 수거 진행 상황" | `shipping_lookup(direction="반품")` |
| "MCP 연결 됐어?" | `data_status()` |
