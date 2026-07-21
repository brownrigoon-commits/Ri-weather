# -*- coding: utf-8 -*-
"""검색 DB(golfdb.js) 커버리지 확장 — 골프존 공식 주소 기반
골프존 상세의 address(공식 지번/도로명)를 지오코딩해서:
1) 1.5km 내 기존 항목 있으면 = 개명 → 이름 교체 + 옛 이름 별칭(a) 보존
2) 없으면 신규 항목 추가 (읍·면·리 중심 좌표 — 코스 검색용으로 충분)
실패는 workfiles/golfdb_expand_fail.json 기록.
"""
import glob, json, math, os, re, sys, time, urllib.parse, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "js", "golfdb.js")
UA = "RiWeather/1.0 (golf course db)"

def norm(s):
    return re.sub(r"(CC|GC|C\.C|G\.C|컨트리클럽|골프클럽|골프장|골프리조트|리조트|컨트리|클럽|\s)", "", s or "", flags=re.I).lower()

def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def geocode(q):
    try:
        j = json.loads(fetch("https://nominatim.openstreetmap.org/search?q=" +
                             urllib.parse.quote(q) + "&format=json&limit=1&countrycodes=kr"))
        if j:
            return float(j[0]["lat"]), float(j[0]["lon"])
    except Exception:
        pass
    return None

def geocode_addr(addr):
    # 전체 → 도로명/번지 제거 → 읍면리 → 시군구 순으로 재시도
    variants = [addr]
    m = re.match(r"(\S+\s+\S+(?:시|군|구)\s+\S+(?:읍|면|동|리))", addr)
    if m:
        variants.append(m.group(1))
    m2 = re.match(r"(\S+\s+\S+(?:시|군|구))", addr)
    if m2:
        variants.append(m2.group(1))
    for v in variants:
        g = geocode(v)
        time.sleep(1.1)
        if g:
            return g
    return None

def dist_km(a, b, c, d):
    R = 6371; p = math.pi / 180
    x = math.sin((c-a)*p/2)**2 + math.cos(a*p)*math.cos(c*p)*math.sin((d-b)*p/2)**2
    return 2*R*math.asin(math.sqrt(x))

# 골프존 국내 클럽: 이름→주소
gz = {}
for f in glob.glob(os.path.join(ROOT, "coursedata", "golfzon", "cc_*.json")):
    j = json.load(open(f, encoding="utf-8"))
    d = j.get("detail", {})
    if d.get("country") != 1:
        continue
    name = (j.get("ccName") or "").split(" - ")[0].strip()
    addr = (d.get("address") or "").strip()
    if name and addr and name not in gz:
        gz[name] = addr

# 현 DB 파싱
txt = open(DB, encoding="utf-8").read()
db_norm = set(norm(x) for x in re.findall(r'"n":"([^"]+)"', txt) + re.findall(r'"a":"([^"]+)"', txt))
entries = [(m.group(0), m.group(1), float(m.group(2)), float(m.group(3)))
           for m in re.finditer(r'\{"n":"([^"]+)","lat":([\d.]+),"lon":([\d.]+),"c":"KR"[^}]*\}', txt)]

orig_names = set(e[1] for e in entries)  # 이번 실행 전 원본 항목만 개명 대상
renamed, added, failed = [], [], []
for name, addr in gz.items():
    k = norm(name)
    if any(k == g or (len(k) >= 2 and k in g) or (len(g) >= 2 and g in k) for g in db_norm):
        continue  # 이미 검색 가능
    g = geocode_addr(addr)
    if not g:
        failed.append({"name": name, "address": addr}); print(f"✗ {name}: 지오코딩 실패 ({addr})"); continue
    lat, lon = g
    # 개명 후보 = 원본 항목 중 가장 가까운 것 (이번에 새로 넣은 건 제외)
    orig = [e for e in entries if e[1] in orig_names]
    near = min(orig, key=lambda e: dist_km(lat, lon, e[2], e[3])) if orig else None
    dkm = dist_km(lat, lon, near[2], near[3]) if near else 999
    if near and dkm < 1.0 and norm(near[1]) != k:
        new = near[0].replace(f'"n":"{near[1]}"', f'"n":"{name}"')
        if '"a":"' not in new:
            new = new[:-1] + f',"a":"{near[1]}"}}'
        txt = txt.replace(near[0], new)
        db_norm.add(k)
        renamed.append((near[1], name)); print(f"↻ 개명: {near[1]} → {name} ({dkm:.1f}km)")
    else:
        ne = json.dumps({"n": name, "lat": round(lat, 5), "lon": round(lon, 5), "c": "KR"}, ensure_ascii=False)
        txt = re.sub(r"\}\];\s*$", "}," + ne + "];", txt, count=1)
        entries.append((ne, name, lat, lon)); db_norm.add(k)
        added.append((name, addr)); print(f"＋ 신규: {name} ({addr})")

open(DB, "w", encoding="utf-8", newline="\n").write(txt)
json.dump(failed, open(os.path.join(ROOT, "coursedata", "workfiles", "golfdb_expand_fail.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"\n결과: 개명 {len(renamed)}, 신규 {len(added)}, 실패 {len(failed)}")
