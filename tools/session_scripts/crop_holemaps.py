# -*- coding: utf-8 -*-
"""서서울 공식 홀맵에서 홀 그림 부분만 크롭 (좌측 영역 + 흰 여백 자동 제거)"""
import os, sys, glob
from PIL import Image, ImageChops
sys.stdout.reconfigure(encoding="utf-8")
SRC = r"C:\Users\디자이너\Desktop\claude\Ri-weather\coursedata\homepages\seoseoul\orig"
DST = r"C:\Users\디자이너\Desktop\claude\Ri-weather\holeimg\seoseoul"

for f in sorted(glob.glob(os.path.join(SRC, "n_*.jpg"))):
    img = Image.open(f).convert("RGB")
    w, h = img.size
    left = img.crop((0, 0, int(w * 0.47), h))          # 좌측(홀 그림 영역)
    # 흰 배경 제거: 흰색과의 차이로 bbox
    bg = Image.new("RGB", left.size, (255, 255, 255))
    diff = ImageChops.difference(left, bg).convert("L")
    bbox = diff.point(lambda p: 255 if p > 18 else 0).getbbox()
    if bbox:
        pad = 14
        bbox = (max(0, bbox[0]-pad), max(0, bbox[1]-pad),
                min(left.width, bbox[2]+pad), min(left.height, bbox[3]+pad))
        left = left.crop(bbox)
    out = os.path.join(DST, os.path.basename(f))
    left.save(out, quality=90)
    print(os.path.basename(f), img.size, "→", left.size)
