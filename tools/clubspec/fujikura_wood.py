# -*- coding: utf-8 -*-
"""
Fujikura wood shaft specs collector.

Source : https://fujikuragolf.com/shaft-specs/  (manufacturer official site)
Output : coursedata/clubspecs/fujikura_wood.json          (wood / driver+fairway)
         coursedata/clubspecs/fujikura_other.json         (hybrid / iron / wedge / practice)

RULES (do not violate):
  - Never invent a number. A value that cannot be read from the page stays null.
  - Every record keeps the exact original cell text in "raw" for traceability.
  - Model names are kept verbatim (English, as printed). No translation, no guessing.

The page ships all 18 spec tables in static HTML (~378KB), so plain urllib is
enough; selenium is only used as a fallback if the static fetch yields no tables.
"""

import json
import os
import re
import sys
import html as H
from datetime import date

URL = "https://fujikuragolf.com/shaft-specs/"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.abspath(os.path.join(HERE, "..", "..", "coursedata", "clubspecs"))


# --------------------------------------------------------------------------
# fetch
# --------------------------------------------------------------------------
def fetch_static(url):
    import urllib.request
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=60) as r:
        raw = r.read()
    return raw.decode("utf-8", "replace"), r.status


def fetch_selenium(url):
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    o = Options()
    o.add_argument("--headless=new")
    o.add_argument("--window-size=1400,1000")
    o.add_argument("--user-agent=" + UA)
    o.add_argument("--disable-gpu")
    o.add_argument("--no-sandbox")
    d = webdriver.Chrome(options=o)
    try:
        d.get(url)
        import time
        time.sleep(4)
        return d.page_source
    finally:
        d.quit()


# --------------------------------------------------------------------------
# html helpers
# --------------------------------------------------------------------------
def text_of(fragment):
    s = re.sub(r"(?is)<(script|style).*?</\1>", " ", fragment)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    s = H.unescape(s).replace("\xa0", " ").replace("​", "")
    return re.sub(r"\s+", " ", s).strip()


def parse_grid(table_html):
    """Expand a <table> into a rectangular grid of strings, honouring
    rowspan / colspan. Fujikura uses rowspan on the model column."""
    rows_html = re.findall(r"(?is)<tr\b.*?</tr>", table_html)
    carry = {}          # col_index -> [text, remaining_rows]
    grid = []
    for rh in rows_html:
        cells = re.findall(r"(?is)<t([hd])\b([^>]*)>(.*?)</t\1\s*>", rh)
        row = {}
        # 1) place cells still spanning down from previous rows
        for col, cv in carry.items():
            row[col] = cv[0]
        # 2) place this row's own cells into the first free columns
        col = 0
        for _tag, attrs, inner in cells:
            while col in row:
                col += 1
            txt = text_of(inner)
            rs = re.search(r'(?i)rowspan\s*=\s*"?(\d+)', attrs)
            cs = re.search(r'(?i)colspan\s*=\s*"?(\d+)', attrs)
            rs = int(rs.group(1)) if rs else 1
            cs = int(cs.group(1)) if cs else 1
            for k in range(cs):
                row[col + k] = txt
                if rs > 1:
                    # store the FULL span; step 3 decrements it once for this
                    # very row, leaving rs-1 rows still to be covered.
                    carry[col + k] = [txt, rs]
            col += cs
        # 3) age the carries
        for c in list(carry):
            carry[c][1] -= 1
            if carry[c][1] <= 0:
                del carry[c]
        if row:
            width = max(row) + 1
            grid.append([row.get(i, "") for i in range(width)])
    return grid


# --------------------------------------------------------------------------
# field mapping
# --------------------------------------------------------------------------
HEADER_MAP = {
    "model": "model",
    "flex": "flex",
    "iron": "iron",
    "length": "length_in",
    "weight": "weight_g",
    "tip flex": "tip_flex",
    "butt flex": "butt_flex",
    "torque": "torque",
    "par. tip length": "parallel_tip_in",
    "tip parallel": "parallel_tip_in",
    "par. tip": "parallel_tip_in",
    "butt diameter": "butt_diameter_in",
    "butt dia.": "butt_diameter_in",
    "tip dia.": "tip_diameter_in",
    "bend point": "bend_point",     # == kick point
    "spin": "spin",
    "launch": "launch",
    "cpm (7 iron)": "cpm_7iron",
    "cpm pro 95is (7 iron)": "cpm_pro95is_7iron",
}

# fields that should also be exposed as a number (null when not cleanly numeric)
NUMERIC = {"length_in", "weight_g", "torque", "tip_flex", "butt_flex",
           "parallel_tip_in", "butt_diameter_in", "tip_diameter_in",
           "cpm_7iron", "cpm_pro95is_7iron"}

