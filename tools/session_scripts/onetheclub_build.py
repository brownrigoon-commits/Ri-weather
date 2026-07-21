# -*- coding: utf-8 -*-
"""원더클럽(onetheclub.com) 계열 구장 등록: 신라CC / 파주CC / 클럽72
- 코스 페이지 HTML + course_{slug}.js 의 par_list/hdcp_list/sum_list 파싱 (원문 그대로)
- 홀맵 이미지 다운로드 → 표준 크롭(keep=all: 범례·그린분석 등 공식 정보 유지)
- 검증: 홀 수, 파 값 범위, 배열 길이 일치
사용: python tools/session_scripts/onetheclub_build.py <shilla|paju|club72>
"""
import json, os, re, sys, time, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from crop_map_only import crop_map

BASE = "https://www.onetheclub.com"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"

# img: (패턴, 확장자) — {slug}=코스 슬러그, {n}=홀번호
CONFIG = {
    "shilla": {
        "db명": "신라CC", "dir": "shilla",
        "source": "신라CC 공식 홈페이지(원더클럽)",
        "courses": [("east", "동"), ("south", "남"), ("west", "서")],
        "img": "/static/pc/@company/shilla/images/sub/course/{slug}-{n}-1.jpg",
    },
    "paju": {
        "db명": "파주CC", "dir": "paju",
        "source": "파주CC 공식 홈페이지(원더클럽)",
        "courses": [("east", "동"), ("west", "서")],
        "img": "/static/pc/@company/paju/images/sub/course/{slug}-{n}.jpg",
    },
    "club72": {
        "db명": None,  # 골프DB에 스카이72 바다/하늘 두 항목으로 존재 → 별도 매핑
        "dir": "club72",
        "source": "클럽72 공식 홈페이지(원더클럽)",
        "courses": [("ocean", "오션"), ("sky", "하늘"), ("lake", "레이크"), ("classic", "클래식"), ("dunes", "듄스")],
        "img": "/static/pc/@company/club72/images/sub/course/{slug}-{n}.png",
        "img_override": {
            "sky": "/static/pc/@company/club72/images/sub/course/sky-{n}-1.png",
            "dunes": "/static/pc/@company/club72/images/sub/course/dunes-{n}-1.png",
        },
    },
}

def fetch(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ko"})
    with urllib.request.urlopen(req, timeout=25) as r:
        data = r.read()
    return data if binary else data.decode("utf-8", errors="ignore")

def js_array(js, name):
    """var name = [ ... ] 의 항목들을 문자열 리스트로 추출 (따옴표 혼용·중첩 대응)"""
    m = re.search(re.escape(name) + r"\s*=\s*\[", js)
    if not m:
        return None
    i = m.end()
    depth = 1
    items, cur, quote = [], "", None
    while i < len(js) and depth > 0:
        c = js[i]
        if quote:
            if c == quote:
                quote = None
            else:
                cur += c
        elif c in "'\"":
            quote = c
        elif c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0 and cur.strip():
                items.append(cur.strip())
        elif c == "," and depth == 1:
            items.append(cur.strip())
            cur = ""
        elif depth == 1 and not c.isspace():
            cur += c
        i += 1
    return items

def clean(s):
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("\r", "").replace("&nbsp;", " ")
    s = re.sub(r"\n{2,}", "\n", s)
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()

def build(club):
    cfg = CONFIG[club]
    imgdir = os.path.join(ROOT, "holeimg", cfg["dir"])
    os.makedirs(imgdir, exist_ok=True)
    courses = []
    errors = []
    for slug, cname in cfg["courses"]:
        js = fetch(f"{BASE}/static/pc/@company/{club}/js/course_{slug}.js")
        pars = js_array(js, "par_list")
        hdcps = js_array(js, "hdcp_list")
        sums = js_array(js, "sum_list")
        names2 = js_array(js, "name2_list")
        lefts = js_array(js, "left_list")    # 듄스(파3 코스): L/R 그린 거리
        rights = js_array(js, "right_list")
        if not pars:
            errors.append(f"{slug}: JS 배열 없음")
            continue
        if sums and len(pars) != len(sums):
            errors.append(f"{slug}: 배열 길이 불일치 par{len(pars)} sum{len(sums)}")
            continue
        holes = []
        for n in range(1, len(pars) + 1):
            par = int(pars[n - 1])
            if par not in (3, 4, 5):
                errors.append(f"{slug}{n}: 파 이상 {par}")
                continue
            pattern = cfg.get("img_override", {}).get(slug, cfg["img"])
            url = BASE + pattern.format(slug=slug, n=n)
            ext = os.path.splitext(url)[1]
            raw = os.path.join(imgdir, f"_raw_{slug}{n}{ext}")
            out = os.path.join(imgdir, f"{slug}{n}.jpg")
            try:
                if not os.path.exists(raw) or os.path.getsize(raw) < 3000:
                    open(raw, "wb").write(fetch(url, binary=True))
                size = crop_map(raw, out, 0, keep="all")
            except Exception as e:
                errors.append(f"{slug}{n}: 이미지 실패 {str(e)[:60]}")
                continue
            tip = clean(sums[n - 1]) if sums else ""
            if names2:
                alias = clean(names2[n - 1])
                if alias:
                    tip = (alias + "\n" + tip).strip()
            hole = {"no": n, "par": par, "img": f"holeimg/{cfg['dir']}/{slug}{n}.jpg"}
            if tip:
                hole["tip"] = tip
            if hdcps:
                hole["hdcp"] = int(hdcps[n - 1])
            if lefts and rights:
                hole["tees"] = [{"name": "L그린", "m": int(lefts[n - 1])},
                                {"name": "R그린", "m": int(rights[n - 1])}]
            holes.append(hole)
            print(f"{cname} {n}홀 파{par} {size} | {tip[:28]}")
            time.sleep(0.4)
        courses.append({"name": cname, "holes": holes})
    total = sum(len(c["holes"]) for c in courses)
    expect = None  # 코스×9
    if errors:
        print("검증 실패/경고:")
        for e in errors:
            print(" ", e)
    return courses, total, errors

if __name__ == "__main__":
    club = sys.argv[1] if len(sys.argv) > 1 else "shilla"
    courses, total, errors = build(club)
    cfg = CONFIG[club]
    if errors or total == 0:
        sys.exit(1)
    if cfg["db명"]:
        out = {"course": cfg["db명"], "source": cfg["source"],
               "sourceUrl": f"{BASE}/{club}/course", "courses": courses}
        dst = os.path.join(ROOT, "coursedata", "homepages", cfg["dir"])
        os.makedirs(dst, exist_ok=True)
        json.dump(out, open(os.path.join(dst, "parsed.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
        print(f"저장: {total}홀 → {dst}\\parsed.json")
    else:
        # club72: 골프DB 이름이 갈라져 있어 별도 저장 (스카이72 바다/하늘)
        json.dump(courses, open(os.path.join(ROOT, "coursedata", "workfiles", "club72_courses.json"),
                                "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"수집만 저장: {total}홀 → workfiles/club72_courses.json (골프DB 매핑 후 등록)")
