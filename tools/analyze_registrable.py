# -*- coding: utf-8 -*-
"""수집 자산 정밀 분석 — 구장별 '홀별 공략 등록 가능성' 판정
서서울/몽베르/더스타휴 수준(홀맵 + 파/거리 + 공략TIP)을 기준으로 평가한다.

판정 등급
  A  즉시등록: 홀 이미지 세트(9/18/27홀) 확보 + 홀정보(파·거리) + 공략TIP → 바로 파이프라인 적용
  B  이미지OK: 홀 이미지 세트는 있으나 공략TIP 미확인 → 등록 가능하나 정보 빈약
  C  부분수집: 홀 이미지가 일부만 (재수집 필요)
  D  텍스트만: 홀정보 텍스트는 있으나 홀맵 이미지 없음
  E  수집실패: 사이트 접속 불가/자료 없음

출력: coursedata/workfiles/registrable_analysis.json
"""
import glob, json, os, re, sys
from collections import Counter, defaultdict
sys.stdout.reconfigure(encoding="utf-8")
try:
    from PIL import Image
except ImportError:
    Image = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUTO = os.path.join(ROOT, "coursedata", "homepages_auto")
GZ = os.path.join(ROOT, "coursedata", "golfzon")

# ── 골프존 공식 홀 수 ──────────────────────────────────────────
def norm(s):
    return re.sub(r"(CC|GC|C\.C|G\.C|컨트리클럽|골프클럽|골프장|골프앤리조트|골프리조트|리조트|컨트리|클럽|\s|·|&)", "", s or "", flags=re.I).lower()

official = {}
for f in glob.glob(os.path.join(GZ, "cc_*.json")):
    try:
        j = json.load(open(f, encoding="utf-8"))
    except Exception:
        continue
    d = j.get("detail", {})
    if d.get("country") != 1:
        continue
    n = norm((j.get("ccName") or "").split(" - ")[0])
    hc = d.get("holeCount")
    if n and hc:
        official[n] = max(official.get(n, 0), hc)

def official_holes(club):
    k = norm(club)
    if k in official:
        return official[k]
    for g, hc in official.items():
        if len(k) >= 3 and (k in g or g in k):
            return hc
    return None

# ── 홀 이미지 판정 ────────────────────────────────────────────
HOLE_PAT = [
    re.compile(r"(?:hole|hol|h)[ _-]?0*(\d{1,2})\b", re.I),
    re.compile(r"(?:course|cos|cs)[ _-]?[a-z]*0*(\d{1,2})[ _-]?", re.I),
    re.compile(r"^0*(\d{1,2})[ _-]?(?:hole|h)\b", re.I),
    re.compile(r"[_-](\d{1,2})[_-]?(?:m|map|yard)\.", re.I),
]
SKIP = re.compile(r"(logo|banner|btn|icon|ico_|bg_|sns|kakao|insta|facebook|blog|quick|top\.|arrow|bullet|visual|main_|popup|thumb_s|slide|_s\.|sample)", re.I)

def hole_numbers(fnames):
    """파일명에서 홀 번호 집합 추출 (패턴별로 가장 많이 잡힌 것 채택)"""
    best = set()
    best_map = {}
    for pat in HOLE_PAT:
        got = {}
        for fn in fnames:
            if SKIP.search(fn):
                continue
            m = pat.search(fn)
            if m:
                n = int(m.group(1))
                if 1 <= n <= 27:
                    got.setdefault(n, fn)
        if len(got) > len(best):
            best = set(got.keys())
            best_map = got
    return best, best_map

def vertical_ratio(path):
    if Image is None:
        return None
    try:
        with Image.open(path) as im:
            w, h = im.size
        return h / w if w else None
    except Exception:
        return None

# ── 텍스트 신호 ───────────────────────────────────────────────
TIP_PAT = re.compile(r"(코스\s*공략|공략\s*(TIP|포인트|법)|홀\s*공략|공략도|플레이\s*팁)")
PAR_PAT = re.compile(r"(PAR\s*[3-5]|파\s*[3-5]홀|Par\s*[3-5])")
TEE_PAT = re.compile(r"(BACK\s*TEE|REGULAR\s*TEE|FRONT\s*TEE|LADY\s*TEE|CHAMPION|블루\s*티|화이트\s*티|레드\s*티|백티)", re.I)
DIST_PAT = re.compile(r"\b\d{2,3}\s*(?:m|M|미터|yards?|야드)\b")

