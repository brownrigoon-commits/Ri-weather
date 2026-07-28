# -*- coding: utf-8 -*-
"""
클리브랜드 웨지 스펙 수집 — 공식 도메인.

주의: clevelandgolf.com 은 us.dunlopsports.com/cleveland-golf 로 리다이렉트된다
      (던롭스포츠가 클리브랜드골프 공식 운영). 그래서 최종 도메인에서 수집.

주의2: 스펙 표에 지역 변형 셀이 섞여 있다.
      class="au-only"  -> 호주 전용 값
      class="au-remove"-> 호주에서만 제거(=미국/기타 지역 값)
      미국 사이트 기준값을 쓰고, au 전용 값은 length_au_in 에 따로 보존한다.

원칙: 페이지에서 읽지 못한 값은 null. 추정/보간 없음.
출력: coursedata/clubspecs/cleveland_wedge.json
"""
import sys, io, os, re, json, time, urllib.request, urllib.error, gzip, zlib, html as H
from datetime import date

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

BASE = "https://us.dunlopsports.com"
# (모델라인, URL, 성별)  — 성별은 페이지가 속한 공식 카테고리에서만 따온다
PAGES = [
    ("RTZ", BASE + "/cleveland-golf/clubs/wedges/rtz/rtz-tour-satin-wedge/MRTZTS.html", "men"),
    ("CBZ", BASE + "/cleveland-golf/clubs/wedges/cbz-tour-satin-wedge/MCBZTS.html", "men"),
    ("RTX 6 ZipCore", BASE + "/cleveland-golf/clubs/wedges/rtx-6-zipcore/rtx-6-zipcore-tour-satin-wedge/MRTX6ZCTS.html", "men"),
    ("Smart Sole Full-Face", BASE + "/cleveland-golf/clubs/wedges/smart-sole-full-face/smart-sole-full-face-wedge/MSMARTSOLEFF.html", "men"),
    ("Women's CBZ", BASE + "/cleveland-golf/clubs/wedges/womens-wedges/womens-cbz-tour-satin-wedge/MWCBZTS.html", "women"),
    ("Women's Smart Sole Full-Face", BASE + "/cleveland-golf/clubs/wedges/womens-wedges/womens-smart-sole-full-face-wedge/MWSMARTSOLEFF.html", "women"),
    ("Women's CBX 4 ZipCore", BASE + "/cleveland-golf/sale/wedges/womens-cbx-4-zipcore-wedges/womens-cbx-4-zipcore-wedge/MWCBX4ZC.html", "women"),
]
UA_HDRS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "close",
}
OUT = r"C:/Users/PC/Desktop/Ri-weather/coursedata/clubspecs/cleveland_wedge.json"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def make_driver():
    o = Options()
    o.add_argument("--headless=new")
    o.add_argument("--window-size=1400,1000")
    o.add_argument(f"--user-agent={UA}")
    o.add_argument("--disable-gpu")
    o.add_argument("--no-sandbox")
    o.add_argument("--disable-blink-features=AutomationControlled")
    o.add_experimental_option("excludeSwitches", ["enable-automation"])
    d = webdriver.Chrome(options=o)
    d.set_page_load_timeout(60)
    return d


def fetch_urllib(url):
    """dunlopsports 는 스펙표를 서버렌더링한다 -> urllib 로 충분(셀레늄보다 빠름)."""
    req = urllib.request.Request(url, headers={"User-Agent": UA, **UA_HDRS})
    with urllib.request.urlopen(req, timeout=45) as r:
        b = r.read()
        e = r.headers.get("Content-Encoding", "")
        if "gzip" in e:
            b = gzip.decompress(b)
        elif "deflate" in e:
            b = zlib.decompress(b, -zlib.MAX_WBITS)
        return b.decode("utf-8", "replace")


def txt(s):
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", H.unescape(s)).strip()


def num(s):
    if not s:
        return None
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    return float(m.group()) if m else None


def split_cells(row_html):
    """(텍스트, 셀 자신의 class 토큰집합) 목록 반환.

    주의: class 는 반드시 <td>/<th> **여는 태그**에서만 읽는다.
    내부 <span class="us-au-only">/LH</span> 같은 자식 클래스를 셀 클래스로
    잘못 잡으면 미국 기준 행이 통째로 버려진다.
    """
    out = []
    for m in re.finditer(r"<(t[hd])\b([^>]*)>(.*?)</\1>", row_html, re.S | re.I):
        attrs, inner = m.group(2), m.group(3)
        cls = re.search(r'class="([^"]*)"', attrs)
        toks = set(cls.group(1).split()) if cls else set()
        out.append((txt(inner), toks))
    return out


