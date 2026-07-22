# Ri-Weather 작업 이어하기 가이드 (2026-07-22 갱신)

집/회사 어디서든: `git pull` 후 이 문서대로. 로컬 서버: `python -m http.server 8734`
권한 설정(승인 질문 없애기): `Github_코드백업/_클로드_설정/설정적용.py` 실행 후 클로드 재시작.

## 현재 상태 (v70 배포됨)

**등록 완료 20구장 414홀** — 전부 홀 완전체 + 이미지 존재 검증 통과
서서울(18) · 몽베르(18) · 더스타휴(18) · 샴발라(18) · 신라(27) · 파주(18) · 클럽72 하늘(18) · 클럽72 바다(63)
· 감곡(18) · 파인크리크(27) · 파인밸리(18) · **타이거(18) · 무등산(27) · 광주(27) · 일레븐(18) · 써닝포인트(18)
· 하이망(18) · 골드그린(9) · 더나인골프클럽(9) · 한림안성(9)** ← 자동 파이프라인 산출

**맛집 기능**: 카카오 로컬 API 연동 완료 (자유로CC 2곳 → 64곳). 키는 app.js `EMBED_KAKAO_B64`.
카카오 개발자 앱 = "Ri-Weather"(ID 1520230), 카카오맵 API 활성화됨(무료 쿼터 이 앱에 귀속).

## 절대 원칙 (사장님 확정)

1. **홀이 하나라도 빠지면 등록 금지** — 공식 홀 수(골프존) = 파싱 홀 수 일치 필수
2. **틀릴 수 있으면 아예 표시하지 않음** — 거리·코스명이 의심스러우면 그 항목만 제거하고 등록
3. 홀맵 이미지 표준: 지도만, 흰배경, 세로 600px 고정·가로≤680 (`tools/crop_map_only.py`)
4. 미등록 구장은 앱이 "홀별 공략 준비 중" 배너 자동 표시
5. 사용량 절약: 단계별 확인 왕복 금지 — 일괄 실행 + 자동 검증 + 최종 요약

## 자동 등록 파이프라인 (핵심)

```
tools/analyze_registrable.py    수집 자산 → 등급 A~E 판정 (registrable_analysis.json)
tools/universal_build.py        사이트 유형 자동판별 파싱 → 검증 → 등록
      --club "타이거CC" --db "타이거CC" --slug tiger [--write]
      --batch --grades ABCD --write        (일괄, 이어하기 자동)
tools/cleanup_registrations.py  중복·코스명불량·거리이상 자동 정리
tools/audit_registered.py       품질 감사 (파합계·이미지·TIP·거리 상식)  [--fix 시 불합격 삭제]
tools/match_dbnames.py          등록 구장명 ↔ golfdb.js 표기 일치 교정
tools/build_holeimgdb.py        parsed.json → js/holeimgdb.js 조립
tools/release_courses.py "메시지"  조립+무결성+버전업+push 원클릭 배포
tools/export_status_excel.py    골프장DB.xlsx 현황 분류표 생성
```

**지원 사이트 유형** (universal_build.py): `holebox`(타이거형) · `tabpane`(감곡형) · `holeinfo`(몽베르형)
· `generic`/`generic-loose`(홀번호 이미지 + 주변 문맥 해석). 페이지마다 전 파서를 시도해 **연속 홀 세트를 만드는 최선**을 채택.

**검증 게이트** (하나라도 실패 시 등록 안 함): 홀번호 연속 · 공식 홀수 일치 · 9의 배수 · 이미지 존재
· 이미지 세로형 · 9홀 파합계 33~39(파3코스 예외) · 동일 도메인 중복 등록 방지

## 골프장DB.xlsx (현황 분류표)

시트: 한국 전체(625) / 등록완료(20) / 제작가능 / 부분수집(30) / 자료부족(260) / 자료없음(314) / 일본 / 중국
상태별 색상 구분, 각 행에 홀이미지 수·공식 홀수·실패 사유·홈페이지 URL 기록.
`python tools/export_status_excel.py` 로 언제든 갱신 (파일 열려 있으면 골프장DB_현황.xlsx로 저장).

## 다음 작업

1. **배치 계속 실행**: `python tools/universal_build.py --batch --grades ABCD --write`
   → 끝나면 `cleanup_registrations.py` → `audit_registered.py` → `match_dbnames.py` → `release_courses.py`
   ⚠️ 프로세스 종료는 PowerShell로 (bash에 pkill 없음):
   `Get-CimInstance Win32_Process -Filter "Name='python.exe'" | ? {$_.CommandLine -like "*universal_build*"} | % {Stop-Process -Id $_.ProcessId -Force}`
2. **부분수집 30곳**: 사이트별 전용 파서 추가하면 등록 가능 (이븐데일·진양밸리·웰링턴·속리산 등)
3. **자료부족 260곳**: 수집기 재실행(이미지 상한 30장 → 상향) 후 재분석
4. 골프DB 커버리지: 골프존 218곳 중 58곳이 golfdb.js에 없었음 → `tools/expand_golfdb.py`로 일부 반영, 나머지 수동 확인 필요

## 참고

- Gemini API 키: extract_tips.py 등에 내장 (무료 한도, 429 시 재시도)
- 골프존 API: `https://lobby.golfzon.com/v1/dotcom/courses/course/{ciCode}/details/hole-info`
- 배포: `release_courses.py`가 APP_VER·sw.js 캐시 동기화까지 처리
- 회사 PC Python: `C:\Python314\python.exe` (selenium·pillow 설치됨)
