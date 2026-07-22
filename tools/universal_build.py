# -*- coding: utf-8 -*-
"""범용 홀별 공략 등록기 — 사이트 유형 자동 판별 후 파싱·검증·등록
지원 유형
  holebox  : div.hole-box(제목 h2 + Par/HDCP + 티별거리 + 이미지 + Tip)   예) 타이거CC
  tabpane  : course_title + tab-pane                                    예) 감곡·파인밸리
  holeinfo : class="holeInfo" 슬라이더형                                 예) 몽베르
  asp_hole : 홀마다 개별 페이지(/course/m1.asp)                          예) 샴발라

품질 기준(서서울/몽베르/더스타휴 수준)
  · 홀 번호가 1..N 연속 (9/18/27홀)
  · 파 3~6, 거리(티별 또는 전장) 확보
  · 홀맵 이미지가 홀마다 존재하고 세로형
  · 공략 TIP 원문 (없으면 B급으로 표시하되 등록은 허용)

사용:
  python tools/universal_build.py --club "타이거CC" --db "타이거CC" --slug tiger
  python tools/universal_build.py --batch          # 후보 전체 자동 시도(리포트만)
  python tools/universal_build.py --batch --write  # 통과분 실제 등록
"""
import argparse, glob, json, os, re, sys, time, urllib.parse, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from crop_map_only import crop_map
from PIL import Image

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
AUTO = os.path.join(ROOT, "coursedata", "homepages_auto")

# ── 공통 ──────────────────────────────────────────────────────
import ssl
_NOSSL = ssl.create_default_context()
_NOSSL.check_hostname = False
_NOSSL.verify_mode = ssl.CERT_NONE

