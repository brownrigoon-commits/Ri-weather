#!/usr/bin/env bash
# =====================================================================
# run_js_tests.sh — JS 전략엔진 정답지 테스트 실행
#
#   bash ristock/engine/tests/run_js_tests.sh
#
# 어느 폴더에서 실행해도 됩니다. 전부 통과하면 0, 하나라도 어긋나면 1.
# 네트워크 없이 돌아갑니다 (픽스처만 읽습니다).
#
# ※ 셸 변수 이름은 ASCII 만 허용되므로 여기서만 영문을 씁니다(안내 문구는 한국어).
# =====================================================================
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_JS="$HERE/test_js_golden.mjs"
ENGINE_JS="$(cd "$HERE/../.." && pwd)/js/strategy.js"

if ! command -v node >/dev/null 2>&1; then
  echo "node 가 없습니다. Node.js 18 이상을 설치한 뒤 다시 실행하세요." >&2
  echo "  윈도우: https://nodejs.org 에서 LTS 설치 → 새 명령창에서 다시 실행" >&2
  exit 1
fi

if [ ! -f "$ENGINE_JS" ]; then
  echo "전략엔진을 찾을 수 없습니다: $ENGINE_JS" >&2
  exit 1
fi
if [ ! -f "$TEST_JS" ]; then
  echo "테스트 파일을 찾을 수 없습니다: $TEST_JS" >&2
  exit 1
fi

echo "node $(node --version) 로 전략엔진을 검사합니다."
echo "  엔진   : $ENGINE_JS"
echo "  테스트 : $TEST_JS"
echo

node "$TEST_JS"
CODE=$?

echo
if [ "$CODE" -eq 0 ]; then
  echo "JS 전략엔진 검사 통과 (정답지 재현 확인)."
else
  echo "JS 전략엔진 검사 실패 — 위 어긋남을 먼저 고치세요. 배포하면 안 됩니다." >&2
fi
exit "$CODE"
