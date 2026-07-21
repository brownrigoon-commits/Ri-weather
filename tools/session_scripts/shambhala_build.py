# -*- coding: utf-8 -*-
"""샴발라CC 코스공략 등록 파이프라인
- 공식 홈페이지 마운틴(m1~m9.asp)/레이크(l1~l9.asp) 홀 페이지 수집
- HTML에서 파/티별 거리(블루·화이트·레드)/공략 TIP 원문 파싱 (OCR 불필요)
- 홀맵 이미지(A1~A9, B1~B9) 다운로드 → crop_map_only 표준 크롭(세로600)
- 검증: 파 값 범위, 거리 내림차순, 18홀 전부 존재 확인
출력: coursedata/homepages/shambhala/parsed.json, holeimg/shambhala/
"""
import json, os, re, sys, time, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from crop_map_only import crop_map

BASE = "https://www.shambhalacc.co.kr"
AUTO = os.path.join(ROOT, "coursedata", "homepages_auto", "샴발라CC")
IMGDIR = os.path.join(ROOT, "holeimg", "shambhala")
RAWDIR = os.path.join(AUTO, "img")
os.makedirs(IMGDIR, exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"

def fetch(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ko"})
    with urllib.request.urlopen(req, timeout=25) as r:
        data = r.read()
    if binary:
        return data
    for enc in ("utf-8", "euc-kr", "cp949"):
        try:
            return data.decode(enc)
        except Exception:
            pass
    return data.decode("utf-8", errors="ignore")

def parse_hole(html):
    m = re.search(r"<h2>(\d+)HOLE\s*PAR(\d)</h2>", html)
    no, par = int(m.group(1)), int(m.group(2))
    tees = []
    for c, v in re.findall(r'<span class="(blue|white|red)"></span>(\d+)', html):
        tees.append({"name": {"blue": "블루", "white": "화이트", "red": "레드"}[c], "m": int(v)})
    img = re.search(r'<img src="(/images/course/new/[^"]+)">', html).group(1)
    tip = re.search(r"<li>\s*<p>(.*?)</p>", html, re.S).group(1)
    tip = re.sub(r"<br\s*/?>", "\n", tip)
    tip = re.sub(r"<[^>]+>", "", tip)
    tip = tip.replace("\r", "")
    tip = re.sub(r"\n{2,}", "\n", tip)
    tip = re.sub(r"[ \t]+", " ", tip).strip()
    return no, par, tees, img, tip

courses = []
errors = []
for cname, prefix, letter in [("마운틴", "m", "A"), ("레이크", "l", "B")]:
    holes = []
    for n in range(1, 10):
        url = f"{BASE}/course/{prefix}{n}.asp"
        try:
            html = fetch(url)
            no, par, tees, imgsrc, tip = parse_hole(html)
            # 페이지 저장(보관)
            open(os.path.join(AUTO, "pages", f"{prefix}{n}.html"), "w", encoding="utf-8").write(html)
            # 검증
            if no != n:
                errors.append(f"{prefix}{n}: 홀번호 불일치 {no}")
            if par not in (3, 4, 5):
                errors.append(f"{prefix}{n}: 파 이상 {par}")
            if len(tees) != 3 or any(tees[i]["m"] < tees[i+1]["m"] for i in range(len(tees)-1)):
                errors.append(f"{prefix}{n}: 티 거리 이상 {tees}")
            # 원본 이미지 다운로드 → 표준 크롭
            raw = os.path.join(RAWDIR, f"{letter}{n}.jpg")
            if not os.path.exists(raw) or os.path.getsize(raw) < 5000:
                open(raw, "wb").write(fetch(BASE + imgsrc, binary=True))
            out = os.path.join(IMGDIR, f"{letter.lower()}{n}.jpg")
            size = crop_map(raw, out, 0)   # 카드가 아니라 지도 단독 이미지 → x0=0
            holes.append({
                "no": n, "par": par,
                "img": f"holeimg/shambhala/{letter.lower()}{n}.jpg",
                "tip": tip, "len": tees[0]["m"], "tees": tees,
            })
            print(f"{cname} {n}홀 파{par} {tees[0]['m']}m {size} | {tip[:30]}")
        except Exception as e:
            errors.append(f"{prefix}{n}: {e}")
        time.sleep(0.8)
    courses.append({"name": cname, "holes": holes})

if errors or sum(len(c["holes"]) for c in courses) != 18:
    print("검증 실패:")
    for e in errors:
        print(" ", e)
    sys.exit(1)

out = {
    "course": "샴발라CC",
    "source": "샴발라CC 공식 홈페이지",
    "sourceUrl": "https://www.shambhalacc.co.kr/course/m1.asp",
    "courses": courses,
}
dst = os.path.join(ROOT, "coursedata", "homepages", "shambhala")
os.makedirs(dst, exist_ok=True)
json.dump(out, open(os.path.join(dst, "parsed.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("저장: 18홀 →", os.path.join(dst, "parsed.json"))
