# -*- coding: utf-8 -*-
"""
Mitsubishi Chemical (MCA Golf) 골프 샤프트 공식 스펙 수집기
공식 도메인: https://mitsubishigolf.com  (mcagolf.com 은 여기로 301)

원칙:
  - 페이지에 적힌 값만 기록. 없으면 null. 추정/보간 절대 금지.
  - 각 항목에 출처 URL + 수집일 기록.
  - 제조사 공식 도메인만 사용.
  - 모델명은 페이지 원문 그대로.

출력: coursedata/clubspecs/mitsubishi.json
"""
import json
import os
import re
import sys
import time
import datetime
from html.parser import HTMLParser

import requests

BASE = "https://mitsubishigolf.com"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_DIR = os.path.join(ROOT, "coursedata", "clubspecs")
OUT_PATH = os.path.join(OUT_DIR, "mitsubishi.json")

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})


def get(url, tries=3):
    last = None
    for i in range(tries):
        try:
            r = SESSION.get(url, timeout=40)
            if r.status_code == 200:
                # Shopify 는 항상 UTF-8. apparent_encoding 추측을 쓰면 일부 페이지가
                # cp1252 로 잘못 디코딩되어 Diamana™ -> Diamanaâ„˘ 로 깨진다.
                r.encoding = "utf-8"
                return r.text
            last = "HTTP %s" % r.status_code
        except Exception as e:  # noqa
            last = repr(e)
        time.sleep(1.5 * (i + 1))
    print("  [FAIL] %s (%s)" % (url, last))
    return None


