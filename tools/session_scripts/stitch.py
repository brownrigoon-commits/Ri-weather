# -*- coding: utf-8 -*-
"""위성 타일 합성 + 좌표 그리드 — 홀 트레이싱용
사용: python stitch.py <이름> <lat> <lon> [반경m=1300] [zoom=17]
출력: scratchpad/<이름>.png + <이름>.meta.json (px→latlon 변환 정보)
"""
import sys, math, json, io, os, urllib.request
from PIL import Image, ImageDraw

name, lat, lon = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
radius = float(sys.argv[4]) if len(sys.argv) > 4 else 1300
Z = int(sys.argv[5]) if len(sys.argv) > 5 else 17

def lon2tx(lo, z): return (lo + 180) / 360 * 2**z
def lat2ty(la, z):
    r = math.radians(la)
    return (1 - math.log(math.tan(r) + 1/math.cos(r)) / math.pi) / 2 * 2**z

dlat = radius / 111320
dlon = radius / (111320 * math.cos(math.radians(lat)))
tx0 = math.floor(lon2tx(lon - dlon, Z)); tx1 = math.floor(lon2tx(lon + dlon, Z))
ty0 = math.floor(lat2ty(lat + dlat, Z)); ty1 = math.floor(lat2ty(lat - dlat, Z))

W, H = (tx1-tx0+1)*256, (ty1-ty0+1)*256
img = Image.new("RGB", (W, H))
for tx in range(tx0, tx1+1):
    for ty in range(ty0, ty1+1):
        url = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{Z}/{ty}/{tx}"
        req = urllib.request.Request(url, headers={"User-Agent": "RiWeather/1.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            img.paste(Image.open(io.BytesIO(r.read())), ((tx-tx0)*256, (ty-ty0)*256))

d = ImageDraw.Draw(img)
for x in range(0, W, 200):
    d.line([(x,0),(x,H)], fill=(255,255,0), width=1)
    d.text((x+3, 3), str(x), fill=(255,255,0))
for y in range(0, H, 200):
    d.line([(0,y),(W,y)], fill=(255,255,0), width=1)
    d.text((3, y+3), str(y), fill=(255,255,0))

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), name)
img.save(out + ".png")
json.dump({"tx0": tx0, "ty0": ty0, "z": Z, "w": W, "h": H}, open(out + ".meta.json", "w"))
print(f"saved {out}.png {W}x{H}")
