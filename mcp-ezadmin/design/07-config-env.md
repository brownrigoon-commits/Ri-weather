# 07. 설정 — `.env` 와 `config.json`

역할 분담: **`.env` = 비밀·접속 정보**, **`config.json` = 동작 설정**(브랜드·컬럼·임계값 등 구조적 설정).
둘 다 gitignore 대상이며 저장소에는 example만 커밋한다.

로드 순서: `.env` 파일을 읽되 이미 있는 `os.environ` 값이 우선 →
`config.json` 로드(없으면 `config.example.json`을 복사해 자동 생성하고 stderr에 안내) →
env가 config의 대응 항목을 오버라이드(`EZMCP_SOURCE_MODE` 등).
`.env` 파서는 표준 라이브러리로 자작: `KEY=VALUE` 줄만, `#` 주석·빈 줄 무시, 양끝 따옴표 제거.

## `.env.example` (전문 — 이대로 커밋)

```ini
# ===== ezadmin-mcp 접속·비밀 설정 =====
# 이 파일을 .env 로 복사한 뒤 값을 채우세요. .env 는 절대 커밋되지 않습니다.

# 데이터 소스 모드: excel(기본, 엑셀만) | api(API만) | auto(API 우선, 실패 시 엑셀)
EZMCP_SOURCE_MODE=excel

# 엑셀 데이터 폴더 (비우면 프로젝트 안 data 폴더 사용)
# Windows 경로는 슬래시 사용 권장: C:/ezadmin-data
EZMCP_DATA_DIR=

# 개인정보 표시: masked(기본, 마스킹) | summary(개인정보 제외) | full(원본 — 주의해서 사용)
EZMCP_PII_MODE=masked

# ----- 이지어드민 API (명세 수령 후 입력. P1에서는 비워 둠) -----
EZADMIN_API_DOMAIN=
EZADMIN_API_KEY=
# 브랜드별 계정이 나뉜 경우 계정별 변수를 추가하고 config.json의 api.accounts에서 ${변수명}으로 참조
# EZADMIN_API_DOMAIN_LUMINE=
# EZADMIN_API_KEY_LUMINE=

# ----- 향후 DB 직접 연결이 생길 경우 (반드시 읽기 전용 계정) -----
EZMCP_DB_DSN=
```

## `config.example.json` (전문 — 이대로 커밋)

```jsonc
{
  "source_mode": "excel",            // .env의 EZMCP_SOURCE_MODE가 있으면 그 값이 우선
  "pii_mode": "masked",              // .env의 EZMCP_PII_MODE가 있으면 그 값이 우선
  "data_dir": "",                    // 빈 값이면 <프로젝트>/data

  "brands": {                        // 05 문서. 실제 브랜드로 교체할 것
    "루미네": { "aliases": ["lumine"], "product_keywords": ["LM-"], "malls": ["루미네 자사몰"], "accounts": [] },
    "베르디": { "aliases": ["verdi"], "product_keywords": ["VD-"], "malls": ["베르디 자사몰"], "accounts": [] }
  },

  "columns": {                       // 02 문서 기본 후보에 '추가'되는 계정별 커스텀 헤더
    // "orders": { "order_no": ["주문코드"] }
  },
  "status_keywords": {               // 02 문서 기본 버킷 키워드에 '추가'
    // "배송준비": ["출고예정"]
  },

  "unshipped_delay_days": 2,         // 미출고 지연 판정 (경과일 기준)
  "low_stock_threshold": 3,          // 안전재고 컬럼이 없을 때 재고부족 판정 기준
  "stale_hours": 24,                 // 이 시간보다 오래된 파일이면 meta.warnings 에 경고

  "courier_urls": {                  // 04 문서 기본 URL 덮어쓰기용
    // "cj": "https://..."
  },

  "api": {                           // 03 문서. P1에서는 enabled=false 유지
    "enabled": false,
    "base_url": "",
    "encoding": "utf-8",
    "timeout_sec": 15,
    "auth_params": { "domain": "${EZADMIN_API_DOMAIN}", "key": "${EZADMIN_API_KEY}" },
    "accounts": [],
    "endpoints": {
      "orders":    { "method": "GET", "path": "", "params": { "sdate": "{start_date}", "edate": "{end_date}" }, "record_path": [], "fields": {} },
      "inventory": { "method": "GET", "path": "", "params": {}, "record_path": [], "fields": {} },
      "returns":   { "method": "GET", "path": "", "params": {}, "record_path": [], "fields": {} }
    }
  }
}
```

주의: 실제 `config.json`은 주석 없는 순수 JSON이어야 한다(자동 생성 시 주석 제거).
example 파일의 주석은 `//` 형태로 두되, 자동 생성 로직이 `//` 주석 줄을 제거하고 복사한다.
(더 단순하게: example을 처음부터 주석 없는 순수 JSON으로 커밋하고 설명은 이 문서가 담당 — 구현 시 이 방식 권장)
