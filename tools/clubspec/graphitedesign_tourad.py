# -*- coding: utf-8 -*-
"""
Graphite Design TOUR AD shaft specs collector.

Official manufacturer domain: graphitedesign.gd-inc.co.jp
(株式会社グラファイトデザイン / Graphite Design Inc., Japan HQ)

NOTE on the URL originally supplied:
  https://www.graphitedesign.com/  -> a UK graphic-design agency in Kent.
                                      NOT the golf shaft maker. No golf content.
  https://touradco.com/            -> genuine official site of the US arm
                                      (Graphite Design International) but it
                                      publishes zero spec tables (marketing copy).
  https://graphitedesign.gd-inc.co.jp/tourad/  -> JP HQ, authoritative per-flex
                                      spec tables. Used here.

TABLE SHAPES (both handled):
  A) wood/hybrid/putter: columns = flex.        Row0 = model, Row"フレックス" = axis
  B) iron:               columns = iron number. Row1 = ['', '#3'...'#10'],
                         flex carried in the model title ("AD-55 R") or a
                         フレックス row.
  Cells carry colspan, so every row is expanded to the full column count before
  values are aligned. Without this, tour-ad-u / tour-ad-lia misalign.

RULE: never invent numbers. Anything not readable on the page stays null.
"""
import json
import os
import re
import sys
import time
import urllib.request
from datetime import date
from html import unescape

sys.stdout.reconfigure(encoding="utf-8")

BASE = "https://graphitedesign.gd-inc.co.jp"
INDEX = BASE + "/tourad/"
SITEMAP = BASE + "/wp-sitemap-posts-tourad-1.xml"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
OUT = r"C:\Users\PC\Desktop\Ri-weather\coursedata\clubspecs\graphitedesign_tourad.json"
TODAY = date.today().isoformat()


def fetch(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "ja,en;q=0.8",
            })
            return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
        except Exception as e:
            if i == tries - 1:
                print("  FETCH FAIL %s: %s" % (url, e))
                return None
            time.sleep(2)


def txt(s):
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", unescape(s)).strip()


def num(s):
    """Return a float only for a clean bare number; otherwise None. Never guess."""
    if s is None:
        return None
    m = re.fullmatch(r"(\d+(?:\.\d+)?)", s.strip())
    return float(m.group(1)) if m else None


def split_tables(html):
    """Top-level <table>...</table> slices, depth-aware.

    A plain non-greedy `<table.*?</table>` stops at the FIRST </table>. This
    site nests tables: on tour-ad-iron-85-115 the AD-115 table wraps its price
    row in an inner <table>. Today the nesting sits in the last row so nothing
    is lost, but a nested table appearing mid-table would silently truncate
    every data row after it. Match on depth instead.
    """
    out, depth, start = [], 0, None
    for m in re.finditer(r"<table\b[^>]*>|</table\s*>", html, re.I):
        if m.group(0).lower().startswith("</"):
            depth = max(0, depth - 1)
            if depth == 0 and start is not None:
                out.append(html[start:m.end()])
                start = None
        else:
            if depth == 0:
                start = m.start()
            depth += 1
    return out


def parse_rows(table_html):
    """Rows of cells with colspan expanded, so column i is comparable across rows."""
    rows = []
    for r in re.finditer(r"<tr.*?</tr>", table_html, re.S | re.I):
        cells = []
        for c in re.finditer(r"<(t[hd])\b([^>]*)>(.*?)</\1>", r.group(0), re.S | re.I):
            attrs, body = c.group(2), txt(c.group(3))
            m = re.search(r'colspan\s*=\s*["\']?(\d+)', attrs, re.I)
            span = int(m.group(1)) if m else 1
            cells.extend([body] * span)
        if cells:
            rows.append(cells)
    return rows


# row label -> (field, kind)
FIELDS = [
    ("フレックス", ("flex", "raw")),
    ("重量", ("weight_g", "num")),
    ("トルク", ("torque_deg", "num")),
    ("Tip径/パラレル長", ("tip_parallel_mm", "raw")),
    ("Tip径/テーパー長", ("tip_taper_mm", "raw")),
    ("Tip/テーパー長", ("tip_taper_mm", "raw")),
    ("先端形状", ("tip_shape", "raw")),
    ("先端径", ("tip_mm", "raw")),
    ("Tip径", ("tip_mm", "raw")),
    ("Butt径", ("butt_mm", "num")),
    ("手元径", ("butt_mm", "num")),
    ("シャフト長さ", ("length_mm", "num")),
    ("長さ", ("length_mm", "num")),
    ("キックポイント", ("kick_point_ja", "raw")),
    ("調子", ("kick_point_ja", "raw")),
]

FLEX_TOKENS = {"R2", "R1", "R", "SR", "S", "SX", "X", "TX", "L", "A", "FW", "M"}


def field_for(label):
    for k, v in FIELDS:
        if label.startswith(k):
            return v
    return None


