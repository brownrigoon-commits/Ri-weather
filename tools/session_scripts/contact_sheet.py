# -*- coding: utf-8 -*-
"""야디지맵 9홀 컨택트시트 생성: python contact_sheet.py <ccMasterSeq> <courseNo>"""
import sys, os
from PIL import Image, ImageDraw
YD = r"C:\Users\디자이너\Desktop\claude\Ri-weather\coursedata\golfzon\yardage"
OUT = os.path.dirname(os.path.abspath(__file__))
seq, cno = sys.argv[1], sys.argv[2]
W = H = 3   # 3x3
cell_w, cell_h = 420, 640
sheet = Image.new("RGB", (cell_w * W, cell_h * H), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for i in range(9):
    fn = os.path.join(YD, f"yardage_entire_{seq}_{cno.zfill(2)}_{str(i+1).zfill(2)}.jpg")
    x, y = (i % W) * cell_w, (i // W) * cell_h
    if os.path.exists(fn):
        img = Image.open(fn)
        img.thumbnail((cell_w - 10, cell_h - 40))
        sheet.paste(img, (x + 5, y + 35))
    d.rectangle([x, y, x + cell_w, y + 30], fill=(40, 40, 80))
    d.text((x + 10, y + 8), f"HOLE {i+1}", fill=(255, 255, 0))
out = os.path.join(OUT, f"sheet_{seq}_{cno}.png")
sheet.save(out)
print(out, sheet.size)
