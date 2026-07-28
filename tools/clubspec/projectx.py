# -*- coding: utf-8 -*-
"""
Project X 우드/아이언 샤프트 스펙 수집

주의: projectxgolf.com 은 모회사 True Temper 공식몰로 301 리다이렉트된다.
      (https://www.projectxgolf.com/ -> https://www.truetemper.com/pages/project-x)
      따라서 공식 도메인 truetemper.com 의 Project X 컬렉션에서 수집한다.

원칙:
 - 페이지에서 실제로 읽은 값만 기록. 못 읽으면 null. 추정/보간 없음.
 - 각 item 에 출처 URL(source_url) 기록.

스펙 표 구조(Shopify):
  <product-spec-selector> 안에
  <table class="table-collapse">
     <caption>Weight 60g</caption>
     <thead><tr><th>Flex</th><th>Weight</th>...</tr></thead>
     <tbody><tr><td>Regular</td><td>66 g</td>...</tr></tbody>

출력: coursedata/clubspecs/projectx.json
"""
import json
import os
import re
import html
import time
import urllib.request
from datetime import date
from html.parser import HTMLParser

BASE = "https://www.truetemper.com"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "coursedata", "clubspecs", "projectx.json")

COLLECTIONS = [
    ("project-x-wood-shafts", "wood"),
    ("project-x-iron-shafts", "iron"),
]

FIELD_MAP = {
    "flex": "flex",
    "weight": "weight",
    "length": "length",
    "tip dia": "tip_dia",
    "butt dia": "butt_dia",
    "torque": "torque",
    "launch": "launch",
    "spin": "spin",
    "kick point": "kick_point",
    "bend profile": "bend_profile",
    "parallel tip": "parallel_tip",
    "tip": "tip_dia",
    "butt": "butt_dia",
    "model": "model",
    "shaft": "model",
    "raw length": "length",
}


def fetch(url, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=45) as r:
                return r.read().decode("utf-8", "ignore")
        except Exception as e:  # noqa
            last = e
            time.sleep(2 + i * 2)
    print("    FETCH FAIL %s -> %s" % (url, last))
    return None


def clean(s):
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    s = s.replace("″", '"').replace("”", '"')
    s = s.replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()


