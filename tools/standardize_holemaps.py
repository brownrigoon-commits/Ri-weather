# -*- coding: utf-8 -*-
"""홀맵 이미지 표준화 (서서울 기준)
- 투명(알파) → 흰색 합성
- 흰 여백 최대 크롭 (상하좌우, 약간의 패딩만)
- 최대 변 900px로 축소 (용량 절감)

사용: python tools/standardize_holemaps.py <입력폴더> [출력폴더]
출력 생략 시 제자리 덮어쓰기.
"""
import os, sys, glob
from PIL import Image, ImageChops
sys.stdout.reconfigure(encoding="utf-8")

def standardize(path, outpath):
    raw = Image.open(path)
    if raw.mode in ("RGBA", "LA", "P"):
        raw = raw.convert("RGBA")
        img = Image.new("RGB", raw.size, (255, 255, 255))
        img.paste(raw, mask=raw.split()[-1])
    else:
        img = raw.convert("RGB")
    bg = Image.new("RGB", img.size, (255, 255, 255))
    diff = ImageChops.difference(img, bg).convert("L")
    bbox = diff.point(lambda p: 255 if p > 12 else 0).getbbox()
    if bbox:
        pad = 8
        bbox = (max(0, bbox[0]-pad), max(0, bbox[1]-pad),
                min(img.width, bbox[2]+pad), min(img.height, bbox[3]+pad))
        img = img.crop(bbox)
    if max(img.size) > 900:
        r = 900 / max(img.size)
        img = img.resize((int(img.width*r), int(img.height*r)), Image.LANCZOS)
    ext = os.path.splitext(outpath)[1].lower()
    if ext in (".jpg", ".jpeg"):
        img.save(outpath, quality=88)
    else:
        img.save(outpath)
    return img.size

def main():
    if len(sys.argv) < 2:
        print(__doc__); return
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else src
    os.makedirs(dst, exist_ok=True)
    n = 0
    for f in glob.glob(os.path.join(src, "*")):
        if not f.lower().endswith((".jpg", ".jpeg", ".png", ".gif")):
            continue
        out = os.path.join(dst, os.path.basename(f))
        try:
            size = standardize(f, out)
            print(os.path.basename(f), "→", size)
            n += 1
        except Exception as e:
            print(os.path.basename(f), "실패:", e)
    print(f"완료: {n}장")

if __name__ == "__main__":
    main()
