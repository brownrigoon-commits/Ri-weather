# -*- coding: utf-8 -*-
"""클럽 피팅 아이콘 — 무료 라이선스(MIT/Apache) 아이콘으로 제작.

배경: assets/src/putter.jpg 에 123RF 유료 스톡 워터마크가 박혀 있었다(2026-07-28 발견).
      출처 불명 이미지를 배포 앱에 둘 수 없어 라이선스가 확실한 것으로 전면 교체한다.

라이선스 (2026-07-28 api.iconify.design/collections 에서 확인):
  · Phosphor      MIT         https://github.com/phosphor-icons/core/blob/main/LICENSE
  · Tabler Icons  MIT         https://github.com/tabler/tabler-icons/blob/master/LICENSE
  · Material Design Icons  Apache-2.0
  · Material Symbols       Apache-2.0
MIT·Apache 2.0 은 상업적 사용·수정·재배포가 자유롭고 출처 표시 의무가 없다.
그래도 docs/아이콘_출처.md 에 근거를 남긴다.

    python tools/make_club_icons.py            제작
    python tools/make_club_icons.py --sheet    시안 비교표
"""
import io, json, os, sys, urllib.request
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0"

# 4개 클럽을 눈으로 구분해야 한다. 골프 아이콘이 하나뿐인 셋이 많아
# '클럽별로 다른 아이콘'을 만들려면 여러 셋에서 성격이 다른 것을 골라 조합한다.
# 네 개가 **눈으로 바로 구분**되어야 한다.
# 처음엔 깃발 아이콘을 둘 썼다가 아이언·웨지가 똑같이 보여 다시 골랐다.
# at-icons:golf-club(클럽 헤드)을 각도만 달리해 클럽 종류를 나타내고,
# 드라이버는 티, 퍼터는 홀컵으로 성격을 분명히 한다.
PLAN = {
    # 드라이버 — 티에 올린 공 (드라이버만 티를 쓴다)
    "golfer": {"icon": "ph:golf-fill", "lic": "MIT / Phosphor", "rot": 0},
    # 아이언 — 클럽 헤드 (기본 각도, 얕은 로프트 느낌)
    "iron":   {"icon": "at-icons:golf-club", "lic": "MIT / At-Icons", "rot": 0},
    # 웨지 — 같은 클럽을 눕혀 로프트가 큰 느낌으로 (아이언과 확실히 구분).
    # -42° 는 너무 납작해 다른 아이콘보다 작아 보였다 → -28° 로 완화.
    "wedge":  {"icon": "at-icons:golf-club", "lic": "MIT / At-Icons", "rot": -28},
    # 퍼터 — 홀컵과 깃발 (그린 위 = 퍼팅).
    # 다른 셋은 선이 가늘어 혼자 얇아 보였다 → 채워진 at-icons 로 통일.
    "putter": {"icon": "at-icons:golf-hole", "lic": "MIT / At-Icons", "rot": 0},
}
BOX = (600, 780)     # 기존 PNG 와 같은 비율 (mask-size: contain, bottom center)


def fetch_svg(icon, h=520):
    p, n = icon.split(":")
    url = f"https://api.iconify.design/{p}/{n}.svg?height={h}&color=black"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read().decode("utf-8")


def svg_to_png(svg, size):
    """크롬으로 렌더 — cairosvg 없이도 정확하게 그린다."""
    import subprocess, tempfile
    node = os.path.join(ROOT, "tools", "_svg2png.js")
    with tempfile.NamedTemporaryFile("w", suffix=".svg", delete=False, encoding="utf-8") as f:
        f.write(svg)
        sp = f.name
    op = sp.replace(".svg", ".png")
    r = subprocess.run(["node", node, sp, op, str(size[0]), str(size[1])],
                       capture_output=True, text=True, cwd=ROOT)
    if r.returncode != 0:
        raise RuntimeError("렌더 실패: " + (r.stderr or "")[:200])
    im = Image.open(op).convert("RGBA")
    os.unlink(sp)
    return im


def make(name, cfg):
    svg = fetch_svg(cfg["icon"])
    im = svg_to_png(svg, (520, 520))
    if cfg.get("rot"):
        # 같은 클럽 헤드를 각도만 바꿔 다른 클럽으로 보이게 한다
        im = im.rotate(cfg["rot"], resample=Image.BICUBIC, expand=True)
    # 여백 잘라내기
    bb = im.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()
    if bb:
        im = im.crop(bb)
    # 캔버스에 아래정렬 배치
    bw, bh = BOX
    r = min((bw * 0.86) / im.width, (bh * 0.86) / im.height)
    im = im.resize((max(1, int(im.width * r)), max(1, int(im.height * r))), Image.LANCZOS)
    canvas = Image.new("RGBA", BOX, (0, 0, 0, 0))
    canvas.paste(im, ((bw - im.width) // 2, bh - im.height), im)
    # 마스크용 — 알파를 단단하게 (반투명이 남으면 그 아이콘만 흐려 보인다)
    a = canvas.getchannel("A").point(lambda v: 255 if v > 110 else 0)
    out = Image.merge("RGBA", (Image.new("L", BOX, 0),) * 3 + (a,))
    path = os.path.join(OUT, name + ".png")
    out.save(path)
    print(f"✔ {name}.png  {cfg['icon']:34} [{cfg['lic']}]  {os.path.getsize(path)/1024:.1f}KB")


def sheet():
    """시안 — 실제 앱처럼 마스크로 색을 입혀 보여준다"""
    cols = []
    for name, cfg in PLAN.items():
        m = Image.open(os.path.join(OUT, name + ".png")).getchannel("A")
        vis = Image.new("RGB", m.size, (242, 244, 246))
        vis.paste((25, 31, 40), (0, 0), m)
        vis.thumbnail((200, 260))
        col = Image.new("RGB", (210, 300), (242, 244, 246))
        col.paste(vis, ((210 - vis.width) // 2, 0))
        cols.append((col, name))
    from PIL import ImageDraw
    out = Image.new("RGB", (210 * len(cols), 330), (242, 244, 246))
    d = ImageDraw.Draw(out)
    for i, (c, n) in enumerate(cols):
        out.paste(c, (210 * i, 0))
        d.text((210 * i + 80, 306), n, fill=(78, 89, 104))
    p = os.path.join(ROOT, "icons_new.png")
    out.save(p)
    print("시안:", p)


if __name__ == "__main__":
    for n, c in PLAN.items():
        make(n, c)
    if "--sheet" in sys.argv:
        sheet()
