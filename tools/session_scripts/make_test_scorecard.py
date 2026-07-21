# -*- coding: utf-8 -*-
"""필로스 스마트스코어 공유 카드와 동일 구조의 테스트 이미지 생성"""
from PIL import Image, ImageDraw, ImageFont
import random

W, H = 920, 1180
img = Image.new("RGB", (W, H))
d = ImageDraw.Draw(img)

# 하늘+벚꽃 느낌 배경 (밝은 사진 배경 재현)
for y in range(H):
    t = y / H
    r = int(150 + 60 * t); g = int(180 + 40 * t); b = int(210 + 20 * t)
    d.line([(0, y), (W, y)], fill=(r, g, b))
random.seed(7)
for _ in range(900):  # 벚꽃/노이즈
    x = random.randint(0, W); y = random.randint(0, int(H * 0.55))
    rad = random.randint(1, 4)
    c = random.choice([(250, 235, 240), (240, 210, 220), (255, 255, 255), (200, 190, 200)])
    d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=c)

def font(size, bold=False):
    try:
        return ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf" if bold else "C:/Windows/Fonts/malgun.ttf", size)
    except Exception:
        return ImageFont.load_default()

white = (255, 255, 255)
# 상단: 동반자 + 날짜/시간 (흰 글자)
d.text((60, 40), "이성민, 이**, 허**, 노**", font=font(30), fill=white)
d.text((60, 85), "2026.07.16  18:20", font=font(30), fill=white)
d.text((40, 560), "Putt -   GIR -%   Fwhit -%", font=font(28), fill=white)
# 구장/코스/총타수
d.text((40, 640), "필로스", font=font(48, True), fill=white)
d.text((40, 710), "남, 동", font=font(30), fill=white)
d.text((750, 610), "88", font=font(84, True), fill=white)
d.text((690, 720), "White Tee", font=font(30), fill=white)

# 스코어 행: 흰 박스 + 진한 숫자, 끝은 진초록 박스 + 흰 합계
rows = [([1, 1, 1, 1, 1, 0, 0, 2, 0], 43), ([1, 1, 2, 1, 0, 1, 0, 1, 2], 45)]
y0 = 790
for nine, tot in rows:
    x0 = 40
    cw = (W - 80 - 90) // 9
    for i, v in enumerate(nine):
        d.rectangle([x0 + i * cw, y0, x0 + i * cw + cw - 6, y0 + 62], fill=(255, 255, 255, 230), outline=(180, 180, 180))
        d.text((x0 + i * cw + cw // 2 - 10, y0 + 14), str(v), font=font(32, True), fill=(30, 30, 30))
    d.rectangle([W - 128, y0, W - 40, y0 + 62], fill=(46, 90, 60))
    d.text((W - 105, y0 + 12), str(tot), font=font(34, True), fill=white)
    y0 += 78

img.save(r"C:\Users\디자이너\Desktop\claude\Ri-weather\test_scorecard.png")
print("saved test_scorecard.png")
