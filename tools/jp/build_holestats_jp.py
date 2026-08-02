# -*- coding: utf-8 -*-
"""coursedata/homepages_jp/_stats/*.json → js/holestats_jp.js (2026-08-02 신설)

왜 holeimgdb_jp.js 와 파일을 나누나: 통계는 홀마다 **스코어대 5벌 × 8지표**라 부피가 크다.
코스공략 화면을 열 때만 붙이면 되므로 지연 로드할 수 있게 따로 둔다
(홀맵 DB 와 같은 방식 — 한국 이용자에게는 1바이트도 안 간다).

형식 (부피를 줄이려고 배열로)
  const HOLESTATS_JP = {
    "구장명": { s:"출처", u:"주소", d:"수집일", p:[파배열],
                h:[ [ [순위,평균,퍼트,버디,파온,FW,벙커,OB] ×5밴드 ], … 홀 순서 ] }
  }
  밴드 순서 고정: 全スコア / ～79 / 80～99 / 100～119 / 120～
  값이 없으면 null — **없는 숫자를 지어내지 않는다.**

⚠️ 홀 순서는 홀맵(parsed.json)의 순서와 같다. 관문(check_stats_jp)이 파 배열로 확인한다.

사용: python tools/jp/build_holestats_jp.py
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import HP_JP, ROOT, align_stats

STATS = os.path.join(HP_JP, "_stats")
OUT = os.path.join(ROOT, "js", "holestats_jp.js")


def js_str(s):
    s = str(s).replace("\\", "\\\\").replace('"', '\\"').replace("\r", " ").replace("\n", " ")
    return '"' + s.strip() + '"'


def num(v):
    if v is None:
        return "null"
    if isinstance(v, float) and v == int(v):
        return str(int(v))
    return str(v)


def main():
    if not os.path.isdir(STATS):
        print("통계 자료가 없습니다")
        return 1
    # tip_ja_cache.json 처럼 통계가 아닌 파일이 같은 폴더에 있다 — 형태로 가른다
    files = sorted(f for f in os.listdir(STATS) if f.endswith(".json") and f != "tip_ja_cache.json")
    # 홀맵이 등록된 구장만 담는다 — 홀맵 없이 숫자만 있으면 화면에 붙일 자리가 없다
    reg = {}
    for d in os.listdir(HP_JP):
        f = os.path.join(HP_JP, d, "parsed.json")
        if os.path.exists(f):
            try:
                j = json.load(open(f, encoding="utf-8"))
                reg[j["course"]] = [h.get("par") for c in j["courses"] for h in c["holes"]]
            except Exception:
                pass

    rows, skipped, reordered, unaligned = [], 0, 0, 0
    for fn in files:
        d = json.load(open(os.path.join(STATS, fn), encoding="utf-8"))
        if d["course"] not in reg:
            skipped += 1
            continue
        theirs = reg[d["course"]]
        # 🔴 출처마다 코스 순서·IN OUT 순서가 다르다. 홀맵 순서에 맞춰 자리를 바꿔 담는다.
        #    맞출 수 없으면 담지 않는다 — 엉뚱한 홀에 숫자가 붙느니 없는 게 낫다.
        if any(a is not None for a in theirs) and theirs != d["pars"]:
            idx = align_stats(theirs, d["pars"])
            if idx is None:
                unaligned += 1
                continue
            d["pars"] = [d["pars"][i] for i in idx]
            d["holes"] = [d["holes"][i] for i in idx]
            reordered += 1
        rows.append(d)

    with open(OUT, "w", encoding="utf-8", newline="\n") as w:
        w.write("/* 투어리스트 일본 홀별 실전 통계 — じゃらんゴルフ 공개 자료\n"
                "   ⚠️ 생성물입니다. 직접 고치지 마세요 — tools/jp/build_holestats_jp.py 가 다시 씁니다.\n"
                "   밴드 순서: 全スコア / ～79 / 80～99 / 100～119 / 120～\n"
                "   지표 순서: 난이도순위·평균스코어·평균퍼트·버디율·파온율·FW안착률·벙커율·OB율\n"
                "   값이 null 이면 '자료 없음' 입니다 — 화면에서 그 줄을 빼 주세요(0 이 아닙니다). */\n")
        w.write("const HOLESTATS_JP = {\n")
        for d in rows:
            w.write(f'  {js_str(d["course"])}: {{ s: {js_str(d["source"])}, '
                    f'u: {js_str(d["sourceUrl"])}, d: {js_str(d["collectedAt"])},\n')
            w.write("    p: [" + ", ".join(str(x) for x in d["pars"]) + "],\n")
            w.write("    h: [\n")
            for h in d["holes"]:
                bands = ", ".join("[" + ", ".join(num(x) for x in (b or [None] * 8)) + "]"
                                  for b in h["b"])
                w.write(f"      [{bands}],\n")
            w.write("    ] },\n")
        w.write("};\n")
    kb = os.path.getsize(OUT) // 1024
    holes = sum(len(d["holes"]) for d in rows)
    print(f"holestats_jp.js 조립 완료: {len(rows)}구장 · {holes:,}홀 · {kb}KB")
    if skipped:
        print(f"   · 홀맵이 없어 제외 {skipped}곳")
    if reordered:
        print(f"   · 코스 순서를 홀맵에 맞춰 재배치 {reordered}곳")
    if unaligned:
        print(f"   · 자리를 맞출 수 없어 제외 {unaligned}곳 (엉뚱한 홀에 붙는 것보다 낫다)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
