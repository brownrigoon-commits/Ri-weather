# -*- coding: utf-8 -*-
"""몽베르: 홀 그림만 최대 크롭 (유채색 컬럼 밀도로 홀 영역 검출, 범례 제외)"""
import os, sys, glob, shutil
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")
SRC = r"C:\Users\디자이너\Desktop\claude\Ri-weather\coursedata\homepages\montvert"
DST = r"C:\Users\디자이너\Desktop\claude\Ri-weather\holeimg\montvert"

def saturated(r, g, b):
    return (max(r, g, b) - min(r, g, b)) > 25 and max(r, g, b) > 70

for f in sorted(glob.glob(os.path.join(SRC, "course_*-0.png"))):
    raw = Image.open(f).convert("RGBA")
    img = Image.new("RGB", raw.size, (255, 255, 255))
    img.paste(raw, mask=raw.split()[3])
    w, h = img.size
    px = img.load()
    col = [sum(1 for y in range(h) if saturated(*px[x, y])) for x in range(w)]
    row = [sum(1 for x in range(w) if saturated(*px[x, y])) for y in range(h)]
    xs = [x for x in range(w) if col[x] >= 12]
    ys = [y for y in range(h) if row[y] >= 8]
    if not xs or not ys:
        print("skip", os.path.basename(f)); continue
    pad = 8
    box = (max(0, min(xs)-pad), max(0, min(ys)-pad), min(w, max(xs)+pad), min(h, max(ys)+pad))
    out = os.path.join(DST, os.path.basename(f))
    img.crop(box).save(out)
    print(os.path.basename(f), img.size, "→", (box[2]-box[0], box[3]-box[1]))
print("완료")
