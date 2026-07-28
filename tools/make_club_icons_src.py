# -*- coding: utf-8 -*-
"""사장님이 주신 실루엣 원본 → CSS mask 용 PNG.

사장님 지시(2026-07-29): 직접 그린 아이콘이 허접하니 주신 이미지를 그대로 쓸 것.

⚠️ putter.jpg 는 제외한다 — 123RF 워터마크가 그대로 박혀 있다(= 미구매 스톡).
   워터마크는 잘라낼 수 있지만 그건 저작권 표시를 지우는 것이지 권리를 얻는 게 아니다.
   퍼터는 라이선스가 확실한 것으로 따로 만든다. 자세한 사정은 docs/아이콘_출처.md.

    python tools/make_club_icons_src.py           제작
    python tools/make_club_icons_src.py --sheet   결과 비교표
"""
import io, os, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "src")
OUT = os.path.join(ROOT, "assets")
# 상자를 따로 두지 않는다 — 실루엣에 딱 맞게 잘라야 화면에서 크게 보인다

# 원본 → 결과 파일. 워터마크 있는 putter.jpg 는 넣지 않는다.
PLAN = {
    "iron":  "iron.jpg",     # 스윙 중 — 클럽이 옆으로 길게 뻗는다
    "wedge": "wedge.jpg",    # 피니시 — 클럽이 위로 올라간다 (아이언과 실루엣이 확연히 다름)
}


def to_mask(path):
    """흰 배경을 지우고 실루엣만 남긴다. mask 로 쓰이므로 알파만 의미가 있다."""
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            # 어두울수록 실루엣. 회색 실루엣(#3a3a3a)도 있어 넉넉히 잡는다.
            v = (r + g + b) / 3
            mp[x, y] = 255 if v < 140 else (0 if v > 200 else int((200 - v) / 60 * 255))
    # 여백을 남기지 않고 딱 잘라 저장한다.
    # ⚠️ 큰 상자에 여백과 함께 넣으면 CSS 의 mask-size:contain 이 '여백까지' 맞추느라
    #    화면에서 실루엣이 아주 작게 보인다(2026-07-29 실제로 그렇게 나왔다).
    bb = mask.point(lambda v: 255 if v > 25 else 0).getbbox()
    if bb:
        mask = mask.crop(bb)
    # 너무 커서 파일이 무거워지지 않게만 제한
    if max(mask.size) > 900:
        mask.thumbnail((900, 900), Image.LANCZOS)
    rgba = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    rgba.putalpha(mask)
    return rgba


def sheet():
    names = ["golfer", "iron", "wedge", "putter"]
    labels = ["드라이버", "아이언", "웨지", "퍼터"]
    bg = Image.new("RGBA", (900, 420), (242, 244, 246, 255))
    for i, n in enumerate(names):
        p = os.path.join(OUT, n + ".png")
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert("RGBA")
        big = im.copy(); big.thumbnail((150, 150), Image.LANCZOS)
        bg.alpha_composite(big, (60 + i * 210 + (150 - big.width) // 2, 40))
        sm = im.copy(); sm.thumbnail((40, 40), Image.LANCZOS)   # 실제 화면 크기
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
            to_mask(src).save(os.path.join(OUT, name + ".png"))
            print(f"{name}.png  ← {f}")
        print("※ putter 는 워터마크 문제로 제외 (docs/아이콘_출처.md 참고)")