class TableParser(HTMLParser):
    """<table> 를 caption / header / rows 로 추출."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables = []
        self._t = None
        self._row = None
        self._cell = None
        self._in_caption = False
        self._caption = ""

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self._t = {"caption": None, "headers": [], "rows": []}
        elif self._t is None:
            return
        elif tag == "caption":
            self._in_caption = True
            self._caption = ""
        elif tag == "tr":
            self._row = []
        elif tag in ("th", "td"):
            self._cell = {"tag": tag, "text": ""}

    def handle_data(self, data):
        if self._in_caption:
            self._caption += data
        elif self._cell is not None:
            self._cell["text"] += data

    def handle_endtag(self, tag):
        if self._t is None:
            return
        if tag == "caption":
            self._in_caption = False
            self._t["caption"] = clean(self._caption)
        elif tag in ("th", "td"):
            if self._cell is not None and self._row is not None:
                self._row.append(self._cell)
            self._cell = None
        elif tag == "tr":
            if self._row:
                if all(c["tag"] == "th" for c in self._row) and \
                        not self._t["headers"]:
                    self._t["headers"] = [clean(c["text"]) for c in self._row]
                else:
                    self._t["rows"].append([clean(c["text"]) for c in self._row])
            self._row = None
        elif tag == "table":
            if self._t["headers"] and self._t["rows"]:
                self.tables.append(self._t)
            self._t = None


def norm_field(header):
    h = header.lower().strip().rstrip(".")
    h = re.sub(r"\s+", " ", h)
    if h in FIELD_MAP:
        return FIELD_MAP[h]
    for key, val in FIELD_MAP.items():
        if h.startswith(key):
            return val
    return re.sub(r"[^a-z0-9]+", "_", h).strip("_")


def spec_section(page):
    """product-spec-selector 영역만 잘라낸다 (다른 표 혼입 방지)."""
    m = re.search(r"<product-spec-selector\b", page)
    if not m:
        return None
    end = page.find("</product-spec-selector>", m.start())
    return page[m.start():end if end > 0 else len(page)]


def collect():
    today = date.today().isoformat()

    # 1) 컬렉션에서 제품 목록 (Shopify products.json)
    products = []
    seen = set()
    for coll, kind in COLLECTIONS:
        url = "%s/collections/%s/products.json?limit=250" % (BASE, coll)
        raw = fetch(url)
        if not raw:
            continue
        data = json.loads(raw)
        plist = data.get("products", [])
        print("[collection] %-24s %d products" % (coll, len(plist)))
        for p in plist:
            key = (p["handle"], kind)
            if key not in seen:
                seen.add(key)
                products.append((p["handle"], p["title"], kind))

    items = []
    no_table = []
    for handle, title, kind in products:
        purl = "%s/products/%s" % (BASE, handle)
        page = fetch(purl)
        if not page:
            no_table.append(handle)
            continue
        sec = spec_section(page)
        if not sec:
            print("  %-38s %-5s spec-selector 없음" % (handle, kind))
            no_table.append(handle)
            continue
        tp = TableParser()
        tp.feed(sec)
        cnt = 0
        for t in tp.tables:
            fields = [norm_field(h) for h in t["headers"]]
            for row in t["rows"]:
                if len(row) != len(fields):
                    print("      (경고) 열수 불일치 폐기: %s" % row)
                    continue
                it = {
                    "model": title,
                    "product": title,
                    "category": kind,
                    "spec_group": t["caption"],  # 예: 'Weight 60g'
                    "source_url": purl,
                }
                for f, v in zip(fields, row):
                    v = v.strip()
                    # 사이트가 '값 없음'으로 표시하는 기호 -> null (임의 보간 금지)
                    if v in ("", "-", "--", "—", "–", "N/A", "n/a", "NA", "TBD"):
                        v = None
                    if f == "model" and v:
                        it["model"] = v
                    else:
                        it[f] = v
                items.append(it)
                cnt += 1
        print("  %-38s %-5s rows=%d (tables=%d)" % (handle, kind, cnt,
                                                    len(tp.tables)))
        if cnt == 0:
            no_table.append(handle)
        time.sleep(0.6)

    data = {
        "source": "https://www.projectxgolf.com/ -> "
                  "https://www.truetemper.com/pages/project-x",
        "fetched": today,
        "brand": "Project X",
        "category": "wood/iron shafts",
        "note": "projectxgolf.com 은 공식 모회사몰 truetemper.com 으로 301 "
                "리다이렉트됨. 스펙은 truetemper.com 제품 페이지에서 수집.",
        "source_pages": ["%s/collections/%s" % (BASE, c) for c, _ in COLLECTIONS],
        "items": items,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("\n=== Project X ===")
    print("products scanned : %d" % len(products))
    print("items collected  : %d" % len(items))
    print("no spec table    : %d %s" % (len(no_table), no_table))
    print("saved -> %s" % OUT)

    keys = {}
    for it in items:
        for k, v in it.items():
            if v not in (None, ""):
                keys[k] = keys.get(k, 0) + 1
    print("-- 필드 채움율 --")
    for k in sorted(keys, key=lambda x: -keys[x]):
        print("   %-15s %d/%d" % (k, keys[k], len(items)))

    # 참고: 스틸(아이언) 샤프트의 Torque 는 공식 페이지가 수치 대신
    # 'Low' 같은 정성값으로 표기한다 -> 원문 그대로 유지한다.
    checks = {
        "weight": r"^\d{2,3}(\.\d+)?\s*g$",
        "torque": r"^(\d+(\.\d+)?\s*°?|Low|Mid|High|Mid-Low|Mid-High)$",
        "tip_dia": r'^\.?\d?\.?\d{3}\s*(in|")?$',
        "butt_dia": r'^\.?\d?\.?\d{3}\s*(in|")?$',
        "length": r'^\d{2}(\.\d+)?\s*(in|")?$',
    }
    print("-- 열 정렬 검증(형식 일치율) --")
    bad = 0
    for f, pat in checks.items():
        vals = [it[f] for it in items if it.get(f)]
        if not vals:
            continue
        good = sum(1 for v in vals if re.match(pat, v.strip()))
        pct = 100.0 * good / len(vals)
        if pct < 95:
            bad += 1
            odd = [v for v in vals if not re.match(pat, v.strip())][:5]
            print("   %-9s %5.1f%% (%d/%d) ** 확인필요 ** 예:%s"
                  % (f, pct, good, len(vals), odd))
        else:
            print("   %-9s %5.1f%% (%d/%d) OK" % (f, pct, good, len(vals)))
    if bad == 0:
        print("   => 모든 열 형식 일치. 정렬 이상 없음.")


if __name__ == "__main__":
    collect()