def fetch(url, binary=False, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ko"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read()
    except Exception as e:
        if "SSL" not in str(e) and "CERTIFICATE" not in str(e).upper():
            raise
        with urllib.request.urlopen(req, timeout=timeout, context=_NOSSL) as r:   # 인증서 만료 사이트 대응
            data = r.read()
    if binary:
        return data
    for enc in ("utf-8", "euc-kr", "cp949"):
        try:
            return data.decode(enc)
        except Exception:
            pass
    return data.decode("utf-8", errors="ignore")

def strip_tags(s):
    s = re.sub(r"<(script|style|video)[^>]*>.*?</\1>", " ", s or "", flags=re.S | re.I)
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = s.replace("&nbsp;", " ").replace("&amp;", "&")
    return re.sub(r"\s+", " ", s).strip()

TEE_COLOR_KO = {"blue": "블루", "white": "화이트", "red": "레드", "yellow": "옐로",
                "gold": "골드", "black": "블랙", "green": "그린", "silver": "실버",
                "champion": "챔피언", "back": "백", "regular": "레귤러", "front": "프론트", "lady": "레이디"}

def norm_club(s):
    return re.sub(r"(CC|GC|C\.C|G\.C|컨트리클럽|골프클럽|골프장|골프앤리조트|골프리조트|리조트|컨트리|클럽|\s|·|&)", "", s or "", flags=re.I).lower()

_official = None
def official_holes(dbname):
    global _official
    if _official is None:
        _official = {}
        for f in glob.glob(os.path.join(ROOT, "coursedata", "golfzon", "cc_*.json")):
            try:
                j = json.load(open(f, encoding="utf-8"))
            except Exception:
                continue
            d = j.get("detail", {})
            if d.get("country") != 1:
                continue
            n = norm_club((j.get("ccName") or "").split(" - ")[0])
            if n and d.get("holeCount"):
                _official[n] = max(_official.get(n, 0), d["holeCount"])
    k = norm_club(dbname)
    if k in _official:
        return _official[k]
    for g, hc in _official.items():
        if len(k) >= 3 and (k in g or g in k):
            return hc
    return None

# ── 유형별 파서 (반환: [{no,par,hdcp,len,tees,tip,img_url}], 코스명) ──
def parse_holebox(html, base):
    holes = []
    for b in re.split(r'<div[^>]*class="[^"]*hole-box', html)[1:]:
        m = re.search(r"<h2>\s*(\d+)\s*<span>", b)
        if not m:
            continue
        no = int(m.group(1))
        pm = re.search(r"Par\s*(\d)", b, re.I)
        hm = re.search(r"HDCP\s*(\d+)", b, re.I)
        tees = []
        for c, v in re.findall(r'<span class="(\w+)"></span>\s*([\d,]+)', b):
            tees.append({"name": TEE_COLOR_KO.get(c.lower(), c), "m": int(v.replace(",", ""))})
        im = re.search(r'<img[^>]+src="([^"]+)"', b)
        tm = re.search(r'class="[^"]*hole-tip[^"]*"[^>]*>(.*?)</div>', b, re.S)
        tip = strip_tags(tm.group(1)) if tm else ""
        tip = re.sub(r"^Tip\s*", "", tip, flags=re.I)
        holes.append({
            "no": no, "par": int(pm.group(1)) if pm else 0,
            "hdcp": int(hm.group(1)) if hm else None,
            "tees": tees, "len": tees[0]["m"] if tees else 0,
            "tip": tip, "img": urllib.parse.urljoin(base, im.group(1)) if im else None,
        })
    return holes

def parse_tabpane(html, base):
    holes = []
    for b in re.split(r'class="tab-pane', html)[1:]:
        t = re.search(r'class="course_title"><strong>(\d+)\s*Hole</strong><span>(?:(\d+)m[^<]*</span><i>\|</i><span>)?Par\s*(\d)', b)
        if not t:
            continue
        no = int(t.group(1)); length = int(t.group(2)) if t.group(2) else 0; par = int(t.group(3))
        hm = re.search(r"HDCP\s*(\d+)", b, re.I)
        ths = [x for x in re.findall(r"<th[^>]*>(?:<i[^>]*></i>)?\s*([A-Z가-힣]+)", b) if x != "PAR"]
        tds = re.findall(r"<td[^>]*>\s*([\d,/ ]+?)\s*</td>", b)
        tees = []
        for i, v in enumerate(tds[1:]):
            v = v.replace(",", "").strip()
            nm = ths[min(i, len(ths) - 1)] if ths else f"티{i+1}"
            tees.append({"name": TEE_COLOR_KO.get(nm.lower(), nm), "m": int(v) if v.isdigit() else v})
        tm = re.search(r"코스공략</strong></div>(.*?)(?:<table|</div>\s*</div>)", b, re.S)
        imgs = re.findall(r'<img[^>]+src="([^"]+\.(?:jpg|png|jpeg))"', b, re.I)
        nums = [x["m"] for x in tees if isinstance(x["m"], int)]
        holes.append({
            "no": no, "par": par, "hdcp": int(hm.group(1)) if hm else None,
            "tees": tees, "len": length or (max(nums) if nums else 0),
            "tip": strip_tags(tm.group(1)) if tm else "",
            "img": urllib.parse.urljoin(base, imgs[0]) if imgs else None,
            "imgs": [urllib.parse.urljoin(base, x) for x in imgs],
        })
    return holes

def parse_holeinfo(html, base):
    holes = []
    for b in re.split(r'class="holeInfo', html)[1:]:
        nm = re.search(r'<div class="number">(\d+)</div>', b)
        pm = re.search(r"par\s*<span>(\d)</span>", b, re.I)
        hm = re.search(r"hdcp\s*<span>(\d+)</span>", b, re.I)
        lm = re.search(r'<div class="length">(\d+)m</div>', b)
        im = re.search(r'<img src="([^"]+-0\.png)"', b) or re.search(r'<img src="([^"]+)"', b)
        tm = re.search(r"<p>(.*?)</p>", b, re.S)
        if not nm or not pm:
            continue
        holes.append({
            "no": int(nm.group(1)), "par": int(pm.group(1)),
            "hdcp": int(hm.group(1)) if hm else None,
            "len": int(lm.group(1)) if lm else 0, "tees": [],
            "tip": strip_tags(tm.group(1)) if tm else "",
            "img": urllib.parse.urljoin(base, im.group(1)) if im else None,
        })
    return holes

HOLE_KEY = re.compile(r"(hole|hol|course|cos|yardage|공략)", re.I)
HOLE_NUM = re.compile(r"(?:hole|hol|h)[ _-]?0*(\d{1,2})\b", re.I)

def hole_no_of(src, mode="strict"):
    """이미지 URL에서 홀 번호 추출
    strict : 파일명이 hole08 / h3 형태일 때만 (오탐 최소)
    loose  : 경로에 hole/course 키워드가 있으면 파일명 숫자를 홀번호로 (course_e09 → 9)
    """
    path = urllib.parse.urlparse(src).path
    stem = os.path.splitext(os.path.basename(path))[0]
    m = HOLE_NUM.search(stem)
    if m:
        n = int(m.group(1))
        return n if 1 <= n <= 27 else None
    if mode == "loose" and HOLE_KEY.search(path):
        nums = re.findall(r"\d{1,2}", stem)
        if len(nums) == 1:
            n = int(nums[0])
            return n if 1 <= n <= 27 else None
    return None
PAR_RE = re.compile(r"(?:PAR|파)\s*[:\s]?\s*([3-6])\b", re.I)
KO_SENT = re.compile(r"[가-힣][^<>]{18,300}?[.다요]")

def parse_generic(html, base, mode="strict"):
    """범용 폴백: 홀 번호가 담긴 이미지 주변 문맥에서 파/거리/공략 추출"""
    imgs = list(re.finditer(r'<img[^>]+src="([^"]+\.(?:jpg|jpeg|png))"', html, re.I))
    cand = {}
    for m in imgs:
        src = m.group(1)
        no = hole_no_of(src, mode)
        if no is None or no in cand:   # 같은 홀 번호는 첫 번째(대표) 이미지만
            continue
        s, e = max(0, m.start() - 2200), min(len(html), m.end() + 2200)
        block = html[s:e]
        pm = PAR_RE.search(strip_tags(block))
        if not pm:
            continue
        txt = strip_tags(block)
        # 거리: 티 색상/이름 뒤 숫자, 없으면 80~700 범위 숫자들
        tees = []
        for c, v in re.findall(r'class="(\w+)"[^>]*>\s*</?\w*>?\s*([\d,]{2,5})', block):
            if c.lower() in TEE_COLOR_KO:
                n = int(v.replace(",", ""))
                if 60 <= n <= 700:
                    tees.append({"name": TEE_COLOR_KO[c.lower()], "m": n})
        nums = [int(x) for x in re.findall(r"\b(\d{2,3})\s*(?:m|M|미터)\b", txt)]
        nums = [n for n in nums if 60 <= n <= 700]
        tip = ""
        for s2 in KO_SENT.findall(txt):
            s2 = s2.strip()
            if len(s2) > len(tip) and not re.search(r"(예약|회원|고객센터|주소|전화|이용약관|개인정보)", s2):
                tip = s2
        cand[no] = {
            "no": no, "par": int(pm.group(1)), "hdcp": None,
            "tees": tees, "len": (tees[0]["m"] if tees else (max(nums) if nums else 0)),
            "tip": tip if len(tip) >= 20 else "",
            "img": urllib.parse.urljoin(base, src),
        }
    return list(cand.values())

PARSERS = [("holebox", parse_holebox), ("tabpane", parse_tabpane),
           ("holeinfo", parse_holeinfo),
           ("generic", parse_generic),
           ("generic-loose", lambda h, b: parse_generic(h, b, "loose"))]

def resolve_dir(club):
    """분석 리포트의 클럽명 → 실제 수집 폴더명"""
    d = os.path.join(AUTO, club)
    if os.path.isdir(d):
        return club
    key = norm_club(club)
    for name in os.listdir(AUTO):
        if norm_club(name) == key:
            return name
    for name in os.listdir(AUTO):
        n = norm_club(name)
        if key and (key in n or n in key):
            return name
    return club

# ── 코스 페이지 후보 찾기 ─────────────────────────────────────
LINK_KW = re.compile(r"(course|cos|hole|공략|코스)", re.I)
def candidate_pages(club, seed):
    urls, seen = [], set()
    meta_p = os.path.join(AUTO, club, "meta.json")
    if os.path.exists(meta_p):
        meta = json.load(open(meta_p, encoding="utf-8"))
        seed = meta.get("seed", seed)
        for u in meta.get("pages", {}).values():
            pr = urllib.parse.urlparse(u)
            n = pr.scheme + "://" + pr.netloc + re.sub(r"/{2,}", "/", pr.path) + (("?" + pr.query) if pr.query else "")
            if n not in seen:
                seen.add(n); urls.append(n)
    # 시드에서 코스 링크 추가 발굴 (JS 내비 포함)
    try:
        html = fetch(seed)
        host = "{0.scheme}://{0.netloc}".format(urllib.parse.urlparse(seed))
        for m in re.finditer(r'["\'](/[^"\']*(?:course|cos|hole)[^"\']*\.(?:asp|php|html?|jsp)[^"\']*)["\']', html, re.I):
            n = urllib.parse.urljoin(host, m.group(1))
            if n not in seen:
                seen.add(n); urls.append(n)
    except Exception:
        pass
    return [u for u in urls if LINK_KW.search(u) or u.rstrip("/") == seed.rstrip("/")][:25]

BAD_NAME = re.compile(r"^\d+$|^(코스|course)\d*$", re.I)

PERHOLE_URL = re.compile(r"/(?:hole|h)0*(\d{1,2})(?:[_-]?\w*)?\.(?:asp|php|html?|jsp|do)", re.I)

def parse_one_hole(html, url, no):
    """홀 1개짜리 페이지에서 파/거리/공략/이미지 추출"""
    txt = strip_tags(html)
    pm = re.search(r"(?:PAR|Par|파)\s*[:\s]?\s*([3-6])\b", txt)
    if not pm:
        return None
    tees = []
    for c, v in re.findall(r'class="(\w+)"[^>]*>\s*</?\w*>?\s*([\d,]{2,5})', html):
        if c.lower() in TEE_COLOR_KO:
            n = int(v.replace(",", ""))
            if 60 <= n <= 700:
                tees.append({"name": TEE_COLOR_KO[c.lower()], "m": n})
    nums = [int(x) for x in re.findall(r"\b(\d{2,3})\s*(?:m|M|미터)\b", txt) if 60 <= int(x) <= 700]
    # 이미지: 홀 번호가 들어간 것 우선
    img = None
    srcs = re.findall(r'<img[^>]+src="([^"]+\.(?:jpg|jpeg|png))"', html, re.I)
    for s in srcs:
        if hole_no_of(s, "loose") == no:
            img = s; break
    if not img:
        for s in srcs:
            if HOLE_KEY.search(urllib.parse.urlparse(s).path) and not re.search(r"(logo|btn|icon|bg_|banner)", s, re.I):
                img = s; break
    tip = ""
    for s2 in KO_SENT.findall(txt):
        s2 = s2.strip()
        if len(s2) > len(tip) and not re.search(r"(예약|회원|고객센터|주소|전화|이용약관|개인정보|저작권|Copyright)", s2):
            tip = s2
    return {"no": no, "par": int(pm.group(1)), "hdcp": None, "tees": tees,
            "len": (tees[0]["m"] if tees else (max(nums) if nums else 0)),
            "tip": tip if len(tip) >= 20 else "",
            "img": urllib.parse.urljoin(url, img) if img else None}

def collect_per_hole(seed, pages):
    """홀마다 개별 페이지인 사이트 → 코스별로 묶어 홀 목록 구성
    반환: [(코스명, [holes...])]"""
    groups = {}
    for u in pages:
        m = PERHOLE_URL.search(urllib.parse.urlparse(u).path)
        if not m:
            continue
        no = int(m.group(1))
        if not (1 <= no <= 27):
            continue
        key = re.sub(PERHOLE_URL.pattern, "", urllib.parse.urlparse(u).path, flags=re.I)  # 디렉터리 = 코스
        groups.setdefault(key, {})[no] = u
    out = []
    for key, m in groups.items():
        # 수집된 URL이 1개뿐이어도 홀 번호만 바꿔 나머지를 탐색 (사이트 대부분이 규칙적)
        sample_no, sample_url = sorted(m.items())[0]
        start = 10 if sample_no >= 10 else 1
        for n in range(start, start + 18):
            if n in m:
                continue
            for pat in (f"{n:02d}", str(n)):
                cand = re.sub(r"(hole|h)0*\d{1,2}", lambda mm: mm.group(1) + pat, sample_url, flags=re.I, count=1)
                if cand != sample_url and cand not in m.values():
                    m[n] = cand
                    break
        holes = []
        miss = 0
        for no in sorted(m):
            try:
                h = parse_one_hole(fetch(m[no]), m[no], no)
            except Exception:
                h = None
            if h:
                holes.append(h)
                miss = 0
            else:
                miss += 1
                if miss >= 3 and len(holes) >= 6:   # 연속 실패 = 홀 끝
                    break
                if miss >= 5:
                    break
            time.sleep(0.25)
        if len(holes) >= 6:
            seg = [s for s in key.strip("/").split("/") if s and not re.match(r"^(course|pagesite|html?|kr|ko)$", s, re.I)]
            cname = seg[-1].upper() if seg else "OUT"
            cname = {"ONE": "OUT", "TWO": "IN", "1": "OUT", "2": "IN"}.get(cname, cname)
            out.append((cname, holes))
    return out

def course_name_of(url, html, idx, holes=None):
    """코스명: 활성 탭 → URL 슬러그 → 홀 번호 기반(OUT/IN) 순"""
    for pat in (r'<li class="on"><a[^>]*>([^<]{2,15})</a>',
                r'class="[^"]*(?:on|active|current)[^"]*"[^>]*>\s*([가-힣A-Za-z]{2,10})\s*코스'):
        m = re.search(pat, html)
        if m:
            n = re.sub(r"\s*코스$", "", m.group(1).strip())
            if n and not BAD_NAME.match(n):
                return n
    m = re.search(r"course[_-]?([A-Za-z가-힣]{2,12})\.(?:asp|php|html?|jsp)", url)
    if m:
        w = m.group(1)
        if not BAD_NAME.match(w):
            return {"out": "OUT", "in": "IN"}.get(w.lower(), w.upper())
    if holes:
        first = min(h["no"] for h in holes)
        return "OUT" if first == 1 else ("IN" if first == 10 else f"코스{idx+1}")
    return f"코스{idx+1}"

PAR_RANGE = {3: (70, 260), 4: (230, 470), 5: (380, 650), 6: (500, 780)}

def sanitize_distance(h):
    """상식 범위를 벗어난 거리는 버림 — 틀린 정보 노출 방지"""
    rng = PAR_RANGE.get(h.get("par"))
    if not rng:
        h["len"] = 0; h["tees"] = []
        return h
    lo, hi = rng
    tees = [t for t in (h.get("tees") or [])
            if isinstance(t.get("m"), int) and lo * 0.75 <= t["m"] <= hi * 1.1]
    tees.sort(key=lambda t: -t["m"])
    h["tees"] = tees
    L = h.get("len") or 0
    if tees:
        h["len"] = tees[0]["m"]
    elif not (lo <= L <= hi):
        h["len"] = 0
    return h

# ── 메인 처리 ─────────────────────────────────────────────────
def build(club, dbname, slug, write=False, verbose=True):
    res = {"club": club, "db": dbname, "slug": slug, "ok": False, "reason": "", "parser": "",
           "courses": 0, "holes": 0, "official": official_holes(dbname), "tip": 0}
    seed = ""
    club = resolve_dir(club)
    meta_p = os.path.join(AUTO, club, "meta.json")
    if os.path.exists(meta_p):
        seed = json.load(open(meta_p, encoding="utf-8")).get("seed", "")
    if not seed:
        res["reason"] = "수집 시드 없음"; return res

    found = []          # (코스명, 파서, holes)
    sigs = set()
    pages = candidate_pages(club, seed)

    # 홀마다 개별 페이지인 사이트 먼저 시도
    try:
        for cname, holes in collect_per_hole(seed, pages):
            holes = [sanitize_distance(h) for h in holes if 3 <= h["par"] <= 6]
            holes.sort(key=lambda h: h["no"])
            sig = tuple((h["no"], h["par"]) for h in holes)
            if sig in sigs:
                continue
            sigs.add(sig)
            found.append((cname, "perhole", holes))
    except Exception:
        pass

    for i, url in enumerate(pages):
        try:
            html = fetch(url)
        except Exception:
            continue
        # 모든 파서를 시도해 '연속된 홀 세트'를 만드는 최선의 결과 채택
        best = None
        for pname, fn in PARSERS:
            try:
                hs = fn(html, url)
            except Exception:
                continue
            hs = [h for h in hs if h["no"] and 3 <= h["par"] <= 6]
            if len(hs) < 6:
                continue
            hs.sort(key=lambda h: h["no"])
            nums = [h["no"] for h in hs]
            contiguous = nums == list(range(nums[0], nums[0] + len(nums))) and nums[0] in (1, 10, 19)
            score = (1 if contiguous else 0, len(hs))
            if best is None or score > best[0]:
                best = (score, pname, hs)
        if best:
            pname, holes = best[1], best[2]
        else:
            continue
        for _ in (1,):
            sig = tuple((h["no"], h["par"]) for h in holes)
            if sig in sigs:
                continue
            # 같은 홀 번호 구성 + 파 70% 이상 동일 → 같은 코스의 다른 URL로 간주
            dup = False
            for prev in sigs:
                if [x[0] for x in prev] == [x[0] for x in sig]:
                    same = sum(1 for a, b in zip(prev, sig) if a[1] == b[1])
                    if same / max(1, len(sig)) >= 0.7:
                        dup = True
                        break
            if dup:
                continue
            sigs.add(sig)
            holes = [sanitize_distance(h) for h in holes]
            found.append((course_name_of(url, html, len(found), holes), pname, holes))
            break
        time.sleep(0.4)

    if not found:
        res["reason"] = "홀 정보 파싱 실패(지원 유형 아님)"; return res

    res["parser"] = found[0][1]
    total = sum(len(h) for _, _, h in found)
    res["courses"], res["holes"] = len(found), total
    res["tip"] = sum(1 for _, _, hs in found for h in hs if h["tip"])

    # 검증 1: 홀 번호 연속성
    for cname, _, hs in found:
        nums = [h["no"] for h in hs]
        if nums != list(range(1, len(nums) + 1)) and nums != list(range(10, 10 + len(nums))):
            res["reason"] = f"{cname} 홀 번호 불연속 {nums}"; return res
    # 검증 2: 공식 홀 수 일치
    if res["official"] and total != res["official"]:
        res["reason"] = f"홀 수 불일치 (파싱 {total} vs 공식 {res['official']})"; return res
    if not res["official"] and total % 9 != 0:
        res["reason"] = f"홀 수가 9의 배수 아님 ({total})"; return res
    # 검증 3: 이미지 존재
    missing = [f"{c}{h['no']}" for c, _, hs in found for h in hs if not h.get("img")]
    if missing:
        res["reason"] = f"홀맵 이미지 없음 {missing[:4]}"; return res

    # 검증 4: 9홀당 파 합계 상식 (파3 전용 코스는 예외)
    for cname, _, hs in found:
        if len(hs) < 9:
            continue
        pars = [h["par"] for h in hs]
        per9 = len(hs) / 9
        if pars.count(3) / per9 >= 6:      # 파3 코스로 간주 — 통과
            continue
        s = sum(pars) / per9
        if not (33 <= s <= 39):
            res["reason"] = f"{cname} 9홀 파 합계 {s:.0f} 비정상"; return res

    # 검증 5: 다른 구장으로 이미 등록된 동일 출처인지 (중복 방지)
    for f in glob.glob(os.path.join(ROOT, "coursedata", "homepages", "*", "parsed.json")):
        try:
            d0 = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        if d0.get("course") == dbname:
            continue
        if d0.get("sourceUrl") and urllib.parse.urlparse(d0["sourceUrl"]).netloc == urllib.parse.urlparse(seed).netloc:
            res["reason"] = f"이미 등록된 사이트와 동일 도메인({d0['course']}) — 중복 의심"; return res

    if not write:
        res["ok"] = True; res["reason"] = "검증 통과(미기록)"; return res

    # ── 실제 등록 ──
    imgdir = os.path.join(ROOT, "holeimg", slug)
    os.makedirs(imgdir, exist_ok=True)
    # 코스명이 겹치면 A/B/C로 구분 (이미지 파일명 충돌 방지 위해 등록 전에 확정)
    names = [c[0] for c in found]
    if len(set(names)) < len(names):
        found = [(chr(ord("A") + i), p, h) for i, (n, p, h) in enumerate(found)]

    courses = []
    for ci, (cname, _, hs) in enumerate(found):
        out_holes = []
        base_slug = re.sub(r"[^0-9A-Za-z가-힣]", "", cname).lower() or "c"
        cslug = f"{ci+1}{base_slug}"          # 코스 인덱스 접두 → 코스 간 파일 충돌 원천 차단
        for h in hs:
            raw = os.path.join(imgdir, f"_raw{cslug}{h['no']}")
            try:
                open(raw, "wb").write(fetch(h["img"], binary=True))
                with Image.open(raw) as im:
                    w0, h0 = im.size
                if h0 < w0 * 0.9:      # 가로형이면 홀맵 아님
                    os.remove(raw)
                    res["reason"] = f"{cname}{h['no']} 이미지가 홀맵 형태 아님"; return res
                out = os.path.join(imgdir, f"{cslug}{h['no']}.jpg")
                crop_map(raw, out, 0, keep="all")
                os.remove(raw)
            except Exception as e:
                res["reason"] = f"{cname}{h['no']} 이미지 처리 실패: {e}"; return res
            e = {"no": h["no"], "par": h["par"], "img": f"holeimg/{slug}/{cslug}{h['no']}.jpg"}
            if h.get("tip"): e["tip"] = h["tip"]
            if h.get("tees"): e["tees"] = h["tees"]
            if h.get("len"): e["len"] = h["len"]
            if h.get("hdcp"): e["hdcp"] = h["hdcp"]
            out_holes.append(e)
            time.sleep(0.25)
        courses.append({"name": cname, "holes": out_holes})
    data = {"course": dbname, "source": f"{dbname} 공식 홈페이지", "sourceUrl": seed, "courses": courses}
    dst = os.path.join(ROOT, "coursedata", "homepages", slug)
    os.makedirs(dst, exist_ok=True)
    json.dump(data, open(os.path.join(dst, "parsed.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    res["ok"] = True; res["reason"] = "등록 완료"
    return res

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--club"); ap.add_argument("--db"); ap.add_argument("--slug")
    ap.add_argument("--batch", action="store_true")
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--grades", default="ABC")
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()

    if a.club:
        r = build(a.club, a.db or a.club, a.slug or re.sub(r"[^a-z0-9]", "", a.club.lower()), a.write)
        print(json.dumps(r, ensure_ascii=False, indent=1)); return

    analysis = json.load(open(os.path.join(ROOT, "coursedata", "workfiles", "registrable_analysis.json"), encoding="utf-8"))
    done = {json.load(open(p, encoding="utf-8"))["course"] for p in glob.glob(os.path.join(ROOT, "coursedata", "homepages", "*", "parsed.json"))}
    todo = [r for r in analysis if r["grade"] in a.grades and r["club"] not in done]
    if a.limit:
        todo = todo[:a.limit]
    print(f"대상 {len(todo)}곳 (등급 {a.grades}, 기등록 {len(done)}곳 제외)\n")
    out = []
    for i, r in enumerate(todo):
        club = r["club"]
        # 슬러그: 영문 표기 우선, 없으면 도메인명 사용 (kr1234 같은 무의미 이름 방지)
        slug = re.sub(r"[^a-z0-9]", "", re.sub(r"[가-힣]", "", club).lower())
        if len(slug) < 3:
            mp = os.path.join(AUTO, resolve_dir(club), "meta.json")
            if os.path.exists(mp):
                host = urllib.parse.urlparse(json.load(open(mp, encoding="utf-8")).get("seed", "")).netloc
                slug = re.sub(r"[^a-z0-9]", "", host.replace("www.", "").split(".")[0].lower())
        if len(slug) < 3:
            slug = "club" + str(abs(hash(club)) % 10000)
        try:
            res = build(club, club, slug, a.write, verbose=False)
        except Exception as e:
            res = {"club": club, "ok": False, "reason": f"예외: {e}", "parser": "", "holes": 0,
                   "courses": 0, "official": None, "tip": 0, "slug": slug, "db": club}
        out.append(res)
        mark = "✅" if res["ok"] else "—"
        print(f"[{i+1}/{len(todo)}] {mark} {club}: {res['reason']} ({res.get('parser','')} {res.get('holes',0)}홀)", flush=True)
    p = os.path.join(ROOT, "coursedata", "workfiles", "universal_build_report.json")
    json.dump(out, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    ok = sum(1 for r in out if r["ok"])
    print(f"\n성공 {ok} / {len(out)} → {p}")

if __name__ == "__main__":
    main()
