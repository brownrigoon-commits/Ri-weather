# -*- coding: utf-8 -*-
"""미즈노 클럽 스펙 수집 — 제조사 공식 사이트 mizunogolf.com 만 사용.

  python tools/clubspec/mizuno.py            # 수집 + 저장
  python tools/clubspec/mizuno.py --dry      # 저장 없이 확인만

원칙
  1. 페이지에서 읽은 숫자만 넣는다. 못 읽으면 null. 추정 금지.
  2. 항목마다 출처 URL(spec_url) 과 수집일을 남긴다.
  3. mizunogolf.com 공식 도메인 외에는 절대 안 받는다.
  4. 한글 모델명은 만들지 않는다 — 영문 원문 그대로.

저장: coursedata/clubspecs/mizuno.json
"""
import json, os, re, sys, time
import html as ihtml
from datetime import date
from urllib.parse import urljoin

import requests

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(ROOT, "coursedata", "clubspecs")
OUT = os.path.join(OUT_DIR, "mizuno.json")

BASE = "https://mizunogolf.com/us/golf-clubs/"
OFFICIAL_HOST = "mizunogolf.com"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
S = requests.Session()
S.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9",
                  "Accept": "text/html,application/xhtml+xml,*/*;q=0.8"})

TAG = re.compile(r"<[^>]+>")


def get(url, timeout=45):
    assert OFFICIAL_HOST in url, f"공식 도메인 아님: {url}"
    r = S.get(url, timeout=timeout)
    return r


def txt(s):
    s = re.sub(r"(?is)<(script|style).*?</\1>", " ", s)
    return re.sub(r"\s+", " ", ihtml.unescape(TAG.sub(" ", s))).strip()


def num(s):
    """숫자만 뽑는다. 범위('7.0–11.0')나 못 읽는 값은 None 을 돌려주고 원문은 따로 보관."""
    if s is None:
        return None
    t = s.replace("″", "").replace('"', "").replace("°", "").strip()
    m = re.fullmatch(r"[-+]?\d+(?:\.\d+)?", t)
    return float(m.group()) if m else None


def length_options(s):
    """'34/35' 처럼 슬래시로 나열된 길이 선택지를 그대로 목록으로 돌려준다.

    퍼터는 단일 길이가 아니라 34"/35" 두 가지로 나오는 식이라 length_inch 는 null 이 된다.
    여기서 만드는 건 표에 적힌 숫자 그대로이지 추정값이 아니다. 하나뿐이면 None.
    """
    if not s:
        return None
    t = s.replace("″", "").replace('"', "").strip()
    if "/" not in t:
        return None
    parts = [p.strip() for p in t.split("/")]
    out = []
    for p in parts:
        if not re.fullmatch(r"[-+]?\d+(?:\.\d+)?", p):
            return None          # 하나라도 숫자가 아니면 해석하지 않는다
        out.append(float(p))
    return out or None


def blocks(html):
    """<h4> 제목과 바로 뒤 <table> 을 짝지어 문서 순서대로 돌려준다."""
    out = []
    heading = None
    for m in re.finditer(r"(?is)<h[234][^>]*>(.*?)</h[234]>|<table.*?</table>", html):
        chunk = m.group(0)
        if chunk.lower().startswith("<table"):
            rows = []
            for tr in re.findall(r"(?is)<tr.*?</tr>", chunk):
                cells = [txt(c) for c in re.findall(r"(?is)<t[hd].*?</t[hd]>", tr)]
                if any(cells):
                    rows.append(cells)
            if len(rows) >= 2:
                out.append((heading, rows))
        else:
            h = txt(chunk)
            if h:
                heading = h
    return out


def kind_of(url):
    u = url.lower()
    for k in ("driver", "fairway", "hybrid", "putter", "wedge", "fli-hi"):
        if k in u:
            return {"fli-hi": "utility_iron"}.get(k, k)
    return "iron"


COLMAP = {
    "club #": "club", "club": "club", "club no": "club",
    "loft": "loft", "loft range": "loft_range",
    "lie angle": "lie", "lie": "lie", "lie range": "lie_range",
    "offset inch": "offset_inch", "offset": "offset_inch",
    "length inch": "length_inch", "length": "length_inch",
    "60 deg length inch": "length_inch",
    "bounce": "bounce",
    "volume": "volume", "model": "model", "head size": "head_size",
    "toe hang": "toe_hang", "head weight": "head_weight",
}


def norm_cols(header):
    out = []
    for h in header:
        k = h.lower().replace("°", " ").replace("(", " ").replace(")", " ")
        k = re.sub(r"\s+", " ", k).strip()
        out.append(COLMAP.get(k, re.sub(r"\W+", "_", k).strip("_") or "col"))
    return out


