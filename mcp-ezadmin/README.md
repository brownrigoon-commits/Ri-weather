# ezadmin-mcp — 이지어드민 조회 전용 MCP 서버

디자이너 브랜드 풀필먼트의 재고·주문·배송 데이터를 Claude가 대화로 조회할 수 있게 하는
**읽기 전용 로컬 MCP 서버**입니다. 데이터 원천은 이지어드민 WMS 하나이며,
엑셀 다운로드 파일과 이지어드민 API를 모두 데이터 소스로 쓸 수 있는 이중 구조입니다.

> **현재 상태: 설계 완료, 구현 대기.**
> 구현 담당(Opus 5)은 작업 전 반드시 이 폴더의 `CLAUDE.md`와 `design/` 문서 전체를 읽고,
> `design/08-implementation-plan.md`의 순서·완료 기준을 따라 구현하세요.

## 기능 (확정 — 이 4개 + 진단 1개만, 추가 금지)

| # | 기능 | MCP 도구 이름 | 설명 |
|---|---|---|---|
| 1 | 재고조회 | `inventory_lookup` | SKU·상품명·브랜드명으로 현재 수량과 재고 위치 |
| 2 | 주문조회 | `order_lookup` | 기간 또는 주문번호로 주문 내역 |
| 3 | 미출고목록 | `unshipped_list` | 접수됐지만 출고(송장 등록) 안 된 건 |
| 4 | 배송조회 | `shipping_lookup` | 출고·반품 배송 상황, 택배사 송장 조회 링크 |
| + | 상태진단 | `data_status` | 연결·데이터 신선도·설정 확인 (연결 테스트용) |

## 설계 문서 분류

| 분류 | 문서 | 내용 |
|---|---|---|
| 개요 | [design/00-overview.md](design/00-overview.md) | 배경, 확정 요구사항, 로드맵, 비목표 |
| 아키텍처 | [design/01-architecture.md](design/01-architecture.md) | 구성도, 기술 스택, 읽기전용 보장, 소스 라우팅 |
| 데이터 소스 | [design/02-datasource-excel.md](design/02-datasource-excel.md) | 엑셀 소스: 폴더 규약, 헤더 매핑, 상태 정규화 |
| 데이터 소스 | [design/03-datasource-api.md](design/03-datasource-api.md) | API 소스 스켈레톤, 인증키 관리 원칙 |
| 도구 명세 | [design/04-mcp-tools.md](design/04-mcp-tools.md) | 도구 5개의 파라미터·반환 형식·예시 |
| 브랜드 | [design/05-brand-mapping.md](design/05-brand-mapping.md) | 브랜드 매핑 스키마와 매칭 규칙 |
| 보안·개인정보 | [design/06-privacy-masking.md](design/06-privacy-masking.md) | 마스킹 규칙, pii_mode, 로그 정책 |
| 설정 | [design/07-config-env.md](design/07-config-env.md) | `.env` / `config.json` 전체 스키마 |
| 구현 계획 | [design/08-implementation-plan.md](design/08-implementation-plan.md) | **Opus 5 구현 지시서**: 파일 트리, 마일스톤, 완료 기준, 테스트 |
| 사용자 안내 | [design/09-claude-desktop-setup.md](design/09-claude-desktop-setup.md) | Claude Desktop/Code 연결·확인·문제 해결 |

## 구현 킥오프 (Opus 5 세션에 붙여넣을 프롬프트)

```
mcp-ezadmin/CLAUDE.md 와 mcp-ezadmin/design/ 문서를 전부 읽고,
design/08-implementation-plan.md 의 마일스톤 순서대로 구현해 주세요.
완료 기준 체크리스트를 전부 통과할 때까지 끝내지 말고,
설계에 없는 기능(특히 쓰기 기능)은 절대 추가하지 마세요.
```
