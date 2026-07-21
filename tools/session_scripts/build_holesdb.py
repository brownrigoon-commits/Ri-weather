# -*- coding: utf-8 -*-
"""scratchpad의 모든 *.holes.json → Ri-weather/js/holesdb.js 재생성"""
import json, glob, os, io
base = os.path.dirname(os.path.abspath(__file__))
out_path = r"C:\Users\디자이너\Desktop\claude\Ri-weather\js\holesdb.js"

db = {}
for f in sorted(glob.glob(os.path.join(base, "*.holes.json"))):
    j = json.load(open(f, encoding="utf-8"))
    holes = []
    for h in j["holes"]:
        e = {"ref": h["ref"], "name": h["name"], "par": h["par"], "line": h["line"]}
        if h.get("tip"):
            e["len"] = h.get("len") or 0
            e["tip"] = h["tip"]
        if h.get("greenFlow"):
            e["gf"] = h["greenFlow"]
        holes.append(e)
    db[j["course"]] = holes
    print(f'{j["course"]}: {len(holes)} holes')

with io.open(out_path, "w", encoding="utf-8") as w:
    w.write("/* Ri-Weather 내장 홀 DB\n")
    w.write(" * 공개 지도(OSM)에 홀 데이터가 없는 한국 골프장을 위성사진 분석으로 직접 제작.\n")
    w.write(' * 형식: HOLES_DB["골프장 이름"] = [{ref, name(코스명), par, line:[[lat,lon],...]}]\n')
    w.write(" * line은 티잉구역 → 그린 순서. 홀 번호·파는 위성 분석 추정치.\n */\n")
    w.write("const HOLES_DB = ")
    w.write(json.dumps(db, ensure_ascii=False, separators=(",", ":")))
    w.write(";\n")
print("holesdb.js written:", len(db), "courses")