# 모델라인마다 헤더 표기가 제각각이다.
#   RTZ            : LOFT GRIND BOUNCE GROOVES HAND LIE LENGTH† SW
#   CBZ            : LOFT SOLE GRIND BOUNCE ... STEEL SW / GRAPHITE SW
#   RTX 6 ZipCore  : ... SWING WEIGHT
#   Smart Sole FF  : MODEL LOFT HAND LIE LENGTH ST SWING WEIGHT / GR SWING WEIGHT  (그라인드·바운스 없음)
#   W CBX 4 ZipCore: LOFT SOLE BOUNCE ... SWING WEIGHT
HEAD_ALIAS = {
    "sole grind": "grind",
    "sole": "grind",
    "swing weight": "sw",
    "steel sw": "sw_steel",
    "st swing weight": "sw_steel",
    "graphite sw": "sw_graphite",
    "gr swing weight": "sw_graphite",
}


def norm_head(h):
    """'LENGTH †' -> 'length', 'SOLE GRIND' -> 'grind' 등"""
    k = re.sub(r"[^a-z0-9 ]+", "", h.lower()).strip()
    k = re.sub(r"\s+", " ", k)
    return HEAD_ALIAS.get(k, k)


def parse_specs(doc, line):
    """웨지 스펙 표 파싱.

    'loft' 열이 있는 표만 채택한다. GRIND/BOUNCE 가 없는 라인(Smart Sole 등)도 있으므로
    필수로 요구하지 않고, 없으면 null 로 남긴다(추정 금지).
    'LOFT ADJUSTMENT' 같은 열은 norm_head 결과가 'loft' 와 정확히 같지 않으므로 걸리지 않는다.
    """
    items = []
    for table in re.findall(r"<table\b.*?</table>", doc, re.S | re.I):
        rows = re.findall(r"<tr\b.*?</tr>", table, re.S | re.I)
        if not rows:
            continue
        headl = [norm_head(t) for t, _ in split_cells(rows[0])]
        if "loft" not in headl:
            continue

        for r in rows[1:]:
            cells = split_cells(r)
            # 호주 전용 셀 분리 (미국 사이트 기준값을 채택)
            au = [t for t, c in cells if "au-only" in c]
            main = [t for t, c in cells if "au-only" not in c]
            if len(main) < 3 or not main[0]:
                continue
            if len(main) != len(headl):
                print(f"      [WARN] {line} 열 개수 불일치 head={len(headl)} row={len(main)}: {main}")
                continue
            rec = dict(zip(headl, main))          # 헤더와 1:1 정렬
            loft = num(rec.get("loft"))
            if loft is None:
                continue
            sw = rec.get("sw") or rec.get("sw_steel")
            # 이름 구성 요소: 로프트 + (그라인드 또는 모델코드)
            tail = rec.get("grind") or rec.get("model") or ""
            items.append({
                "model": f"Cleveland {line} {rec.get('loft')} {tail}".strip(),
                "model_line": line,
                "model_code": rec.get("model") or None,   # Smart Sole 의 C/G/S 등
                "loft_deg": loft,
                "grind": rec.get("grind") or None,
                "bounce_deg": num(rec.get("bounce")),
                "grooves": rec.get("grooves") or None,
                "hand": rec.get("hand") or None,
                "lie_deg": num(rec.get("lie")),
                "length_in": num(rec.get("length")),
                "swingweight": sw or None,
                "swingweight_graphite": rec.get("sw_graphite") or None,
                "length_au_in": num(au[0]) if au else None,
                "loft_raw": rec.get("loft"),
                "bounce_raw": rec.get("bounce"),
                "length_raw": rec.get("length"),
            })
        if items:
            break
    return items


def parse_grinds(doc):
    """Turf Cond. 표 + 직전 alt='XXX Sole Grind' 라벨"""
    out = []
    for m in re.finditer(r"<table\b.*?</table>", doc, re.S | re.I):
        table = m.group()
        rows = re.findall(r"<tr\b.*?</tr>", table, re.S | re.I)
        if not rows:
            continue
        head = [t.lower() for t, _ in split_cells(rows[0])]
        if not head or head[0] != "turf cond.":
            continue
        pre = doc[max(0, m.start() - 3000):m.start()]
        alts = re.findall(r'alt="([^"]*Sole Grind[^"]*)"', pre)
        name = alts[-1].replace(" Sole Grind", "").strip() if alts else None
        if len(rows) < 2:
            continue
        vals = [t for t, _ in split_cells(rows[1])]
        rec = dict(zip(head, vals))
        out.append({
            "grind": name,
            "turf_condition": rec.get("turf cond."),
            "divot_size": rec.get("divot size"),
            "attack_angle": rec.get("attack angle"),
            "sole_design": rec.get("sole design"),
            "face_shape": rec.get("face shape"),
            "lofts_available": rec.get("lofts"),
            "bounce_raw": rec.get("bounce"),
        })
    return out


