# -*- coding: utf-8 -*-
"""seoseoul_tips.json + 골프존 파/거리 → js/holeimgdb.js 재생성"""
import json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
base = os.path.dirname(os.path.abspath(__file__))
tips = json.load(open(os.path.join(base, "seoseoul_tips.json"), encoding="utf-8"))
try:
    dists = json.load(open(os.path.join(base, "seoseoul_dists.json"), encoding="utf-8"))
except Exception:
    dists = {}

def esc(s):
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").strip()

courses = []
warn = []
for cname, prefix in [("레이크", "L"), ("마운틴", "M")]:
    holes = []
    total = 0
    for i in range(1, 10):
        t = tips.get(f"{prefix}{i}") or {}
        par = t.get("par")
        if not par:
            warn.append(f"{cname}{i}: 파 추출 실패")
            par = 4
        total += par
        holes.append({"no": i, "par": par,
                      "img": f"holeimg/seoseoul/n_{prefix}{i}.png",
                      "tip": (t.get("tip") or "").strip(),
                      "dist": dists.get(f"{prefix}{i}") or None})
    if total != 36:
        warn.append(f"{cname}: 파 합계 {total} (36 아님 — 확인 필요)")
    courses.append({"name": cname, "holes": holes})

out_path = r"C:\Users\디자이너\Desktop\claude\Ri-weather\js\holeimgdb.js"
with open(out_path, "w", encoding="utf-8") as w:
    w.write("/* Ri-Weather 공식 홀맵 이미지 DB\n")
    w.write(" * 홀 그림·공략 TIP: 각 골프장 공식 홈페이지 (출처 표기), 거리: 골프존 실측 프론트티 기준.\n */\n")
    w.write("const HOLEIMG_DB = {\n")
    w.write('  "서서울CC": {\n')
    w.write('    source: "서서울CC(H1클럽) 공식 홈페이지",\n')
    w.write('    sourceUrl: "https://www.h1club.co.kr/html/course.asp",\n')
    w.write("    courses: [\n")
    for c in courses:
        w.write(f'      {{ name: "{c["name"]}", holes: [\n')
        for h in c["holes"]:
            d = h.get("dist")
            dstr = f', dist: {{ L: {d["L"]}, R: {d["R"]} }}' if d else ""
            w.write(f'        {{ no: {h["no"]}, par: {h["par"]}, img: "{h["img"]}", tip: "{esc(h["tip"])}"{dstr} }},\n')
        w.write("      ]},\n")
    w.write("    ],\n  },\n};\n")

print("holeimgdb.js 재생성 완료")
for x in warn:
    print("⚠", x)
