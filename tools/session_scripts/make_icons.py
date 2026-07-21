# -*- coding: utf-8 -*-
"""Ri-Weather PWA 아이콘 생성 — 앱의 녹색점(골프장 위치) 모티브"""
from PIL import Image, ImageDraw
import os

OUT = r"C:\Users\디자이너\Desktop\claude\Ri-weather\icons"
os.makedirs(OUT, exist_ok=True)

def make_icon(size):
    img = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(img)
    # 배경: 앱과 같은 어두운 블루그레이 세로 그라데이션
    top = (74, 90, 108)     # #4a5a6c
    bot = (51, 64, 79)      # #33404f
    for y in range(size):
        t = y / size
        c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (size, y)], fill=c)

    cx, cy = size // 2, int(size * 0.56)
    r = int(size * 0.20)

    # 은은한 강수 물결(하단)
    d.ellipse([-size*0.3, size*0.78, size*0.75, size*1.25], fill=(63, 154, 224))
    d.ellipse([size*0.35, size*0.85, size*1.3, size*1.35], fill=(127, 212, 255))

    # 반투명 글로우 (RGBA 레이어 합성)
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([cx-r*1.7, cy-r*1.7, cx+r*1.7, cy+r*1.7], fill=(46, 204, 113, 70))
    img = Image.alpha_composite(img.convert("RGBA"), glow)
    d = ImageDraw.Draw(img)

    # 깃대 + 깃발 (점 뒤쪽)
    pole_w = max(3, size // 36)
    pole_top = int(size * 0.14)
    d.rectangle([cx - pole_w//2, pole_top, cx + pole_w//2, cy], fill=(255, 255, 255))
    flag_h = int(size * 0.14)
    flag_w = int(size * 0.24)
    d.polygon([(cx + pole_w//2, pole_top),
               (cx + pole_w//2 + flag_w, pole_top + flag_h//2),
               (cx + pole_w//2, pole_top + flag_h)], fill=(235, 87, 87))

    # 흰 테두리 녹색점 (지도의 골프장 마커)
    ring = int(r * 0.22)
    d.ellipse([cx-r-ring, cy-r-ring, cx+r+ring, cy+r+ring], fill=(255, 255, 255))
    d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(46, 204, 113))
    return img.convert("RGB")

for s in (180, 192, 512):
    make_icon(s).save(os.path.join(OUT, f"icon-{s}.png"))
    print("saved", s)
