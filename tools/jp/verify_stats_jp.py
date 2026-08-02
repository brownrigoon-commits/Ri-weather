# -*- coding: utf-8 -*-
"""수집한 홀별 통계가 원문과 같은가 — 페이지를 다시 열어 글자 단위로 대조 (2026-08-02)

수치는 눈으로 훑어서는 틀린 걸 못 잡는다. 그래서 **저장한 값 ↔ 원문 표의 글자**를
하나씩 맞춰 본다. 한 곳이라도 다르면 실패로 끝난다.

⚠️ 이 검사가 보는 것은 **'원문을 그대로 옮겼는가(충실성)'** 이지
   '그 값이 말이 되는가(타당성)' 가 아니다. 타당성은 check_stats_jp.py 몫이다.
   실제로 원문에 평균 퍼트 6.8 같은 엉터리 값이 있어서, 수집기가 그런 값을 비운다
   (jalan_stats.sanitize). 여기서도 **같은 규칙을 적용한 뒤** 대조한다 —
   안 그러면 '비운 것'을 틀린 것으로 오해한다.

사용: python tools/jp/verify_stats_jp.py [--n 3]
"""
import argparse, json, os, random, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import HP_JP, fetch
from jalan_stats import BAND_LABEL, KEYS, strip_tags, sanitize

STATS = os.path.join(HP_JP, "_stats")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=3)
    a = ap.parse_args()
    files = sorted(f for f in os.listdir(STATS) if f.endswith(".json")) if os.path.isdir(STATS) else []
    if not files:
        print("✖ 통계 자료가 없습니다")
        return 1
    random.seed(0)
    picks = random.sample(files, min(a.n, len(files)))

    bad = 0
    for fn in picks:
        d = json.load(open(os.path.join(STATS, fn), encoding="utf-8"))
        code, _, html = fetch(d["sourceUrl"])
        if code != 200:
            print(f"  ? {d['course']}: 원문을 못 받음 HTTP {code}")
            bad += 1
            continue
        body = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
        panels = [m.start() for m in re.finditer(r'<div[^>]*class="[^"]*tabContent[^"]*"', body)]
        edges = panels + [len(body)]
        tbls = [(m.start(), m.group(0)) for m in
                re.finditer(r'(?is)<table class="holeInfo">.*?</table>', body)]

        checked = wrong = 0
        for bi in range(5):
            lo, hi = edges[bi], edges[bi + 1]
            ss = [t for p, t in tbls if lo <= p < hi]
            for i, tbl in enumerate(ss):
                if i >= len(d["holes"]):
                    break
                row = {}
                for m in re.finditer(r"(?is)<th>\s*([^<]+?)\s*</th>\s*<td>\s*([^<]*?)\s*</td>", tbl):
                    row[strip_tags(m.group(1))] = strip_tags(m.group(2))
                saved = d["holes"][i]["b"][bi]
                want_all = []
                for k in KEYS:
                    raw = row.get(k, "")
                    if k == "難易度":
                        mm = re.match(r"(\d+)位", raw)
                        want_all.append(int(mm.group(1)) if mm else None)
                    else:
                        mm = re.match(r"([\d.]+)", raw)
                        want_all.append(float(mm.group(1)) if mm else None)
                want_all = sanitize(want_all)      # 수집기와 같은 규칙을 적용해 비교
                for ki, k in enumerate(KEYS):
                    raw = row.get(k, "")
                    want = want_all[ki]
                    checked += 1
                    if saved[ki] != want:
                        wrong += 1
                        if wrong <= 3:
                            print(f"    ✖ {d['course']} {BAND_LABEL[bi]} {i+1}번째홀 {k}: "
                                  f"저장 {saved[ki]} ≠ 원문 {want!r} (원문글자 {raw!r})")
        mark = "✔" if wrong == 0 else "✖"
        print(f"  {mark} {d['course'][:24]:26s} {len(d['holes'])}홀 · 대조 {checked}개 · 틀림 {wrong}")
        bad += 1 if wrong else 0

    print(f"\n{'✅ 원문과 완전히 일치합니다' if not bad else f'✖ 어긋난 구장 {bad}곳'}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
