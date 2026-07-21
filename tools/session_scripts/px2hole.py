# -*- coding: utf-8 -*-
"""픽셀 좌표로 적은 홀 트레이스(JSON) → holesdb.js 항목(lat/lon) 변환
사용: python px2hole.py <이름>   (읽기: <이름>.trace.json + <이름>.meta.json)
trace.json 형식: {"course":"DB상 골프장 이름","holes":[{"ref":"1","name":"힐","par":4,"px":[[x,y],[x,y],...]}]}
par 생략 시 길이로 추정. 출력: <이름>.holes.json (lat/lon line)
"""
import sys, math, json, os
base = os.path.dirname(os.path.abspath(__file__))
name = sys.argv[1]
meta = json.load(open(os.path.join(base, name + ".meta.json")))
trace = json.load(open(os.path.join(base, name + ".trace.json"), encoding="utf-8"))
Z, tx0, ty0 = meta["z"], meta["tx0"], meta["ty0"]

def px2ll(x, y):
    tx = tx0 + x / 256; ty = ty0 + y / 256
    lon = tx / 2**Z * 360 - 180
    n = math.pi - 2 * math.pi * ty / 2**Z
    lat = math.degrees(math.atan(math.sinh(n)))
    return [round(lat, 6), round(lon, 6)]

def dist(a, b):
    R = 6371000
    la1, lo1, la2, lo2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    x = math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
    return 2 * R * math.asin(math.sqrt(x))

out = []
for h in trace["holes"]:
    line = [px2ll(x, y) for x, y in h["px"]]
    L = sum(dist(line[i], line[i+1]) for i in range(len(line)-1))
    par = h.get("par") or (3 if L < 210 else 4 if L < 400 else 5)
    out.append({"ref": str(h["ref"]), "name": h.get("name", ""), "par": par, "line": line, "len": round(L)})
    print(f'{h.get("name","")} {h["ref"]}: par{par} {round(L)}m')

json.dump({"course": trace["course"], "holes": out},
          open(os.path.join(base, name + ".holes.json"), "w", encoding="utf-8"),
          ensure_ascii=False)
print(f"total {len(out)} holes -> {name}.holes.json")
