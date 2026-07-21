# -*- coding: utf-8 -*-
"""더스타휴 홀 카드 18장에서 파/거리/TIP/티별거리 추출 (Gemini OCR)
카드 구성: 좌측 텍스트(N hole, Par/m/yds, 공략 설명), 우측 홀맵 + 티별 거리 범례(색점+숫자)
출력: coursedata/workfiles/thestarhue_ocr.json
"""
import base64, io, json, os, re, sys, time, urllib.request, glob
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "coursedata", "homepages_auto", "더스타휴골프앤리조트", "img")
OUT = os.path.join(ROOT, "coursedata", "workfiles", "thestarhue_ocr.json")
KEY = base64.b64decode("QVEuQWI4Uk42S29NMXN6VU9DbnE3UUpCQUc2b1FtUU1hMnc5RnpONnF3WnlVUG43WjdHMXc=").decode()
MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"]

def b64img(path):
    img = Image.open(path).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
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

PROMPT = (
    "이미지는 골프장 홀 안내 카드입니다. 좌측 상단에 'N hole' 제목과 'Par X / YYYm / ZZZyds' 표기, "
    "그 아래 홀 공략 설명 문단이 있고, 우측 하단에 색깔 점과 숫자로 된 티별 거리 범례가 있습니다. "
    "다음을 추출해 반드시 JSON만 출력하세요: "
    '{"hole": 홀번호숫자, "par": 숫자, "m": 미터숫자, "yds": 야드숫자, '
    '"tip": "공략 설명 원문 그대로(줄바꿈은 \\n, 한 글자도 바꾸지 말 것)", '
    '"tees": [{"color": "점 색깔(빨강/분홍/흰색/하늘색/검정 등)", "m": 숫자}, ...위에서 아래 순서대로]}'
)

results = {}
files = sorted(glob.glob(os.path.join(SRC, "shole_*.jpg"))) + sorted(glob.glob(os.path.join(SRC, "hhole_*.jpg")))
for f in files:
    key = os.path.basename(f).replace(".jpg", "")  # shole_01 .. hhole_09
    try:
        t = gemini([{"text": PROMPT}, {"inline_data": {"mime_type": "image/jpeg", "data": b64img(f)}}])
        m = re.search(r"\{.*\}", t, re.S)
        r = json.loads(m.group(0))
        results[key] = r
        tees = " ".join(f'{x["color"]}{x["m"]}' for x in r.get("tees", []))
        print(f"{key}: {r['hole']}홀 파{r['par']} {r['m']}m | 티:{tees} | {r['tip'][:30]}")
    except Exception as e:
        results[key] = None
        print(f"{key}: 실패 {e}")
    json.dump(results, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    time.sleep(10)
print("저장:", OUT)
