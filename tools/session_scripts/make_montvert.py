# -*- coding: utf-8 -*-
"""몽베르 스마트스코어 캡처 재현 (광고 배너 포함)"""
from PIL import Image, ImageDraw, ImageFont
import random

W, H = 920, 1990
img = Image.new("RGB", (W, H))
d = ImageDraw.Draw(img)

def font(size, bold=False):
    try:
        return ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf" if bold else "C:/Windows/Fonts/malgun.ttf", size)
    except Exception:
        return ImageFont.load_default()

white = (255, 255, 255)

# ── 상단 사진 영역 (하늘 + 클럽하우스 + 그린 느낌)
for y in range(0, 840):
    t = y / 840
    r = int(120 + 60 * t); g = int(160 + 40 * t); b = int(200 - 60 * t)
    d.line([(0, y), (W, y)], fill=(r, g, b))
random.seed(3)
for _ in range(500):  # 구름/나무 노이즈
    x = random.randint(0, W); y = random.randint(0, 830)
    rad = random.randint(2, 6)
    c = random.choice([(230, 235, 240), (90, 130, 80), (70, 110, 70), (200, 210, 220)])
    d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=c)
d.rectangle([0, 620, W, 840], fill=(80, 120, 75))  # 그린

# 상단 텍스트 (흰 글자)
d.text((100, 40), "이성민, 박**, 조**, 이**", font=font(30), fill=white)
d.text((100, 85), "2026.05.08  18:44", font=font(30), fill=white)
d.text((60, 430), "Putt -   GIR -%   Fwhit -%", font=font(28), fill=white)
d.text((60, 510), "몽베르", font=font(46, True), fill=white)
d.text((60, 580), "망무봉 OUT, 망무봉 IN", font=font(28), fill=white)
d.text((740, 480), "77", font=font(80, True), fill=white)
d.text((680, 585), "White Tee", font=font(28), fill=white)

# 스코어 행 (반투명 흰 박스 + 진한 숫자 + 진초록 합계)
rows = [([3, 1, 0, -1, 1, 0, 0, 0, -1], 39), ([2, 0, 0, -1, 1, 0, 0, 0, 0], 38)]
y0 = 640
for nine, tot in rows:
    x0 = 60
    cw = (W - 120 - 90) // 9
    for i, v in enumerate(nine):
        d.rectangle([x0 + i * cw, y0, x0 + i * cw + cw - 5, y0 + 60], fill=(245, 246, 248), outline=(170, 170, 170))
        tx = x0 + i * cw + cw // 2 - (18 if v < 0 else 9)
        d.text((tx, y0 + 12), str(v), font=font(32, True), fill=(35, 35, 35))
    d.rectangle([W - 145, y0, W - 60, y0 + 60], fill=(250, 250, 245))
    d.text((W - 122, y0 + 10), str(tot), font=font(34, True), fill=(70, 100, 30))
    y0 += 74

# 파란 저장 바
d.rectangle([40, 810, W - 40, 900], fill=(45, 130, 250))
d.text((80, 838), "인스타저장", font=font(28), fill=white)
d.text((380, 838), "공유하기", font=font(28), fill=white)
d.text((650, 838), "스코어저장", font=font(28), fill=white)

# 보라 광고
d.rectangle([40, 940, W - 40, 1160], fill=(60, 30, 110))
d.text((250, 970), "오늘도, 내일도 예약 가능!", font=font(28), fill=(220, 210, 240))
d.text((180, 1020), "오늘 바로 가능한 라운드 예약", font=font(34, True), fill=white)
d.text((220, 1080), "내일의 핫딜 티타임 확인하기", font=font(30), fill=(230, 220, 250))

# 초록 광고 (포웰CC 프린세스)
d.rectangle([40, 1200, W - 40, 1700], fill=(60, 110, 70))
d.text((90, 1250), "★이달의 부킹 PICK★", font=font(28), fill=(160, 255, 210))
d.text((90, 1330), "야간라운드 즐기기 최적", font=font(42, True), fill=white)
d.text((90, 1400), "지금 할인특가로 예약할 찬스!", font=font(42, True), fill=white)
d.text((90, 1480), "포웰CC 프린세스", font=font(44, True), fill=(120, 255, 190))
d.text((90, 1570), "#충남·대전·세종 인기 골프장", font=font(26), fill=(210, 240, 220))
d.text((90, 1615), "#수도권 근교 인기 급상승", font=font(26), fill=(210, 240, 220))
d.rectangle([520, 1540, 880, 1640], fill=(60, 180, 250))
d.text((560, 1568), "Click! 골프예약", font=font(32, True), fill=white)

# 하단 탭바
d.rectangle([0, 1800, W, 1990], fill=(250, 250, 250))
for tx, lbl in [(80, "홈"), (270, "공유"), (450, "찜"), (630, "위로"), (810, "MY")]:
    d.text((tx, 1880), lbl, font=font(26), fill=(90, 90, 90))

img.save(r"C:\Users\디자이너\Desktop\claude\Ri-weather\montvert_test.png")
print("saved")
