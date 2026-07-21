# -*- coding: utf-8 -*-
"""감곡CC 코스공략 등록 파이프라인
- course_glen.asp / course_peach.asp에서 홀별 파/전장/코스공략/티표(블루2·화이트·골드·레드) HTML 파싱
- 홀맵(hole_NN.jpg, 등고선 포함 세로형) → crop_map 표준 크롭
- 그린 경사도(GlenN/PeachN.jpg) → green 필드로 함께 표시 (공식 자료!)
- 검증: 각 9홀, 번호 1~9, 파 3~5, 티 내림차순
"""
import json, os, re, sys, time, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from crop_map_only import crop_map
from PIL import Image

BASE = "https://www.gamgokcc.com"
AUTO = os.path.join(ROOT, "coursedata", "homepages_auto", "감곡CC")
IMGDIR = os.path.join(ROOT, "holeimg", "gamgok")
RAWDIR = os.path.join(AUTO, "img")
os.makedirs(IMGDIR, exist_ok=True)
os.makedirs(RAWDIR, exist_ok=True)
os.makedirs(os.path.join(AUTO, "pages"), exist_ok=True)
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

def dl(url, path):
    if not os.path.exists(path) or os.path.getsize(path) < 5000:
        open(path, "wb").write(fetch(url, binary=True))

TEE_NAMES = ["블루", "블루", "화이트", "골드", "레드"]

def parse_page(html):
    holes = []
    blocks = re.split(r'class="tab-pane', html)[1:]
    for b in blocks:
        t = re.search(r'<p class="course_title"><strong>(\d+)Hole</strong><span>(\d+)m[^<]*</span><i>\|</i><span>Par(\d)</span>', b)
        if not t:
            continue
        no, length, par = int(t.group(1)), int(t.group(2)), int(t.group(3))
        imgs = re.findall(r'<img src="(/images/[^"]+)"', b)
        mapimg = next((x for x in imgs if re.search(r'hole_\d+\.jpg$', x, re.I)), None)
        greenimg = next((x for x in imgs if re.search(r'(glen|peach)\d+\.(jpg|png)$', x, re.I)), None)
        tipm = re.search(r'코스공략</strong></div>(.*?)<table', b, re.S)
        tip = ""
        if tipm:
            tip = re.sub(r"<br\s*/?>", " ", tipm.group(1))
            tip = re.sub(r"<video.*?</video>", " ", tip, flags=re.S)
            tip = re.sub(r"<[^>]+>", " ", tip)
            tip = re.sub(r"\s+", " ", tip).strip()
        tds = re.findall(r"<td[^>]*>\s*([\d,/ ]+?)\s*</td>", b)
        tees = []
        if len(tds) >= 6:
            vals = []
            for x in tds[1:6]:
                x = x.replace(",", "").strip()
                vals.append(int(x) if x.isdigit() else x)
            tees = [{"name": TEE_NAMES[i], "m": vals[i]} for i in range(5)]
        holes.append({"no": no, "par": par, "len": length, "mapimg": mapimg,
                      "greenimg": greenimg, "tip": tip, "tees": tees})
    return holes

courses = []
errors = []
for cname, page, slug in [("GLEN", "course_glen.asp", "glen"), ("PEACH", "course_peach.asp", "peach")]:
    html = fetch(f"{BASE}/html/{page}")
    open(os.path.join(AUTO, "pages", page.replace(".asp", ".html")), "w", encoding="utf-8").write(html)
    parsed = parse_page(html)
    holes = []
    for h in parsed:
        n = h["no"]
        if h["par"] not in (3, 4, 5):
            errors.append(f"{cname}{n}: 파 이상 {h['par']}")
        nums = [t["m"] for t in h["tees"] if isinstance(t["m"], int)]
        if nums and any(nums[i] < nums[i+1] for i in range(len(nums)-1)):
            print(f"  ⚠ {cname}{n}: 티 거리 순서 특이 (2그린 공식 수치 그대로 사용) {[t['m'] for t in h['tees']]}")
        if not h["tees"]:
            errors.append(f"{cname}{n}: 티표 파싱 실패")
        if not h["tip"]:
            errors.append(f"{cname}{n}: 공략 TIP 파싱 실패")
        if not h["mapimg"]:
            errors.append(f"{cname}{n}: 홀맵 없음")
            continue
        raw = os.path.join(RAWDIR, os.path.basename(h["mapimg"]))
        dl(BASE + h["mapimg"], raw)
        out = os.path.join(IMGDIR, f"{slug}{n}.jpg")
        size = crop_map(raw, out, 0)
        entry = {"no": n, "par": h["par"], "len": h["len"],
                 "img": f"holeimg/gamgok/{slug}{n}.jpg", "tip": h["tip"], "tees": h["tees"]}
        if h["greenimg"]:
            graw = os.path.join(RAWDIR, os.path.basename(h["greenimg"]))
            dl(BASE + h["greenimg"], graw)
            gout = os.path.join(IMGDIR, f"{slug}{n}_green.jpg")
            gi = Image.open(graw).convert("RGB")
            if gi.width > 420:
                gi = gi.resize((420, int(gi.height * 420 / gi.width)), Image.LANCZOS)
            gi.save(gout, quality=86)
            entry["green"] = f"holeimg/gamgok/{slug}{n}_green.jpg"
        holes.append(entry)
        print(f"{cname} {n}홀 파{h['par']} {h['len']}m 티{[t['m'] for t in h['tees']]} 그린맵={'O' if h['greenimg'] else 'X'} | {h['tip'][:26]}")
        time.sleep(0.5)
    if [x["no"] for x in holes] != list(range(1, 10)):
        errors.append(f"{cname}: 홀 구성 이상 {[x['no'] for x in holes]}")
    courses.append({"name": cname, "holes": holes})

if errors:
    print("검증 실패:")
    for e in errors:
        print(" ", e)
    sys.exit(1)

out = {
    "course": "감곡CC",
    "source": "감곡CC 공식 홈페이지",
    "sourceUrl": "https://www.gamgokcc.com/html/course.asp",
    "courses": courses,
}
dst = os.path.join(ROOT, "coursedata", "homepages", "gamgok")
os.makedirs(dst, exist_ok=True)
json.dump(out, open(os.path.join(dst, "parsed.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("저장: 18홀 →", os.path.join(dst, "parsed.json"))