STRINGY = {"model", "flex", "flex_variant", "iron", "bend_point", "spin", "launch"}


def to_num(s):
    """Return float only when the cell is unambiguously a single number.
    Ranges ('40-35.5'), 'TAPERED', '' -> None.  Unit marks (g, inch ") stripped."""
    if s is None:
        return None
    t = s.strip().replace("”", "").replace("″", "").replace('"', "")
    t = re.sub(r"(?i)\s*g$", "", t).strip()
    if not t:
        return None
    if not re.fullmatch(r"[+-]?(\d+\.?\d*|\.\d+)", t):
        return None
    try:
        return float(t)
    except ValueError:
        return None


# --------------------------------------------------------------------------
# section -> club category  (explicit table, derived from the page's own
# headings + verified against the data: AXIOM tables carry an "Iron" column
# and 37.5-40.5" lengths, i.e. they are iron shafts, not wood.)
# --------------------------------------------------------------------------
CATEGORY = {
    "VENTUS with Velocore+":        "wood",
    "VENTUS TR with Velocore+":     "wood",
    "VENTUS TR":                    "wood",
    "VENTUS HB with Velocore+":     "hybrid",
    "VENTUS HB":                    "hybrid",
    "AXIOM > Parallel Shaft Specs": "iron",
    "AXIOM > Taper Tip shaft Specs": "iron",
    "PRO":                          "wood",
    "PRO HB":                       "hybrid",
    "SPEEDER NX":                   "wood",
    "VISTA PRO":                    "wood",
    "VISTA PRO HYBRID":             "hybrid",
    "VISTA PRO IRON":               "iron",
    "AIR SPEEDER":                  "wood",
    "PRO IRON":                     "iron",
    "MCI":                          "iron",
    "MCI PRACTICE":                 "practice",
    "MCI WEDGE":                    "wedge",
}

# section label per table index (the page nests h4 tab title + h3/h4 sub-title)
SECTIONS = [
    "VENTUS with Velocore+",
    "VENTUS TR with Velocore+",
    "VENTUS TR",
    "VENTUS HB with Velocore+",
    "VENTUS HB",
    "AXIOM > Parallel Shaft Specs",
    "AXIOM > Taper Tip shaft Specs",
    "PRO",
    "PRO HB",
    "SPEEDER NX",
    "VISTA PRO",
    "VISTA PRO HYBRID",
    "VISTA PRO IRON",
    "AIR SPEEDER",
    "PRO IRON",
    "MCI",
    "MCI PRACTICE",
    "MCI WEDGE",
]


def build_items(html):
    tables = re.findall(r"(?is)<table\b.*?</table>", html)
    if len(tables) != len(SECTIONS):
        print(f"!! WARNING: expected {len(SECTIONS)} tables, found {len(tables)}. "
              f"Page layout changed - review before trusting output.", file=sys.stderr)

    all_items = []
    per_table = []
    for ti, tb in enumerate(tables):
        grid = parse_grid(tb)
        if not grid:
            per_table.append((ti, "", 0))
            continue
        section = SECTIONS[ti] if ti < len(SECTIONS) else f"table_{ti}"

        header_raw = grid[0]
        cols, seen_flex = [], False
        for h in header_raw:
            key = HEADER_MAP.get(h.strip().lower())
            if key == "flex":
                if seen_flex:
                    key = "flex_variant"   # AXIOM parallel: LP / MP / SP sub-column
                seen_flex = True
            cols.append(key or ("_unmapped_" + h.strip().lower()))

        n = 0
        for row in grid[1:]:
            if not any(c.strip() for c in row):
                continue
            # skip a repeated header row, if any
            if row[0].strip().lower() == "model":
                continue

            raw = {}
            item = {}
            for i, key in enumerate(cols):
                val = row[i].strip() if i < len(row) else ""
                # keep every column, even when two columns share a header name
                # (AXIOM's "Flex" spans 2 columns) - never let one clobber the other
                rk = header_raw[i] if i < len(header_raw) else f"col{i}"
                if rk in raw:
                    rk = f"{rk} ({i})"
                raw[rk] = val
                if key.startswith("_unmapped_"):
                    continue
                if key in NUMERIC:
                    item[key] = to_num(val)
                else:
                    item[key] = val if val else None

            if not item.get("model"):
                continue

            item["section"] = section
            item["category"] = CATEGORY.get(section)
            item["raw"] = raw
            all_items.append(item)
            n += 1
        per_table.append((ti, section, n))

    return all_items, per_table


ORDER = ["model", "section", "flex", "flex_variant", "iron", "length_in", "weight_g",
         "torque", "bend_point", "tip_flex", "butt_flex", "parallel_tip_in",
         "butt_diameter_in", "tip_diameter_in", "cpm_7iron", "cpm_pro95is_7iron",
         "spin", "launch", "category", "raw"]


