# -*- coding: utf-8 -*-
"""캘러웨이 클럽 스펙 수집 — 제조사 공식 사이트 callawaygolf.com 만 사용.

  python tools/clubspec/callaway.py             # 드라이버 + 아이언 수집 후 저장
  python tools/clubspec/callaway.py --dry       # 저장 없이 확인만
  python tools/clubspec/callaway.py --only drivers

원칙
  1. 공식 제품페이지의 스펙표에서 읽은 값만 넣는다. 못 읽으면 null. 추정 금지.
  2. 항목마다 출처 URL 과 수집일을 남긴다.
  3. callawaygolf.com 공식 도메인 외에는 안 받는다.
  4. 한글 모델명은 만들지 않는다 — 영문 원문 그대로.

저장: coursedata/clubspecs/callaway.json
"""
import json, os, re, sys, time
import html as ihtml
from datetime import date

import requests

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(ROOT, "coursedata", "clubspecs")
OUT = os.path.join(OUT_DIR, "callaway.json")

HOST = "https://www.callawaygolf.com"
OFFICIAL_HOST = "callawaygolf.com"

# (카테고리 URL, 제품 slug 패턴, 우리 분류)
CATS = [
    ("/golf-clubs/drivers/",    r"drivers-20\d\d-[a-z0-9\-]+",  "driver"),
    ("/golf-clubs/iron-sets/",  r"irons-20\d\d-[a-z0-9\-]+",    "iron"),
]
# 제품 상세 URL 이 붙는 폴더 (카테고리 URL 과 같다)
FOLDER = {"driver": "/golf-clubs/drivers/", "iron": "/golf-clubs/iron-sets/"}

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
S = requests.Session()
S.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9",
                  "Accept": "text/html,application/xhtml+xml,*/*;q=0.8"})

TAG = re.compile(r"<[^>]+>")


def get(url, timeout=60):
    assert OFFICIAL_HOST in url, f"공식 도메인 아님: {url}"
    return S.get(url, timeout=timeout)


def txt(s):
    s = re.sub(r"(?is)<(script|style).*?</\1>", " ", s)
    return re.sub(r"\s+", " ", ihtml.unescape(TAG.sub(" ", s))).strip()


def num(s):
    if s is None:
        return None
    t = (s.replace("″", "").replace('"', "").replace("°", "")
          .replace("cc", "").replace("CC", "").strip())
    m = re.match(r"^[-+]?\d+(?:\.\d+)?", t)
    if not m:
        return None
    # '9° (Adjustable)' 처럼 숫자 뒤에 설명이 붙는 건 허용, '9-10' 같은 범위는 숫자만 못 믿으니 제외
    rest = t[m.end():].strip()
    if rest.startswith(("-", "–", "~")):
        return None
    return float(m.group())


COLMAP = {
    "club": "club", "club #": "club",
    # 어떤 페이지는 클럽칸 머리글이 'Name' / 'Iron' 이다 (내용은 '#5','PW','3H' 로 동일)
    "name": "club", "club name": "club", "iron": "club", "irons": "club",
    "loft": "loft", "lofts": "loft",
    "lie": "lie", "lie angle": "lie",
    "length": "length", "standard length": "length",
    # 여성용 표는 길이 칸 머리글이 "Women's Length" 다 — 같은 길이 값이다
    "women s length": "length", "womens length": "length",
    "men s length": "length", "mens length": "length",
    "cc": "cc", "volume": "cc", "head size": "cc",
    "availability": "availability", "hand": "availability",
    "offset mm": "offset_mm", "offset": "offset_mm",
    "swing weight": "swing_weight",
    "bounce": "bounce",
    "hl spec- custom only": "hl_loft", "hl spec custom only": "hl_loft",
}


def norm_cols(header):
    out = []
    for h in header:
        k = h.lower().replace("°", " ").replace("(", " ").replace(")", " ")
        # 아포스트로피는 표기가 제각각(' / ’)이라 공백으로 눕혀서 맞춘다: "Women's Length" → "women s length"
        k = k.replace("'", " ").replace("’", " ")
        k = re.sub(r"\s+", " ", k).strip()
        out.append(COLMAP.get(k, re.sub(r"\W+", "_", k).strip("_") or "col"))
    return out


def tables(html):
    out = []
    for tb in re.findall(r"(?is)<table.*?</table>", html):
        rows = []
        for tr in re.findall(r"(?is)<tr.*?</tr>", tb):
            cells = [txt(c) for c in re.findall(r"(?is)<t[hd].*?</t[hd]>", tr)]
            if any(cells):
                rows.append(cells)
        if len(rows) >= 2:
            out.append(rows)
    return out


def title_of(html):
    m = re.search(r"(?is)<title[^>]*>(.*?)</title>", html)
    if m:
        # <title> 은 "모델명 | Callaway Golf | Specs & Reviews" 처럼 꼬리가 여러 개 붙는다.
        # 첫 '|' 앞이 모델명이다 — 꼬리를 통째로 버린다.
        t = txt(m.group(1)).split("|")[0].strip()
        if t:
            return t
    # <title> 이 비면 h1 으로 대체
    m = re.search(r"(?is)<h1[^>]*>(.*?)</h1>", html)
    if m:
        return txt(m.group(1)).strip() or None
    return None