def parse_kv_table(doc, first_col):
    """헤더 첫 칸이 first_col 인 표 -> dict 리스트"""
    out = []
    for table in re.findall(r"<table\b.*?</table>", doc, re.S | re.I):
        rows = re.findall(r"<tr\b.*?</tr>", table, re.S | re.I)
        if not rows:
            continue
        head = [t.lower() for t, _ in split_cells(rows[0])]
        if not head or head[0] != first_col:
            continue
        for r in rows[1:]:
            vals = [t for t, _ in split_cells(r)]
            if vals and vals[0]:
                out.append(dict(zip(head, vals)))
    return out


def fetch_selenium(url):
    d = make_driver()
    try:
        d.get(url)
        time.sleep(4)
        for _ in range(6):
            d.execute_script("window.scrollBy(0, document.body.scrollHeight/6);")
            time.sleep(0.7)
        time.sleep(1.5)
        return d.page_source
    finally:
        d.quit()


def main():
    items, grinds, shafts, grips, srcs = [], [], [], [], []
    for line, url, gender in PAGES:
        doc, how = None, None
        try:
            doc, how = fetch_urllib(url), "urllib"
        except Exception as e:
            print(f"[warn] {line} urllib 실패({type(e).__name__}) -> 셀레늄 재시도")
        if doc is not None and not parse_specs(doc, line):
            print(f"[warn] {line} urllib 응답에 스펙표 없음 -> 셀레늄 재시도")
            doc = None
        if doc is None:
            try:
                doc, how = fetch_selenium(url), "selenium"
            except Exception as e:
                print(f"[ERR] {line} {url} :: {type(e).__name__}: {e}")
                srcs.append({"model_line": line, "url": url, "items": 0,
                             "error": f"{type(e).__name__}: {e}"})
                continue

        got = parse_specs(doc, line)
        for g in got:
            g["gender"] = gender
        items.extend(got)
        srcs.append({"model_line": line, "url": url, "gender": gender,
                     "items": len(got), "fetched_via": how})
        if line == "RTZ":
            grinds = parse_grinds(doc)
            for s in parse_kv_table(doc, "flex"):
                shafts.append({"model_line": line, **s})
            for g in parse_kv_table(doc, "size"):
                grips.append({"model_line": line, **g})
        if not got:
            print(f"[{line}] [MISS] 스펙표 파싱 0건  {url}")
        else:
            print(f"[{line}] items={len(got)} via={how}  {url}")

    data = {
        "source": PAGES[0][1],
        "sources": srcs,
        "fetched": date.today().isoformat(),
        "brand": "Cleveland Golf",
        "brand_ko": "클리브랜드 골프",
        "category": "wedge",
        "note": ("clevelandgolf.com 은 us.dunlopsports.com/cleveland-golf 로 리다이렉트됨(공식). "
                 "스펙표에 호주 전용 셀(au-only)이 섞여 있어 미국 기준값을 쓰고 "
                 "호주 길이는 length_au_in 에 별도 보존. 표에 없는 값은 null. "
                 "스펙표가 서버렌더링이라 urllib 우선, 실패 시에만 셀레늄으로 재시도 "
                 "(항목별 수집방식은 sources[].fetched_via). "
                 "gender 는 페이지가 속한 공식 카테고리(womens-wedges 등)에서만 판정."),
        "grind_profiles": grinds,
        "shaft_options": shafts,
        "grip_options": grips,
        "items": items,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    keys = ("loft_deg", "bounce_deg", "grind", "lie_deg", "length_in", "swingweight", "hand")
    filled = {k: sum(1 for it in items if it.get(k) is not None) for k in keys}
    byline = {}
    for it in items:
        byline[it["model_line"]] = byline.get(it["model_line"], 0) + 1
    print(f"[save] {OUT}")
    print(f"[stat] items={len(items)} grinds={len(grinds)} shafts={len(shafts)} grips={len(grips)}")
    print(f"[stat] 모델라인별={byline}")
    print(f"[stat] filled={filled}")
    for it in items[:3]:
        print("   ", it)


if __name__ == "__main__":
    main()
