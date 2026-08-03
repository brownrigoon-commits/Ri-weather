# -*- coding: utf-8 -*-
"""이미 훑어 둔 결과(official_dom.json)만 보고 홀맵이 있는 구장을 가려낸다 (2026-08-03 신설)

왜 따로 만들었나
  `official_collect.py --scan-all` 은 구장 사이트를 **다시** 받아 온다.
  브라우저로 방금 훑은 뒤(구장당 최대 6페이지) 또 두드리면 같은 서버에 두 배로 요청하는 셈이다.
  훑기 결과에 이미 페이지별 이미지 목록이 다 들어 있으니, 판정만 여기서 한다 — **새 요청 0건.**

판정은 official_collect.py 의 잣대를 그대로 쓴다(series_of · qualifying_series):
  파일명에서 숫자 한 자리만 바뀌는 묶음을 시리즈로 보고, 1..9/18/27 이 빠짐없이 있어야 홀맵으로 친다.
  사진·배너 계열 이름은 뺀다.

사용
  python tools/jp/official_from_dom.py            요약
  python tools/jp/official_from_dom.py --list     홀맵이 나온 구장 전부
  python tools/jp/official_from_dom.py --json     다음 단계(내려받기)용 파일로 저장
"""
import argparse, json, os, re, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import HP_JP, ROOT
from official_collect import qualifying_series, series_of

DOM = os.path.join(HP_JP, "_scan", "official_dom.json")
OUT = os.path.join(HP_JP, "_scan", "official_holemaps.json")

# 홀 '번호 아이콘·탭 버튼'도 1..18 로 이름이 붙어 있어 시리즈로 잡힌다.
# 표본 18곳을 실제로 받아 보니 6곳이 이런 것이었다(50x50 숫자칩, 31x23 탭 등, 2026-08-03).
# 파일명만으로 걸러지는 것은 여기서 뺀다 — 나머지는 내려받을 때 크기로 걸러진다.
ICONY = re.compile(r"(_off|_on|btn|button|num|no\d*\.svg|tab|thumb|icon|gallery|nav|"
                   r"_s\.(jpg|png)|small)", re.I)


def registered():
    out = set()
    for d in os.listdir(HP_JP) if os.path.isdir(HP_JP) else []:
        f = os.path.join(HP_JP, d, "parsed.json")
        if os.path.exists(f):
            try:
                out.add(json.load(open(f, encoding="utf-8"))["course"])
            except Exception:
                pass
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    dom = json.load(open(DOM, encoding="utf-8"))
    have = registered()
    hits, per_src = [], defaultdict(int)
    for rec in dom:
        g = rec["golfdb"]
        best = None
        for p in rec.get("pages", []):
            for s in qualifying_series(series_of(p.get("imgs", []))):
                if ICONY.search(s["base"]):
                    continue                       # 숫자칩·탭 버튼 묶음은 홀맵이 아니다
                if not best or s["n"] > best["n"]:
                    best = {"n": s["n"], "base": s["base"], "page": p["url"],
                            "holes": {str(k): v for k, v in sorted(s["holes"].items())}}
        if best:
            hits.append({"golfdb": g, "site": rec.get("site"), "already": g in have, **best})
            per_src["이미 등록됨" if g in have else "새로 등록 가능"] += 1

    new = [h for h in hits if not h["already"]]
    print(f"■ 훑은 구장 {len(dom)}곳 · 홀맵 시리즈가 잡힌 곳 {len(hits)}곳")
    print(f"   그 중 아직 등록 안 된 곳 {len(new)}곳 "
          f"(홀 합계 {sum(h['n'] for h in new)}홀)")
    from collections import Counter
    for n, c in sorted(Counter(h["n"] for h in new).items()):
        print(f"     {n}홀짜리 {c}곳")
    if a.list:
        for h in sorted(new, key=lambda x: -x["n"]):
            print(f"  {h['golfdb'][:24]:26s} {h['n']:2d}홀  {h['base'][:34]:36s} {h['page'][:52]}")
    if a.json:
        json.dump(new, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"\n저장: {os.path.relpath(OUT, ROOT)} ({len(new)}곳)")
        print("   다음: 그림을 내려받아 등록하는 것은 official_collect.py --collect 가 한다")
    return 0


if __name__ == "__main__":
    sys.exit(main())
