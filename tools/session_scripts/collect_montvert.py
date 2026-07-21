# -*- coding: utf-8 -*-
"""몽베르CC 공식 홈페이지 코스 데이터 수집 → coursedata/homepages/montvert/"""
import os, re, sys, time, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
OUT = r"C:\Users\디자이너\Desktop\claude\Ri-weather\coursedata\homepages\montvert"
os.makedirs(OUT, exist_ok=True)
BASE = "https://montvertcc.com"

def get(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=25) as r:
        data = r.read()
    return data if binary else data.decode("utf-8", errors="ignore")

pages = ["courseData", "courseIn", "courseOut", "courseInfo"]
imgs = set()
for p in pages:
    html = get(f"{BASE}/public/swp/{p}")
    open(os.path.join(OUT, f"{p}.html"), "w", encoding="utf-8").write(html)
    for m in re.findall(r'(?:src|href)="(/static/[^"]*course[^"]*\.(?:png|jpg|gif))"', html, re.I):
        imgs.add(m)
    print(f"{p}.html 저장 ({len(html)} bytes)")
    time.sleep(0.7)

print(f"코스 이미지 {len(imgs)}개 다운로드")
ok = 0
for path in sorted(imgs):
    fn = os.path.basename(path)
    try:
        open(os.path.join(OUT, fn), "wb").write(get(BASE + path, binary=True))
        ok += 1
    except Exception as e:
        print("FAIL", fn, e)
    time.sleep(0.4)
print(f"이미지 {ok}/{len(imgs)} 저장 완료 → {OUT}")
