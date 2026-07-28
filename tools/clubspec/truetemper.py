# -*- coding: utf-8 -*-
"""
True Temper iron shaft specs -> coursedata/clubspecs/truetemper.json

Official source: https://www.truetemper.com/collections/true-temper-iron-shafts
NOTE: the old truetempersports.com product URLs now 301-redirect to truetemper.com,
which is why the spec tables looked empty before. Product list comes from the
site's own collection endpoint, so the iron/wedge grouping is the maker's, not ours.

Each product page carries one <table> per flex variant, labelled by
<caption>Flex R300</caption>. Columns: Flex | Weight | Length | Tip Dia. | Butt Dia. | Torque
True Temper publishes TORQUE qualitatively ("Low"), not as a number -> torque_deg
stays null and the published wording is kept in torque_text.
"""
import sys, os, io, json, time, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from _ironshaft_lib import fetch, parse_tables, page_title, row_to_spec, save, uniq

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "coursedata", "clubspecs", "truetemper.json")
BASE = "https://www.truetemper.com"
COLLECTION = "true-temper-iron-shafts"
LIST = f"{BASE}/collections/{COLLECTION}"
TODAY = datetime.date.today().isoformat()


def discover():
    d = json.loads(fetch(f"{LIST}/products.json?limit=250"))
    return [(f"{BASE}/products/{p['handle']}", p.get("title", "")) for p in d.get("products", [])]


def main():
    products = discover()
    print(f"[truetemper] discovered {len(products)} products in collection '{COLLECTION}'")
    items, failed = [], []
    for i, (url, title) in enumerate(products, 1):
        try:
            h = fetch(url)
        except Exception as e:                                  # noqa: BLE001
            print(f"  !! {url} -> {type(e).__name__} {e}")
            failed.append({"url": url, "error": f"{type(e).__name__}: {e}"})
            continue
        model = page_title(h) or title
        variants, seen = [], set()
        for t in parse_tables(h):
            hdrs = t["headers"]
            if not any("WEIGHT" in x.upper() for x in hdrs):
                continue
            key = (tuple(hdrs), tuple(tuple(r) for r in t["rows"]), t["caption"])
            if key in seen:
                continue
            seen.add(key)
            specs = [row_to_spec(hdrs, r) for r in t["rows"]]
            specs = [s for s in specs if s.get("weight_text") or s.get("flex")]
            if not specs:
                continue
            weights = uniq([s.get("weight_text") for s in specs])
            wnums = uniq([s.get("weight_g") for s in specs])
            variants.append({
                # <caption> is the maker's own label for this flex block, e.g. "Flex R300"
                "variant": t["caption"] or None,
                "flex": (uniq([s.get("flex") for s in specs]) or [None])[0]
                        if len(uniq([s.get("flex") for s in specs])) == 1 else uniq([s.get("flex") for s in specs]),
                "weight_g": wnums[0] if len(wnums) == 1 else None,
                "weight_options_g": wnums if len(wnums) > 1 else None,
                "weight_text": weights[0] if len(weights) == 1 else None,
                "torque_deg": (uniq([s.get("torque_deg") for s in specs]) or [None])[0]
                              if len(uniq([s.get("torque_deg") for s in specs])) == 1 else None,
                "torque_text": (uniq([s.get("torque_text") for s in specs]) or [None])[0]
                               if len(uniq([s.get("torque_text") for s in specs])) == 1
                               else uniq([s.get("torque_text") for s in specs]),
                "lengths_in": uniq([s.get("length_text") for s in specs]),
                "tip_dia_in": uniq([s.get("tip_dia_text") for s in specs]),
                "butt_dia_in": uniq([s.get("butt_dia_text") for s in specs]),
                "row_count": len(specs),
                "rows": specs,
            })
        if not variants:
            print(f"  ?? {model}: no spec table")
            failed.append({"url": url, "error": "no spec table parsed"})
            continue
        items.append({"model": model, "source": url, "fetched": TODAY, "flexes": variants})
        print(f"  [{i:2}/{len(products)}] {model:42} variants={len(variants):2} "
              f"rows={sum(v['row_count'] for v in variants)}")
        time.sleep(0.5)

    rows = sum(sum(v["row_count"] for v in x["flexes"]) for x in items)
    vs = sum(len(x["flexes"]) for x in items)
    payload = {
        "source": LIST,
        "fetched": TODAY,
        "brand": "True Temper",
        "category": "iron_shaft",
        "source_note": ("Manufacturer official site. truetempersports.com 301-redirects to "
                        "truetemper.com - the old URLs are why the tables looked empty. "
                        "Product list is the site's own 'True Temper Iron Shafts' collection. "
                        "True Temper states TORQUE qualitatively (e.g. 'Low'), not numerically, "
                        "so torque_deg is null and the published wording is in torque_text. "
                        "No value here is inferred or interpolated."),
        "model_count": len(items),
        "variant_count": vs,
        "row_count": rows,
        "failed": failed,
        "items": items,
    }
    save(OUT, payload)
    print(f"[truetemper] models={len(items)} variants={vs} rows={rows} failed={len(failed)} -> {OUT}")


if __name__ == "__main__":
    main()
