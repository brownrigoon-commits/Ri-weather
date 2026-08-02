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
from jp_common import HP_JP, ROOT

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
    files = sorted(f for f in os.listdir(STATS) if f.endswith(".json"))
    # 홀맵이 등록된 구장만 담는다 — 홀맵 없이 숫자만 있으면 화면에 붙일 자리가 없다
    reg = set()
    for d in os.listdir(HP_JP):
        f = os.path.join(HP_JP, d, "parsed.json")
        if os.path.exists(f):
            try:
                reg.add(json.load(open(f, encoding="utf-8"))["course"])
            except Exception:
                pass

    rows, skipped = [], 0
    for fn in files:
        d = json.load(open(os.path.join(STATS, fn), encoding="utf-8"))
        if d["course"] not in reg:
            skipped += 1
            continue
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
    print(f"holestats_jp.js 조립 완료: {len(rows)}구장 · {holes:,}홀 · {kb}KB"
          + (f" (홀맵 없는 구장 {skipped}곳은 제외)" if skipped else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
