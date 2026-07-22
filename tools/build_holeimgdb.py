# -*- coding: utf-8 -*-
"""coursedata/homepages/*/parsed.json → js/holeimgdb.js (다구장 조립)
session_scripts/build_holeimg_all.py의 경로 하드코딩 제거 + tees(티별 거리) 지원판.
사용: python tools/build_holeimgdb.py
"""
import json, glob, os, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HP = os.path.join(ROOT, "coursedata", "homepages")
OUT = os.path.join(ROOT, "js", "holeimgdb.js")

def js_str(s):
    s = str(s)
    s = s.replace("\\", "\\\\")
    s = s.replace('"', '\\"')
    s = s.replace("\r", " ")
    s = s.replace("\n", " ")
    return '"' + s.strip() + '"'

# 같은 골프장이 앱 검색DB에 두 항목으로 들어가 있는 경우, 어느 쪽으로 찾아와도
# 같은 홀 데이터를 보여주도록 키를 복제한다 (코스명은 데이터 안에 그대로 표시됨).
MIRROR = {"샤인빌파크CC-PALM코스": ["샤인빌파크CC-RIVER코스"]}

entries = []
for f in sorted(glob.glob(os.path.join(HP, "*", "parsed.json"))):
    d = json.load(open(f, encoding="utf-8"))
    entries.append(d)
    for extra in MIRROR.get(d["course"], []):
        m = dict(d)
        m["course"] = extra
        entries.append(m)
    total = sum(len(c["holes"]) for c in d["courses"])
    print(f'{d["course"]}: {total}홀 ({", ".join(c["name"] for c in d["courses"])})')

with open(OUT, "w", encoding="utf-8", newline="\n") as w:
    w.write("/* Ri-Weather 공식 홀맵 이미지 DB — 각 골프장 공식 홈페이지 원문 (출처 표기) */\n")
    w.write("const HOLEIMG_DB = {\n")
    for d in entries:
        w.write(f'  {js_str(d["course"])}: {{\n')
        w.write(f'    source: {js_str(d["source"])},\n')
        w.write(f'    sourceUrl: {js_str(d.get("sourceUrl", ""))},\n')
        w.write("    courses: [\n")
        for c in d["courses"]:
            w.write(f'      {{ name: {js_str(c["name"])}, holes: [\n')
            for h in c["holes"]:
                parts = [f'no: {h["no"]}', f'par: {h.get("par") or 4}']
                if h.get("img"):
                    parts.append(f'img: {js_str(h["img"])}')
                if h.get("video"):
                    parts.append(f'video: {js_str(h["video"])}')
                if h.get("frames"):
                    parts.append("frames: [" + ", ".join(js_str(x) for x in h["frames"]) + "]")
                if h.get("elev"):
                    parts.append(f'elev: {h["elev"]}')
                if h.get("tip"):
                    parts.append(f'tip: {js_str(h["tip"])}')
                if h.get("dist"):
                    parts.append(f'dist: {{ L: {h["dist"]["L"]}, R: {h["dist"]["R"]} }}')
                if h.get("tees"):
                    def tee_m(v):
                        return str(v) if isinstance(v, int) else js_str(v)
                    tj = ", ".join(f'{{ name: {js_str(t["name"])}, m: {tee_m(t["m"])} }}' for t in h["tees"])
                    parts.append(f"tees: [{tj}]")
                if h.get("green"):
                    parts.append(f'green: {js_str(h["green"])}')
                if h.get("len"):
                    parts.append(f'len: {h["len"]}')
                if h.get("hdcp"):
                    parts.append(f'hdcp: {h["hdcp"]}')
                w.write("        { " + ", ".join(parts) + " },\n")
            w.write("      ]},\n")
        w.write("    ],\n  },\n")
    w.write("};\n")
print("holeimgdb.js 조립 완료:", len(entries), "구장")
