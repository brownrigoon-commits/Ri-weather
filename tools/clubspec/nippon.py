# -*- coding: utf-8 -*-
"""
Nippon Shaft (N.S.PRO) steel iron shaft specs -> coursedata/clubspecs/nippon.json

Official source: https://nipponshaft.com/product/steel/   (manufacturer's own site)
NOTE: nssgolf.com/product/ returns 404 - the live official domain is nipponshaft.com.

Spec table columns on each product page:
  PRODUCT | FLEX | LENGTH INCH (IRON #) | WEIGHT (G) | BALANCE POINT (%)
  | TORQUE (deg) | KICK POINT | SHAFT DIAMETER (IN) Butt | ... Tip
The table uses rowspan heavily; _ironshaft_lib expands it into a full grid.
"""
import sys, os, io, re, time, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from _ironshaft_lib import fetch, parse_tables, page_title, row_to_spec, save, clean

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "coursedata", "clubspecs", "nippon.json")
BASE = "https://nipponshaft.com"
LIST = BASE + "/product/steel/"
TODAY = datetime.date.today().isoformat()


def discover():
    h = fetch(LIST)
    seen, out = set(), []
    for m in re.finditer(r'href="([^"]*steel_[\w]+\.php)"[^>]*>(.*?)</a>', h, re.S | re.I):
        href = m.group(1)
        if href.endswith("steel_spec.php"):        # comparison page, not a product
            continue
        url = href if href.startswith("http") else BASE + href
        if url in seen:
            continue
        seen.add(url)
        out.append((url, clean(m.group(2))))
    return out


def main():
    products = discover()
    print(f"[nippon] discovered {len(products)} product pages from {LIST}")
    items, failed = [], []
    for i, (url, listing_name) in enumerate(products, 1):
        try:
            h = fetch(url)
        except Exception as e:                                  # noqa: BLE001
            print(f"  !! {url} -> {type(e).__name__} {e}")
            failed.append({"url": url, "error": f"{type(e).__name__}: {e}"})
            continue
        model = page_title(h)
        tables = parse_tables(h)
        flexes = []
        for t in tables:
            hdrs = t["headers"]
            # Some single-flex models (e.g. Zelos 6) have no FLEX column at all.
            # Accept any spec table that carries a WEIGHT column; leave flex null
            # when the manufacturer does not state one - never guess it.
            if not any("WEIGHT" in x.upper() for x in hdrs):
                continue
            for r in t["rows"]:
                sp = row_to_spec(hdrs, r)
                if sp.get("flex") or sp.get("weight_text"):
                    sp.setdefault("flex", None)
                    flexes.append(sp)
        if not flexes:
            print(f"  ?? {model or url}: no spec rows ({len(tables)} tables)")
            failed.append({"url": url, "error": "no spec rows parsed"})
            continue
        items.append({"model": model, "listing_name": listing_name,
                      "source": url, "fetched": TODAY, "flexes": flexes})
        print(f"  [{i:2}/{len(products)}] {model:38} rows={len(flexes)}")
        time.sleep(0.5)

    rows = sum(len(x["flexes"]) for x in items)
    payload = {
        "source": LIST,
        "fetched": TODAY,
        "brand": "Nippon Shaft (N.S.PRO)",
        "category": "iron_shaft_steel",
        "source_note": ("Manufacturer official site. nssgolf.com/product/ is 404; "
                        "the live official domain is nipponshaft.com. Every value is "
                        "verbatim from the product page spec table - nothing inferred. "
                        "The official STEEL SHAFTS listing also contains a few models "
                        "whose own names say WEDGE / FW / HYBRID; they are kept as-is. "
                        "950GH WF publishes a weight RANGE (e.g. '94~99'): the verbatim "
                        "text is kept in weight_text and weight_g is left null. Zelos 6 has "
                        "no FLEX column on the official page, so its flex is null, not guessed."),
        "model_count": len(items),
        "row_count": rows,
        "failed": failed,
        "items": items,
    }
    save(OUT, payload)
    print(f"[nippon] models={len(items)} flex_rows={rows} failed={len(failed)} -> {OUT}")


if __name__ == "__main__":
    main()