def scan_pages(cdir):
    sig = {"tip": 0, "par": 0, "tee": 0, "dist": 0, "parser": set(), "pages": 0}
    for p in glob.glob(os.path.join(cdir, "pages", "*.html")):
        try:
            t = open(p, encoding="utf-8", errors="ignore").read()
        except Exception:
            continue
        sig["pages"] += 1
        if TIP_PAT.search(t): sig["tip"] += 1
        if PAR_PAT.search(t): sig["par"] += 1
        if TEE_PAT.search(t): sig["tee"] += 1
        sig["dist"] += len(DIST_PAT.findall(t))
        if "course_title" in t and "tab-pane" in t: sig["parser"].add("tabpane")
        if 'class="holeInfo' in t: sig["parser"].add("holeinfo")
        if re.search(r"/course/[a-z]\d\.asp", t): sig["parser"].add("asp_hole")
        if re.search(r"holeSel\(|hole_slide|swiper", t): sig["parser"].add("swiper")
    return sig

def grade(nholes, off, sig, vert_ok):
    """등급 판정"""
    full = off if off else None
    setsize = None
    if nholes >= 27: setsize = 27
    elif nholes >= 18: setsize = 18
    elif nholes >= 9: setsize = 9
    has_set = setsize is not None and (full is None or nholes >= min(full, 9))
    has_info = sig["par"] > 0 or sig["tee"] > 0
    has_tip = sig["tip"] > 0
    if has_set and has_info and has_tip and vert_ok:
        return "A"
    if has_set and (has_info or has_tip):
        return "B"
    if nholes >= 3:
        return "C"
    if sig["par"] or sig["tip"] or sig["dist"] > 20:
        return "D"
    return "E"

rows = []
for meta_p in sorted(glob.glob(os.path.join(AUTO, "*", "meta.json"))):
    cdir = os.path.dirname(meta_p)
    try:
        meta = json.load(open(meta_p, encoding="utf-8"))
    except Exception:
        continue
    club = meta.get("name") or os.path.basename(cdir)
    imgdir = os.path.join(cdir, "img")
    files = [os.path.basename(x) for x in glob.glob(os.path.join(imgdir, "*"))] if os.path.isdir(imgdir) else []
    nums, nmap = hole_numbers(files)
    sig = scan_pages(cdir)
    off = official_holes(club)
    # 세로형(홀맵) 비율 확인 — 샘플 3장
    vert = []
    for n in sorted(nums)[:3]:
        r = vertical_ratio(os.path.join(imgdir, nmap[n]))
        if r:
            vert.append(r)
    vert_ok = bool(vert) and (sum(vert) / len(vert)) > 0.95
    g = grade(len(nums), off, sig, vert_ok)
    rows.append({
        "club": club,
        "grade": g,
        "hole_imgs": len(nums),
        "hole_nums": sorted(nums),
        "official_holes": off,
        "total_imgs": len(files),
        "pages": sig["pages"],
        "tip_pages": sig["tip"],
        "par_pages": sig["par"],
        "tee_pages": sig["tee"],
        "dist_hits": sig["dist"],
        "parser": sorted(sig["parser"]),
        "vertical": round(sum(vert)/len(vert), 2) if vert else None,
        "seed": meta.get("seed", ""),
        "errors": len(meta.get("errors", [])),
    })

rows.sort(key=lambda r: ("ABCDE".index(r["grade"]), -r["hole_imgs"]))
out = os.path.join(ROOT, "coursedata", "workfiles", "registrable_analysis.json")
json.dump(rows, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

c = Counter(r["grade"] for r in rows)
print(f"분석 완료: {len(rows)}개 클럽")
for g in "ABCDE":
    print(f"  {g}등급: {c.get(g,0)}곳")
print("\n=== A등급 (즉시 등록 가능) ===")
for r in rows:
    if r["grade"] == "A":
        print(f"  {r['club']}: 홀이미지 {r['hole_imgs']}장 (공식 {r['official_holes']}홀), 파서 {r['parser']}, TIP {r['tip_pages']}p")
print("\n=== B등급 상위 20 (이미지 세트 확보) ===")
n = 0
for r in rows:
    if r["grade"] == "B" and n < 20:
        print(f"  {r['club']}: 홀이미지 {r['hole_imgs']}장 (공식 {r['official_holes']}홀), 파서 {r['parser']}")
        n += 1
print("\n저장:", out)
