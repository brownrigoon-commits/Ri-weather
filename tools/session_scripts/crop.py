# -*- coding: utf-8 -*-
"""스티치 이미지 크롭 (원본 픽셀 좌표 유지 확인용)
사용: python crop.py <이름> <x0> <y0> <x1> <y1> [태그]
출력: <이름>_<태그>.png — 크롭 후 좌상단 기준 원본 좌표 라벨 그리드 재표시
"""
import sys, os
from PIL import Image, ImageDraw
base = os.path.dirname(os.path.abspath(__file__))
name, x0, y0, x1, y1 = sys.argv[1], *map(int, sys.argv[2:6])
tag = sys.argv[6] if len(sys.argv) > 6 else f"{x0}_{y0}"
img = Image.open(os.path.join(base, name + ".png")).crop((x0, y0, x1, y1))
d = ImageDraw.Draw(img)
for gx in range(x0 - x0 % 100, x1, 100):
    if gx < x0: continue
    d.line([(gx-x0, 0), (gx-x0, y1-y0)], fill=(255,255,0), width=1)
    d.text((gx-x0+2, 2), str(gx), fill=(255,60,60))
for gy in range(y0 - y0 % 100, y1, 100):
    if gy < y0: continue
    d.line([(0, gy-y0), (x1-x0, gy-y0)], fill=(255,255,0), width=1)
    d.text((2, gy-y0+2), str(gy), fill=(255,60,60))
if len(sys.argv) > 7 and sys.argv[7] == "2x":
    img = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
out = os.path.join(base, f"{name}_{tag}.png")
img.save(out)
print(out, img.size)
