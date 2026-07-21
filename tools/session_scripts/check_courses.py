# -*- coding: utf-8 -*-
"""사장님 방문 18개 골프장: golfdb 좌표 확인 + OSM 골프 데이터 존재 여부 조사"""
import re, json, time, urllib.request, urllib.parse, sys
sys.stdout.reconfigure(encoding="utf-8")

DB = r"C:\Users\디자이너\Desktop\claude\Ri-weather\js\golfdb.js"
targets = ["서서울", "자유로", "몽베르", "노스팜", "베스트밸리", "스마트KU",
           "서원힐스", "동강시스타", "더스타휴", "감곡", "힐마루", "알프스",
           "샴발라", "푸른솔포천", "라싸", "신라", "클럽72", "스프링힐스"]

txt = open(DB, encoding="utf-8").read()
entries = [json.loads(m) for m in re.findall(r'\{"n":"[^"]+","lat":[\d.]+,"lon":[\d.]+,"c":"KR"[^}]*\}', txt)]
print(f"KR courses in DB: {len(entries)}")

found = {}
for t in targets:
    hits = [e for e in entries if t.lower() in e["n"].lower() or t.lower() in e.get("k", "").lower()]
    found[t] = hits
    names = ", ".join(f'{h["n"]}({h["lat"]:.4f},{h["lon"]:.4f})' for h in hits[:3])
    print(f'{"O" if hits else "X"} {t}: {names if hits else "DB에 없음"}')

# OSM 데이터 조사 (DB에 있는 것만)
print("\n--- OSM golf data ---")
for t, hits in found.items():
    if not hits:
        continue
    e = hits[0]
    q = f'[out:json][timeout:20];way["golf"](around:1800,{e["lat"]},{e["lon"]});out tags;'
    url = "https://overpass-api.de/api/interpreter"
    data = urllib.parse.urlencode({"data": q}).encode()
    req = urllib.request.Request(url, data=data, headers={"User-Agent": "RiWeather/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            j = json.loads(r.read())
        cnt = {}
        for el in j.get("elements", []):
            g = el.get("tags", {}).get("golf", "?")
            cnt[g] = cnt.get(g, 0) + 1
        print(f'{t} ({e["n"]}): hole={cnt.get("hole",0)} tee={cnt.get("tee",0)} green={cnt.get("green",0)} fairway={cnt.get("fairway",0)} bunker={cnt.get("bunker",0)}')
    except Exception as ex:
        print(f"{t}: 조회 실패 {ex}")
    time.sleep(2)
