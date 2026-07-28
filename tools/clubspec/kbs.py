# -*- coding: utf-8 -*-
"""
KBS iron shaft specs -> coursedata/clubspecs/kbs.json

Official source: https://kbsgolfshafts.com/collections/irons  (+ the graphite-iron
models from /collections/graphite). Both groupings are KBS's own, taken from the
site's collection endpoint, so no guessing about what counts as an iron shaft.

Product pages expose the spec table twice (desktop tabs + mobile accordion);
identical tables are de-duplicated. Each table is labelled by the nearest
preceding "... TECHNICAL SPECIFICATIONS" heading, e.g. TAPER TIP / PARALLEL TIP.
Columns: FLEX | CLUBS | WEIGHT | TIP | LENGTH | BUTT OD. | FINISH
KBS does not publish a torque figure on these pages -> torque stays null.
"""
import sys, os, io, re, json, time, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from _ironshaft_lib import fetch, parse_tables, page_title, row_to_spec, save, clean

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "coursedata", "clubspecs", "kbs.json")
BASE = "https://kbsgolfshafts.com"
LIST = BASE + "/collections/irons"
TODAY = datetime.date.today().isoformat()

SECTION = re.compile(r'>\s*([A-Z0-9$\-\+\./ ]{0,40}?TECHNICAL SPECIFICATIONS)\s*<', re.I)


def collection(handle):
    d = json.loads(fetch(f"{BASE}/collections/{handle}/products.json?limit=250"))
    return d.get("products", [])


def discover():
    out, seen = [], set()
    for p in collection("irons"):
        h = p["handle"]
        if h not in seen:
            seen.add(h)
            out.append((f"{BASE}/products/{h}", p.get("title", ""), "irons"))
    # KBS also sells graphite IRON shafts, grouped under /collections/graphite.
    # Keep only the ones KBS itself names as irons.
    for p in collection("graphite"):
        h, t = p["handle"], p.get("title", "")
        if "IRON" in t.upper() and h not in seen:
            seen.add(h)
            out.append((f"{BASE}/products/{h}", t, "graphite"))
    return out


def main():
    products = discover()
    print(f"[kbs] discovered {len(products)} iron-shaft products (collections: irons + graphite)")
    items, failed = [], []
    for i, (url, title, coll) in enumerate(products, 1):
        try:
            h = fetch(url)
        except Exception as e:                                  # noqa: BLE001
            print(f"  !! {url} -> {type(e).__name__} {e}")
            failed.append({"url": url, "error": f"{type(e).__name__}: {e}"})
            continue
        model = page_title(h) or title
        labels = [(m.start(), clean(m.group(1))) for m in SECTION.finditer(h)]
        groups, seen, skipped = [], set(), []
        torque_on_page = len(re.findall(r'(?i)torque', h))
        for t in parse_tables(h):
            hdrs = t["headers"]
            up = [x.upper() for x in hdrs]
            if not any("WEIGHT" in x for x in up):
                continue
            # Some pages (e.g. GENERATION Graphite Irons) also carry a tipping /
            # frequency FITTING chart that happens to have a WEIGHT column. Its
            # "FLEX" cells hold swing-speed advice, not flexes, so it must not be
            # mixed into the spec rows. Real spec tables always state TIP or LENGTH.
            if not any(("TIP" in x or "LENGTH" in x) for x in up):
                skipped.append({"headers": hdrs, "reason": "fitting/trim chart, not a spec table"})
                continue
            key = (tuple(hdrs), tuple(tuple(r) for r in t["rows"]))
            if key in seen:                       # desktop/mobile duplicate
                continue
            seen.add(key)
            label = None
            for pos, txt in labels:
                if pos < t["start"]:
                    label = txt
                else:
                    break
            specs = [row_to_spec(hdrs, r) for r in t["rows"]]
            specs = [s for s in specs if s.get("weight_text") or s.get("flex")]
            if not specs:
                continue
            groups.append({"section": label, "row_count": len(specs), "rows": specs})
        if not groups:
            print(f"  ?? {model}: no spec table")
            failed.append({"url": url, "error": "no spec table parsed"})
            continue
        items.append({"model": model, "collection": coll, "source": url,
                      "fetched": TODAY,
                      # verified count of the word "torque" in the page source:
                      # 0 means KBS simply does not publish it for this model.
                      "torque_mentions_on_page": torque_on_page,
                      "skipped_tables": skipped or None,
                      "spec_groups": groups})
        print(f"  [{i:2}/{len(products)}] {model:38} groups={len(groups)} "
              f"rows={sum(g['row_count'] for g in groups)}")
        time.sleep(0.5)

    rows = sum(sum(g["row_count"] for g in x["spec_groups"]) for x in items)
    torque_rows = sum(1 for x in items for g in x["spec_groups"]
                      for r in g["rows"] if r.get("torque_text"))
    payload = {
        "source": LIST,
        "fetched": TODAY,
        "brand": "KBS",
        "category": "iron_shaft",
        "source_note": ("Manufacturer official site. Product list is KBS's own 'irons' "
                        "collection plus the graphite models KBS itself names as irons. "
                        "KBS publishes FLEX / CLUBS / WEIGHT / TIP / LENGTH / BUTT OD / FINISH. "
                        "TORQUE IS NOT PUBLISHED: the word 'torque' does not occur anywhere in "
                        f"the source of these product pages, so torque is null on all {rows} rows "
                        "rather than estimated (see torque_mentions_on_page per item). "
                        "Some models state a weight RANGE (e.g. '80g - 89g'); those keep the "
                        "verbatim text in weight_text and leave weight_g null. Each table is "
                        "tagged with its tip type (TAPER TIP / PARALLEL TIP) from its own heading."),
        "model_count": len(items),
        "row_count": rows,
        "rows_with_torque": torque_rows,
        "failed": failed,
        "items": items,
    }
    save(OUT, payload)
    print(f"[kbs] models={len(items)} rows={rows} torque_rows={torque_rows} "
          f"failed={len(failed)} -> {OUT}")


if __name__ == "__main__":
    main()
