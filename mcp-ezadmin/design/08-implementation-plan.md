# 08. 구현 계획 — Opus 5 지시서

이 문서는 구현 세션(Opus 5)이 그대로 따라야 하는 작업 순서와 완료 기준이다.
**시작 전에 `../CLAUDE.md`와 design/ 00~09 전부를 읽을 것.**

## 파일 트리 (이 구조를 그대로 만들 것)

```
mcp-ezadmin/
  CLAUDE.md                  # 있음 — 규칙 변경 금지, 필요 시 테스트 명령만 갱신
  README.md                  # 재작성: 아래 'README 요구사항' 목차로
  requirements.txt           # mcp, openpyxl 두 줄
  server.py                  # FastMCP 엔트리 (도구 5개, 로직 없음)
  .env.example               # 07 문서 전문 그대로
  config.example.json        # 07 문서 내용을 주석 없는 순수 JSON으로
  .gitignore                 # 있음
  design/                    # 설계 문서 — 구현 중 어긋나면 문서를 먼저 갱신
  ezmcp/
    __init__.py
    envload.py  config.py  dates.py  masking.py  normalize.py
    brands.py  couriers.py  service.py
    sources/__init__.py  sources/base.py  sources/excel_source.py
    sources/api_source.py  sources/router.py
  scripts/
    make_sample_data.py  selftest.py  mcp_smoke_test.py
  data/                      # gitignore. 서버가 orders/ inventory/ returns/ 자동 생성
```

## 마일스톤 순서

| 단계 | 내용 | 검증 |
|---|---|---|
| M1 | envload → config → dates → normalize → excel_source: 폴더 스캔·헤더 탐지·표준 레코드 생성 | make_sample_data로 만든 파일이 정상 파싱되는 단위 확인 |
| M2 | masking, brands, couriers | 마스킹 예시 표(06)와 매칭 규칙(05) 그대로 동작 |
| M3 | service.py 도구 5개 로직 + router + api_source 스켈레톤 | selftest.py 전 항목 PASS |
| M4 | server.py FastMCP 연결 | mcp_smoke_test.py PASS |
| M5 | README 재작성, 최종 점검, 커밋·푸시 | 완료 기준 체크리스트 전부 통과 |

## 테스트 스크립트 명세

### `scripts/make_sample_data.py`
`data/`(또는 `--out` 경로)에 이지어드민풍 샘플 엑셀 생성. **가상 인물·가상 브랜드만** 사용.
- `orders/주문_샘플.xlsx`: 60행, 최근 14일 분포, 브랜드 2개(루미네 LM-/베르디 VD-),
  판매처 4종, 상태 분포(신규·배송준비·배송중·배송완료·취소·반품·교환·보류 + 미매핑 상태
  "발주대기" 2행), 미출고 노령 건(주문일 5일 전, 송장 없음) 3행 이상, 송장 있는 행은
  택배사 3종(CJ대한통운/한진/롯데) 섞기. 헤더에 제목행 1줄을 위에 얹어 헤더 탐지를 시험
- `orders/주문_샘플2.csv`: **cp949 인코딩**, 10행, 그중 3행은 xlsx와 같은 주문번호(병합·dedupe 시험)
- `inventory/재고_샘플.xlsx`: 30행, 로케이션 컬럼(A-01-03 형식), 안전재고 미달 3행 이상
- `returns/반품_샘플.xlsx`: 8행, 수거송장 있는 행 4행

### `scripts/selftest.py`
MCP 없이 service 함수를 직접 호출해 검증. 샘플 데이터 없으면 make_sample_data 먼저 실행.
결과를 한국어 PASS/FAIL 표로 stderr 출력(이 스크립트는 stdio 서버가 아니므로 stdout 허용), 실패 시 exit 1.

필수 검증 항목:
1. data_status: 주문/재고/반품 파일 인식, 행수 > 0, 기타상태값에 "발주대기" 노출
2. inventory_lookup: brand="루미네" 결과 전 행이 루미네 매칭, 합계 정합,
   low_stock_only 결과 ≥ 3행, query="LM-" 동작, 위치 값 존재
3. order_lookup: period="최근7일" 집계 총건수 = 목록 필터와 일치, 단건 상세 동작,
   존재하지 않는 주문번호 → 한국어 안내, **수취인 이름에 `*` 포함(마스킹 확인)**,
   전화번호 원본 미노출, csv 병합분 포함(dedupe 후 총행 수 = 60+10−3)
4. unshipped_list: 결과 전 행이 송장 없음 AND 제외 버킷 아님, 경과일 ≥ 2 행에 지연 플래그,
   정렬 오래된 순
5. shipping_lookup: direction="출고" 전 행 송장 있음, 조회링크가 택배사별 올바른 도메인,
   direction="반품" 에 수거송장 행 포함, tracking_no 단건 검색 동작
