# -*- coding: utf-8 -*-
"""
Post-collection correction for the iron-shaft datasets.

Problem found in audit (2026-07-28)
-----------------------------------
kbs.json counted KBS store *per-club purchase SKU pages* as if they were
distinct shaft models:

  $-TAPER - PW                      -> same shaft as $-TAPER
  TOUR V-X Lite - 3I .. 9I/PW/SW    -> per-club SKUs, NOT distinct models

Worse, the nine "TOUR V-X Lite - <club>" pages publish a spec block
(100/110/120 g, clubs "2i - 9i", 37"-40.5") that is identical to TOUR-V and
CONTRADICTS the real "TOUR V-X Lite" product page (90/95/100 g taper +
99/102 g parallel, clubs "4i - 9i", 37"-39.5"). That is KBS's own storefront
inconsistency - the scrape is faithful to each page - but left unmarked it
means any lookup for "TOUR V-X Lite" returns conflicting weights.

This script does NOT delete or alter any scraped value. It only:
  1. tags each item with page_kind / canonical_model,
  2. flags the spec conflict on the affected pages,
  3. replaces the inflated headline counts with honest ones
     (page_count vs model_count), keeping row counts intact.

Idempotent: re-running produces the same file.
"""
import json, re, sys
from pathlib import Path

BASE = Path(r"C:\Users\PC\Desktop\Ri-weather\coursedata\clubspecs")

# "<BASE> - <CLUB>" store SKU pages, only when <BASE> exists as its own page.
SKU_SUFFIX = re.compile(r"^(?P<base>.+?)\s*-\s*(?P<club>\d+I|PW|SW|AW|GW|LW)$", re.I)


def spec_rows(item):
    return [r for g in item.get("spec_groups", []) for r in g.get("rows", [])]


def signature(rows):
    return tuple(
        tuple(sorted((str(a), str(b)) for a, b in (r.get("raw") or {}).items()))
        for r in rows
    )


def fix_kbs():
    p = BASE / "kbs.json"
    d = json.loads(p.read_text(encoding="utf-8"))
    items = d["items"]
    by_model = {it["model"]: it for it in items}

    sku_of = {}
    for it in items:
        m = SKU_SUFFIX.match(it["model"])
        if m and m.group("base") in by_model:
            sku_of[it["model"]] = m.group("base")

    for it in items:
        model = it["model"]
        it.pop("page_kind", None)
        it.pop("canonical_model", None)
        it.pop("spec_conflict", None)

        if model in sku_of:
            base = sku_of[model]
            it["page_kind"] = "per_club_sku"
            it["canonical_model"] = base
            same = signature(spec_rows(it)) == signature(spec_rows(by_model[base]))
            if not same:
                # find any other page whose table this one actually matches
                matches = [
                    o["model"] for o in items
                    if o["model"] not in sku_of and o["model"] != model
                    and signature(spec_rows(o)) == signature(spec_rows(it))
                ]
                it["spec_conflict"] = {
                    "note": (
                        "This per-club SKU page publishes a spec table that differs "
                        "from the canonical product page '%s'. Values are transcribed "
                        "verbatim from this page; do NOT treat them as the specs of "
                        "'%s'." % (base, base)
                    ),
                    "differs_from": base,
                    "matches_instead": matches,
                }
        else:
            it["page_kind"] = "primary"
            it["canonical_model"] = model

    pages = len(items)
    canonical = [it for it in items if it["page_kind"] == "primary"]
    rows_total = sum(len(spec_rows(it)) for it in items)
    rows_canonical = sum(len(spec_rows(it)) for it in canonical)

    new = {}
    for k, v in d.items():
        if k == "model_count":
            new["model_count"] = len(canonical)       # honest: distinct shaft models
            new["page_count"] = pages                 # pages actually fetched
            new["per_club_sku_page_count"] = pages - len(canonical)
        elif k == "row_count":
            new["row_count"] = rows_total
            new["row_count_canonical"] = rows_canonical
            new["count_note"] = (
                "model_count counts distinct shaft models. page_count counts product "
                "pages fetched; %d of them are per-club purchase SKUs "
                "(page_kind='per_club_sku') that republish another page's table and "
                "must not be counted as separate models. row_count is every stored "
                "row; row_count_canonical excludes SKU-page rows."
                % (pages - len(canonical))
            )
        else:
            new[k] = v
    p.write_text(json.dumps(new, ensure_ascii=False, indent=2), encoding="utf-8")
    return len(canonical), pages, rows_total, rows_canonical, sku_of


def annotate_truetemper():
    """TT has 3 pairs sharing a spec table, but they are genuinely separate
    products (finish / tolerance variants). Record that, change no counts."""
    p = BASE / "truetemper.json"
    d = json.loads(p.read_text(encoding="utf-8"))
    sig = {}
    for it in d["items"]:
        rows = [r for f in it["flexes"] for r in f.get("rows", [])]
        sig.setdefault(signature(rows), []).append(it["model"])
    shared = [v for v in sig.values() if len(v) > 1]
    d["shared_spec_groups"] = shared
    d["shared_spec_note"] = (
        "These model pairs publish identical spec tables. They are distinct "
        "retail products (finish or tolerance variants), not duplicate pages, "
        "so each is counted once in model_count."
    )
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    return shared


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    canon, pages, rt, rc, sku = fix_kbs()
    print("KBS: model_count %d (was 24), page_count %d, sku pages %d"
          % (canon, pages, pages - canon))
    print("KBS: row_count %d, row_count_canonical %d" % (rt, rc))
    for k, v in sorted(sku.items()):
        print("   SKU %-24s -> %s" % (k, v))
    print("TT shared spec groups:", annotate_truetemper())
