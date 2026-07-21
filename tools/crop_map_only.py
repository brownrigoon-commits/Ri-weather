# -*- coding: utf-8 -*-
"""홀 카드에서 '지도만' 잘라내는 표준 크롭 도구 (서서울 크기 기준)
- 배경색은 모서리 샘플링(흰색/미색 카드 모두 대응)
- 1/4 축소 마스크에서 2차원 연결성분 분석 → 가장 큰 덩어리 = 홀맵
  (좌측 설명 텍스트, 우측 티 범례, 자잘한 조각은 자동 배제)
- 배경색을 흰색으로 정규화 (미색 카드 → 흰배경)
- 서서울 기준 최대 변 620px 리사이즈

사용: python tools/crop_map_only.py <입력폴더> <출력폴더> [--x0 0.42]
      python tools/crop_map_only.py <파일> <출력파일> [--x0 0.42]
x0: 카드 왼쪽(사진 영역) 제외 비율. 기본 0.42.
"""
import os, sys, glob
from collections import deque
from PIL import Image, ImageChops, ImageFilter
sys.stdout.reconfigure(encoding="utf-8")
TARGET_H = 600        # 세로 고정 기준 — 항상 이 높이로 맞춤
MAX_W = 680           # 가로 상한 (앱 표시 최대 340px의 2배, 레티나 선명도) — 넘으면 가로에 맞추고 세로 자동 축소
THRESH = 16
SCALE = 4
PAD = 8

def crop_map(path, outpath, x0_ratio=0.42, keep="largest"):
    """keep="largest": 가장 큰 덩어리(지도)만 남김 (카드형 원본용)
    keep="all": 모든 내용 유지, 여백만 크롭 (지도 단독 원본에 범례 등이 붙은 경우)"""
    img = Image.open(path).convert("RGB")
    w, h = img.size
    region = img.crop((int(w * x0_ratio), 0, w, h))
    rw, rh = region.size
    px = region.load()
    corners = [px[2, 2], px[rw - 3, 2], px[2, rh - 3], px[rw - 3, rh - 3]]
    bg = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
    diff = ImageChops.difference(region, Image.new("RGB", region.size, bg)).convert("L")
    mask = diff.point(lambda p: 255 if p > THRESH else 0)
    if keep == "all":
        bbox = mask.getbbox()
        if not bbox:
            raise ValueError("내용 없음")
        box = (max(0, bbox[0] - PAD), max(0, bbox[1] - PAD),
               min(rw, bbox[2] + PAD), min(rh, bbox[3] + PAD))
        out = region.crop(box)
        return _finish(out, bg, outpath)
    # 1/4 축소 후 연결성분 분석 (BFS, 8방향)
    sw, sh = rw // SCALE, rh // SCALE
    small = mask.resize((sw, sh), Image.BILINEAR).point(lambda p: 1 if p > 48 else 0)
    sp = small.load()
    seen = [[False] * sh for _ in range(sw)]
    best = None  # (면적, bbox)
    for sx in range(sw):
        for sy in range(sh):
            if sp[sx, sy] and not seen[sx][sy]:
                q = deque([(sx, sy)])
                seen[sx][sy] = True
                cells = []
                x1 = x2 = sx
                y1 = y2 = sy
                while q:
                    cx, cy = q.popleft()
                    cells.append((cx, cy))
                    x1, x2 = min(x1, cx), max(x2, cx)
                    y1, y2 = min(y1, cy), max(y2, cy)
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < sw and 0 <= ny < sh and sp[nx, ny] and not seen[nx][ny]:
                                seen[nx][ny] = True
                                q.append((nx, ny))
                if best is None or len(cells) > best[0]:
                    best = (len(cells), cells, (x1, y1, x2, y2))
    if best is None:
        raise ValueError("내용 없음")
    x1, y1, x2, y2 = best[2]
    # 지도 덩어리 바깥 픽셀은 배경색으로 지움 (bbox 안에 우연히 든 글자 조각 제거)
    comp = Image.new("L", (sw, sh), 0)
    cp = comp.load()
    for (cx, cy) in best[1]:
        cp[cx, cy] = 255
    comp = comp.filter(ImageFilter.MaxFilter(3))          # 1칸 팽창(부드러운 가장자리 보존)
    keepmask = comp.resize((rw, rh), Image.BILINEAR).point(lambda p: 255 if p > 32 else 0)
    region = Image.composite(region, Image.new("RGB", region.size, bg), keepmask)
    box = (max(0, x1 * SCALE - PAD), max(0, y1 * SCALE - PAD),
           min(rw, (x2 + 1) * SCALE + PAD), min(rh, (y2 + 1) * SCALE + PAD))
    out = region.crop(box)
    return _finish(out, bg, outpath)

def _finish(out, bg, outpath):
    # 배경색 → 흰색 정규화 (미색 카드 대응, 흰 카드는 사실상 무변화)
    if any(c < 250 for c in bg):
        lut = []
        for ch in range(3):
            scale = 255.0 / max(1, bg[ch])
            lut += [min(255, int(v * scale + 0.5)) for v in range(256)]
        out = out.point(lut)
    r = TARGET_H / out.height          # 세로 600 고정
    if out.width * r > MAX_W:          # 가로가 넘치면 가로 상한에 맞춤
        r = MAX_W / out.width
    out = out.resize((max(1, int(out.width * r)), max(1, int(out.height * r))), Image.LANCZOS)
    ext = os.path.splitext(outpath)[1].lower()
    if ext in (".jpg", ".jpeg"):
        out = out.convert("RGB")
        out.save(outpath, quality=90)
    else:
        out.save(outpath)
    return out.size

def main():
    if len(sys.argv) < 3:
        print(__doc__); return
    src, dst = sys.argv[1], sys.argv[2]
    x0 = 0.42
    if "--x0" in sys.argv:
        x0 = float(sys.argv[sys.argv.index("--x0") + 1])
    if os.path.isfile(src):
        print(os.path.basename(src), "→", crop_map(src, dst, x0)); return
    os.makedirs(dst, exist_ok=True)
    for f in sorted(glob.glob(os.path.join(src, "*"))):
        if not f.lower().endswith((".jpg", ".jpeg", ".png")):
            continue
        out = os.path.join(dst, os.path.basename(f))
        try:
            print(os.path.basename(f), "→", crop_map(f, out, x0))
        except Exception as e:
            print(os.path.basename(f), "실패:", e)

if __name__ == "__main__":
    main()
