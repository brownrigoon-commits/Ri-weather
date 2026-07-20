# -*- coding: utf-8 -*-
"""국내 골프장 공식 홈페이지 자동 수집기
골프존 DB(coursedata/golfzon)의 homepageUrl을 시드로 각 클럽 사이트에서
코스소개 페이지 HTML과 홀맵 후보 이미지를 수집해 보관한다.

사용:
  python tools/collect_course_homepages.py            # 전체 (이어하기 지원)
  python tools/collect_course_homepages.py --limit 5  # 앞 5개만
  python tools/collect_course_homepages.py --only 서서울,몽베르

출력: coursedata/homepages_auto/<클럽슬러그>/
  - pages/*.html (수집 페이지), img/* (후보 이미지), meta.json (URL·로그)
주의: 서버 부담 방지를 위해 요청 간 0.6초 대기. 저작권 자료는 로컬 보관·분석용.
"""
import argparse, glob, hashlib, io, json, os, re, sys, time, urllib.parse, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
try:
    from PIL import Image
except ImportError:
    Image = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GZ = os.path.join(ROOT, "coursedata", "golfzon")
OUT = os.path.join(ROOT, "coursedata", "homepages_auto")
os.makedirs(OUT, exist_ok=True)

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
LINK_KW = re.compile(r"(course|cos|hole|yardage|layout|코스|홀|공략|야디지)", re.I)
IMG_KW = re.compile(r"(hole|course|cos|yardage|map|layout|green)", re.I)
SKIP_IMG = re.compile(r"(logo|banner|btn|button|icon|ico_|bg_|sns|kakao|insta|facebook|blog|quick|top\.|arrow|bullet|visual|main_|popup)", re.I)

def slugify(name):
    s = re.sub(r"[^0-9A-Za-z가-힣]", "", name)
    return s[:40] or hashlib.md5(name.encode()).hexdigest()[:10]

def fetch(url, timeout=20, binary=False, maxbytes=1_500_000):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ko"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read(maxbytes)
        final = r.geturl()
    if binary:
        return data, final
    for enc in ("utf-8", "euc-kr", "cp949"):
        try:
            return data.decode(enc), final
        except Exception:
            continue
    return data.decode("utf-8", errors="ignore"), final

def norm_url(u):
    u = (u or "").strip()
    if not u:
        return None
    if not u.startswith("http"):
        u = "http://" + u
    return u

def load_clubs():
    seen = {}
    for f in glob.glob(os.path.join(GZ, "cc_*.json")):
        j = json.load(open(f, encoding="utf-8"))
        d = j.get("detail", {})
        if d.get("country") != 1:
            continue
        name = (j.get("ccName") or "").split(" - ")[0].strip()
        url = norm_url(d.get("homepageUrl"))
        if name and (name not in seen or (url and not seen[name])):
            seen[name] = url
    return {k: v for k, v in seen.items() if v}

def extract_links(html, base):
    out = []
    for m in re.finditer(r'(?:href|src)\s*=\s*["\']([^"\'#]+)["\']', html, re.I):
        u = m.group(1).strip()
        if u.lower().startswith(("javascript:", "mailto:", "tel:")):
            continue
        out.append(urllib.parse.urljoin(base, u))
    return out

def same_host(a, b):
    try:
        ha = urllib.parse.urlparse(a).netloc.lower().replace("www.", "")
        hb = urllib.parse.urlparse(b).netloc.lower().replace("www.", "")
        return ha == hb
    except Exception:
        return False

def collect_club(name, url, log):
    slug = slugify(name)
    cdir = os.path.join(OUT, slug)
    if os.path.exists(os.path.join(cdir, "meta.json")):
        return "skip"
    pdir = os.path.join(cdir, "pages"); idir = os.path.join(cdir, "img")
    os.makedirs(pdir, exist_ok=True); os.makedirs(idir, exist_ok=True)
    meta = {"name": name, "seed": url, "pages": {}, "images": {}, "errors": []}

    to_visit = [(url, 0)]
    visited = set()
    img_urls = set()
    while to_visit and len(visited) < 14:
        cur, depth = to_visit.pop(0)
        if cur in visited:
            continue
        visited.add(cur)
        try:
            html, final = fetch(cur)
        except Exception as e:
            meta["errors"].append(f"page {cur}: {e}")
            continue
        pid = f"p{len(meta['pages'])}.html"
        open(os.path.join(pdir, pid), "w", encoding="utf-8").write(html)
        meta["pages"][pid] = cur
        time.sleep(0.6)
        for link in extract_links(html, final):
            low = link.lower()
            if re.search(r"\.(jpg|jpeg|png|gif)(\?|$)", low):
                if same_host(link, url) or IMG_KW.search(low):
                    img_urls.add(link)
            elif depth < 2 and same_host(link, url) and LINK_KW.search(link) and link not in visited:
                if not re.search(r"\.(css|js|pdf|zip)(\?|$)", low):
                    to_visit.append((link, depth + 1))

    # 이미지 다운로드 (키워드 우선, 클럽당 최대 30장)
    cand = sorted(img_urls, key=lambda u: 0 if IMG_KW.search(u) else 1)
    kept = 0
    for iu in cand:
        if kept >= 30:
            break
        fn = os.path.basename(urllib.parse.urlparse(iu).path)
        if not fn or SKIP_IMG.search(iu):
            continue
        try:
            data, _ = fetch(iu, binary=True)
        except Exception:
            continue
        if len(data) < 15000:
            continue
        if Image is not None:
            try:
                im = Image.open(io.BytesIO(data))
                if min(im.size) < 320:
                    continue
            except Exception:
                continue
        safe = re.sub(r"[^0-9A-Za-z._-]", "_", fn)[:60]
        path = os.path.join(idir, safe)
        if os.path.exists(path):
            safe = hashlib.md5(iu.encode()).hexdigest()[:6] + "_" + safe
            path = os.path.join(idir, safe)
        open(path, "wb").write(data)
        meta["images"][safe] = iu
        kept += 1
        time.sleep(0.4)

    json.dump(meta, open(os.path.join(cdir, "meta.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    log(f"{name}: 페이지 {len(meta['pages'])}, 이미지 {kept}, 오류 {len(meta['errors'])}")
    return "ok"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only", type=str, default="")
    ap.add_argument("--seeds", type=str, default="", help="추가 시드 JSON (find_missing_homepages 결과)")
    args = ap.parse_args()
    if args.seeds:
        raw = json.load(open(args.seeds, encoding="utf-8"))
        clubs = {}
        for name, v in raw.items():
            url = v.get("url") if isinstance(v, dict) else v
            if url:
                clubs[name] = norm_url(url)
    else:
        clubs = load_clubs()
    items = list(clubs.items())
    if args.only:
        keys = [k.strip() for k in args.only.split(",")]
        items = [(n, u) for n, u in items if any(k in n for k in keys)]
    if args.limit:
        items = items[:args.limit]
    print(f"대상 클럽: {len(items)}")
    done = 0
    for i, (name, url) in enumerate(items):
        try:
            r = collect_club(name, url, lambda s: print(f"[{i+1}/{len(items)}] {s}", flush=True))
            if r == "skip":
                print(f"[{i+1}/{len(items)}] {name}: 이미 수집됨 — 건너뜀", flush=True)
            else:
                done += 1
        except Exception as e:
            print(f"[{i+1}/{len(items)}] {name}: 실패 {e}", flush=True)
        time.sleep(0.8)
    print(f"완료: 신규 {done} / 전체 {len(items)}")

if __name__ == "__main__":
    main()
