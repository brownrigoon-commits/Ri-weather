# -*- coding: utf-8 -*-
"""Strict audit of the Titleist / PING head-spec JSONs.

_verify_heads.py only asks "does this string appear somewhere on the page?".
That passes even when a number is real but attached to the wrong club, and it
cannot notice a row the parser dropped. This one re-parses each source page
from scratch and checks three things:

  1. cell-bound values  - the stored loft/lie/length/head size must sit in the
     cell for that exact (product, club-or-loft) coordinate, not merely occur
     somewhere on the page;
  2. reverse coverage   - every spec row printed on the page must exist in the
     JSON, so a silently dropped club is caught;
  3. bookkeeping        - item_count matches len(items), sources stay on the
     manufacturer domain, and no field is null (absent values are omitted).

Run:  python tools/clubspec/_verify_heads_strict.py
Exit code 0 = clean.
"""
import gzip, html as ihtml, json, os, re, sys, time
import urllib.request
from urllib.parse import urlparse

sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
SPECS = os.path.normpath(os.path.join(HERE, "..", "..", "coursedata", "clubspecs"))
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
DASH = {"-", "--", "—", "–", "", "n/a", "N/A"}
ALLOWED_DOMAINS = {"www.titleist.com", "titleist.com", "ping.com", "www.ping.com"}


