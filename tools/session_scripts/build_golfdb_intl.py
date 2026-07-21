# -*- coding: utf-8 -*-
"""한국+일본+중국 OSM 골프장 → 앱 내장 DB(js/golfdb.js)"""
import json, re, io

BASE = r"C:\Users\디자이너\AppData\Local\Temp\claude\C--Users------Desktop---AI\4560011b-9c43-4f94-9eec-f28d556e2d5a\scratchpad\\"
OUT = r"C:\Users\디자이너\Desktop\claude\Ri-weather\js\golfdb.js"

SOURCES = [
    ("KR", "golf_raw.json"),
    ("JP", "golf_jp.json"),
    ("CN", "golf_cn.json"),
]

MOJIBAKE = re.compile(r"[ÃÂãâäåæçèéêëìíîïðñòóôõöø]")

def fix_mojibake(s):
    if not s:
        return s
    # 이중 인코딩된 경우까지 반복 복원 (깨짐 표시가 줄어드는 동안)
    for _ in range(3):
        if not MOJIBAKE.search(s):
            break
        try:
            t = s.encode("latin-1").decode("utf-8")
        except UnicodeEncodeError:
            break
        except UnicodeDecodeError:
            # 끝이 잘린 멀티바이트 → 디코딩 가능한 부분만 살림
            try:
                t = s.encode("latin-1").decode("utf-8", "ignore")
            except UnicodeEncodeError:
                break
        if t == s:
            break
        s = t
    return s.rstrip()

# 연습장/스크린 등 제외 (한/영/일/중)
EXCLUDE = re.compile(
    r"스크린|연습장|골프존|파크\s?골프|아카데미|인도어|드라이빙|미니골프|"
    r"練習場|打ちっぱなし|ゴルフガーデン|ゴルフセンター|"      # 일본어 연습장
    r"练习场|練習場|迷你高尔夫|室内|高尔夫练习|"                # 중국어 연습장
    r"screen|practice|driving|indoor|park\s?golf|GDR|range|academy", re.I)

# 단독으로 의미 없는 코스명 (A코스, IN코스 등)
GENERIC = re.compile(r"^(in|out|west|east|south|north|g|hill|hue|no\.?\s?\d*|[a-z]{1,4}|\d+[가-힣]?)\s?(코스|course|コース)$", re.I)

ALIAS_KEYS = ["name:en", "name:ko", "name:ja", "name:zh", "int_name", "alt_name"]

# 일본어 → 로마자, 중국어 → 병음 (한글 발음 검색용 별칭)
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pykakasi
from pypinyin import lazy_pinyin
from koreanize import jp_to_korean, cn_to_korean
_kks = pykakasi.kakasi()

def romanize(name, cc):
    try:
        if cc == "JP":
            return "".join(item["hepburn"] for item in _kks.convert(name))
        if cc == "CN":
            return "".join(lazy_pinyin(name))
    except Exception:
        pass
    return ""

def center(el):
    lat = el.get("lat") or (el.get("center") or {}).get("lat")
    lon = el.get("lon") or (el.get("center") or {}).get("lon")
    return lat, lon

courses = []
seen = set()
for cc, fname in SOURCES:
    data = json.load(io.open(BASE + fname, encoding="utf-8-sig"))
    for el in data["elements"]:
        tags = el.get("tags") or {}
        name = fix_mojibake((tags.get("name") or "").strip())
        if not name or EXCLUDE.search(name) or GENERIC.match(name):
            continue
        lat, lon = center(el)
        if lat is None or lon is None:
            continue
        # 별칭 수집 (영문/타국어명) → 다국어 검색
        aliases = []
        for k in ALIAS_KEYS:
            v = fix_mojibake((tags.get(k) or "").strip())
            if v and v != name and v not in aliases:
                aliases.append(v)
        # 로마자/병음 별칭 — 한글 발음 검색용
        rom = romanize(name, cc)
        if rom and rom.lower() != name.lower() and rom not in aliases:
            aliases.append(rom)
        key = (name, round(lat, 2), round(lon, 2))
        if key in seen:
            continue
        seen.add(key)
        entry = {"n": name, "lat": round(lat, 5), "lon": round(lon, 5), "c": cc}
        if aliases:
            entry["a"] = " ".join(aliases)
        # 한글 표기명 (일본/중국 골프장 → 한국인용 표시 이름)
        if cc == "JP":
            k = jp_to_korean(name)
            if k and k != name:
                entry["k"] = k
        elif cc == "CN":
            k = cn_to_korean(name)
            if k and k != name:
                entry["k"] = k
        courses.append(entry)

# 같은 이름이 근거리(≈3km)에 중복이면 하나만
dedup = []
for c in sorted(courses, key=lambda x: (x["c"], x["n"])):
    dup = False
    for d in dedup:
        if d["n"] == c["n"] and abs(d["lat"] - c["lat"]) < 0.03 and abs(d["lon"] - c["lon"]) < 0.03:
            dup = True
            break
    if not dup:
        dedup.append(c)

# 국가별 정렬: KR, JP, CN 순, 이름순
order = {"KR": 0, "JP": 1, "CN": 2}
dedup.sort(key=lambda x: (order[x["c"]], x["n"]))

js = "/* 한국·일본·중국 골프장 DB — OpenStreetMap(ODbL) 기반, 자동 생성 */\n"
js += "const GOLF_DB = " + json.dumps(dedup, ensure_ascii=False, separators=(",", ":")) + ";\n"
io.open(OUT, "w", encoding="utf-8").write(js)

from collections import Counter
cnt = Counter(c["c"] for c in dedup)
size_kb = len(js.encode("utf-8")) / 1024
print("total:", len(dedup), "by country:", dict(cnt), "size: %.0fKB" % size_kb)
