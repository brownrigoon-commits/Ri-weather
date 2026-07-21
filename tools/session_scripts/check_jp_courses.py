# -*- coding: utf-8 -*-
import io, json, re
db = io.open(r"C:\Users\디자이너\Desktop\claude\Ri-weather\js\golfdb.js", encoding="utf-8").read()
arr = json.loads(db[db.index("["):db.rindex("]")+1])
jp = [g for g in arr if g.get("c") == "JP"]

# 삿포로/치토세 인근 (북위 42.5~43.3, 동경 141~142)
sapporo = [g for g in jp if 42.4 < g["lat"] < 43.4 and 140.8 < g["lon"] < 142.2]
out = ["JP total=%d, Sapporo-area=%d" % (len(jp), len(sapporo))]
# 영문명 보유율
with_en = [g for g in sapporo if g.get("a")]
out.append("Sapporo-area with English name: %d/%d" % (len(with_en), len(sapporo)))

# 키워드로 특정 코스 찾기
def find(kw):
    return [g["n"] + (" / " + g["a"] if g.get("a") else "") for g in jp if kw.lower() in (g["n"] + " " + g.get("a","")).lower()]

for kw in ["羊", "hitsuji", "chitose", "千歳", "rembrandt", "レンブラント", "elm", "エルム", "sapporo", "clark", "sukisappu", "月寒"]:
    hits = find(kw)
    out.append("[%s] %d: %s" % (kw, len(hits), " || ".join(hits[:4])))

io.open(r"C:\Users\디자이너\AppData\Local\Temp\claude\C--Users------Desktop---AI\4560011b-9c43-4f94-9eec-f28d556e2d5a\scratchpad\jp_courses_out.txt","w",encoding="utf-8").write("\n".join(out))
print("done")
