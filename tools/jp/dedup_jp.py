# -*- coding: utf-8 -*-
"""같은 구장이 두 출처로 등록됐을 때 정리 (2026-08-01 신설)

왜 생기나: 여러 수집을 **동시에** 돌리면, 나중 수집기가 시작 시점에 만든
'이미 등록된 구장' 목록이 낡아서 같은 구장을 또 담는다(실제로 3곳 겹쳤다).
조립기가 중복을 만나면 멈추므로(그게 맞다), 여기서 화질 사다리대로 한쪽을 고른다.

우선순위
  ① **홀이 많은 쪽** — 완전성이 먼저다. 18홀 구장을 9홀로 등록하면 화면 절반이 빈다.
     (2026-08-01 실제로 겪음: 공식 9홀이 じゃらん 18홀을 밀어냈다)
  ② 같은 홀 수면 **화질 사다리** (docs/일본_6메뉴_데이터_설계.md §2-1-1)
       1. 구장 공식 홈페이지 (고화질·때로 벡터)
       2. 체인 표준 템플릿 (아코디아 540×900 등)
       3. じゃらん (235px 폴백)

사용
  python tools/jp/dedup_jp.py            무엇을 지울지만 보여준다
  python tools/jp/dedup_jp.py --apply    실제로 지운다
"""
import argparse, json, os, shutil, sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import HP_JP, ROOT


def rank(source):
    if "公式ホームページ" in source:
        return 0
    if "じゃらん" in source:
        return 2
    return 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()

    by = defaultdict(list)
    for d in sorted(os.listdir(HP_JP)):
        f = os.path.join(HP_JP, d, "parsed.json")
        if not os.path.exists(f):
            continue
        try:
            j = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        holes = sum(len(c["holes"]) for c in j.get("courses", []))
        by[j["course"]].append({"dir": d, "src": j.get("source", ""), "holes": holes,
                                "rank": rank(j.get("source", ""))})

    dups = {k: v for k, v in by.items() if len(v) > 1}
    if not dups:
        print("겹치는 구장이 없습니다")
        return 0
    print(f"■ 겹치는 구장 {len(dups)}곳")
    drop = []
    for name, items in dups.items():
        items.sort(key=lambda x: (-x["holes"], x["rank"]))   # 완전성 먼저, 그다음 화질
        keep, rest = items[0], items[1:]
        print(f"  {name}")
        print(f"    남김: {keep['dir']} ({keep['src'][:26]} · {keep['holes']}홀)")
        for r in rest:
            print(f"    지움: {r['dir']} ({r['src'][:26]} · {r['holes']}홀)")
            drop.append(r["dir"])

    if not a.apply:
        print(f"\n연습 모드 — 실제로 지우려면 --apply ({len(drop)}곳)")
        return 0
    for d in drop:
        shutil.rmtree(os.path.join(HP_JP, d), ignore_errors=True)
        img = os.path.join(ROOT, "holeimg", "jp_" + d)
        if os.path.isdir(img):
            shutil.rmtree(img, ignore_errors=True)
    print(f"\n✔ {len(drop)}곳 정리 완료")
    return 0


if __name__ == "__main__":
    sys.exit(main())
