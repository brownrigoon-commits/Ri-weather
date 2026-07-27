# -*- coding: utf-8 -*-
"""Ri_Stock PWA 아이콘 생성 — 파랑 배경 + 흰 상승 차트 + "Ri"
   외부 자산 없이 PIL 만으로 그린다. (아이콘은 저장소에 커밋되는 산출물)"""
from PIL import Image, ImageDraw, ImageFont
import os

파랑 = (49, 130, 246, 255)     # #3182f6 — 주식 앱 포인트 색
진파랑 = (27, 100, 218, 255)   # #1b64da — 아래쪽 그라데이션
흰색 = (255, 255, 255, 255)
폰트경로 = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
출력폴더 = os.path.join(os.path.dirname(os.path.abspath(__file__)))


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


if __name__ == "__main__":
    저장("icon-192.png", 192, 0.0)
    저장("icon-512.png", 512, 0.13)   # maskable 안전영역 확보
    저장("icon-180.png", 180, 0.0)    # iOS 홈 화면
