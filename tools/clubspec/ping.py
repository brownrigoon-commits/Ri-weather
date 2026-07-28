# -*- coding: utf-8 -*-
"""
PING (ping.com) official spec scraper — drivers + irons.

Rules enforced:
  * Only ping.com (manufacturer official domain).
  * NEVER invent a number. A field that is not present on the page stays null.
  * Every item records the source URL and the fetch date.

Output: coursedata/clubspecs/ping_drivers.json, ping_irons.json
"""
import json, re, sys, time, gzip, os, html as ihtml
import urllib.request, urllib.error
from datetime import date

BASE = "https://ping.com"
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "..", "..", "coursedata", "clubspecs")
OUT_DIR = os.path.normpath(OUT_DIR)
TODAY = date.today().isoformat()

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

DRIVERS = [
    "/en-us/golf-clubs/drivers/g440-max-driver",
    "/en-us/golf-clubs/drivers/g440-max-hl-driver",
    "/en-us/golf-clubs/drivers/g440-lst-driver",
    "/en-us/golf-clubs/drivers/g440-sft-driver",
    "/en-us/golf-clubs/drivers/g440-sft-hl-driver",
    "/en-us/golf-clubs/drivers/g440-k-driver",
    "/en-us/golf-clubs/drivers/g440-k-hl-driver",
    "/en-us/golf-clubs/drivers/g430-max-driver",
    "/en-us/golf-clubs/drivers/g430-max-10k-driver",
    "/en-us/golf-clubs/drivers/g430-max-hl-driver",
    "/en-us/golf-clubs/drivers/g430-lst-driver",
    "/en-us/golf-clubs/drivers/g430-sft-driver",
    "/en-us/golf-clubs/drivers/g430-sft-hl-driver",
    "/en-us/golf-clubs/drivers/g-le3-driver",
    "/en-us/golf-clubs/drivers/g-le4-driver",
]
IRONS = [
    "/en-us/golf-clubs/irons/i230-iron",
    "/en-us/golf-clubs/irons/i240-iron",
    "/en-us/golf-clubs/irons/i530-iron",
    "/en-us/golf-clubs/irons/i540-iron",
    "/en-us/golf-clubs/irons/g440-iron",
    "/en-us/golf-clubs/irons/g440-hl-iron",
    "/en-us/golf-clubs/irons/g430-iron",
    "/en-us/golf-clubs/irons/g430-hl-iron",
    "/en-us/golf-clubs/irons/g730-iron",
    "/en-us/golf-clubs/irons/g740-iron",
    "/en-us/golf-clubs/irons/blueprint-s-iron",
    "/en-us/golf-clubs/irons/blueprint-t-iron",
    "/en-us/golf-clubs/irons/g-le3-iron",
    "/en-us/golf-clubs/irons/g-le4-iron",
]

# ---------------------------------------------------------------- fetching
def fetch(url, timeout=40, tries=3):
    last = None
    for a in range(tries):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate",
            })
            with urllib.request.urlopen(req, timeout=timeout) as r:
                d = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    d = gzip.decompress(d)
                return d.decode("utf-8", "replace")
        except Exception as e:
            last = e
            time.sleep(1.5 * (a + 1))
    raise last

# ---------------------------------------------------------------- parsing
TAG = re.compile(r"<[^>]+>")

def txt(s):
    s = re.sub(r"(?is)<(script|style).*?</\1>", " ", s)
    s = TAG.sub(" ", s)
    return re.sub(r"\s+", " ", ihtml.unescape(s)).strip()

def get_h1(doc):
    m = re.search(r"(?is)<h1[^>]*>(.*?)</h1>", doc)
    return txt(m.group(1)) if m else None

def tables(doc):
    """Return list of tables, each a list of (key, value) pairs."""
    out = []
    for tb in re.findall(r"(?is)<table.*?</table>", doc):
        rows = []
        for tr in re.findall(r"(?is)<tr.*?</tr>", tb):
            cells = [txt(c) for c in re.findall(r"(?is)<t[hd][^>]*>.*?</t[hd]>", tr)]
            cells = [c for c in cells if c != ""]
            if len(cells) >= 2:
                rows.append((cells[0], " ".join(cells[1:])))
        if rows:
            out.append(rows)
    return out

NUM = re.compile(r"-?\d+(?:\.\d+)?")

