# -*- coding: utf-8 -*-
import io, json, re
db = io.open(r"C:\Users\디자이너\Desktop\claude\Ri-weather\js\golfdb.js", encoding="utf-8").read()
arr = json.loads(db[db.index("["):db.rindex("]")+1])
jp = [g for g in arr if g["c"]=="JP"]; cn = [g for g in arr if g["c"]=="CN"]
jk = [g for g in jp if g.get("k")]; ck = [g for g in cn if g.get("k")]
out = ["JP with k: %d/%d, CN with k: %d/%d" % (len(jk), len(jp), len(ck), len(cn))]
for g in jk[:6]: out.append("JP %s -> %s" % (g["n"], g["k"]))
for g in ck[:6]: out.append("CN %s -> %s" % (g["n"], g["k"]))
# 羊ヶ丘 확인
for g in jp:
    if "羊" in g["n"]: out.append("CHECK %s -> %s" % (g["n"], g.get("k")))
io.open(r"C:\Users\디자이너\AppData\Local\Temp\claude\C--Users------Desktop---AI\4560011b-9c43-4f94-9eec-f28d556e2d5a\scratchpad\k_out.txt","w",encoding="utf-8").write("\n".join(out))
print("done")
