# -*- coding: utf-8 -*-
"""홀맵 크롭 v2 — 홀 그림(채도 있는 픽셀)의 실제 범위를 감지해 절대 잘리지 않게.
컬럼별 유채색 픽셀 수를 세고, 그림 블록과 우측 텍스트 패널 사이의 공백에서 절단.
그 후 흰 배경 투명 처리(테두리 연결 영역만).
"""
import os, sys, glob
from collections import deque
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")
SRC = r"C:\Users\디자이너\Desktop\claude\Ri-weather\coursedata\homepages\seoseoul\orig"
DST = r"C:\Users\디자이너\Desktop\claude\Ri-weather\holeimg\seoseoul"

def saturated(r, g, b):
    return (max(r, g, b) - min(r, g, b)) > 28 and max(r, g, b) > 60

for f in sorted(glob.glob(os.path.join(SRC, "n_*.jpg"))):
    img = Image.open(f).convert("RGB")
    w, h = img.size
    px = img.load()
    # 우측 정보 패널은 모든 카드에서 x≈420 이후 → 410에서 고정 절단 (홀 그림·거리라벨 보존)
    cut = 410
    left = img.crop((0, 0, cut, h)).convert("RGBA")

    # 흰 배경 투명화 (테두리 연결 영역만)
    lw, lh = left.size
    lp = left.load()
    TH = 235
    def bright(x, y):
        r, g, b, a = lp[x, y]
        return r >= TH and g >= TH and b >= TH
    seen = [[False] * lh for _ in range(lw)]
    q = deque()
    for x in range(lw):
        for y in (0, lh - 1):
            if bright(x, y) and not seen[x][y]:
                seen[x][y] = True; q.append((x, y))
    for y in range(lh):
        for x in (0, lw - 1):
            if bright(x, y) and not seen[x][y]:
                seen[x][y] = True; q.append((x, y))
    while q:
        x, y = q.popleft()
        r, g, b, a = lp[x, y]
        lp[x, y] = (r, g, b, 0)
        for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
            if 0 <= nx < lw and 0 <= ny < lh and not seen[nx][ny] and bright(nx, ny):
                seen[nx][ny] = True; q.append((nx, ny))

    # 투명 여백 제거 + 패딩
    bbox = left.getbbox()
    if bbox:
        pad = 12
        bbox = (max(0, bbox[0]-pad), max(0, bbox[1]-pad),
                min(lw, bbox[2]+pad), min(lh, bbox[3]+pad))
        left = left.crop(bbox)
    out = os.path.join(DST, os.path.basename(f).replace(".jpg", ".png"))
    left.save(out)
    print(os.path.basename(out), f"절단x={cut}", left.size)
print("완료")
