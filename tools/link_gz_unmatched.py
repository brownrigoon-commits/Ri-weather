# -*- coding: utf-8 -*-
"""골프존에는 있으나 앱 검색DB에 없는 구장을 '주소 좌표'로 안전하게 연결
1) 골프존 주소 → 지오코딩
2) golfdb.js에서 3km 이내 항목 검색
   · 정확히 1곳  → 그 항목에 골프존 이름을 별칭(a)으로 추가 (검색 가능해짐)
   · 0곳        → 신규 항목으로 추가
   · 2곳 이상    → 건너뜀 (오연결 방지)
사용: python tools/link_gz_unmatched.py [--write]
"""
import json, math, os, re, sys, time, urllib.parse, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WRITE = "--write" in sys.argv
UA = "RiWeather/1.0 (golf course linking)"

def geocode(addr):
    for q in (addr, re.sub(r"\s*\S*번지.*$", "", addr), " ".join(addr.split()[:4])):
        if not q.strip():
            continue
        try:
            u = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q=" + urllib.parse.quote(q)
            req = urllib.request.Request(u, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20) as r:
                j = json.loads(r.read())
            time.sleep(1.1)
            if j:
                return float(j[0]["lat"]), float(j[0]["lon"])
        except Exception:
            time.sleep(1.1)
    return None

def km(a, b, c, d):
    R, p = 6371, math.pi / 180
    x = math.sin((c-a)*p/2)**2 + math.cos(a*p)*math.cos(c*p)*math.sin((d-b)*p/2)**2
    return 2 * R * math.asin(math.sqrt(x))

path = os.path.join(ROOT, "js", "golfdb.js")
txt = open(path, encoding="utf-8").read()
DB = json.loads(re.search(r"const GOLF_DB = (\[.*\]);", txt, re.S).group(1))
kr = [(i, g) for i, g in enumerate(DB) if g.get("c") == "KR"]

items = json.load(open(os.path.join(ROOT, "coursedata", "workfiles", "gz_unmatched.json"), encoding="utf-8"))
alias, added, skipped, failed = [], [], [], []
for it in items:
    club, addr = it["club"], it["addr"]
    if not addr:
        failed.append((club, "주소 없음")); continue
    g = geocode(addr)
    if not g:
        failed.append((club, f"지오코딩 실패: {addr[:24]}")); continue
    lat, lon = g
    near = [(km(lat, lon, x["lat"], x["lon"]), i, x) for i, x in kr]
    near = [n for n in near if n[0] <= 3.0]
    near.sort()
    if len(near) == 1:
        d, i, x = near[0]
        alias.append((club, x["n"], round(d, 2)))
        if WRITE:
            DB[i]["a"] = (DB[i].get("a", "") + " " + club).strip()
    elif not near:
        added.append((club, lat, lon))
        if WRITE:
            DB.append({"n": club, "lat": round(lat, 5), "lon": round(lon, 5), "c": "KR"})
    else:
        skipped.append((club, [n[2]["n"] for n in near[:3]]))

print(f"별칭 연결 {len(alias)} / 신규 추가 {len(added)} / 모호 건너뜀 {len(skipped)} / 실패 {len(failed)}")
for c, n, d in alias:
    print(f"  연결: '{c}' → 기존 '{n}' ({d}km)")
for c, la, lo in added:
    print(f"  신규: '{c}' ({la:.4f},{lo:.4f})")
for c, cands in skipped:
    print(f"  모호: '{c}' ↔ {cands}")
for c, why in failed:
    print(f"  실패: '{c}' — {why}")

if WRITE:
    new = "const GOLF_DB = " + json.dumps(DB, ensure_ascii=False, separators=(",", ":")) + ";"
    txt2 = re.sub(r"const GOLF_DB = \[.*\];", lambda m: new, txt, flags=re.S)
    open(path, "w", encoding="utf-8", newline="\n").write(txt2)
    print("\ngolfdb.js 반영 완료")
