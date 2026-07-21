# -*- coding: utf-8 -*-
"""그린 흐름(지형 경사) 계산 — Open-Meteo 고도 API (Copernicus DEM)
서서울 holes.json의 각 그린 주변 고도를 조회해 경사 방향/기울기를 산출하고
holes.json에 greenFlow 필드를 추가한다.
"""
import json, math, os, sys, time, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
base = os.path.dirname(os.path.abspath(__file__))
f = os.path.join(base, "seoseoul.holes.json")
data = json.load(open(f, encoding="utf-8"))

R = 60  # 그린 주변 반경(m) — 지형 경사 파악용
DIRS = [(0,1,"북"),(1,1,"북동"),(1,0,"동"),(1,-1,"남동"),(0,-1,"남"),(-1,-1,"남서"),(-1,0,"서"),(-1,1,"북서")]

pts = []   # (holeIdx, dirIdx|-1=center, lat, lon)
for i, h in enumerate(data["holes"]):
    glat, glon = h["line"][-1]
    pts.append((i, -1, glat, glon))
    for j, (dx, dy, _) in enumerate(DIRS):
        n = math.hypot(dx, dy)
        dlat = (dy / n) * R / 111320
        dlon = (dx / n) * R / (111320 * math.cos(math.radians(glat)))
        pts.append((i, j, glat + dlat, glon + dlon))

# open-meteo elevation: 최대 100좌표/요청
elev = {}
for s in range(0, len(pts), 100):
    chunk = pts[s:s+100]
    lats = ",".join(f"{p[2]:.6f}" for p in chunk)
    lons = ",".join(f"{p[3]:.6f}" for p in chunk)
    url = f"https://api.open-meteo.com/v1/elevation?latitude={lats}&longitude={lons}"
    req = urllib.request.Request(url, headers={"User-Agent": "RiWeather/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        j = json.loads(r.read())
    for p, e in zip(chunk, j["elevation"]):
        elev[(p[0], p[1])] = e
    time.sleep(1)

for i, h in enumerate(data["holes"]):
    c = elev[(i, -1)]
    best = max(range(8), key=lambda j: elev[(i, j)])
    worst = min(range(8), key=lambda j: elev[(i, j)])
    high, low = DIRS[best][2], DIRS[worst][2]
    grade = (elev[(i, best)] - elev[(i, worst)]) / (2 * R) * 100  # %
    h["greenFlow"] = {"high": high, "low": low, "grade": round(grade, 1), "elev": round(c)}
    print(f'{h["name"]}{h["ref"]}: 그린고도 {round(c)}m, {high}쪽 높음 → {low}쪽으로 흐름 (경사 {grade:.1f}%)')

json.dump(data, open(f, "w", encoding="utf-8"), ensure_ascii=False)
print("greenFlow 저장 완료")