# --------------------------------------------------------------- fetching
def fetch_static(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate"})
    with urllib.request.urlopen(req, timeout=40) as r:
        d = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            d = gzip.decompress(d)
    return d.decode("utf-8", "replace")


def make_drv():
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    o = Options()
    for a in ["--headless=new", "--window-size=1400,1000", "--user-agent=" + UA,
              "--disable-gpu", "--no-sandbox", "--log-level=3"]:
        o.add_argument(a)
    o.page_load_strategy = "eager"
    d = webdriver.Chrome(options=o)
    d.set_page_load_timeout(45)
    return d


def fetch_rendered(drv, url):
    from selenium.common.exceptions import TimeoutException
    try:
        drv.get(url)
    except TimeoutException:
        try:
            drv.execute_script("window.stop();")
        except Exception:
            pass
    time.sleep(3.0)
    return drv.page_source


# --------------------------------------------------------------- html bits
def txt(s):
    return re.sub(r"\s+", " ", ihtml.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def table_rows(tbl):
    out = []
    for rm in re.finditer(r"<tr[^>]*>(.*?)</tr>", tbl, re.S):
        cs = [txt(c) for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", rm.group(1), re.S)]
        if cs:
            out.append(cs)
    return out


def same(a, b):
    return re.sub(r"\s+", "", str(a or "")) == re.sub(r"\s+", "", str(b or ""))


# --------------------------------------------------------------- titleist
PID_RE = re.compile(r"/product/[^/]+/([0-9A-Za-z]+)\.html")


def titleist_grid(html, url):
    """{(product_id, column): {'cell','lie','len'}} rebuilt from the raw HTML."""
    page_pid = (PID_RE.search(url).group(1) if PID_RE.search(url) else url)
    grid = {}
    for part in re.split(r'(?=<div class="primary-specs-container)', html)[1:]:
        mh = re.search(r'<div class="primary-specs-wrapper headers".*?(<table.*?</table>)', part, re.S)
        mc = re.search(r'<div class="primary-specs-wrapper content.*?(<table.*?</table>)', part, re.S)
        if not (mh and mc):
            continue
        lab_body = re.search(r"<tbody[^>]*>(.*?)</tbody>", mh.group(1), re.S)
        dat_head = re.search(r"<thead[^>]*>(.*?)</thead>", mc.group(1), re.S)
        dat_body = re.search(r"<tbody[^>]*>(.*?)</tbody>", mc.group(1), re.S)
        if not (lab_body and dat_head and dat_body):
            continue
        lab_rows = re.findall(r"<tr[^>]*>.*?</tr>", lab_body.group(1), re.S)
        dat_rows = [[txt(c) for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", r, re.S)]
                    for r in re.findall(r"<tr[^>]*>.*?</tr>", dat_body.group(1), re.S)]
        cols = table_rows(dat_head.group(1))[-1]

        models, attrs = [], {}
        for i, lr in enumerate(lab_rows):
            vals = dat_rows[i] if i < len(dat_rows) else []
            label = txt(lr)
            if "alt=" in lr:
                m = PID_RE.search(lr)
                models.append(((m.group(1) if m else page_pid), label, vals))
            else:
                attrs.setdefault(re.sub(r"\(.*?\)|\*", "", label).strip().lower(), []).append((label, vals))

        def pick(key, label):
            generic = None
            for base, lst in attrs.items():
                if base != key:
                    continue
                for orig, arr in lst:
                    scope = re.search(r"\((.*?)\)", orig)
                    if scope:
                        a = re.sub(r"[^A-Z0-9]", "", scope.group(1).upper())
                        b = re.sub(r"[^A-Z0-9]", "", label.upper())
                        if a and a == b:
                            return arr
                    else:
                        generic = arr
            return generic

        for pid, label, vals in models:
            lie_r, len_r = pick("lie", label), pick("length", label)
            for j, col in enumerate(cols):
                grid[(pid, col)] = {
                    "cell": vals[j] if j < len(vals) else "",
                    "lie": lie_r[j] if lie_r and j < len(lie_r) else None,
                    "len": len_r[j] if len_r and j < len(len_r) else None,
                }

    # Legacy free-form layout (620 CB / 620 MB): one plain table whose rows are
    # a cross-model comparison. There are no per-row product links here, so key
    # these by the row's own label — keying them all to the page id would let
    # five different irons collapse onto one slot and hide a mismatch.
    if not grid:
        for part in re.split(r'(?=<div class="m-product-specifications__free-form)', html)[1:]:
            for t in re.findall(r"<table.*?</table>", part, re.S)[:1]:
                rs = table_rows(t)
                if len(rs) < 3:
                    continue
                cols = rs[0][1:]
                attr = {r[0].replace("*", "").strip().lower(): r[1:] for r in rs[1:]}
                for r in rs[1:]:
                    label = r[0].replace("*", "").strip()
                    if label.lower() in ("lie", "length"):
                        continue
                    for j, col in enumerate(cols):
                        grid[(nkey(label), col)] = {
                            "cell": r[1 + j] if 1 + j < len(r) else "",
                            "lie": attr.get("lie", [])[j] if j < len(attr.get("lie", [])) else None,
                            "len": attr.get("length", [])[j] if j < len(attr.get("length", [])) else None,
                            "cross_model_row": True,
                        }
    return grid


def nkey(s):
    return re.sub(r"[^A-Z0-9]", "", (s or "").upper())


def audit_titleist(fname, drv):
    doc = json.load(open(os.path.join(SPECS, fname), encoding="utf-8"))
    items = doc["items"]
    grids = {}
    for u in sorted({i["source"] for i in items}):
        grids[u] = titleist_grid(fetch_rendered(drv, u), u)

    problems, checked = [], 0
    for it in items:
        col = it.get("club") or it.get("loft_raw")
        grid = grids[it["source"]]
        g = (grid.get((it.get("product_id"), col))
             or grid.get((nkey(it.get("model_label")), col))
             or grid.get((nkey(it.get("model")), col)))
        if g is None:
            problems.append(("no such cell on page", it.get("model"), col, it["source"]))
            continue
        pairs = [("lie_raw", it.get("lie_raw"), g["lie"]),
                 ("length_raw", it.get("length_raw"), g["len"])]
        pairs.append(("loft_raw", it.get("loft_raw"), g["cell"]) if "club" in it
                     else ("hand_availability", it.get("hand_availability"), g["cell"]))
        for field, stored, live in pairs:
            checked += 1
            if not same(stored, live):
                problems.append((field, it.get("model"), col, f"json={stored!r} page={live!r}"))

    # Reverse coverage: nothing printed on a page may be absent from the JSON.
    # Cross-model rows on the legacy 620 tables are exempt — those irons are
    # collected from their own PDPs, and re-importing them here would file the
    # same club twice under two names.
    have = {(i.get("product_id"), i.get("club") or i.get("loft_raw")) for i in items}
    have |= {(nkey(i.get("model_label")), i.get("club") or i.get("loft_raw")) for i in items}
    have |= {(nkey(i.get("model")), i.get("club") or i.get("loft_raw")) for i in items}
    dropped = 0
    for u, grid in grids.items():
        for key, g in grid.items():
            if txt(g["cell"]) in DASH or g.get("cross_model_row"):
                continue
            if key not in have:
                problems.append(("row missing from json", key[0], key[1], u))
                dropped += 1
    print(f"{fname:<26} items={len(items):<4} cells_checked={checked:<5} "
          f"problems={len(problems)} (dropped_rows={dropped})")
    for p in problems[:25]:
        print("    ", p)
    return len(problems)


# --------------------------------------------------------------- ping
def audit_ping(fname):
    doc = json.load(open(os.path.join(SPECS, fname), encoding="utf-8"))
    items = doc["items"]
    by_url = {}
    for it in items:
        by_url.setdefault(it["source"], []).append(it)

    problems, checked = [], 0
    for url, its in by_url.items():
        html = fetch_static(url)
        specs = []
        for t in re.findall(r"<table[^>]*club-specs-table[^>]*>.*?</table>", html, re.S):
            kv = {r[0].upper(): r[1] for r in table_rows(t) if len(r) >= 2}
            if kv:
                specs.append(kv)
        for it in its:
            want = it["club"] if "club" in it else it["loft_raw"]
            hit = next((kv for kv in specs
                        if same(kv.get("CLUB", kv.get("LOFT")), want)), None)
            if hit is None:
                problems.append(("no such spec table", it["model"], want, url))
                continue
            for k, v in it.get("raw", {}).items():
                checked += 1
                live = hit.get(k.replace("_", " ").upper())
                if not same(v, live):
                    problems.append((k, it["model"], want, f"json={v!r} page={live!r}"))
        keys_on_page = {kv.get("CLUB", kv.get("LOFT")) for kv in specs}
        keys_in_json = {(i.get("club") if "club" in i else i["loft_raw"]) for i in its}
        for k in keys_on_page - keys_in_json:
            problems.append(("row missing from json", its[0]["model"], k, url))
    print(f"{fname:<26} items={len(items):<4} cells_checked={checked:<5} "
          f"problems={len(problems)}")
    for p in problems[:25]:
        print("    ", p)
    return len(problems)


# --------------------------------------------------------------- bookkeeping
def audit_shape(fname):
    doc = json.load(open(os.path.join(SPECS, fname), encoding="utf-8"))
    bad = []
    if doc.get("item_count") != len(doc["items"]):
        bad.append(f"item_count={doc.get('item_count')} but len(items)={len(doc['items'])}")
    for i, it in enumerate(doc["items"]):
        for k, v in it.items():
            if v is None:
                bad.append(f"items[{i}].{k} is null (absent values must be omitted)")
        d = urlparse(it.get("source", "")).netloc
        if d not in ALLOWED_DOMAINS:
            bad.append(f"items[{i}].source is off-domain: {d}")
        if not it.get("fetched"):
            bad.append(f"items[{i}] has no fetched date")
    print(f"{fname:<26} shape problems={len(bad)}")
    for b in bad[:10]:
        print("    ", b)
    return len(bad)


if __name__ == "__main__":
    total = 0
    for f in ("titleist_drivers.json", "titleist_irons.json",
              "ping_drivers.json", "ping_irons.json"):
        total += audit_shape(f)
    total += audit_ping("ping_drivers.json")
    total += audit_ping("ping_irons.json")
    drv = make_drv()
    try:
        total += audit_titleist("titleist_drivers.json", drv)
        total += audit_titleist("titleist_irons.json", drv)
    finally:
        drv.quit()
    print("\nTOTAL problems:", total)
    sys.exit(1 if total else 0)
