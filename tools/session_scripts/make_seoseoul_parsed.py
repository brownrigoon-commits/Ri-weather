# -*- coding: utf-8 -*-
"""서서울 tips/dists → parsed.json 형식으로 변환"""
import json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
base = os.path.dirname(os.path.abspath(__file__))
tips = json.load(open(os.path.join(base, "seoseoul_tips.json"), encoding="utf-8"))
dists = json.load(open(os.path.join(base, "seoseoul_dists.json"), encoding="utf-8"))

courses = []
for cname, prefix in [("레이크", "L"), ("마운틴", "M")]:
    holes = []
    for i in range(1, 10):
        t = tips.get(f"{prefix}{i}") or {}
        holes.append({"no": i, "par": t.get("par") or 4,
                      "img": f"holeimg/seoseoul/n_{prefix}{i}.png",
                      "tip": (t.get("tip") or "").strip(),
                      "dist": dists.get(f"{prefix}{i}")})
    courses.append({"name": cname, "holes": holes})

data = {"course": "서서울CC", "source": "서서울CC(H1클럽) 공식 홈페이지",
        "sourceUrl": "https://www.h1club.co.kr/html/course.asp", "courses": courses}
out = r"C:\Users\디자이너\Desktop\claude\Ri-weather\coursedata\homepages\seoseoul\parsed.json"
json.dump(data, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("서서울 parsed.json 저장")