def parse_table(raw, url, page_title):
    rows = parse_rows(raw)
    if not rows:
        return []

    # Row 0 spanning a single distinct value = sub-model name (e.g. "DI-5", "AD-55 R")
    submodel = None
    if rows and len(set(rows[0])) == 1 and rows[0][0]:
        submodel = rows[0][0]

    # trailing single-value row = price / origin note
    note = None
    if len(rows) > 1 and len(set(rows[-1])) == 1 and rows[-1][0]:
        if "価格" in rows[-1][0] or "製" in rows[-1][0]:
            note = rows[-1][0]

    # label -> values
    grid = {}
    ncol = 0
    for r in rows:
        if len(r) < 2:
            continue
        f = field_for(r[0])
        if f:
            grid[f[0]] = (f[1], r[1:])
            ncol = max(ncol, len(r) - 1)

    # column axis: iron numbers (#3..#10) or flex
    iron_axis = None
    for r in rows:
        if len(r) >= 2 and r[0] == "" and any(c.startswith("#") for c in r[1:]):
            iron_axis = r[1:]
            ncol = max(ncol, len(iron_axis))
            break

    flex_row = grid.get("flex", (None, None))[1]

    if iron_axis is None:
        if not flex_row:
            return []
        axis = flex_row
        axis_name = "flex"
    else:
        axis = iron_axis
        axis_name = "iron"

    ncol = max(ncol, len(axis))

    # flex for iron tables: explicit フレックス row, else trailing token of the model name
    iron_flex = None
    if axis_name == "iron":
        if flex_row and flex_row[0]:
            iron_flex = flex_row[0]
        elif submodel:
            tail = submodel.split()[-1]
            if tail.upper() in FLEX_TOKENS:
                iron_flex = tail

    items = []
    for i in range(ncol):
        if i >= len(axis) or not axis[i]:
            continue
        it = {
            "model": submodel or page_title,
            "series": page_title or None,
            "flex": None,
            "iron_no": None,
            "weight_g": None,
            "torque_deg": None,
            "butt_mm": None,
            "length_mm": None,
            "kick_point_ja": None,
            "note": note,
            "source": url,
        }
        if axis_name == "flex":
            it["flex"] = axis[i]
        else:
            it["iron_no"] = axis[i]
            it["flex"] = iron_flex

        for fld, (kind, vals) in grid.items():
            if fld == "flex" or i >= len(vals):
                continue
            v = vals[i]
            if not v:
                continue
            it[fld] = num(v) if kind == "num" else v
        items.append(it)
    return items


def parse_page(url, html):
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)
    page_title = txt(m.group(1)).split("|")[0].strip() if m else ""
    out = []
    for tbl in split_tables(html):
        out.extend(parse_table(tbl, url, page_title))
    return out


def model_urls():
    """Sitemap is authoritative: it lists tour-ad-xc and tour_ad_hd, which the
    /tourad/ nav omits. Fall back to scraping the nav if the sitemap is down."""
    sm = fetch(SITEMAP)
    links = []
    if sm:
        links = re.findall(r"<loc>(https://graphitedesign\.gd-inc\.co\.jp/tourad/[^<]+)</loc>", sm)
        links = [l for l in links if l.rstrip("/") != INDEX.rstrip("/")]
    if not links:
        print("  sitemap unavailable, falling back to nav links")
        idx = fetch(INDEX) or ""
        links = re.findall(
            r'href="(https://graphitedesign\.gd-inc\.co\.jp/tourad/[^"?#]+/)"', idx)
        links = [l for l in links if l.rstrip("/") != INDEX.rstrip("/")]
    return sorted(set(links))


def main():
    links = model_urls()
    if not links:
        print("no model pages found")
        return
    print("model pages: %d" % len(links))

    all_items, ok, empty = [], 0, []
    for u in links:
        h = fetch(u)
        if not h:
            empty.append(u)
            continue
        got = parse_page(u, h)
        if got:
            ok += 1
            all_items.extend(got)
        else:
            empty.append(u)
        print("  %-24s %3d rows" % (u.replace(BASE + "/tourad/", "").strip("/"), len(got)))
        time.sleep(0.6)

    out = {
        "source": INDEX,
        "source_sitemap": SITEMAP,
        "source_note": ("Official site of Graphite Design Inc. (JP HQ). The URL "
                        "originally supplied, www.graphitedesign.com, is an unrelated "
                        "UK graphic-design agency. touradco.com is the genuine US "
                        "official site but publishes no spec tables."),
        "fetched": TODAY,
        "brand": "Graphite Design",
        "brand_ja": "グラファイトデザイン",
        "category": "shaft",
        "line": "TOUR AD",
        "field_notes": {
            "weight_g": "重量 (g)",
            "torque_deg": "トルク (deg)",
            "butt_mm": "Butt径 (mm)",
            "length_mm": "シャフト長さ (mm)",
            "kick_point_ja": "キックポイント (JP term, left verbatim)",
            "iron_no": "iron tables only: column is iron number, not flex",
        },
        "pages_ok": ok,
        "pages_empty": empty,
        "items": all_items,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print("\nitems: %d   pages ok: %d   pages w/o table: %d" % (len(all_items), ok, len(empty)))
    keys = ["flex", "iron_no", "weight_g", "torque_deg", "butt_mm", "length_mm",
            "kick_point_ja", "tip_parallel_mm", "tip_taper_mm"]
    for k in keys:
        c = sum(1 for it in all_items if it.get(k) not in (None, ""))
        print("  %-18s %3d/%d" % (k, c, len(all_items)))
    print("saved ->", OUT)


if __name__ == "__main__":
    main()
