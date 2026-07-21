# -*- coding: utf-8 -*-
"""Gemini 객관식 매칭: 현재 18개 홀 라인에 A~R 라벨을 붙인 위성 이미지를 주고
각 골프존 야디지맵이 어느 라벨과 일치하는지 고르게 한다. (좌표 생성보다 훨씬 신뢰도 높음)
결과: seoseoul_match.json  {야디지(코스,홀)} → 라벨
"""
import base64, io, json, os, re, sys, time, urllib.request, importlib.util
from PIL import Image, ImageDraw, ImageFont
sys.stdout.reconfigure(encoding="utf-8")
BASE = os.path.dirname(os.path.abspath(__file__))
YD = r"C:\Users\디자이너\Desktop\claude\Ri-weather\coursedata\golfzon\yardage"
KEY = base64.b64decode("QVEuQWI4Uk42S29NMXN6VU9DbnE3UUpCQUc2b1FtUU1hMnc5RnpONnF3WnlVUG43WjdHMXc=").decode()
MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"]

spec = importlib.util.spec_from_file_location("bs", os.path.join(BASE, "build_seoseoul.py"))
bs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bs)
HOLES = bs.HOLES  # (name, ref, par, len, pxline, tip)

LETTERS = "ABCDEFGHIJKLMNOPQR"
X0, Y0, X1, Y1 = 1030, 1000, 2400, 2400
img = Image.open(os.path.join(BASE, "seoseoul.png")).crop((X0, Y0, X1, Y1))
d = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 34)
except Exception:
    font = ImageFont.load_default()
palette = [(255,80,80),(80,180,255),(120,255,120),(255,200,60),(255,120,255),(120,255,255)]
for idx, (name, ref, par, olen, pxline, tip) in enumerate(HOLES):
    c = palette[idx % len(palette)]
    pts = [((x-X0), (y-Y0)) for x, y in pxline]
    d.line(pts, fill=c, width=5)
    tx, ty = pts[0]
    d.ellipse([tx-6, ty-6, tx+6, ty+6], fill=(255,240,80))
    mx, my = pts[len(pts)//2]
    d.rectangle([mx-4, my-40, mx+42, my+2], fill=(0,0,0))
    d.text((mx, my-40), LETTERS[idx], fill=c, font=font)
labeled_path = os.path.join(BASE, "seoseoul_labeled.png")
img.save(labeled_path)
print("라벨 이미지 저장:", labeled_path)

def b64img(im, maxpx=1100):
    if max(im.size) > maxpx:
        r = maxpx / max(im.size)
        im = im.resize((int(im.width*r), int(im.height*r)), Image.LANCZOS)
    buf = io.BytesIO()
    im.convert("RGB").save(buf, "JPEG", quality=80)
    return base64.b64encode(buf.getvalue()).decode()

labeled_b64 = b64img(img)

def gemini(parts, retries=6):
    body = json.dumps({"contents": [{"parts": parts}], "generationConfig": {"temperature": 0.1}}).encode()
    for a in range(retries):
        model = MODELS[a % len(MODELS)]
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}"
        try:
            req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read())["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            print(f"    재시도 {a+1} ({model}): {str(e)[:60]}")
            time.sleep(20 + a * 10)
    raise RuntimeError("fail")

results = {}
for cno, cname in [("01", "코스1"), ("02", "코스2")]:
    for hole in range(1, 10):
        yd = Image.open(os.path.join(YD, f"yardage_entire_238_{cno}_{str(hole).zfill(2)}.jpg"))
        prompt = ("이미지1은 골프장 위성사진이고, 18개 홀 라인이 A~R 알파벳 라벨과 색선으로 표시되어 있습니다(노란 점=티). "
                  "이미지2는 이 골프장 특정 홀의 야디지맵입니다(아래=티, 위=그린, 회전되어 있을 수 있음). "
                  "야디지맵의 홀 모양(길이·꺾임·주변 벙커·연못)과 가장 일치하는 라벨을 고르세요. "
                  '반드시 JSON만 출력: {"label":"글자","confidence":0~1,"reason":"짧은 근거"}')
        try:
            t = gemini([{"text": prompt},
                        {"inline_data": {"mime_type": "image/jpeg", "data": labeled_b64}},
                        {"inline_data": {"mime_type": "image/jpeg", "data": b64img(yd, 700)}}])
            m = re.search(r"\{.*\}", t, re.S)
            r = json.loads(m.group(0))
            results[f"{cno}-{hole}"] = r
            print(f"{cname} {hole}번 → {r.get('label')} (conf {r.get('confidence')}) {r.get('reason','')[:40]}")
        except Exception as e:
            results[f"{cno}-{hole}"] = None
            print(f"{cname} {hole}번: 실패 {e}")
        time.sleep(18)

json.dump(results, open(os.path.join(BASE, "seoseoul_match.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
# 현재 앱 배치와 비교 요약
print("\n=== 현재 배치 vs Gemini 매칭 ===")
for idx, (name, ref, par, olen, pxline, tip) in enumerate(HOLES):
    print(f"{LETTERS[idx]} = 현재 {name}{ref}")
