# -*- coding: utf-8 -*-
"""OSM 골프장 원본 → 앱 내장 골프장 DB(js/golfdb.js) 생성"""
import json, re, io, sys

RAW = r"C:\Users\디자이너\AppData\Local\Temp\claude\C--Users------Desktop---AI\4560011b-9c43-4f94-9eec-f28d556e2d5a\scratchpad\golf_raw.json"
OUT = r"C:\Users\디자이너\Desktop\claude\Ri-weather\js\golfdb.js"

def fix_mojibake(s):
    # PowerShell이 UTF-8 응답을 Latin-1로 잘못 읽어 저장한 경우 복원
    try:
        repaired = s.encode("latin-1").decode("utf-8")
        return repaired
    except (UnicodeEncodeError, UnicodeDecodeError):
        return s

with io.open(RAW, "r", encoding="utf-8-sig") as f:
    data = json.load(f)

EXCLUDE = re.compile(
    r"스크린|연습장|골프존|파크\s?골프|아카데미|인도어|드라이빙|미니골프|"
    r"screen|practice|driving|indoor|park\s?golf|GDR|range", re.I)
# 리조트 내부 개별 코스명 등 단독으로 의미 없는 이름
GENERIC = re.compile(r"^(in|out|west|east|south|north|g|hill|hue|no\.?\s?\d*|[a-z]{1,4}|\d+[가-힣]?)\s?(코스|course)$", re.I)

courses = []
seen = set()
for el in data["elements"]:
    tags = el.get("tags") or {}
    name = tags.get("name")
    if not name:
        continue
    name = fix_mojibake(name).strip()
    if EXCLUDE.search(name) or GENERIC.match(name):
        continue
    lat = el.get("lat") or (el.get("center") or {}).get("lat")
    lon = el.get("lon") or (el.get("center") or {}).get("lon")
    if lat is None or lon is None:
        continue
    # 이름+대략 위치로 중복 제거 (코스별 way가 여럿인 골프장)
    key = (name, round(lat, 2), round(lon, 2))
    if key in seen:
        continue
    seen.add(key)
    courses.append({"n": name, "lat": round(lat, 5), "lon": round(lon, 5)})

# 같은 이름이 아주 가까운 거리(≈3km)에 여러 개면 하나만
dedup = []
for c in sorted(courses, key=lambda x: x["n"]):
    dup = False
    for d in dedup:
        if d["n"] == c["n"] and abs(d["lat"] - c["lat"]) < 0.03 and abs(d["lon"] - c["lon"]) < 0.03:
            dup = True
            break
    if not dup:
        dedup.append(c)

dedup.sort(key=lambda x: x["n"])
js = "/* 전국 골프장 DB — OpenStreetMap(ODbL) 기반, 자동 생성 */\n"
js += "const GOLF_DB = " + json.dumps(dedup, ensure_ascii=False, separators=(",", ":")) + ";\n"

with io.open(OUT, "w", encoding="utf-8") as f:
    f.write(js)

print("courses:", len(dedup))
print("sample:", [c["n"] for c in dedup[:5]])
ulsan = [c["n"] for c in dedup if "울산" in c["n"]]
print("ulsan:", ulsan)