RANGE = re.compile(r"^\s*[-+]?\d+(?:\.\d+)?\s*[-–~]\s*[-+]?\d+(?:\.\d+)?\s*$")


def parse_table(heading, rows, product_url, spec_url, kind):
    header, body = rows[0], rows[1:]
    cols = norm_cols(header)
    series = re.sub(r"\s*Specifications?\s*$", "", heading or "", flags=re.I).strip() or None
    if series and re.search(r"(?i)wedge", series):
        kind = "wedge"

    recs = [dict(zip(cols, r)) for r in body if len(r) >= 2]

    # 우드류: 첫 칸이 Model — 한 행이 곧 한 모델
    if cols and cols[0] == "model":
        items = []
        for rec in recs:
            vol = rec.get("volume")
            lo = rec.get("loft") or rec.get("loft_range")
            li = rec.get("lie") or rec.get("lie_range")
            items.append({
                "model": rec.get("model"),
                "series": series,
                "type": kind,
                "loft_deg": num(lo),
                "loft_range_deg": lo if lo and RANGE.match(lo) else None,
                "lie_deg": num(li),
                "lie_range_deg": li if li and RANGE.match(li) else None,
                "head_volume_cc": num(re.sub(r"(?i)cc", "", vol)) if vol else None,
                "length_inch": num(rec.get("length_inch")),
                "length_options_inch": length_options(rec.get("length_inch")),
                "raw": rec,
                "product_url": product_url,
                "spec_url": spec_url,
            })
        return items

    # 아이언/웨지류: 한 표가 한 모델, 행이 클럽별
    clubs = []
    for rec in recs:
        clubs.append({
            "club": rec.get("club"),
            "loft_deg": num(rec.get("loft")),
            "lie_deg": num(rec.get("lie")),
            "offset_inch": num(rec.get("offset_inch")),
            "length_inch": num(rec.get("length_inch") or rec.get("length_inch_60deg")),
            "bounce_deg": num(rec.get("bounce")),
            "raw": rec,
        })
    return [{
        "model": series,
        "series": series,
        "type": kind,
        "clubs": clubs,
        "columns": header,
        "product_url": product_url,
        "spec_url": spec_url,
    }]


def main():
    dry = "--dry" in sys.argv
    r = get(BASE)
    r.raise_for_status()
    products = sorted(set(re.findall(
        r'href="(https://mizunogolf\.com/us/golf-clubs/[^"#?]+/)"', r.text)))
    products = [p for p in products if p.rstrip("/") != BASE.rstrip("/")]
    print(f"제품 페이지 {len(products)}개 발견")

    items, sources, skipped = [], [], []
    for p in products:
        spec_url = urljoin(p, "club-specification/")
        try:
            rr = get(spec_url)
        except Exception as e:
            skipped.append((spec_url, f"{type(e).__name__}"))
            continue
        if rr.status_code != 200:
            skipped.append((spec_url, f"HTTP {rr.status_code}"))
            print(f"  - 스펙표 없음({rr.status_code}) {p}")
            continue
        bs = blocks(rr.text)
        if not bs:
            skipped.append((spec_url, "표 없음"))
            print(f"  - 표 없음 {p}")
            continue
        kind = kind_of(p)
        got = 0
        for heading, rows in bs:
            new = parse_table(heading, rows, p, spec_url, kind)
            items += new
            got += len(new)
        sources.append(spec_url)
        print(f"  ✔ {p.split('/golf-clubs/')[1]:52s} 표 {len(bs)}개 → 항목 {got}")
        time.sleep(0.4)

    rec = {
        "source": BASE,
        "sources": sources,
        "fetched": date.today().isoformat(),
        "brand": "Mizuno",
        "brand_ko": "미즈노",
        "category": "head",
        "official_domain": OFFICIAL_HOST,
        "note": "mizunogolf.com 공식 스펙표(club-specification) 원문. 못 읽은 값은 null.",
        "skipped": [{"url": u, "reason": w} for u, w in skipped],
        "items": items,
    }
    n_clubrows = sum(len(i.get("clubs", [])) for i in items)
    print(f"\n모델 항목 {len(items)}개 · 클럽별 행 {n_clubrows}개 · 스펙페이지 {len(sources)}개")
    if not dry:
        os.makedirs(OUT_DIR, exist_ok=True)
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(rec, f, ensure_ascii=False, indent=1)
        print("저장:", OUT)


if __name__ == "__main__":
    main()
