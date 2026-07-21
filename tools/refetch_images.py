# -*- coding: utf-8 -*-
"""homepages_auto의 meta.json에 기록된 이미지 URL로 img/ 재다운로드 (회사 PC 복원용)
사용: python tools/refetch_images.py
"""
import glob, json, os, sys, time, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "coursedata", "homepages_auto")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126"

total = ok = 0
for m in glob.glob(os.path.join(BASE, "*", "meta.json")):
    j = json.load(open(m, encoding="utf-8"))
    idir = os.path.join(os.path.dirname(m), "img")
    os.makedirs(idir, exist_ok=True)
    for fn, url in j.get("images", {}).items():
        path = os.path.join(idir, fn)
        total += 1
        if os.path.exists(path) and os.path.getsize(path) > 5000:
            ok += 1
            continue
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20) as r:
                open(path, "wb").write(r.read(3_000_000))
            ok += 1
        except Exception as e:
            print("실패:", j.get("name"), fn, str(e)[:40])
        time.sleep(0.3)
print(f"완료 {ok}/{total}")
