# -*- coding: utf-8 -*-
"""서서울 홀 라인을 위성사진 위에 렌더링해 검증용 이미지 생성
사용: python render_lines.py  (build_seoseoul.py의 HOLES px 좌표를 그대로 읽음)
"""
import os, sys, importlib.util
from PIL import Image, ImageDraw, ImageFont
base = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("bs", os.path.join(base, "build_seoseoul.py"))
bs = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(bs)   # HOLES 정의 로드 (출력 무시)
except SystemExit:
    pass
HOLES = bs.HOLES

X0, Y0, X1, Y1 = 1030, 1000, 2400, 2400
img = Image.open(os.path.join(base, "seoseoul.png")).crop((X0, Y0, X1, Y1))
img = img.resize((int(img.width * 1.2), int(img.height * 1.2)), Image.LANCZOS)
d = ImageDraw.Draw(img)
S = 1.2
try:
    font = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 26)
except Exception:
    font = ImageFont.load_default()

def T(p):
    return ((p[0] - X0) * S, (p[1] - Y0) * S)

colors = {"힐": (0, 255, 120), "레이크": (80, 170, 255)}
for name, ref, par, olen, pxline, tip in HOLES:
    c = colors.get(name, (255, 255, 0))
    pts = [T(p) for p in pxline]
    d.line(pts, fill=c, width=4)
    tx, ty = pts[0]
    d.ellipse([tx-7, ty-7, tx+7, ty+7], fill=(255, 235, 60), outline=(0,0,0))       # 티=노랑
    gx, gy = pts[-1]
    d.ellipse([gx-7, gy-7, gx+7, gy+7], fill=(255, 60, 60), outline=(255,255,255))  # 그린=빨강
    mx, my = pts[len(pts)//2]
    label = f"{'H' if name=='힐' else 'L'}{ref}"
    d.rectangle([mx-2, my-30, mx+58, my-2], fill=(0, 0, 0))
    d.text((mx+2, my-30), label, fill=c, font=font)

out = os.path.join(base, "seoseoul_check.png")
img.save(out)
print(out, img.size)

# 원본 좌표 그리드 + 4분할 확대 타일
for gx in range(X0 - X0 % 100 + 100, X1, 100):
    d.line([T((gx, Y0)), T((gx, Y1))], fill=(255, 255, 0), width=1)
    d.text(T((gx, Y0 + 8)), str(gx), fill=(255, 80, 80), font=font)
for gy in range(Y0 - Y0 % 100 + 100, Y1, 100):
    d.line([T((X0, gy)), T((X1, gy))], fill=(255, 255, 0), width=1)
    d.text(T((X0 + 8, gy)), str(gy), fill=(255, 80, 80), font=font)

zones = {"ne": (1550, 1000, 2400, 1750), "w": (1030, 1250, 1750, 1900),
         "s": (1150, 1850, 2050, 2400), "e": (1650, 1550, 2400, 2300)}
for tag, (a, b, c2, e2) in zones.items():
    tile = img.crop((int((a-X0)*S), int((b-Y0)*S), int((c2-X0)*S), int((e2-Y0)*S)))
    tile = tile.resize((int(tile.width * 1.5), int(tile.height * 1.5)), Image.LANCZOS)
    p = os.path.join(base, f"seoseoul_check_{tag}.png")
    tile.save(p)
    print(p, tile.size)
