# -*- coding: utf-8 -*-
"""홀맵에 빠진 파(PAR)를 홀 통계에서 채운다 (2026-08-02 신설)

왜 필요한가: 구장 공식 홈페이지에서 받은 홀맵은 그림은 좋은데 **파가 없는 곳이 많다**
(사이트마다 표 구조가 달라 숫자를 못 읽는다). 반면 じゃらん 통계에는 홀마다 파가 있다.
그림은 좋은 쪽, 숫자는 있는 쪽 — 사장님이 지시한 '화질 좋은 이미지 + 정리 내용' 그대로다.

🔴 지어내지 않는다. **홀 수가 정확히 같고, 이미 있는 파와 어긋나지 않을 때만** 채운다.
   한 자리라도 어긋나면 그 구장은 통째로 건너뛴다(순서가 다르다는 뜻이므로).

사용
  python tools/jp/fill_par_from_stats.py           무엇을 채울지만 보여준다
  python tools/jp/fill_par_from_stats.py --apply   실제로 채운다
"""
import argparse, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import HP_JP

STATS = os.path.join(HP_JP, "_stats")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()

    stats = {}
    if os.path.isdir(STATS):
        for fn in os.listdir(STATS):
            if not fn.endswith(".json"):
                continue
            try:
                d = json.load(open(os.path.join(STATS, fn), encoding="utf-8"))
                stats[d["course"]] = d.get("pars") or []
            except Exception:
                pass
    if not stats:
        print("통계 자료가 없습니다")
        return 1

    filled = skipped = 0
    for dname in sorted(os.listdir(HP_JP)):
        f = os.path.join(HP_JP, dname, "parsed.json")
        if not os.path.exists(f):
            continue
        try:
            j = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        holes = [h for c in j.get("courses", []) for h in c["holes"]]
        missing = [h for h in holes if h.get("par") is None]
        if not missing:
            continue
        pars = stats.get(j["course"])
        if not pars:
            continue
        if len(pars) != len(holes):
            print(f"  – {j['course'][:24]:26s} 홀 수가 달라 건너뜀 "
                  f"(홀맵 {len(holes)} / 통계 {len(pars)})")
            skipped += 1
            continue
        bad = [i for i, h in enumerate(holes) if h.get("par") is not None and h["par"] != pars[i]]
        if bad:
            print(f"  – {j['course'][:24]:26s} 이미 있는 파와 어긋나 건너뜀 ({len(bad)}홀)")
            skipped += 1
            continue
        print(f"  ✔ {j['course'][:24]:26s} 파 {len(missing)}홀 채움")
        if a.apply:
            for i, h in enumerate(holes):
                if h.get("par") is None:
                    h["par"] = pars[i]
            j["parFrom"] = "じゃらんゴルフ"      # 어디서 온 숫자인지 남긴다
            with open(f, "w", encoding="utf-8", newline="\n") as w:
                json.dump(j, w, ensure_ascii=False, indent=1)
        filled += 1

    print(f"\n{'채운' if a.apply else '채울 수 있는'} 구장 {filled}곳"
          + (f" · 건너뜀 {skipped}곳" if skipped else ""))
    if filled and not a.apply:
        print("실제로 채우려면 --apply")
    return 0


if __name__ == "__main__":
    sys.exit(main())
