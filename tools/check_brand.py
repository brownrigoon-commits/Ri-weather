# -*- coding: utf-8 -*-
"""브랜드명 검사 — 옛 이름이 사용자 화면에 남아 있는지 (배포 전 관문)

2026-07-31 앱 이름을 **골프라이프 → 투어리스트(TOURLIST)** 로 바꿨다(상표 출원 진행).
7/27 에도 Ri-Weather → 골프라이프 개명을 했는데, 그때 화면 곳곳에 옛 이름이 남아
`sweep.js` 가 뒤늦게 잡아낸 적이 있다. 같은 일을 반복하지 않으려고 배포 관문에 건다.

검사 대상은 **사용자에게 보이는 파일**뿐이다. 주석·문서·내부 식별자는 건드리지 않는다:
  · `service:"golflife-backend"` — 백엔드 내부 식별자(verify_backend 가 이 값을 대조)
  · `window.RIW_BACKEND`, `riweather.*` localStorage 키 — 바꾸면 기존 이용자 기록이 끊긴다
  · "구 골프라이프" 병기 — 약관에서 동일 서비스임을 밝히는 문구라 **있어야 한다**

사용
  python tools/check_brand.py            # 위반만, 있으면 종료코드 1
  python tools/check_brand.py --report   # 통과 항목까지
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OLD = "골프라이프"
NEW = "투어리스트"

# 사용자에게 보이는 문자열이 들어가는 파일만 본다
TARGETS = [
    "index.html", "manifest.webmanifest", "ops-k58zq.html",
    "js/app.js", "js/legal.js", "js/stats.js", "js/clubfit.js",
    "js/booking.js", "js/stay.js", "js/loading.js", "css/style.css",
    "tools/apps_script/Code.gs",
]

# 옛 이름이 남아도 되는 자리 — 이 표현을 포함한 줄은 통과시킨다
ALLOW_LINE = [
    "구 골프라이프",          # 약관·주석의 병기 ("투어리스트(TOURLIST, 구 골프라이프…)")
    "'골프라이프 백엔드'",    # Apps Script 프로젝트 이름(구글 콘솔에 그렇게 있음)
    "골프라이프 통계",        # 스프레드시트 이름(실제 시트명)
]


def violations(root=ROOT):
    bad, note = [], []
    for rel in TARGETS:
        p = os.path.join(root, rel)
        if not os.path.exists(p):
            note.append(f"{rel}: 파일 없음 — 이름이 바뀌었으면 TARGETS 를 고치세요")
            continue
        for i, line in enumerate(open(p, encoding="utf-8"), 1):
            if OLD not in line:
                continue
            if any(a in line for a in ALLOW_LINE):
                continue
            bad.append(f"{rel}:{i}  {line.strip()[:90]}")
    return bad, note


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    bad, note = violations()
    if "--report" in sys.argv:
        print(f"검사 대상 {len(TARGETS)}개 파일 · 새 이름 '{NEW}' 기준")
        for s in note:
            print("  · 참고:", s)
    if bad:
        print(f"\n✖ 옛 이름('{OLD}')이 남아 있습니다 {len(bad)}건")
        for s in bad[:30]:
            print("   -", s)
        print(f"  '{NEW}' 로 바꾸거나, 남겨야 하는 자리면 tools/check_brand.py 의 ALLOW_LINE 에 근거와 함께 적으세요.")
        return 1
    print(f"브랜드명 검사 통과 — 사용자 화면에 옛 이름 없음 (병기 '구 {OLD}' 는 허용)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