# ---------------------------------------------------------------- table parse
class TableParser(HTMLParser):
    """<table> 안의 행/셀 텍스트를 그대로 뽑아낸다. 값 가공/추정 없음."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables = []          # [{'class':str, 'rows':[[cell,...],...]}]
        self._tstack = []
        self._row = None
        self._cell = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "table":
            self._tstack.append({"class": a.get("class", "") or "", "rows": []})
        elif tag == "tr" and self._tstack:
            self._row = []
        elif tag in ("td", "th") and self._tstack:
            self._cell = []
        elif tag == "br" and self._cell is not None:
            self._cell.append(" ")

    def handle_endtag(self, tag):
        if tag in ("td", "th"):
            if self._cell is not None and self._row is not None:
                self._row.append(clean(" ".join(self._cell)))
            self._cell = None
        elif tag == "tr":
            if self._row and self._tstack:
                self._tstack[-1]["rows"].append(self._row)
            self._row = None
        elif tag == "table":
            if self._tstack:
                self.tables.append(self._tstack.pop())

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)

    def close(self):
        super().close()
        while self._tstack:                      # 닫히지 않은 table 구제
            self.tables.append(self._tstack.pop())


def clean(s):
    s = s.replace(" ", " ").replace("™", "").replace("®", "")
    s = re.sub(r"\s+", " ", s)
    return s.strip()


# header 원문 -> 정규 필드명.
# 실제로 페이지마다 헤더 표기가 제각각이다:
#   Shaft / Shaft Name / Model
#   Length / Length (in) / Length (IN)
#   Weight/GMS / Weight (g) / Weight(g)
#   Tip OD / Tip O.D. (in) / Tip O/D
#   Torque / Torque(deg) / T<span>o</span>rq<span>ue</span>
#   Kick Point / Kick Pt.
HDR_MAP = [
    (r"^shaft|^model",                   "model"),
    (r"flex",                            "flex"),
    (r"^length|raw\s*length",            "length_in"),
    (r"weight|gms|grams",                "weight_g"),
    (r"tip\s*o\s*d|tip\s*dia",           "tip_od_in"),
    (r"tip\s*len|tip\s*parallel|par\s*tip", "tip_length_in"),
    (r"butt\s*o\s*d|butt\s*dia",         "butt_od_in"),
    (r"torq",                            "torque_deg"),
    (r"kick|bend\s*point",               "kick_point"),
    (r"launch",                          "launch"),
    (r"spin",                            "spin"),
]

NUMERIC = {"length_in", "weight_g", "tip_od_in", "tip_length_in",
           "butt_od_in", "torque_deg"}

# 값이 비어 있음을 뜻하는 표기 (페이지 원문). 숫자를 지어내지 않고 None 으로 둔다.
EMPTY_TOKENS = {"", "-", "--", "—", "–", "n/a", "na", "n.a.", "tbd", "none"}

# 숫자칸에 붙어 오는 단위 표기. 단위만 떼고 숫자는 페이지 값 그대로 쓴다.
UNIT_RE = re.compile(r'\s*(?:"|”|″|inch(?:es)?|in\.?|grams?|gms?|g|deg(?:rees?)?|°)\s*$',
                     re.I)


def norm_header(h):
    """헤더는 <span> 으로 잘려 있는 경우가 많다(T<span>o</span>rq<span>ue</span>).
    구두점을 공백으로 바꾼 형태와, 공백을 모두 없앤 형태 둘 다로 매칭한다."""
    hl = re.sub(r"[./()\[\],:]+", " ", clean(h).lower())
    hl = re.sub(r"\s+", " ", hl).strip()
    hs = hl.replace(" ", "")
    for pat, key in HDR_MAP:
        if re.search(pat, hl) or re.search(pat, hs):
            return key
    return None


def cell_value(key, raw):
    """페이지에 적힌 그대로. 비어 있으면 None. 숫자칸은 단위만 떼고 숫자로."""
    v = clean(raw)
    if v.lower() in EMPTY_TOKENS:
        return None
    if key in NUMERIC:
        n = UNIT_RE.sub("", v).strip()
        m = re.fullmatch(r"([0-9]+(?:\.[0-9]+)?)", n)
        if m:
            f = float(m.group(1))
            return int(f) if f == int(f) and key == "weight_g" else f
        return v            # "40-35.5", "TAPERED" 같은 값은 원문 그대로 보존
    return v


MISALIGNED = []   # 헤더/셀 개수가 안 맞아 버린 행 (있으면 리포트)


def parse_spec_tables(html, url):
    p = TableParser()
    p.feed(html)
    p.close()
    items = []
    for t in p.tables:
        rows = [r for r in t["rows"] if any(c for c in r)]
        if len(rows) < 2:
            continue
        header = rows[0]
        keys = [norm_header(h) for h in header]
        # 스펙표 판별: model/flex/weight/torque 중 2개 이상 잡히면 스펙표
        hit = sum(1 for k in keys if k in ("model", "flex", "weight_g", "torque_deg"))
        if hit < 2:
            continue
        for r in rows[1:]:
            if len(r) < 2:
                continue
            # 셀 수가 헤더와 다르면 값이 엉뚱한 필드로 밀려 들어간다.
            # 그런 행은 값을 지어내는 것과 같으므로 버리고 경고만 남긴다.
            if len(r) != len(header):
                MISALIGNED.append({"source": url, "header": header, "row": r})
                continue
            rec = {"raw_headers": [clean(h) for h in header]}
            for i, k in enumerate(keys):
                if k is None or i >= len(r):
                    continue
                rec[k] = cell_value(k, r[i])
            if not rec.get("model"):
                continue
            # 값이 model 하나뿐이면 스펙 없음 -> 버림
            if len([k for k in rec if k not in ("model", "raw_headers")]) == 0:
                continue
            rec["source"] = url
            items.append(rec)
    return items


# ------------------------------------------------------------------- crawl
def collection_products(handle):
    out = []
    page = 1
    while True:
        url = "%s/collections/%s/products.json?limit=250&page=%d" % (BASE, handle, page)
        txt = get(url)
        if not txt:
            break
        try:
            data = json.loads(txt)
        except Exception:
            break
        prods = data.get("products", [])
        if not prods:
            break
        out.extend(prods)
        if len(prods) < 250:
            break
        page += 1
    return out


def main():
    today = datetime.date.today().isoformat()
    os.makedirs(OUT_DIR, exist_ok=True)

    targets = {}   # handle -> title
    for coll in ("tensei", "diamana"):
        for p in collection_products(coll):
            targets[p["handle"]] = clean(p.get("title", ""))
    # 컬렉션에 안 걸린 TENSEI/Diamana 제품도 전체 목록에서 보강
    for p in collection_products("all"):
        t = clean(p.get("title", ""))
        if re.search(r"tensei|diamana", t, re.I):
            targets.setdefault(p["handle"], t)

    print("대상 제품 %d개" % len(targets))

    items = []
    prod_stats = []
    for handle in sorted(targets):
        url = "%s/products/%s" % (BASE, handle)
        html = get(url)
        if not html:
            prod_stats.append((targets[handle], url, 0))
            continue
        rows = parse_spec_tables(html, url)
        series = ("TENSEI" if re.search(r"tensei", targets[handle], re.I)
                  else "Diamana" if re.search(r"diamana", targets[handle], re.I)
                  else None)
        for r in rows:
            r["series"] = series
            r["product_title"] = targets[handle]
            r["fetched"] = today
        items.extend(rows)
        prod_stats.append((targets[handle], url, len(rows)))
        print("  %-45s %3d rows" % (targets[handle][:45], len(rows)))
        time.sleep(0.4)

    doc = {
        "source": BASE + "/",
        "source_collections": [BASE + "/collections/diamana",
                               BASE + "/collections/tensei"],
        "fetched": today,
        "brand": "Mitsubishi Chemical",
        "brand_ko": "미쓰비시케미컬",
        "category": "shaft",
        "note": ("mitsubishigolf.com (= mcagolf.com, Mitsubishi Chemical America Golf 공식) "
                 "제품 페이지의 Specifications 표 원문. "
                 "요청 원본 URL www.mitsubishichemical-golf.com 은 DNS 미해석(존재하지 않음)."),
        "field_units": {
            "length_in": "inch (raw length)",
            "weight_g": "gram",
            "tip_od_in": "inch",
            "tip_length_in": "inch",
            "butt_od_in": "inch",
            "torque_deg": "degree",
            "kick_point": "제조사 표기 원문 (High/Mid/Low 등, 대소문자·구분자도 원문 유지)",
        },
        "raw_headers_note": ("items[].raw_headers 는 해당 표의 헤더 셀을 태그 제거 후 "
                             "그대로 담은 것. 사이트가 헤더 글자 사이에 <span> 을 넣어서 "
                             "'T o rq ue', 'Tip Len gth' 처럼 띄어져 보이는 것이 원문 그대로다."),
        "product_count": len([p for p in prod_stats if p[2] > 0]),
        "item_count": len(items),
        "items": items,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)

    # ---- 리포트
    print("\n저장: %s" % OUT_PATH)
    print("총 항목 %d개 / 스펙표 있는 제품 %d개 (조사 %d개)"
          % (len(items), doc["product_count"], len(targets)))
    fields = ["model", "flex", "length_in", "weight_g", "tip_od_in",
              "tip_length_in", "butt_od_in", "torque_deg", "kick_point"]
    print("\n필드별 채워진 수:")
    for k in fields:
        n = sum(1 for it in items if it.get(k) is not None)
        print("  %-14s %4d / %d" % (k, n, len(items)))
    print("\n스펙표 0행 제품:")
    for t, u, n in prod_stats:
        if n == 0:
            print("  - %s  (%s)" % (t, u))
    print("\n헤더/셀 수 불일치로 버린 행: %d개" % len(MISALIGNED))
    for m in MISALIGNED[:5]:
        print("  ! %s\n    hdr(%d)=%s\n    row(%d)=%s"
              % (m["source"], len(m["header"]), m["header"], len(m["row"]), m["row"]))


if __name__ == "__main__":
    sys.exit(main())