6. 기간 경계: 오늘 00:00(KST) 주문이 period="오늘"에 포함, 어제 23:59는 미포함
7. pii_mode=summary로 재로드 시 수취인·전화·주소 키 부재; full 시 원본 (환경변수 바꿔 재검증)
8. 브랜드 미등록명 → 안내 메시지 반환
9. 날짜·숫자 파싱 회귀 케이스 (이지어드민 표기 변형 — 파싱 실패는 기간 조회에서 조용히 누락됨)
10. 예외 내성: 이상한 인자(limit 음수/문자열, 알 수 없는 기간, 정규식 문자, 역순 날짜 등)에도
    예외가 밖으로 새지 않고 JSON 직렬화 가능한 dict 반환

### `scripts/mcp_smoke_test.py`
`mcp` SDK의 stdio 클라이언트로 server.py를 실제 기동:
initialize → list_tools(5개 확인) → data_status 호출 → inventory_lookup 호출 →
응답 JSON 파싱 확인. PASS/FAIL 출력, 실패 시 exit 1.

## 완료 기준 체크리스트 (2026-07-27 구현 완료 — 전부 실제 실행으로 확인)

- [x] selftest.py 전 항목 PASS (78/78)
- [x] mcp_smoke_test.py PASS (9/9 — 실제 stdio 기동·도구 5개·전 도구 호출)
- [x] 쓰기 코드 경로 없음: 패키지 전체에서 파일 쓰기는 `shutil.copyfile`(config.json 자동 생성)과
      `mkdir`(data 폴더) 둘뿐이고, 파일 오픈은 전부 읽기 모드
- [x] `.env`/`config.json`/`data/` 가 git status에 나타나지 않음 (`git check-ignore` 로 확인)
- [x] 저장소 어디에도 실키·실데이터·실고객정보 없음 (샘플은 전부 가상)
- [x] server.py에 `print(` 없음
- [x] README가 아래 요구사항 목차를 모두 담음
- [x] Windows 실행 관점: pathlib 사용, 인코딩 명시, KST 폴백,
      스크립트 stdout을 UTF-8로 reconfigure (cp949 리다이렉트 시 UnicodeEncodeError 방지)
- [x] design/ 문서와 코드 일치 (구현 중 바뀐 부분은 문서를 먼저 갱신)

### 남은 검증 (실데이터가 있어야 가능 — 사장님 협조 필요)

- [ ] 실제 이지어드민 엑셀 1벌(주문·재고·반품)로 머리글 매핑 확인
- [ ] 원문 상태값 → 버킷 매핑표를 뽑아 사장님과 대조 (02 문서의 '조용한 오분류' 경고 참고)
- [ ] 실제 상품코드 체계로 `config.json` 의 brands 채우기

## README 요구사항 (재작성 목차)

1. 소개와 기능 4+1 (한 줄씩)
2. 설치 (Windows): Python 확인 → `pip install -r requirements.txt` → `.env` 복사·설명
3. 데이터 준비: 이지어드민에서 엑셀 내려받아 `data/orders|inventory|returns`에 넣기
   (파일명 자유, 최신 파일 자동 인식, 매일 아침 갱신 권장)
4. **실행 방법**: 서버는 Claude가 자동 실행하므로 직접 켤 필요 없음을 설명.
   수동 점검용 `python scripts/selftest.py` 안내
5. **테스트 방법**: make_sample_data → selftest → mcp_smoke_test 순서와 기대 결과
6. Claude Desktop / Claude Code 연결: design/09 내용을 사용자용으로 정리
7. 브랜드 등록 방법 (config.json brands)
8. 개인정보 모드 설명과 주의
9. API 전환(P1.5) 안내: 명세 받으면 Claude에게 문서를 주고 config 채우기
10. 문제 해결 (09 문서의 점검 순서)

## 알려진 함정 (구현 시 주의)

1. **stdout 한 글자도 금지** — FastMCP stdio가 조용히 죽는다. 로깅은 stderr
2. cp949 CSV — utf-8로만 읽으면 UnicodeDecodeError. 02 문서 순서대로
3. Windows 경로 — 문자열 결합 대신 pathlib.Path. `.env` 값의 슬래시 경로 허용
4. openpyxl `read_only=True` 시 시트 순회 후 `wb.close()` 필수 (파일 잠금 방지 —
   실무자가 엑셀을 다시 저장할 때 충돌하지 않게)
5. 실무자가 파일을 열어둔 채일 수 있음 — PermissionError를 잡아 "엑셀 파일을 닫고
   다시 시도해 주세요" 한국어 warnings로
6. zoneinfo가 Windows에서 실패할 수 있음 — 01 문서의 고정 오프셋 폴백 필수
7. FastMCP 반환은 JSON 직렬화 가능해야 함 — datetime을 문자열로 변환 후 반환
8. 도구 docstring이 곧 Claude의 사용설명서 — 04 문서의 질문 매핑 예시를 docstring에 반영

## 커밋 규칙

- 브랜치: `claude/mcp-inventory-order-server-fwzy33` 에서만 작업·푸시
- 커밋 단위: 마일스톤별 1커밋 이상, 메시지는 한국어로 "무엇을·왜"
- PR은 사장님이 요청할 때만 생성
