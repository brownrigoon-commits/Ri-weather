# -*- coding: utf-8 -*-
"""Ri_Stock PWA 아이콘·스플래시 생성 — 파랑 배경 + 흰 상승 차트 + "Ri"
   외부 자산 없이 PIL 만으로 그린다. (아이콘·스플래시는 저장소에 커밋되는 산출물)

   실행:  python ristock/icons/make_icons.py
"""
from PIL import Image, ImageDraw, ImageFont
import os

파랑 = (49, 130, 246, 255)     # #3182f6 — 주식 앱 포인트 색
진파랑 = (27, 100, 218, 255)   # #1b64da — 아래쪽 그라데이션
흰색 = (255, 255, 255, 255)
바탕 = (242, 244, 246, 255)    # #f2f4f6 — manifest 의 background_color 와 같은 값
글자색 = (25, 31, 40, 255)     # #191f28 — 앱 본문 글자색
폰트경로 = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
출력폴더 = os.path.join(os.path.dirname(os.path.abspath(__file__)))
스플래시폴더 = os.path.join(출력폴더, "splash")


def 아이콘(크기: int, 여백비율: float = 0.0) -> Image.Image:
    """여백비율 > 0 이면 안전영역(maskable) 을 감안해 도형을 안쪽으로 줄인다."""
    S = 크기 * 4                      # 4배로 그려서 축소 → 계단 현상 제거
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 배경: 위→아래 파랑 그라데이션 (라운드 사각형으로 마스킹)
    grad = Image.new("RGBA", (S, S))
    gd = ImageDraw.Draw(grad)
    for y in range(S):
        t = y / max(1, S - 1)
        gd.line([(0, y), (S, y)], fill=(
            int(파랑[0] + (진파랑[0] - 파랑[0]) * t),
            int(파랑[1] + (진파랑[1] - 파랑[1]) * t),
            int(파랑[2] + (진파랑[2] - 파랑[2]) * t),
            255))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=255)
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)

    # 안전영역 계산 (maskable 대응)
    inset = S * 여백비율
    L, T, R, B = inset, inset, S - inset, S - inset
    W, H = R - L, B - T

    # 상승 꺾은선: 왼쪽 아래 → 오른쪽 위 (계단식 상승)
    점 = [(0.16, 0.66), (0.36, 0.50), (0.52, 0.58), (0.78, 0.28)]
    좌표 = [(L + W * x, T + H * y) for x, y in 점]
    두께 = max(2, int(S * 0.055))
    d.line(좌표, fill=흰색, width=두께, joint="curve")

    # 화살촉 (오른쪽 위)
    끝 = 좌표[-1]
    a = S * 0.085 * (1 - 여백비율)
    d.polygon([끝, (끝[0] - a * 1.15, 끝[1] + a * 0.12), (끝[0] - a * 0.12, 끝[1] + a * 1.15)], fill=흰색)

    # 꺾인 지점 강조 점
    for x, y in 좌표[:-1]:
        r = 두께 * 0.62
        d.ellipse([x - r, y - r, x + r, y + r], fill=흰색)

    # "Ri" — 아래쪽 가운데
    글자크기 = int(H * 0.235)
    try:
        font = ImageFont.truetype(폰트경로, 글자크기)
    except Exception:
        font = ImageFont.load_default()
    글자 = "Ri"
    bbox = d.textbbox((0, 0), 글자, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text((L + W / 2 - tw / 2 - bbox[0], T + H * 0.80 - th / 2 - bbox[1]), 글자, font=font, fill=흰색)

    return img.resize((크기, 크기), Image.LANCZOS)


def 저장(이름, 크기, 여백비율=0.0):
    경로 = os.path.join(출력폴더, 이름)
    아이콘(크기, 여백비율).save(경로, "PNG", optimize=True)
    print(f"{경로}  {크기}x{크기}  {os.path.getsize(경로)}B")


# =====================================================================
# iOS 스플래시 (실행 순간의 흰 화면 번쩍임을 없앤다)
#
# 아이폰은 `apple-touch-startup-image` 가 **기기 해상도와 정확히 맞을 때만** 쓴다.
# 하나라도 안 맞으면 그 기기에서는 흰 화면이 그대로 보인다.
# 그래서 실제로 많이 쓰는 기기 8종의 세로 해상도를 전부 만들어 둔다.
#
# (가로, 세로, 어떤 기기인지)  — CSS 논리 크기 × 배율 = 실제 픽셀
# =====================================================================
스플래시목록 = [
    (750, 1334, "iPhone SE2·SE3 / 6·7·8            375x667 @2x"),
    (828, 1792, "iPhone XR · 11                     414x896 @2x"),
    (1125, 2436, "iPhone X · XS · 11 Pro             375x812 @3x"),
    (1170, 2532, "iPhone 12 · 13 · 14 · 15           390x844 @3x"),
    (1179, 2556, "iPhone 14 Pro · 15 Pro · 16        393x852 @3x"),
    (1242, 2208, "iPhone 6+ · 7+ · 8+                414x736 @3x"),
    (1242, 2688, "iPhone XS Max · 11 Pro Max         414x896 @3x"),
    (1290, 2796, "iPhone 14·15 Pro Max, 12·13 Pro Max 430x932 @3x"),
]


def 스플래시(가로: int, 세로: int) -> Image.Image:
    """앱 배경색 위에 아이콘과 워드마크만. 화려하게 만들 이유가 없다 —
    0.3초 보이고 사라지는 화면이고, 목적은 '흰 화면이 안 보이는 것' 하나다."""
    img = Image.new("RGB", (가로, 세로), 바탕[:3])
    d = ImageDraw.Draw(img)

    짧은쪽 = min(가로, 세로)
    아이콘크기 = int(짧은쪽 * 0.28)
    아이 = 아이콘(아이콘크기, 0.0)

    # 화면 정중앙보다 조금 위 — 아래에 워드마크가 오므로 시각적 무게중심을 맞춘다
    ix = (가로 - 아이콘크기) // 2
    iy = int(세로 * 0.42) - 아이콘크기 // 2
    img.paste(아이, (ix, iy), 아이)

    # 워드마크. 한글 폰트가 없는 환경이라 manifest 의 short_name 그대로 라틴으로 쓴다.
    글자크기 = max(12, int(짧은쪽 * 0.072))
    try:
        font = ImageFont.truetype(폰트경로, 글자크기)
    except Exception:
        font = ImageFont.load_default()
    글자 = "Ri Stock"
    bbox = d.textbbox((0, 0), 글자, font=font)
    tw = bbox[2] - bbox[0]
    d.text((가로 / 2 - tw / 2 - bbox[0], iy + 아이콘크기 + 짧은쪽 * 0.055 - bbox[1]),
           글자, font=font, fill=글자색[:3])
    return img


def 스플래시저장():
    os.makedirs(스플래시폴더, exist_ok=True)
    총합 = 0
    for 가로, 세로, 설명 in 스플래시목록:
        경로 = os.path.join(스플래시폴더, f"splash-{가로}x{세로}.png")
        스플래시(가로, 세로).save(경로, "PNG", optimize=True)
        크기 = os.path.getsize(경로)
        총합 += 크기
        print(f"  splash-{가로}x{세로}.png  {크기:>7,}B   {설명}")
    print(f"  스플래시 {len(스플래시목록)}장 합계 {총합:,}B ({총합/1024:.0f}KB)")
    return 총합


if __name__ == "__main__":
    저장("icon-192.png", 192, 0.0)
    저장("icon-512.png", 512, 0.0)            # 일반(any) — 아이콘이 꽉 차야 또렷하다
    저장("icon-512-maskable.png", 512, 0.13)  # maskable — 런처가 원형으로 잘라도 안 잘리게
    저장("icon-180.png", 180, 0.0)            # iOS 홈 화면
    print("iOS 스플래시:")
    스플래시저장()
