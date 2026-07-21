# -*- coding: utf-8 -*-
"""서서울 공식 홀맵 원본에서 L/R 그린 티별 거리표 추출 (Gemini OCR)"""
import base64, io, json, os, re, sys, time, urllib.request, glob
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")
SRC = r"C:\Users\디자이너\Desktop\claude\Ri-weather\coursedata\homepages\seoseoul\orig"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seoseoul_dists.json")
KEY = base64.b64decode("QVEuQWI4Uk42S29NMXN6VU9DbnE3UUpCQUc2b1FtUU1hMnc5RnpONnF3WnlVUG43WjdHMXc=").decode()
MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"]

def b64img(path):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    right = img.crop((int(w*0.45), 0, w, int(h*0.55)))  # 거리표 영역
    right = right.resize((right.width*2, right.height*2), Image.LANCZOS)
    buf = io.BytesIO()
    right.save(buf, "JPEG", quality=92)
    return base64.b64encode(buf.getvalue()).decode()

def gemini(parts, retries=6):
    body = json.dumps({"contents": [{"parts": parts}], "generationConfig": {"temperature": 0}}).encode()
    for a in range(retries):
        m = MODELS[a % len(MODELS)]
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={KEY}"
        try:
            req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read())["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as e:
            print(f"  재시도{a+1}({m}): {str(e)[:40]}")
            time.sleep(15 + a * 8)
    raise RuntimeError("fail")

dists = {}
for f in sorted(glob.glob(os.path.join(SRC, "n_*.jpg"))):
    key = os.path.basename(f).replace("n_", "").replace(".jpg", "")
    p = ("이미지는 골프 홀 안내 카드의 거리표입니다. L행과 R행에 각각 BACK TEE, REGULAR TEE, FRONT TEE, LADY TEE 거리(미터)가 있습니다. "
         '숫자를 정확히 읽어 JSON만 출력: {"L":[back,regular,front,lady],"R":[back,regular,front,lady]}')
    try:
        t = gemini([{"text": p}, {"inline_data": {"mime_type": "image/jpeg", "data": b64img(f)}}])
        m = re.search(r"\{.*\}", t, re.S)
        r = json.loads(m.group(0))
        dists[key] = r
        print(f"{key}: L{r['L']} R{r['R']}")
    except Exception as e:
        dists[key] = None
        print(f"{key}: 실패 {e}")
    time.sleep(10)

json.dump(dists, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("저장:", OUT)
