# -*- coding: utf-8 -*-
"""카트 태블릿(스마트스코어) 스타일 테스트 이미지"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1400, 900
img = Image.new("RGB", (W, H), (235, 236, 238))
d = ImageDraw.Draw(img)

def font(size, bold=False):
    try:
        return ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf" if bold else "C:/Windows/Fonts/malgun.ttf", size)
    except Exception:
        return ImageFont.load_default()

# 헤더 (어두운 배경 + 흰 숫자)
d.rectangle([0, 0, W, 120], fill=(40, 44, 52))
d.text((30, 30), "밸리 ^", font=font(34, True), fill=(255, 255, 255))
xs = [220 + i * 100 for i in range(9)]
for i, x in enumerate(xs):
    d.text((x, 18), str(i + 1), font=font(40, True), fill=(255, 255, 255))
pars = [(4,8),(5,3),(3,7),(4,5),(4,1),(4,2),(3,9),(5,6),(4,4)]
for (p, h), x in zip(pars, xs):
    d.text((x - 8, 72), f"{p}/{h}", font=font(26), fill=(120, 170, 255))
d.text((1150, 30), "전반", font=font(30), fill=(200, 200, 200))
d.text((1250, 30), "합계", font=font(30), fill=(255, 255, 255))

players = [
    ("최인철", [-1, 0, 1, -1, 0, 1, 1, -1, 0], 0, 36),
    ("이경아", [2, 4, 2, 2, 3, 4, 3, 5, 3], 28, 64),
    ("임형석", [0, 0, 1, 2, 1, 0, 0, 1, 2], 7, 43),
    ("고윤식", [1, 0, 1, 2, 1, 0, 1, 1, 2], 9, 45),
]
y = 160
for name, holes, front, total in players:
    d.rectangle([20, y - 20, W - 20, y + 70], fill=(255, 255, 255), outline=(210, 210, 210))
    d.text((40, y), name, font=font(36, True), fill=(30, 30, 30))
    for v, x in zip(holes, xs):
        d.text((x - (12 if v < 0 else 0), y), str(v), font=font(38, True), fill=(30, 30, 30))
    d.text((1150, y), str(front), font=font(36, True), fill=(30, 90, 220))
    d.text((1250, y), str(total), font=font(36, True), fill=(30, 90, 220))
    y += 175

d.text((40, 850), "스코어  GPS홀맵  리더보드", font=font(28), fill=(60, 60, 60))
img.save(r"C:\Users\디자이너\Desktop\claude\Ri-weather\cart_test.png")
print("saved")
