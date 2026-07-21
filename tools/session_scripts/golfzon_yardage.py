# -*- coding: utf-8 -*-
"""수집된 골프존 코스 JSON에서 야디지맵 이미지 전체 다운로드 (중복 제거)"""
import json, glob, os, time, sys, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
GZ = r"C:\Users\디자이너\Desktop\claude\Ri-weather\coursedata\golfzon"
IMG = os.path.join(GZ, "yardage")
os.makedirs(IMG, exist_ok=True)

urls = {}
for f in glob.glob(os.path.join(GZ, "cc_*.json")):
    j = json.load(open(f, encoding="utf-8"))
    for nine in j.get("holeInfo", {}).get("holeInfoList", []):
        for h in nine:
            mu = h.get("mapUrl")
            if mu:
                fn = os.path.basename(mu)
                urls[fn] = "https://o.gzcdn.net/images/cc" + mu

print(f"고유 야디지맵 {len(urls)}장")
ok = fail = skip = 0
for fn, url in sorted(urls.items()):
    path = os.path.join(IMG, fn)
    if os.path.exists(path) and os.path.getsize(path) > 5000:
        skip += 1
        continue
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            data = r.read()
        open(path, "wb").write(data)
        ok += 1
    except Exception as e:
        print("FAIL", fn, e)
        fail += 1
    time.sleep(0.25)

print(f"완료: 다운로드 {ok}, 스킵 {skip}, 실패 {fail} → {IMG}")
