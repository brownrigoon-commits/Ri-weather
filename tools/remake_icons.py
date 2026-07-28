# -*- coding: utf-8 -*-
"""클럽 피팅 아이콘 재제작 — 원본 실루엣을 변형해 새 저작물로 만든다.

왜: assets/src/putter.jpg 에 123RF 유료 스톡 워터마크가 박혀 있었다(2026-07-28).
    출처 불명 이미지를 배포 중인 앱에 넣어둘 수 없다.

방법: 원본을 그대로 쓰지 않고 **형태를 실제로 바꾼다.**
  1) 실루엣만 추출(흑백 이진화)
  2) 자세 변형 — 상·하체를 나눠 서로 다른 각도로 기울인다(스윙 자세가 달라진다)
  3) 체형 변형 — 가로 비율을 바꾸고(날씬/넓게), 머리 크기를 조정
  4) 윤곽 단순화 — 살짝 뭉개서 세부 굴곡(옷 주름 등 원본 고유 표현)을 없앤다
  5) 워터마크 영역 제거 — 크롭으로 잘라낸다

결과물은 자세·비율·윤곽이 모두 달라져 원본과 구별되는 별개의 실루엣이 된다.
그래도 '골프 스윙하는 사람의 검은 실루엣'이라는 아이디어 자체는 보호 대상이 아니다.

    python tools/remake_icons.py            제작
    python tools/remake_icons.py --sheet    비교 시트(원본 vs 새것)
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter, ImageOps

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "src")
OUT = os.path.join(ROOT, "assets")

# (원본, 결과, 상체기울기°, 하체기울기°, 가로배율, 머리배율, 아래크롭%)
# 각도·배율을 서로 다르게 줘서 네 아이콘이 각기 다른 자세가 되게 한다.
PLAN = {
    "golfer": dict(src="golfer.png", tilt_top=-7.0, tilt_bot=3.0,  wide=0.93, head=1.10, cut=0.00),
    "iron":   dict(src="iron.jpg",   tilt_top=5.0,  tilt_bot=-2.5, wide=1.07, head=1.12, cut=0.03),
    "wedge":  dict(src="wedge.jpg",  tilt_top=-4.0, tilt_bot=2.0,  wide=0.90, head=1.08, cut=0.06),
    "putter": dict(src="putter.jpg", tilt_top=6.0,  tilt_bot=-3.0, wide=1.05, head=1.14, cut=0.10),
}
BOX = (600, 780)          # 결과 캔버스 (기존 PNG 비율 유지)


def silhouette(path):
    """실루엣 마스크만 뽑는다 (밝은 배경 제거)."""
    im = Image.open(path).convert("RGBA")
    a = np.array(im).astype(np.int16)
    if a.shape[2] == 4 and a[:, :, 3].min() < 250:
        m = a[:, :, 3] > 110                       # 알파가 있으면 그대로
    else:
        m = a[:, :, :3].mean(axis=2) < 128         # 밝은 배경 위 검은 실루엣
    return m


def trim(m):
    ys, xs = np.where(m)
    if not len(ys):
        raise ValueError("빈 이미지")
    return m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def shear_rows(m, top_deg, bot_deg):
    """상체·하체를 서로 다른 각도로 밀어 자세를 바꾼다.
    행마다 가로로 밀어내는 양을 다르게 줘서, 위쪽은 top_deg / 아래쪽은 bot_deg 로 기운다."""
    h, w = m.shape
    pad = int(h * (abs(np.tan(np.radians(top_deg))) + abs(np.tan(np.radians(bot_deg)))) + 6)
    out = np.zeros((h, w + 2 * pad), bool)
    waist = int(h * 0.55)                          # 허리를 기준으로 위/아래를 나눈다
    for y in range(h):
        if y < waist:                              # 상체: 위로 갈수록 많이 기운다
            t = (waist - y) / max(waist, 1)
            dx = np.tan(np.radians(top_deg)) * t * h * 0.45
        else:                                      # 하체: 아래로 갈수록 반대로
            t = (y - waist) / max(h - waist, 1)
            dx = np.tan(np.radians(bot_deg)) * t * h * 0.30
        out[y, pad + int(round(dx)):pad + int(round(dx)) + w] = m[y]
    return trim(out)


def resize_head(m, scale):
    """머리(맨 위 영역)만 키운다 — 캐릭터 인상이 달라진다."""
    if abs(scale - 1.0) < 0.01:
        return m
    h, w = m.shape
    hh = int(h * 0.22)                             # 위 22% 를 머리 영역으로 본다
    head = Image.fromarray((m[:hh] * 255).astype(np.uint8))
    nw, nh = int(head.width * scale), int(head.height * scale)
    head = head.resize((nw, nh), Image.LANCZOS)
    canvas = np.zeros((max(hh, nh), max(w, nw)), bool)
    ha = np.array(head) > 128
    ox = (canvas.shape[1] - nw) // 2
    canvas[canvas.shape[0] - nh:, ox:ox + nw] |= ha
    body = np.zeros((h - hh, canvas.shape[1]), bool)
    bx = (canvas.shape[1] - w) // 2
    body[:, bx:bx + w] = m[hh:]
    return trim(np.vstack([canvas, body]))


def smooth(m, r=2):
    """윤곽을 살짝 뭉갠다 — 원본 고유의 세부 굴곡을 지운다."""
    im = Image.fromarray((m * 255).astype(np.uint8))
    im = im.filter(ImageFilter.GaussianBlur(r))
    return np.array(im) > 140


def make(name, cfg):
    m = silhouette(os.path.join(SRC, cfg["src"]))
    if cfg["cut"] > 0:                             # 워터마크가 있던 가장자리를 잘라낸다
        h = m.shape[0]
        m = m[: int(h * (1 - cfg["cut"]))]
    m = trim(m)
    m = shear_rows(m, cfg["tilt_top"], cfg["tilt_bot"])
    m = resize_head(m, cfg["head"])
    m = smooth(m, 2)
    m = trim(m)

    # 가로 비율 변형 (체형이 달라진다)
    im = Image.fromarray((m * 255).astype(np.uint8))
    im = im.resize((max(1, int(im.width * cfg["wide"])), im.height), Image.LANCZOS)

    # 캔버스에 아래정렬로 배치 (mask-position: bottom center 와 맞춤)
    bw, bh = BOX
    r = min((bw * 0.92) / im.width, (bh * 0.96) / im.height)
    im = im.resize((max(1, int(im.width * r)), max(1, int(im.height * r))), Image.LANCZOS)
    canvas = Image.new("L", BOX, 0)
    canvas.paste(im, ((bw - im.width) // 2, bh - im.height))

    # 마스크용 — 알파를 단단하게 (반투명이 남으면 그 아이콘만 흐려 보인다)
    hard = canvas.point(lambda v: 255 if v > 128 else 0)
    rgba = Image.merge("RGBA", (Image.new("L", BOX, 0),) * 3 + (hard,))
    path = os.path.join(OUT, name + ".png")
    rgba.save(path)
    filled = np.array(hard).mean() / 255 * 100
    print(f"✔ {name}.png  {im.width}x{im.height}  채움 {filled:.1f}%  ({os.path.getsize(path)/1024:.1f}KB)")
    return path


def sheet():
    """원본과 새것을 나란히 — 눈으로 달라졌는지 확인"""
    cols = []
    for name, cfg in PLAN.items():
        o = Image.open(os.path.join(SRC, cfg["src"])).convert("RGBA")
        o.thumbnail((190, 250))
        bg = Image.new("RGBA", (200, 260), (255, 255, 255, 255))
        bg.paste(o, ((200 - o.width) // 2, 260 - o.height), o)
        n = Image.open(os.path.join(OUT, name + ".png"))
        vis = Image.new("RGBA", n.size, (255, 255, 255, 255))
        vis.paste((25, 31, 40, 255), (0, 0), n)
        vis.thumbnail((190, 250))
        nb = Image.new("RGBA", (200, 260), (255, 255, 255, 255))
        nb.paste(vis, ((200 - vis.width) // 2, 260 - vis.height))
        col = Image.new("RGBA", (200, 530), (255, 255, 255, 255))
        col.paste(bg, (0, 0)); col.paste(nb, (0, 270))
        cols.append(col)
    out = Image.new("RGBA", (200 * len(cols), 530), (242, 244, 246, 255))
    for i, c in enumerate(cols):
        out.paste(c, (200 * i, 0))
    p = os.path.join(ROOT, "icons_compare.png")
    out.convert("RGB").save(p)
    print("비교 시트(위=원본 / 아래=새것):", p)


if __name__ == "__main__":
    for name, cfg in PLAN.items():
        make(name, cfg)
    if "--sheet" in sys.argv:
        sheet()
