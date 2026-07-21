# -*- coding: utf-8 -*-
"""seoseoul.holes.json(위경도)을 위성사진 px로 역변환해 검증 렌더링"""
import json, math, os, sys
from PIL import Image, ImageDraw, ImageFont
sys.stdout.reconfigure(encoding="utf-8")
base = os.path.dirname(os.path.abspath(__file__))
meta = json.load(open(os.path.join(base, "seoseoul.meta.json")))
data = json.load(open(os.path.join(base, "seoseoul.holes.json"), encoding="utf-8"))
Z, tx0, ty0 = meta["z"], meta["tx0"], meta["ty0"]

def ll2px(lat, lon):
    tx = (lon + 180) / 360 * 2**Z
    r = math.radians(lat)
    ty = (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2**Z
    return ((tx - tx0) * 256, (ty - ty0) * 256)

X0, Y0, X1, Y1 = 1030, 1000, 2400, 2400
S = 1.2
img = Image.open(os.path.join(base, "seoseoul.png")).crop((X0, Y0, X1, Y1))
img = img.resize((int(img.width * S), int(img.height * S)), Image.LANCZOS)
d = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 26)
except Exception:
    font = ImageFont.load_default()
T = lambda p: ((p[0] - X0) * S, (p[1] - Y0) * S)
colors = {"힐": (0, 255, 120), "레이크": (80, 170, 255)}

for h in data["holes"]:
    c = colors.get(h["name"], (255, 255, 0))
    pts = [T(ll2px(la, lo)) for la, lo in h["line"]]
    d.line(pts, fill=c, width=4)
    tx, ty = pts[0]; d.ellipse([tx-7, ty-7, tx+7, ty+7], fill=(255, 235, 60), outline=(0, 0, 0))
    gx, gy = pts[-1]; d.ellipse([gx-7, gy-7, gx+7, gy+7], fill=(255, 60, 60), outline=(255, 255, 255))
    mx, my = pts[len(pts)//2]
    label = f"{'H' if h['name']=='힐' else 'L'}{h['ref']}"
    d.rectangle([mx-2, my-30, mx+58, my-2], fill=(0, 0, 0))
    d.text((mx+2, my-30), label, fill=c, font=font)

out = os.path.join(base, "seoseoul_check2.png")
img.save(out)
print(out, img.size)
