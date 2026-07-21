# -*- coding: utf-8 -*-
"""Gemini 비전으로 홀 위치 자동 추출
1) 위성 전경(격자 라벨) + 골프존 야디지맵 → 홀 대략 위치 (티/그린 px)
2) 해당 부분 2배 확대 크롭 + 야디지맵 → 정밀 좌표 (도그레그 중간점 포함)
결과: seoseoul_gemini.json
"""
import base64, io, json, math, os, re, sys, time, urllib.request
from PIL import Image, ImageDraw
sys.stdout.reconfigure(encoding="utf-8")
BASE = os.path.dirname(os.path.abspath(__file__))
YD = r"C:\Users\디자이너\Desktop\claude\Ri-weather\coursedata\golfzon\yardage"
KEY = base64.b64decode("QVEuQWI4Uk42S29NMXN6VU9DbnE3UUpCQUc2b1FtUU1hMnc5RnpONnF3WnlVUG43WjdHMXc=").decode()
MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"]

SAT = Image.open(os.path.join(BASE, "seoseoul.png"))

def grid_crop(x0, y0, x1, y1, scale=1.0):
    img = SAT.crop((x0, y0, x1, y1))
    if scale != 1.0:
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
    d = ImageDraw.Draw(img)
    step = 100
    for gx in range(x0 - x0 % step + step, x1, step):
        X = (gx - x0) * scale
        d.line([(X, 0), (X, img.height)], fill=(255, 255, 0), width=1)
        d.text((X + 3, 3), str(gx), fill=(255, 60, 60))
    for gy in range(y0 - y0 % step + step, y1, step):
        Y = (gy - y0) * scale
        d.line([(0, Y), (img.width, Y)], fill=(255, 255, 0), width=1)
        d.text((3, Y + 3), str(gy), fill=(255, 60, 60))
    return img

def b64img(img, maxpx=1100):
    if max(img.size) > maxpx:
        r = maxpx / max(img.size)
        img = img.resize((int(img.width * r), int(img.height * r)), Image.LANCZOS)
    buf = io.BytesIO()
    img.convert("RGB").save(buf, "JPEG", quality=80)
    return base64.b64encode(buf.getvalue()).decode()

def gemini(parts, retries=6):
    body = json.dumps({"contents": [{"parts": parts}], "generationConfig": {"temperature": 0.1}}).encode()
    for a in range(retries):
        model = MODELS[a % len(MODELS)]
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}"
        try:
            req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                j = json.loads(r.read())
            return j["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            print(f"    gemini 재시도 {a+1} ({model}): {e}")
            time.sleep(15 + a * 10)
    raise RuntimeError("gemini fail")

def parse_json(t):
    m = re.search(r"\{.*\}", t, re.S)
    return json.loads(m.group(0)) if m else None

# 전경(코스 영역) — 격자 라벨 포함
overview = grid_crop(1030, 1000, 2400, 2400)

NINES = [("레이크", "01"), ("힐", "02")]
out = []
for nine, cno in NINES:
    for hole in range(1, 10):
        yd_path = os.path.join(YD, f"yardage_entire_238_{cno}_{str(hole).zfill(2)}.jpg")
        yd = Image.open(yd_path)
        tag = f"{nine}{hole}"
        try:
            # 1단계: 대략 위치
            p1 = ("이미지1은 서서울CC 위성사진입니다. 노란 격자선에 빨간 숫자로 픽셀 좌표가 표시되어 있습니다(x는 위쪽 라벨, y는 왼쪽 라벨). "
                  "이미지2는 이 골프장 특정 홀의 야디지맵으로, 아래쪽이 티잉구역, 위쪽이 그린입니다(방향은 다를 수 있음). "
                  "위성사진에서 이 홀(같은 모양의 페어웨이)을 찾아 티잉구역과 그린 중심의 픽셀 좌표를 답하세요. "
                  'JSON만 출력: {"tee":[x,y],"green":[x,y],"confidence":0~1}')
            t1 = gemini([{"text": p1},
                         {"inline_data": {"mime_type": "image/jpeg", "data": b64img(overview)}},
                         {"inline_data": {"mime_type": "image/jpeg", "data": b64img(yd, 800)}}])
            r1 = parse_json(t1)
            time.sleep(5)
            cx = (r1["tee"][0] + r1["green"][0]) / 2
            cy = (r1["tee"][1] + r1["green"][1]) / 2
            half = max(abs(r1["tee"][0]-r1["green"][0]), abs(r1["tee"][1]-r1["green"][1])) / 2 + 180
            half = max(half, 250)
            x0, y0 = int(max(0, cx-half)), int(max(0, cy-half))
            x1, y1 = int(min(SAT.width, cx+half)), int(min(SAT.height, cy+half))
            zoom = grid_crop(x0, y0, x1, y1, scale=2.0 if half < 400 else 1.4)
            # 2단계: 정밀 + 중간점
            p2 = ("이미지1은 위성사진 확대본입니다. 격자의 빨간 숫자가 원본 픽셀 좌표입니다. "
                  "이미지2는 같은 홀의 야디지맵(아래=티, 위=그린)입니다. "
                  "이 홀의 티잉구역 중심, (도그레그면) 꺾이는 지점, 그린 중심의 원본 픽셀 좌표를 정밀하게 답하세요. "
                  '직선 홀이면 중간점 생략. JSON만 출력: {"line":[[x,y],[x,y],...],"confidence":0~1} (첫 점=티, 끝 점=그린)')
            t2 = gemini([{"text": p2},
                         {"inline_data": {"mime_type": "image/jpeg", "data": b64img(zoom)}},
                         {"inline_data": {"mime_type": "image/jpeg", "data": b64img(yd, 800)}}])
            r2 = parse_json(t2)
            out.append({"name": nine, "ref": hole, "line": r2["line"], "conf1": r1.get("confidence"), "conf2": r2.get("confidence")})
            print(f"{tag}: {r2['line']} (conf {r1.get('confidence')}/{r2.get('confidence')})")
        except Exception as e:
            print(f"{tag}: 실패 {e}")
            out.append({"name": nine, "ref": hole, "line": None})
        time.sleep(5)

json.dump(out, open(os.path.join(BASE, "seoseoul_gemini.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("저장 완료")
