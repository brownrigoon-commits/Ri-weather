# -*- coding: utf-8 -*-
"""tabpane(감곡형 솔루션) 범용 등록기
course_title + tab-pane 구조의 사이트에서 홀별 파/전장/티표/공략을 파싱해 등록한다.
사용: python tools/tabpane_build.py "클럽폴더명(homepages_auto)" "골프DB이름" "출력슬러그"
예:  python tools/tabpane_build.py 파인밸리CC 파인밸리CC pinevalley
검증: 골프존 holeCount와 총 홀 수 일치해야 저장 (원칙: 전 홀 확보 시만 등록)
"""
import glob, json, os, re, sys, time, urllib.parse, urllib.request
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from crop_map_only import crop_map

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

def golfzon_holecount(dbname):
    key = re.sub(r"[^0-9A-Za-z가-힣]", "", dbname).lower()
    for f in glob.glob(os.path.join(ROOT, "coursedata", "golfzon", "cc_*.json")):
        j = json.load(open(f, encoding="utf-8"))
        n = re.sub(r"[^0-9A-Za-z가-힣]", "", (j.get("ccName") or "").split(" - ")[0]).lower()
        if n and (n in key or key in n):
            hc = j.get("detail", {}).get("holeCount")
            if hc:
                return hc
    return None

def parse_page(html):
    holes = []
    for b in re.split(r'class="tab-pane', html)[1:]:
        hdcp = None
        t = re.search(r'<p class="course_title"><strong>(\d+)\s*Hole</strong><span>(\d+)m[^<]*</span><i>\|</i><span>Par\s*(\d)</span>', b)
        if t:
            no, length, par = int(t.group(1)), int(t.group(2)), int(t.group(3))
        else:
            t = re.search(r'class="course_title"><strong>(\d+)\s*Hole</strong><span>Par\s*(\d)</span>(?:<i>\|</i><span>HDCP\s*(\d+)</span>)?', b)
            if not t:
                continue
            no, length, par = int(t.group(1)), 0, int(t.group(2))
            hdcp = int(t.group(3)) if t.group(3) else None
        # 좌/우 구역 정보 (OB·페널티 등 공식 표기)
        zones = re.findall(r"<li>(좌|우)<i[^>]*>([^<]+)</i></li>", b)
        imgs = re.findall(r'<img src="([^"]+\.(?:jpg|png|jpeg))"', b, re.I)
        tipm = re.search(r'코스공략</strong></div>(.*?)(?:<table|</div>\s*</div>)', b, re.S)
        tip = ""
        if tipm:
            tip = re.sub(r"<video.*?</video>", " ", tipm.group(1), flags=re.S)
            tip = re.sub(r"<br\s*/?>", " ", tip)
            tip = re.sub(r"<[^>]+>", " ", tip)
            tip = re.sub(r"\s+", " ", tip).strip()
        ths = re.findall(r"<th[^>]*>(?:<i[^>]*></i>)?\s*([A-Z가-힣]+)", b)
        tds = re.findall(r"<td[^>]*>\s*([\d,/ ]+?)\s*</td>", b)
        tees = []
        if len(tds) >= 2:
            names = [x for x in ths if x not in ("PAR",)]
            vals = []
            for x in tds[1:]:
                x = x.replace(",", "").strip()
                vals.append(int(x) if x.isdigit() else x)
            # BLUE colspan 등으로 이름 수 != 값 수일 수 있음 → 이름 반복 허용
            for i, v in enumerate(vals):
                nm = names[min(i, len(names)-1)] if names else f"티{i+1}"
                tees.append({"name": nm.title() if nm.isascii() else nm, "m": v})
        if zones:
            zinfo = " · ".join(f"{s}측 {z.strip()}" for s, z in zones)
            tip = (tip + " " if tip else "") + f"[{zinfo}]"
        if not length:
            nums = [t2["m"] for t2 in tees if isinstance(t2["m"], int)]
            if nums:
                length = max(nums)
        holes.append({"no": no, "par": par, "len": length, "imgs": imgs, "tip": tip,
                      "tees": tees, "hdcp": hdcp})
    return holes

