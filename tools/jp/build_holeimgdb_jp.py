# -*- coding: utf-8 -*-
"""coursedata/homepages_jp/*/parsed.json → js/holeimgdb_jp.js (2026-08-01 신설)

⚠️ 한국의 `tools/build_holeimgdb.py` 는 **한 줄도 고치지 않는다.**
   일본 자료가 잘못돼도 한국 배포가 멈추지 않게 하려는 것이다
   (한국판은 전 구장 일괄 재조립이라 한 곳이 깨지면 전체가 멈춘다).

만드는 것: `const HOLEIMG_DB_JP = { "구장명": {...} }`
  · 이름을 `HOLEIMG_DB` 와 다르게 둔 이유: 같은 이름이면 나중에 로드된 쪽이
    앞을 덮어써 한국 홀맵이 통째로 사라진다(재선언 SyntaxError 또는 조용한 덮어쓰기).
  · 거리는 **야드(y)** 로 적는다. 미터(m)와 키를 다르게 둔 이유는
    누군가 `.m` 으로 읽어 100야드씩 틀린 거리를 캐디에게 넘기는 사고를 막기 위해서다.

사용: python tools/jp/build_holeimgdb_jp.py
"""
import glob, json, os, sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import HP_JP, ROOT

OUT = os.path.join(ROOT, "js", "holeimgdb_jp.js")


def js_str(s):
    s = str(s).replace("\\", "\\\\").replace('"', '\\"').replace("\r", " ").replace("\n", " ")
    return '"' + s.strip() + '"'


def main():
    files = sorted(glob.glob(os.path.join(HP_JP, "*", "parsed.json")))
    entries = []
    for f in files:
        d = json.load(open(f, encoding="utf-8"))
        entries.append(d)
        total = sum(len(c["holes"]) for c in d["courses"])
        imgs = sum(1 for c in d["courses"] for h in c["holes"] if h.get("img"))
        print(f'{d["course"]}: {total}홀 · 그림 {imgs}장 ({", ".join(c["name"] for c in d["courses"])})')

    # 중복 구장명 차단 (G5 — 한국 조립기와 같은 사상)
    dups = [n for n, c in Counter(d["course"] for d in entries).items() if c > 1]
    if dups:
        print(f"✖ 구장명이 겹칩니다 {len(dups)}건 — 조립을 멈춥니다(뒤 항목이 앞을 덮어씁니다)")
        for n in dups:
            srcs = [d.get("sourceUrl", "?") for d in entries if d["course"] == n]
            print(f'   - "{n}" ← {" / ".join(srcs)}')
        return 1

    with open(OUT, "w", encoding="utf-8", newline="\n") as w:
        w.write("/* 투어리스트 일본 홀맵 DB — 각 구장 공식 사이트 원문 (출처 표기)\n"
                "   ⚠️ 생성물입니다. 직접 고치지 마세요 — tools/jp/build_holeimgdb_jp.py 가 다시 씁니다.\n"
                "   ⚠️ 거리 단위는 야드(y)입니다. 미터가 아닙니다. */\n")
        w.write("const HOLEIMG_DB_JP = {\n")
        for d in entries:
            w.write(f'  {js_str(d["course"])}: {{\n')
            w.write(f'    source: {js_str(d["source"])},\n')
            w.write(f'    sourceUrl: {js_str(d.get("sourceUrl", ""))},\n')
            w.write(f'    unit: {js_str(d.get("unit", "yd"))},\n')
            if d.get("green"):
                # 2그린 구장 — 화면에 "A그린 기준"이라고 밝히기 위한 값
                w.write(f'    green: {js_str(d["green"])},\n')
                w.write(f'    greens: {int(d.get("greens") or 2)},\n')
            w.write("    courses: [\n")
            for c in d["courses"]:
                w.write(f'      {{ name: {js_str(c["name"])}, holes: [\n')
                for h in c["holes"]:
                    # ⚠️ 파를 모르면 **비워 둔다**. 예전에는 `or 4` 로 파 4를 지어냈고,
                    #    일본 22개 구장 396홀이 근거 없는 '파 4'로 화면과 AI 캐디에 나갔다
                    #    (2026-08-03 감사에서 발견). 틀릴 수 있는 정보는 표시하지 않는다.
                    parts = [f'no: {h["no"]}']
                    if h.get("par"):
                        parts.append(f'par: {h["par"]}')
                    if h.get("img"):
                        parts.append(f'img: {js_str(h["img"])}')
                    if h.get("hdcp"):
                        parts.append(f'hdcp: {h["hdcp"]}')
                    if h.get("tees"):
                        tj = ", ".join(f'{{ name: {js_str(t["name"])}, y: {t["y"]} }}' for t in h["tees"])
                        parts.append(f"tees: [{tj}]")
                    w.write("        { " + ", ".join(parts) + " },\n")
                w.write("      ]},\n")
            w.write("    ],\n  },\n")
        w.write("};\n")
    kb = os.path.getsize(OUT) // 1024
    print(f"holeimgdb_jp.js 조립 완료: {len(entries)}구장 · {kb}KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
