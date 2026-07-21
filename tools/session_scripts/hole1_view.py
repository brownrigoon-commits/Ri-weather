# -*- coding: utf-8 -*-
"""앱과 동일한 로직으로 힐1 세로 홀 뷰를 로컬 재현 — 비틀림 검증용"""
import json, math, os, sys, urllib.request, io
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")
base = os.path.dirname(os.path.abspath(__file__))
holes = json.load(open(os.path.join(base, "seoseoul.holes.json"), encoding="utf-8"))["holes"]
h = [x for x in holes if x["name"] == "힐" and x["ref"] == "1"][0]
line = h["line"]

tee, green = line[0], line[-1]
lat0, lon0 = tee
mLat = 111320
mLon = 111320 * math.cos(math.radians(lat0))
toM = lambda p: ((p[1]-lon0)*mLon, (p[0]-lat0)*mLat)
gE, gN = toM(green)
A = math.atan2(gE, gN)
cosA, sinA = math.cos(A), math.sin(A)
rot = lambda E, N: (E*cosA - N*sinA, E*sinA + N*cosA)
inv = lambda x, y: (x*cosA + y*sinA, -x*sinA + y*cosA)
rpts = [rot(*toM(p)) for p in line]
minX = min(0, min(x for x, y in rpts)); maxX = max(0, max(x for x, y in rpts))
maxY = max(y for x, y in rpts)
rx0, rx1, ry0, ry1 = minX-70, maxX+70, -45, maxY+60
rectW, rectH = rx1-rx0, ry1-ry0
scale = min(720/rectW, 1500/rectH)
W, H = round(rectW*scale), round(rectH*scale)
print(f"홀 방위각 {math.degrees(A):.1f}°, 캔버스 {W}x{H}, scale {scale:.2f}")

z = 18
lon2tx = lambda lon: (lon+180)/360*2**z
lat2ty = lambda lat: (1-math.log(math.tan(math.radians(lat))+1/math.cos(math.radians(lat)))/math.pi)/2*2**z
corners = [inv(x, y) for x, y in [(rx0,ry0),(rx1,ry0),(rx0,ry1),(rx1,ry1)]]
lats = [lat0 + N/mLat for E, N in corners]
lons = [lon0 + E/mLon for E, N in corners]
tx0, tx1 = int(lon2tx(min(lons))), int(lon2tx(max(lons)))
ty0, ty1 = int(lat2ty(max(lats))), int(lat2ty(min(lats)))
off = Image.new("RGB", ((tx1-tx0+1)*256, (ty1-ty0+1)*256))
for tx in range(tx0, tx1+1):
    for ty in range(ty0, ty1+1):
        u = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{ty}/{tx}"
        req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            off.paste(Image.open(io.BytesIO(r.read())), ((tx-tx0)*256, (ty-ty0)*256))

mPerTilePx = 40075016.686*math.cos(math.radians(lat0))/2**z/256
lonLeft = tx0/2**z*360-180
latTop = math.degrees(math.atan(math.sinh(math.pi-2*math.pi*ty0/2**z)))
E_left = (lonLeft-lon0)*mLon
N_top = (latTop-lat0)*mLat

# 픽셀 단위 역매핑으로 회전 렌더 (앱 캔버스 변환과 동일한 결과)
out = Image.new("RGB", (W, H))
src = off.load(); dst = out.load()
ow, oh = off.size
for py in range(H):
    Yp = (H-py)/scale + ry0
    for px in range(W):
        Xp = px/scale + rx0
        E, N = inv(Xp, Yp)
        ox = (E - E_left)/mPerTilePx
        oy = (N_top - N)/mPerTilePx
        if 0 <= ox < ow and 0 <= oy < oh:
            dst[px, py] = src[int(ox), int(oy)]

from PIL import ImageDraw
d = ImageDraw.Draw(out)
pts = [((x-rx0)*scale, H-(y-ry0)*scale) for x, y in rpts]
d.line(pts, fill=(74, 222, 128), width=5)
d.ellipse([pts[0][0]-8, pts[0][1]-8, pts[0][0]+8, pts[0][1]+8], fill=(255, 245, 157))
out.save(os.path.join(base, "hole1_vertical.png"))
print("saved hole1_vertical.png")
