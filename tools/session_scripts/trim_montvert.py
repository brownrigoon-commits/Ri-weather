# -*- coding: utf-8 -*-
"""몽베르 야디지 이미지 흰 여백 트림"""
import os, sys, glob
from PIL import Image, ImageChops
sys.stdout.reconfigure(encoding="utf-8")
DIR = r"C:\Users\디자이너\Desktop\claude\Ri-weather\holeimg\montvert"
for f in sorted(glob.glob(os.path.join(DIR, "*.png"))):
    img = Image.open(f).convert("RGB")
    bg = Image.new("RGB", img.size, (255, 255, 255))
    diff = ImageChops.difference(img, bg).convert("L")
    bbox = diff.point(lambda p: 255 if p > 12 else 0).getbbox()
    if bbox:
        pad = 10
        bbox = (max(0, bbox[0]-pad), max(0, bbox[1]-pad),
                min(img.width, bbox[2]+pad), min(img.height, bbox[3]+pad))
        img.crop(bbox).save(f)
        print(os.path.basename(f), "→", (bbox[2]-bbox[0], bbox[3]-bbox[1]))
print("완료")