def main():
    club, dbname, slug = sys.argv[1], sys.argv[2], sys.argv[3]
    auto = os.path.join(ROOT, "coursedata", "homepages_auto", club)
    meta = json.load(open(os.path.join(auto, "meta.json"), encoding="utf-8"))
    base = meta["seed"].rstrip("/")
    origin = "{0.scheme}://{0.netloc}".format(urllib.parse.urlparse(meta["seed"]))
    imgdir = os.path.join(ROOT, "holeimg", slug)
    os.makedirs(imgdir, exist_ok=True)

    courses = []
    seen_urls = set()
    seen_sigs = set()
    nav_tabs = None
    for pid, url in meta["pages"].items():
        p = os.path.join(auto, "pages", pid)
        if not os.path.exists(p):
            continue
        html = open(p, encoding="utf-8", errors="ignore").read()
        if 'course_title' not in html or 'tab-pane' not in html:
            continue
        pr = urllib.parse.urlparse(url)
        norm = pr.scheme + "://" + pr.netloc + re.sub(r"/{2,}", "/", pr.path)
        if norm in seen_urls:
            continue
        seen_urls.add(norm)
        try:
            html = fetch(norm)  # 최신본
        except Exception:
            pass
        parsed = parse_page(html)
        if len(parsed) < 6:
            continue
        sig = tuple((h["no"], h["par"], h["len"]) for h in sorted(parsed, key=lambda x: x["no"]))
        if sig in seen_sigs:
            continue
        seen_sigs.add(sig)
        # 코스명 = 활성 탭(공식 표기), 탭 총수 = 코스 수 검증용
        onm = re.search(r'<li class="on"><a[^>]*>([^<]{2,15})</a>', html)
        tabs = re.findall(r'<ul id="tab_typeA"[^>]*>(.*?)</ul>', html, re.S)
        if tabs and nav_tabs is None:
            nav_tabs = len(re.findall(r"<li", tabs[0]))
        cname = ""
        if onm:
            cname = re.sub(r"\s*코스$", "", onm.group(1).strip())
        if not cname:
            tm = re.search(r"<title>([^<]*)</title>", html)
            um = re.search(r"course_?([A-Za-z가-힣0-9]+)\.(?:asp|php|html)", norm)
            cname = um.group(1).upper() if um else (tm.group(1).strip()[:10] if tm else "코스")
        holes = []
        for h in sorted(parsed, key=lambda x: x["no"]):
            mapimg = None
            greenimg = None
            for src in h["imgs"]:
                full = src if src.startswith("http") else origin + src
                try:
                    raw = fetch(full, binary=True)
                except Exception:
                    continue
                tmp = os.path.join(imgdir, "_tmp")
                open(tmp, "wb").write(raw)
                try:
                    im = Image.open(tmp)
                    w0, h0 = im.size
                except Exception:
                    continue
                if h0 > w0 * 1.25 and not mapimg:      # 세로형 = 홀맵
                    mapimg = (full, raw)
                elif 0.7 < w0 / h0 < 1.4 and not greenimg and min(w0, h0) >= 250:
                    greenimg = (full, raw)
            if not mapimg:
                print(f"  {cname} {h['no']}홀: 홀맵 후보 없음 → 클럽 제외")
                return False
            rawp = os.path.join(imgdir, f"_{slug}{cname}{h['no']}_raw.jpg")
            open(rawp, "wb").write(mapimg[1])
            out = os.path.join(imgdir, f"{cname.lower()}{h['no']}.jpg")
            crop_map(rawp, out, 0)
            os.remove(rawp)
            entry = {"no": h["no"], "par": h["par"], "len": h["len"],
                     "img": f"holeimg/{slug}/{cname.lower()}{h['no']}.jpg",
                     "tip": h["tip"], "tees": h["tees"]}
            if h.get("hdcp"):
                entry["hdcp"] = h["hdcp"]
            if greenimg:
                gpath = os.path.join(imgdir, f"{cname.lower()}{h['no']}_green.jpg")
                open(gpath, "wb").write(greenimg[1])
                gi = Image.open(gpath).convert("RGB")
                if gi.width > 420:
                    gi = gi.resize((420, int(gi.height * 420 / gi.width)), Image.LANCZOS)
                gi.save(gpath, quality=86)
                entry["green"] = f"holeimg/{slug}/{cname.lower()}{h['no']}_green.jpg"
            holes.append(entry)
            time.sleep(0.4)
        courses.append({"name": cname, "holes": holes})
        print(f"{cname}: {len(holes)}홀 파싱")

    total = sum(len(c["holes"]) for c in courses)
    official = golfzon_holecount(dbname)
    print(f"총 {total}홀, 골프존 공식 {official}홀, 사이트 코스 탭 {nav_tabs}개 / 파싱 {len(courses)}개")
    if not total:
        print("→ 파싱된 홀 없음")
        return False
    if official and total != official:
        print("→ 골프존 공식 홀 수와 불일치, 등록하지 않음")
        return False
    if not official and (nav_tabs is None or len(courses) != nav_tabs):
        print("→ 공식 홀 수 미확인 + 코스 탭 수와 불일치, 등록하지 않음")
        return False
    for c in courses:
        for h in c["holes"]:
            if h["par"] not in (3, 4, 5, 6):
                print(f"→ 파 이상 ({c['name']} {h['no']}: {h['par']}), 등록 중단")
                return False
    out = {"course": dbname, "source": f"{dbname} 공식 홈페이지", "sourceUrl": meta["seed"], "courses": courses}
    dst = os.path.join(ROOT, "coursedata", "homepages", slug)
    os.makedirs(dst, exist_ok=True)
    json.dump(out, open(os.path.join(dst, "parsed.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("저장 완료:", os.path.join(dst, "parsed.json"))
    return True

if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)
