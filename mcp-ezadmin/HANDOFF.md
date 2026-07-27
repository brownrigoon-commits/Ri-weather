# mcp-ezadmin 인수인계 (2026-07-27 밤, 집 PC → 회사 PC)

## 지금 상태

- 서버·도구 로직은 완성. `selftest.py` 78개, `mcp_smoke_test.py` 9개 전부 PASS.
- **아직 실제 이지어드민 데이터에 붙지 않았다.** `data/` 안은 전부 샘플 파일이고
  (`주문_샘플.xlsx`, `재고_샘플.xlsx`, `반품_샘플.xlsx`, `주문_샘플2.csv`),
  `config.json` 의 `api.enabled` 는 `false` 다. 지금 조회되는 숫자는 전부 가짜다.

## 오늘 고친 것 (이 커밋)

Claude 에서 이지어드민 도구를 부르면 **연결은 되는데 응답이 영영 안 오는** 문제가 있었다.

- 증상: `initialize`·도구 목록은 정상, 실제 도구 호출만 무한 대기 → 타임아웃.
- 원인: `ezmcp/sources/excel_source.py` 의 `_read_xlsx()` 안에 있던 openpyxl 지연 임포트.
  openpyxl 은 numpy 가 설치돼 있으면 numpy 를 함께 임포트하는데(`openpyxl/compat/numbers.py`),
  이 임포트가 서버 기동 때가 아니라 **도구 호출 처리 중(이벤트 루프 스레드)** 에 처음 일어나면
  numpy C 확장(`_multiarray_umath`) 로딩이 끝나지 않고 멈춘다.
  스레드 스택 덤프로 확인했고, 기동 시점에 미리 임포트하면 즉시 정상 응답하는 것까지 확인했다.
- 조치: 해당 임포트를 모듈 최상단으로 올렸다. 다시 함수 안으로 되돌리지 말 것(코드에 주석 있음).

## 회사에서 할 일

1. `git pull` 후 서버 재시작(= Claude Desktop / Claude Code 재시작해서 MCP 재연결).
2. 실제 이지어드민 데이터 연결 — 둘 중 하나를 고른다.
   - **엑셀 방식(권장, 바로 됨)**: 이지어드민에서 주문·재고·반품을 내려받아
     `data/orders`, `data/inventory`, `data/returns` 에 넣는다. 파일명은 자유.
     샘플 파일은 지운다. 컬럼명이 다르면 `config.json` 의 `columns` 로 매핑.
   - **API 방식**: `config.json` 의 `api.enabled = true` + `base_url`·`endpoints` 채우고,
     인증키는 반드시 `.env` 에만 넣는다(`EZADMIN_API_DOMAIN`, `EZADMIN_API_KEY`).
3. `config.json` 의 `brands` 를 실제 브랜드로 교체(지금은 예시인 "루미네", "베르디").
4. 검증:
   ```
   python scripts/selftest.py
   python scripts/mcp_smoke_test.py
   ```
   그다음 Claude 에서 "이지어드민 연결 상태 확인해줘" → `data_status` 의
   `데이터기준`·`기타상태값`·`warnings` 를 눈으로 확인한다.
   `기타상태값` 에 뜬 상태값은 `config.json` 의 `status_keywords` 에 분류해 넣어야
   미출고·배송 집계가 정확해진다.

## 주의

- `pii_mode` 기본값은 `masked` 를 유지한다. 실데이터를 붙이는 순간부터 진짜 고객정보다.
- `data/`, `.env`, `config.json` 은 `.gitignore` 대상이다. 실데이터를 커밋하지 말 것.