def num(v):
    """First number in the string, or None. Never fabricates."""
    if v is None:
        return None
    m = NUM.search(v.replace(",", ""))
    return float(m.group()) if m else None

def frac_inch(v):
    """'39 1/4\"' -> 39.25 ; '46\"' -> 46.0 ; else None."""
    if not v:
        return None
    s = v.replace('"', " ").replace("”", " ").strip()
    m = re.match(r"^\s*(\d+)\s+(\d+)\s*/\s*(\d+)", s)
    if m:
        w, n, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return round(w + n / d, 4) if d else None
    m = re.match(r"^\s*(\d+)\s*/\s*(\d+)", s)
    if m and int(m.group(2)):
        return round(int(m.group(1)) / int(m.group(2)), 4)
    return num(s)

def keyname(k):
    return re.sub(r"[^a-z0-9]+", "_", k.lower()).strip("_")

# Head-spec table detection: it must NOT be a shaft table.
SHAFT_KEYS = {"shaft", "flex", "weight", "launch_angle"}

def is_shaft_table(rows):
    ks = {keyname(k) for k, _ in rows}
    return "shaft" in ks or ks <= SHAFT_KEYS

def parse_product(url, category):
    doc = fetch(url)
    model = get_h1(doc)
    items, shafts = [], []
    for rows in tables(doc):
        d = {keyname(k): v for k, v in rows}
        if is_shaft_table(rows):
            shafts.append(d)
            continue
        if not d:
            continue
        rec = {
            "model": model,
            "club": d.get("club"),
            "loft_deg": num(d.get("loft")),
            "loft_raw": d.get("loft"),
            "loft_adjustability": d.get("loft_adjustability"),
            "lie_deg": num(d.get("average_lie_angle") or d.get("lie_angle")),
            "lie_raw": d.get("average_lie_angle") or d.get("lie_angle"),
            "head_size_cc": num(d.get("head_size")),
            "head_size_raw": d.get("head_size"),
            "head_weight_g": num(d.get("head_weight")),
            "length_in": frac_inch(d.get("length")),
            "length_raw": d.get("length"),
            "swingweight": d.get("swingweight"),
            "offset_in": num(d.get("offset")),
            "bounce_deg": num(d.get("bounce")),
            "power_spec_loft_deg": num(d.get("power_spec_loft")),
            "retro_spec_loft_deg": num(d.get("retro_spec_loft")),
            "raw": d,
            "source": url,
            "fetched": TODAY,
        }
        # Drop keys that are entirely absent on this page (stay honest, no zeros)
        rec = {k: v for k, v in rec.items() if v is not None or k in
               ("model", "loft_deg", "lie_deg", "source", "fetched")}
        items.append(rec)
    return model, items, shafts

def run(paths, category, outfile):
    products, n_ok, n_fail = [], 0, 0
    for p in paths:
        url = BASE + p
        try:
            model, items, shafts = parse_product(url, category)
            if not items:
                print(f"  !! no spec rows: {url}")
                n_fail += 1
                continue
            products.append({"model": model, "url": url,
                             "specs": items, "shafts": shafts})
            n_ok += 1
            print(f"  ok  {model:<28} rows={len(items):<3} shafts={len(shafts)}")
        except Exception as e:
            n_fail += 1
            print(f"  ERR {url} :: {type(e).__name__}: {e}")
        time.sleep(0.8)

    flat = []
    for pr in products:
        flat.extend(pr["specs"])

    doc = {
        "source": BASE + "/en-us/golf-clubs/" + ("drivers" if category == "driver" else "irons"),
        "fetched": TODAY,
        "brand": "PING",
        "category": category,
        "note": ("Values transcribed verbatim from PING official product pages. "
                 "Fields absent on the page are omitted rather than estimated."),
        "product_count": len(products),
        "item_count": len(flat),
        "products": [{"model": p["model"], "url": p["url"],
                      "shafts": p["shafts"]} for p in products],
        "items": flat,
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, outfile)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    print(f"-> {path}  products={len(products)} items={len(flat)} fail={n_fail}")
    return doc

if __name__ == "__main__":
    print("== PING drivers ==")
    run(DRIVERS, "driver", "ping_drivers.json")
    print("== PING irons ==")
    run(IRONS, "iron", "ping_irons.json")
