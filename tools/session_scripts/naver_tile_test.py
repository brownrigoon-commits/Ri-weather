# -*- coding: utf-8 -*-
"""네이버/카카오 지도 래스터 타일 엔드포인트 탐색 (더스타휴 좌표)"""
import math, urllib.request, sys
sys.stdout.reconfigure(encoding="utf-8")

lat, lon, z = 37.4760, 127.7005, 16
n = 2 ** z
x = int((lon + 180) / 360 * n)
r = math.radians(lat)
y = int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n)
print("web mercator tile:", z, x, y)

candidates = [
    f"https://map.pstatic.net/nrb/styles/basic/1723000000/{z}/{x}/{y}.png?mt=bg.ol.ts.lko",
    f"https://map.pstatic.net/nrb/styles/basic/{z}/{x}/{y}.png",
    f"https://nrbe.map.naver.net/styles/basic/{z}/{x}/{y}.png",
    f"https://map.pstatic.net/nrt/styles/basic/{z}/{x}/{y}@2x.png",
]
for url in candidates:
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Referer": "https://map.naver.com/",
        })
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
        print("OK", len(data), url)
    except Exception as e:
        print("FAIL", str(e)[:60], url)
