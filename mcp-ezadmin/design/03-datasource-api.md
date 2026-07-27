# 03. 데이터 소스 — 이지어드민 API (P1은 스켈레톤, P1.5에서 활성화)

## 사실관계 (2026-07 조사)

- 이지어드민은 외부 연동용 공식 API를 제공한다: 재고조회·재고이력·주문 상세 등
- **신청제**: 법인 고객 대상, 건당 과금(소액), 세팅 약 3일. 사용 전 고객사 동의 필요
- 문의: apidev@pimz.co.kr · 안내: https://www.ezadmin.co.kr/api/index.html ·
  FAQ: https://www.ezadmin.co.kr/api/faq.html
- **상세 요청 명세(엔드포인트·파라미터·응답 형식)는 신청 후 제공된다.**
  따라서 P1에서는 명세를 하드코딩하지 않고, 명세를 받으면 `config.json`에
  채워 넣는 것만으로 켜지는 **설정 주입형 제네릭 클라이언트**로 만든다

## 설계: 설정 주입형 클라이언트

표준 라이브러리 `urllib.request`만 사용(의존성 추가 금지). 동작은 전부 config가 결정한다.

```jsonc
// config.json 의 "api" 섹션 (기본값: enabled=false)
"api": {
  "enabled": false,
  "base_url": "",                      // 명세 수령 후 입력
  "encoding": "utf-8",                 // 응답 인코딩. euc-kr 가능성 대비
  "timeout_sec": 15,
  "auth_params": {                     // 모든 요청에 합쳐지는 인증 파라미터
    "domain": "${EZADMIN_API_DOMAIN}", // ${VAR} 는 .env 값으로 치환
    "key": "${EZADMIN_API_KEY}"
  },
  "accounts": [                        // 브랜드별 계정 분리 대응. 비우면 auth_params 단일 계정
    // {"name": "루미네", "auth_params": {"domain": "${EZADMIN_API_DOMAIN_LUMINE}", "key": "${EZADMIN_API_KEY_LUMINE}"}}
  ],
  "endpoints": {
    // 조회 성격 엔드포인트만 등록한다 (아래 '읽기 전용 규칙')
    "orders": {
      "method": "GET",                 // GET 또는 POST(조회 파라미터 전달용)만 허용
      "path": "",                      // 예: /order/list
      "params": {                      // {start_date} {end_date} 플레이스홀더 치환 (YYYY-MM-DD)
        "sdate": "{start_date}",
        "edate": "{end_date}"
      },
      "record_path": [],               // 응답 JSON에서 레코드 배열까지의 키 경로. 예: ["data","list"]
      "fields": {                      // 응답 필드명 → 02 문서의 표준 필드명
        // "order_cd": "order_no", "status_nm": "status", ...
      }
    },
    "inventory": { "method": "GET", "path": "", "params": {}, "record_path": [], "fields": {} },
    "returns":   { "method": "GET", "path": "", "params": {}, "record_path": [], "fields": {} }
  }
}
```

### 동작 규칙

1. `enabled=true`이고 `base_url`·인증값(치환 후 비어있지 않음)·해당 endpoint `path`가
   모두 있어야 그 데이터 종류에 대해 "설정 완비"로 판정
2. accounts가 있으면 계정별로 순차 호출해 레코드를 합치고, 각 레코드에 계정 `name`을 붙인다
   (브랜드 매칭에서 mall/계정 매칭에 사용 — 05 문서)
3. 응답 파싱: JSON 우선. `record_path`를 따라 배열을 찾고 `fields`로 표준 필드에 매핑.
   매핑 후에는 엑셀 소스와 **완전히 같은 레코드 형태**가 되어 service 로직을 공유한다
   (상태 버킷·날짜 파싱도 02 문서 규칙 재사용)
4. 페이지네이션: 명세 수령 전에는 미지원. P1.5에서 명세에 맞춰
   `page_param`/`page_size_param`/`has_more` 규칙을 endpoints 스키마에 추가한다
5. 실패 처리(연결 불가·HTTP 오류·파싱 실패): `auto` 모드면 엑셀 폴백 + warnings 명시,
   `api` 고정 모드면 한국어 오류 반환. 오류 메시지에 인증키 값을 절대 포함하지 않는다

### 읽기 전용 규칙 (절대)

- endpoints에는 **조회 성격만** 등록한다. 주문 상태 변경·재고 조정·송장 등록 등
  쓰기 성격 명세는 받아도 등록하지 않는다. 코드 리뷰 시 이 규칙 위반은 반려 사유
- 허용 메서드는 GET, POST 두 가지뿐이며 POST는 조회 조건 전달 용도로만

## 인증키 관리 (절대 규칙)

- 키·도메인 등 비밀값은 **`.env`에만** 둔다. `config.json`에는 `${VAR}` 참조만 적는다
- `.env`와 `config.json`은 `.gitignore` 대상. 저장소에는 `.env.example`,
  `config.example.json`만 커밋한다 (실제 값 없이 빈 값·주석만)
- 로그·오류 메시지·MCP 응답 어디에도 키 값을 노출하지 않는다

## P1.5 활성화 체크리스트 (명세 수령 후)

1. 명세 문서에서 조회 엔드포인트(주문/재고/반품)의 path·파라미터·응답 구조 확인
2. `config.json` api 섹션과 `.env` 값 채우기 (Claude에게 명세 문서를 주면 채울 수 있음)
3. `EZMCP_SOURCE_MODE=api`로 고정하고 `scripts/selftest.py --source api` 실행 → 실데이터 검증
4. 문제없으면 `auto`로 전환 (API 우선 + 엑셀 폴백)
5. 페이지네이션·호출량(건당 과금) 확인: 기간 조회 기본값을 좁게(최근 7일) 유지
