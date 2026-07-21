# -*- coding: utf-8 -*-
import io, json, math

db = io.open(r"C:\Users\디자이너\Desktop\claude\Ri-weather\js\golfdb.js", encoding="utf-8").read()
GOLF_DB = json.loads(db[db.index("["):db.rindex("]")+1])

def dist(a, b):
    R=6371000
    dla=math.radians(b[0]-a[0]); dlo=math.radians(b[1]-a[1])
    x=math.sin(dla/2)**2+math.cos(math.radians(a[0]))*math.cos(math.radians(b[0]))*math.sin(dlo/2)**2
    return 2*R*math.asin(math.sqrt(x))

out = []
for kw in ["파주", "타이거", "필로스", "스카이72", "스카이"]:
    hits = [g for g in GOLF_DB if kw in (g.get("k") or g["n"]) or kw in g["n"] or kw in (g.get("a") or "")]
    out.append("=== '%s' 포함 항목: %d개 ===" % (kw, len(hits)))
    for g in hits[:10]:
        out.append("  n=%r k=%r a=%r c=%s (%.4f, %.4f)" % (g["n"], g.get("k"), (g.get("a") or "")[:40], g["c"], g["lat"], g["lon"]))

# 파주CC 주변 6km 내 다른 골프장 (findCourseNames가 보는 범위)
paju = next((g for g in GOLF_DB if g["n"] == "파주CC"), None)
if paju:
    out.append("=== 파주CC 주변 6km 내 항목 ===")
    for g in GOLF_DB:
        d = dist((g["lat"], g["lon"]), (paju["lat"], paju["lon"]))
        if d < 6000:
            out.append("  %.0fm  %s" % (d, g.get("k") or g["n"]))

io.open(r"C:\Users\디자이너\AppData\Local\Temp\claude\C--Users------Desktop---AI\4560011b-9c43-4f94-9eec-f28d556e2d5a\scratchpad\clubs_out.txt", "w", encoding="utf-8").write("\n".join(out))
print("done")
