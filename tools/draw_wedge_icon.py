# -*- coding: utf-8 -*-
"""웨지 아이콘 — 아이언과 확실히 구분되게 직접 그린다.

배경(2026-07-28): 아이언·웨지가 같은 클럽 아이콘을 각도만 돌린 것이라
                 화면에서 구분이 안 된다는 지적을 받았다.
해결: 웨지는 '클럽 모양'이 아니라 **하는 일**로 그린다 —
      모래(벙커)에서 공이 가파르게 떠오르는 장면.
      아이언(낮고 긴 클럽 헤드)과 실루엣 자체가 달라진다.

CSS mask 로 쓰이므로 검정 단색 + 투명 배경으로 만든다.
    python tools/draw_wedge_icon.py            제작
    python tools/draw_wedge_icon.py --sheet    아이언과 비교표
"""
import io, math, os, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets")
W, H = 600, 780          # 기존 아이콘과 같은 비율 (mask-size: contain)
S = 3                    # 4배 크게 그린 뒤 줄여 계단 현상을 없앤다
BLACK = (0, 0, 0, 255)


def draw_wedge():
    im = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    w, h = W * S, H * S

    # ── 모래 언덕 — 두툼하게. 작은 크기에서 얇으면 선처럼 뭉개진다
    sand_top = h * 0.72
    d.polygon([(0, h), (0, sand_top + h * 0.10),
               (w * 0.20, sand_top - h * 0.02), (w * 0.48, sand_top + h * 0.03),
               (w * 0.74, sand_top - h * 0.03), (w, sand_top + h * 0.07), (w, h)],
              fill=BLACK)

    # ── 공 — 크게. 이게 주인공이라 한눈에 보여야 한다
    br = w * 0.125
    bx, by = w * 0.27, sand_top - br * 1.15
    d.ellipse([bx - br, by - br, bx + br, by + br], fill=BLACK)

    # ── 튀어오르는 궤적 — 점 3개로 줄이고 굵게.
    #    가파른 각도가 웨지의 성격(높이 띄우기)을 그대로 보여준다
    for fx, fy, fr in [(0.50, 0.40, 0.085), (0.68, 0.24, 0.065), (0.84, 0.13, 0.048)]:
        cx, cy, r = w * fx, h * fy, w * fr
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BLACK)

    return im.resize((W, H), Image.LANCZOS)


def sheet():
    """아이언과 나란히 놓고 실제 표시 크기로도 확인한다."""
    iron = Image.open(os.path.join(OUT, "iron.png")).convert("RGBA")
    wedge = Image.open(os.path.join(OUT, "wedge.png")).convert("RGBA")
    bg = Image.new("RGBA", (760, 460), (242, 244, 246, 255))
    for i, (name, im) in enumerate([("아이언", iron), ("웨지", wedge)]):
        big = im.copy(); big.thumbnail((190, 190), Image.LANCZOS)
        bg.alpha_composite(big, (60 + i * 330, 40))
        sm = im.copy(); sm.thumbnail((44, 44), Image.LANCZOS)      # 실제 화면 크기
        bg.alpha_composite(sm, (130 + i * 330, 280))
    p = os.path.join(ROOT, "_icon_check.png")
    bg.convert("RGB").save(p)
    print("비교표:", p)


if __name__ == "__main__":
    if "--sheet" in sys.argv:
        sheet()
    else:
        draw_wedge().save(os.path.join(OUT, "wedge.png"))
        print("웨지 아이콘 생성 완료 → assets/wedge.png")
