# -*- coding: utf-8 -*-
"""사장님이 주신 실루엣 원본 → CSS mask 용 PNG.

사장님 지시(2026-07-29): 직접 그린 아이콘이 허접하니 주신 이미지를 그대로 쓸 것.
드라이버·퍼터 실루엣도 추가로 받아 네 개를 모두 사장님 이미지로 통일했다.

    python tools/make_club_icons_src.py           제작
    python tools/make_club_icons_src.py --sheet   결과 비교표
"""
import io, os, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "src")
OUT = os.path.join(ROOT, "assets")

# 원본 → 결과 파일.
# ※ 워터마크(123RF)가 박힌 옛 putter.jpg 는 쓰지 않는다. putter2.png 가 대체본이다.
PLAN = {
    "golfer": "driver.png",   # 드라이버 — 피니시, 클럽이 등 뒤로 넘어간다
    "iron":   "iron.jpg",     # 아이언 — 스윙 중, 클럽이 옆으로 길게 뻗는다
    "wedge":  "wedge.jpg",    # 웨지 — 피니시, 클럽이 위로 올라간다
    "putter": "putter2.png",  # 퍼터 — 허리 숙여 퍼팅. 배경이 주황 그라데이션이다
}

# 화면에서는 62×72 지만 고해상도 폰은 3배로 그린다. 세로 400px 쯤이면 충분하다.
TARGET_H = 400


def drop_ground(mask):
    """바닥선·바닥 그림자를 지운다.

    원본 중 드라이버는 얇은 지면선, 퍼터는 두툼한 지면 덩어리가 발밑에 깔려 있다.
    작은 아이콘으로 줄이면 이게 '검은 막대'로 보여 실루엣을 망친다.
    아래쪽 20% 안에서 가로로 1/3 넘게 채워진 줄은 사람이 아니라 지면으로 본다
    (두 발을 벌리고 선 아이언 원본도 발 두 짝뿐이라 25%를 넘지 않는다 — 실측 확인).
    """
    w, h = mask.size
    mp = mask.load()
    cut = h
    for y in range(h - 1, int(h * 0.80) - 1, -1):
        filled = sum(1 for x in range(w) if mp[x, y] > 128)
        if filled > w * 0.33:
            cut = y
        else:
            break
    return mask.crop((0, 0, w, cut)) if cut < h else mask


def drop_specks(mask):
    """바닥 그림자 꼬리만 지운다.

    지면을 잘라내도 발 옆에 납작한 그림자가 남는 원본이 있다(퍼터).
    ⚠️ '작은 조각'을 지우는 식으로 만들면 안 된다 — 퍼터 헤드·드라이버 헤드가
       가는 샤프트 때문에 따로 떨어진 덩어리로 잡혀 클럽이 통째로 사라진다
       (2026-07-29 실제로 그렇게 나왔다). 크기가 아니라 **모양**으로 판단한다:
       가로로 아주 길고(폭 25% 이상) 종잇장처럼 얇은(높이 3% 미만) 것만 지운다.
    """
    w, h = mask.size
    mp = mask.load()
    lab = [[0] * w for _ in range(h)]
    box = {}
    cur = 0
    for sy in range(h):
        for sx in range(w):
            if mp[sx, sy] <= 128 or lab[sy][sx]:
                continue
            cur += 1
            stack = [(sx, sy)]
            lab[sy][sx] = cur
            x0 = x1 = sx; y0 = y1 = sy
            while stack:
                x, y = stack.pop()
                if x < x0: x0 = x
                if x > x1: x1 = x
                if y < y0: y0 = y
                if y > y1: y1 = y
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and not lab[ny][nx] and mp[nx, ny] > 128:
                        lab[ny][nx] = cur
                        stack.append((nx, ny))
            box[cur] = (x1 - x0 + 1, y1 - y0 + 1, y0)
    # 발밑(아래 18%)에 있으면서 가로로 길고 얇은 것 = 그림자
    drop = {k for k, (bw, bh, top) in box.items()
            if top > h * 0.82 and bw > w * 0.12 and bh < h * 0.05}
    if not drop:
        return mask
    for y in range(h):
        for x in range(w):
            if mp[x, y] and lab[y][x] in drop:
                mp[x, y] = 0
    return mask


def to_mask(path):
    """배경을 지우고 실루엣만 남긴다. mask 로 쓰이므로 알파만 의미가 있다.

    ⚠️ 밝기(평균)로 자르면 안 된다 — 퍼터 원본의 주황 배경은 평균값이 100~145 라
       실루엣으로 오인된다. 채널 최대값을 본다: 검은 실루엣은 max 가 0에 가깝고
       흰 배경(255)이든 주황 배경(230,120,40 → max 230)이든 최대값은 크다.
    """
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            v = max(r, g, b)
            if v < 100:
                mp[x, y] = 255                       # 실루엣 (회색 #3a3a3a 도 포함)
            elif v > 170:
                mp[x, y] = 0                         # 배경
            else:
                mp[x, y] = int((170 - v) / 70 * 255)  # 안티에일리어싱 가장자리

    mask = drop_ground(mask)
    mask = drop_specks(mask)

    # 여백을 남기지 않고 딱 잘라 저장한다.
    # ⚠️ 큰 상자에 여백과 함께 넣으면 CSS 의 mask-size:contain 이 '여백까지' 맞추느라
    #    화면에서 실루엣이 아주 작게 보인다(2026-07-29 실제로 그렇게 나왔다).
    bb = mask.point(lambda v: 255 if v > 25 else 0).getbbox()
    if bb:
        mask = mask.crop(bb)

    # 원본이 작아도(119×153) 폰 3배 화면에서 뭉개지지 않게 키운다.
    # 단색 실루엣이라 LANCZOS 로 늘려도 가장자리만 부드러워질 뿐 형태는 그대로다.
    if mask.height != TARGET_H:
        k = TARGET_H / mask.height
        mask = mask.resize((max(1, round(mask.width * k)), TARGET_H), Image.LANCZOS)

    rgba = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    rgba.putalpha(mask)
    return rgba


def sheet():
    names = ["golfer", "iron", "wedge", "putter"]
    bg = Image.new("RGBA", (900, 420), (242, 244, 246, 255))
    for i, n in enumerate(names):
        p = os.path.join(OUT, n + ".png")
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert("RGBA")
        big = im.copy(); big.thumbnail((150, 150), Image.LANCZOS)
        bg.alpha_composite(big, (60 + i * 210 + (150 - big.width) // 2, 40))
        sm = im.copy(); sm.thumbnail((44, 44), Image.LANCZOS)   # 실제 화면 크기
        bg.alpha_composite(sm, (60 + i * 210 + (150 - sm.width) // 2, 250))
    p = os.path.join(ROOT, "_icon_check.png")
    bg.convert("RGB").save(p)
    print("비교표:", p, "(위=확대, 아래=실제 크기)")


if __name__ == "__main__":
    if "--sheet" in sys.argv:
        sheet()
    else:
        for name, f in PLAN.items():
            src = os.path.join(SRC, f)
            if not os.path.exists(src):
                print("원본 없음:", f); continue
            m = to_mask(src)
            m.save(os.path.join(OUT, name + ".png"))
            print("%-7s ← %-13s %dx%d" % (name + ".png", f, m.width, m.height))
