# -*- coding: utf-8 -*-
"""더스타휴 홀 카드에서 홀맵 영역만 잘라내기
카드 공통 레이아웃: 좌측 텍스트+사진 / 중앙우측 홀맵 / 우측끝 티 범례
→ x [0.49w, 0.905w] 영역을 취한 뒤, 모서리 배경색 기준으로 여백 최대 크롭.
(HUE 코스는 배경이 미색이라 순백 기준 크롭이 안 됨 → 배경색 샘플링)
출력: holeimg/thestarhue/s1..s9.jpg, h1..h9.jpg
"""
import os, sys, glob
from PIL import Image, ImageChops
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "coursedata", "homepages_auto", "더스타휴골프앤리조트", "img")
DST = os.path.join(ROOT, "holeimg", "thestarhue")
os.makedirs(DST, exist_ok=True)

def crop_map(path, outpath):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    region = img.crop((int(w * 0.49), 0, int(w * 0.905), h))
    # 모서리 4곳 평균으로 배경색 추정
    px = region.load()
    rw, rh = region.size
    corners = [px[2, 2], px[rw - 3, 2], px[2, rh - 3], px[rw - 3, rh - 3]]
    bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
    bgimg = Image.new("RGB", region.size, bg)
    diff = ImageChops.difference(region, bgimg).convert("L")
    bbox = diff.point(lambda p: 255 if p > 16 else 0).getbbox()
    if bbox:
        pad = 10
        bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                min(rw, bbox[2] + pad), min(rh, bbox[3] + pad))
        region = region.crop(bbox)
    if max(region.size) > 900:
        r = 900 / max(region.size)
        region = region.resize((int(region.width * r), int(region.height * r)), Image.LANCZOS)
    region.save(outpath, quality=88)
    return region.size, bbox

for f in sorted(glob.glob(os.path.join(SRC, "shole_*.jpg"))) + sorted(glob.glob(os.path.join(SRC, "hhole_*.jpg"))):
    b = os.path.basename(f)
    no = int(b.split("_")[1].split(".")[0])
    out = os.path.join(DST, ("s" if b.startswith("s") else "h") + str(no) + ".jpg")
    size, bbox = crop_map(f, out)
    # bbox가 잘린 영역 가장자리에 붙으면(=지도가 잘렸을 가능성) 경고
    warn = " ⚠경계밀착" if bbox and (bbox[0] <= 2 or bbox[2] >= size[0] - 2) else ""
    print(f"{b} → {os.path.basename(out)} {size}{warn}")
print("완료")
