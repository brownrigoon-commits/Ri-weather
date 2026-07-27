# mcp-ezadmin 프로젝트 규칙

이 폴더는 골프 앱(Ri-weather)과 무관한 **별도 프로젝트**입니다.
루트 CLAUDE.md의 동시작업 프로토콜(`tools/sync.py`)은 이 폴더에 적용하지 않습니다.
작업은 전용 브랜치(`claude/mcp-inventory-order-server-fwzy33`)에서만 하고, 다른 브랜치에 푸시하지 마세요.

## 절대 규칙 (예외 없음)

1. **읽기 전용.** 쓰기·수정·삭제 도구를 만들지 않습니다. 이지어드민 데이터를 변경하는
   코드 경로가 하나라도 생기면 안 됩니다. API 어댑터에는 조회 성격의 엔드포인트만 등록할 수 있어야 합니다.
   DB를 직접 연결하게 되는 날이 와도 읽기 전용 계정만 사용합니다.
2. **비밀정보는 `.env`에만.** 인증키·접속 정보를 코드/설정 예시/커밋에 절대 넣지 않습니다.
   `.env`, `config.json`, `data/`는 `.gitignore` 대상이며 저장소에는 `*.example.*`만 커밋합니다.
3. **개인정보 기본 마스킹.** `pii_mode` 기본값은 항상 `masked`입니다. 코드 기본값을 `full`로
   바꾸지 않습니다. 로그에 고객 이름·전화·주소를 남기지 않습니다.
4. **stdout 금지.** MCP stdio 전송을 오염시키므로 `print()`를 쓰지 않습니다. 로그는 stderr로만.
5. **기능 추가 금지.** 확정된 도구 5개(inventory_lookup, order_lookup, unshipped_list,
   shipping_lookup, data_status) 외의 도구를 임의로 추가하지 않습니다.

## 구현 절차

- 구현 전 `design/` 문서 전체를 읽습니다. 구현 순서·완료 기준은 `design/08-implementation-plan.md`.
- 설계와 코드가 어긋나면 코드를 고치는 게 아니라 먼저 설계 문서를 갱신하고 커밋 메시지에 사유를 남깁니다.

## 테스트 (구현 후 반드시 통과)

```
python scripts/make_sample_data.py   # 샘플 엑셀 생성
python scripts/selftest.py           # 도구 로직 전수 검증 (전부 PASS여야 함)
python scripts/mcp_smoke_test.py     # 실제 MCP stdio 프로토콜 왕복 확인
```

## 환경

- 대상 PC: Windows, Python `C:\Python314\python.exe`
- 개발 컨테이너: python3 (3.10+), 의존성은 `pip install -r requirements.txt`
- 의존성은 `mcp`, `openpyxl` 두 개로 최소 유지. 추가 의존성은 설계 문서에 근거가 있을 때만.