# Core spec fields that every item must expose, even when that particular
# source table has no such column (e.g. the MCI PRACTICE table has no Flex /
# Bend Point / Spin / Launch).  They are emitted as null so that consumers can
# do item["flex"] without a KeyError.  Nothing is ever invented - a null here
# means "this column does not exist in the source table", and `raw` still shows
# exactly which columns the table really had.
CORE = ["model", "section", "flex", "length_in", "weight_g", "torque",
        "bend_point", "tip_flex", "butt_flex", "parallel_tip_in",
        "butt_diameter_in", "spin", "launch", "category"]


def ordered(it):
    o = {k: it[k] for k in ORDER if k in it}
    for k in it:
        if k not in o:
            o[k] = it[k]
    return o


def rectangular(arr):
    """Give every item in a file the same key set: CORE plus the union of the
    optional columns any table in this file provided.  Missing -> None."""
    union = set(CORE)
    for it in arr:
        union |= set(it.keys())
    union.discard("raw")
    for it in arr:
        for k in union:
            it.setdefault(k, None)
    return [ordered(it) for it in arr]


def main():
    html, status = fetch_static(URL)
    print(f"GET {URL} -> HTTP {status}, {len(html)} chars")
    n_tables = len(re.findall(r"(?is)<table\b", html))
    print(f"static tables: {n_tables}")
    if n_tables == 0:
        print("static fetch had no tables -> falling back to selenium")
        html = fetch_selenium(URL)
        print(f"selenium tables: {len(re.findall(r'(?is)<table\\b', html))}")

    items, per_table = build_items(html)

    print("\n--- rows parsed per table ---")
    for ti, sec, n in per_table:
        print(f"  [{ti:2}] {sec:32} {n:3} rows  ({CATEGORY.get(sec)})")

    today = date.today().isoformat()
    os.makedirs(OUTDIR, exist_ok=True)

    wood = rectangular([i for i in items if i["category"] == "wood"])
    other = rectangular([i for i in items if i["category"] != "wood"])

    def dump(name, category, arr):
        path = os.path.join(OUTDIR, name)
        doc = {
            "source": URL,
            "fetched": today,
            "brand": "Fujikura",
            "category": category,
            "note": ("Values transcribed verbatim from the manufacturer spec tables. "
                     "Empty/unreadable cells are null - no values are estimated. "
                     "Every item carries the same key set; a null means either the "
                     "cell was empty/non-numeric (e.g. 'TAPERED', the range '40-35.5') "
                     "or that column does not exist in that source table. "
                     "'bend_point' is the kick point. 'model' is the exact model text "
                     "of its table; combine with 'section' for the full product name. "
                     "'raw' holds the untouched original cell text of every column "
                     "that the source table actually had."),
            "count": len(arr),
            "items": arr,
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(doc, f, ensure_ascii=False, indent=2)
        print(f"wrote {path}  ({len(arr)} items)")
        return path

    dump("fujikura_wood.json", "wood", wood)
    dump("fujikura_other.json", "hybrid/iron/wedge/practice", other)

    # ---- schema self-check: one key set per file, and no typed value that
    # ---- does not trace back to its raw cell ----
    for nm, arr in (("wood", wood), ("other", other)):
        shapes = {tuple(sorted(i.keys())) for i in arr}
        if len(shapes) != 1:
            print(f"!! {nm}: {len(shapes)} differing key sets", file=sys.stderr)
        else:
            print(f"  schema ok: {nm} - {len(arr)} items, 1 key set "
                  f"({len(next(iter(shapes)))} keys)")
        for i in arr:
            for k in NUMERIC:
                v = i.get(k)
                if v is None:
                    continue
                src = [c for c in i["raw"].values() if to_num(c) == v]
                if not src:
                    print(f"!! {nm}: {i['model']} {k}={v} has no matching raw cell",
                          file=sys.stderr)

    # ---- fill-rate report (wood) ----
    print("\n--- wood field fill rate ---")
    keys = ["model", "flex", "length_in", "weight_g", "torque", "bend_point",
            "tip_flex", "butt_flex", "parallel_tip_in", "butt_diameter_in",
            "spin", "launch"]
    for k in keys:
        c = sum(1 for i in wood if i.get(k) not in (None, ""))
        print(f"  {k:20} {c:3}/{len(wood)}")

    print("\n--- distinct wood models ---")
    seen = []
    for i in wood:
        tag = (i["section"], i["model"])
        if tag not in seen:
            seen.append(tag)
    for s, m in seen:
        print(f"  {s:28} | {m}")
    print(f"\ntotal wood rows: {len(wood)}, distinct models: {len(seen)}")


if __name__ == "__main__":
    main()
