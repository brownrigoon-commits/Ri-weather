# -*- coding: utf-8 -*-
"""서서울 공식 홀맵 원본에서 코스공략 TIP 텍스트 + 파 추출 (Gemini OCR)"""
import base64, io, json, os, re, sys, time, urllib.request, glob
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")
SRC = r"C:\Users\디자이너\Desktop\claude\Ri-weather\coursedata\homepages\seoseoul\orig"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seoseoul_tips.json")
KEY = base64.b64decode("QVEuQWI4Uk42S29NMXN6VU9DbnE3UUpCQUc2b1FtUU1hMnc5RnpONnF3WnlVUG43WjdHMXc=").decode()
MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"]

def b64img(path):
    img = Image.open(path).convert("RGB")
    # 우측(텍스트 영역)만 잘라 선명하게
    w, h = img.size
    right = img.crop((int(w*0.45), 0, w, h))
    buf = io.BytesIO()
    right.save(buf, "JPEG", quality=90)
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
            print(f"  재시도{a+1}({m}): {str(e)[:50]}")
            time.sleep(15 + a * 8)
    raise RuntimeError("fail")

tips = {}
for f in sorted(glob.glob(os.path.join(SRC, "n_*.jpg"))):
    key = os.path.basename(f).replace("n_", "").replace(".jpg", "")  # L1..M9
    p = ("이미지는 골프장 홀 안내 카드의 우측 부분입니다. "
         "1) 홀 번호 오른쪽 회색 원 안의 PAR 숫자, 2) '코스공략 TIP' 아래 본문 텍스트를 한 글자도 바꾸지 말고 원문 그대로. "
         '반드시 JSON만 출력: {"par": 숫자, "tip": "원문"}')
    try:
        t = gemini([{"text": p}, {"inline_data": {"mime_type": "image/jpeg", "data": b64img(f)}}])
        m = re.search(r"\{.*\}", t, re.S)
        r = json.loads(m.group(0))
        tips[key] = r
        print(f"{key}: 파{r['par']} | {r['tip'][:50]}")
    except Exception as e:
        tips[key] = None
        print(f"{key}: 실패 {e}")
    time.sleep(12)

json.dump(tips, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("저장:", OUT)
