# -*- coding: utf-8 -*-
"""홀맵 흰 배경 투명 처리 (테두리에서 연결된 밝은 영역만 제거 — 내부 벙커는 유지)
holeimg/seoseoul/n_*.jpg → n_*.png (투명 배경)"""
import os, sys, glob
from collections import deque
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")
DIR = r"C:\Users\디자이너\Desktop\claude\Ri-weather\holeimg\seoseoul"
TH = 235  # 이 값 이상 밝으면 배경 후보

for f in sorted(glob.glob(os.path.join(DIR, "n_*.jpg"))):
    img = Image.open(f).convert("RGBA")
    w, h = img.size
    px = img.load()
    def bright(x, y):
        r, g, b, a = px[x, y]
        return r >= TH and g >= TH and b >= TH
    seen = [[False]*h for _ in range(w)]
    q = deque()
    for x in range(w):
        for y in (0, h-1):
            if bright(x, y) and not seen[x][y]:
                seen[x][y] = True; q.append((x, y))
    for y in range(h):
        for x in (0, w-1):
            if bright(x, y) and not seen[x][y]:
                seen[x][y] = True; q.append((x, y))
    while q:
        x, y = q.popleft()
        r, g, b, a = px[x, y]
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny] and bright(nx, ny):
                seen[nx][ny] = True; q.append((nx, ny))
    out = f[:-4] + ".png"
    img.save(out)
    os.remove(f)
    print(os.path.basename(out), img.size)
print("완료")