# '9°', '10.5 °' 처럼 도수만 들어있는 칸인지 (Model 칸에 로프트가 오는 페이지가 있다)
DEG_ONLY = re.compile(r"^\s*\d+(?:\.\d+)?\s*°\s*$")


def loft_cell(rc):
    """로프트 원문 칸을 고른다.

    Loft 칸이 있으면 그것을, 없고 Model 칸이 '9°' 같은 도수 표기면 그것을 쓴다.
    (Paradym Ai Smoke MAX / Elyte Night Edition / Reva Rise 처럼 표 머리글이
     'Model' 인데 실제 내용은 로프트인 페이지 대응 — 지어낸 값이 아니라 표 원문이다.)
    """
    if rc.get("loft"):
        return rc["loft"]
    m = rc.get("model")
    if m and DEG_ONLY.match(m):
        return m
    return None


def collect(slug, kind):
    url = HOST + FOLDER[kind] + slug + ".html"
    r = get(url)
    if r.status_code != 200:
        return None, url, f"HTTP {r.status_code}"
    tbs = tables(r.text)
    if not tbs:
        return None, url, "스펙표 없음"
    name = title_of(r.text)

    # 스펙표 고르기 — 로프트/라이 칸이 있는 표만 스펙표로 본다
    picked = None
    for rows in tbs:
        cols = norm_cols(rows[0])
        if "loft" in cols or "lie" in cols:
            picked = rows
            break
    if picked is None:
        return None, url, "로프트/라이 칸 없음"

    header, body = picked[0], picked[1:]
    cols = norm_cols(header)
    recs = [dict(zip(cols, row)) for row in body if len(row) >= 2]

    item = {
        "model": name or slug,
        "slug": slug,
        "type": kind,
        "columns": header,
        "source_url": url,
    }
    if kind == "driver":
        item["loft_options"] = [
            {"loft_label": loft_cell(rc),
             "loft_deg": num(loft_cell(rc)),
             "availability": rc.get("availability"),
             "length_inch": num(rc.get("length")),
             "lie_deg": num(rc.get("lie")),
             "head_volume_cc": num(rc.get("cc")),
             "raw": rc}
            for rc in recs
        ]
        vols = {o["head_volume_cc"] for o in item["loft_options"] if o["head_volume_cc"]}
        item["head_volume_cc"] = vols.pop() if len(vols) == 1 else None
    else:
        item["clubs"] = [
            {"club": rc.get("club"),
             "loft_deg": num(rc.get("loft")),
             "lie_deg": num(rc.get("lie")),
             "length_inch": num(rc.get("length")),
             "offset_mm": num(rc.get("offset_mm")),
             "hl_loft_deg": num(rc.get("hl_loft")),
             "availability": rc.get("availability"),
             "raw": rc}
            for rc in recs
        ]
    return item, url, None


def main():
    dry = "--dry" in sys.argv
    only = None
    if "--only" in sys.argv:
        only = sys.argv[sys.argv.index("--only") + 1]

    items, sources, skipped = [], [], []
    for cat_url, pat, kind in CATS:
        if only and only not in cat_url:
            continue
        r = get(HOST + cat_url)
        r.raise_for_status()
        slugs = sorted(set(re.findall(pat, r.text)))
        print(f"\n[{kind}] {cat_url} → 제품 {len(slugs)}개")
        for slug in slugs:
            try:
                item, url, err = collect(slug, kind)
            except Exception as e:
                item, url, err = None, HOST + FOLDER[kind] + slug + ".html", f"{type(e).__name__}: {e}"
            if err:
                skipped.append({"url": url, "reason": err})
                print(f"  - {slug:44s} {err}")
            else:
                n = len(item.get("loft_options") or item.get("clubs") or [])
                items.append(item)
                sources.append(url)
                print(f"  ✔ {slug:44s} {item['model'][:34]:36s} 행 {n}")
            time.sleep(0.5)

    rec = {
        "source": HOST + "/golf-clubs/",
        "sources": sources,
        "fetched": date.today().isoformat(),
        "brand": "Callaway",
        "brand_ko": "캘러웨이",
        "category": "head",
        "official_domain": OFFICIAL_HOST,
        "note": "callawaygolf.com 공식 제품페이지 SPECS 표 원문. 못 읽은 값은 null.",
        "skipped": skipped,
        "items": items,
    }
    rows = sum(len(i.get("loft_options") or i.get("clubs") or []) for i in items)
    print(f"\n모델 {len(items)}개 · 표 행 {rows}개 · 실패 {len(skipped)}개")
    if not dry:
        os.makedirs(OUT_DIR, exist_ok=True)
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(rec, f, ensure_ascii=False, indent=1)
        print("저장:", OUT)


if __name__ == "__main__":
    main()
