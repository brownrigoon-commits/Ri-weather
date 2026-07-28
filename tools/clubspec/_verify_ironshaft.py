# -*- coding: utf-8 -*-
"""Verify collected iron-shaft JSON: spot-check known rows, fill rates, header audit."""
import sys, io, os, json, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
D = os.path.join(ROOT, "coursedata", "clubspecs")

def load(k):
    with open(os.path.join(D, k + ".json"), encoding="utf-8") as f:
        return json.load(f)

def allrows(doc):
    for it in doc["items"]:
        if "flexes" in it:
            for v in it["flexes"]:
                if "rows" in v:
                    for r in v["rows"]:
                        yield it, r
                else:
                    yield it, v
        for g in it.get("spec_groups", []):
            for r in g["rows"]:
                yield it, r

for key in ["nippon", "truetemper", "kbs"]:
    doc = load(key)
    rows = list(allrows(doc))
    print("=" * 72)
    print(f"{key}: brand={doc['brand']} models={doc['model_count']} rows={len(rows)} "
          f"fetched={doc['fetched']} failed={len(doc['failed'])}")
    print("  source:", doc["source"])

    # ---- fill rates ----
    fields = ["flex", "weight_g", "torque_deg", "torque_text", "kick_point",
              "balance_point_pct", "length_text", "tip_dia_text", "butt_dia_text",
              "clubs", "finish", "product_code"]
    print("  field fill rates (of %d rows):" % len(rows))
    for f in fields:
        n = sum(1 for _, r in rows if r.get(f) not in (None, "", []))
        if n:
            print(f"     {f:20} {n:4}/{len(rows):4}  {100*n/len(rows):5.1f}%")
    missing = [f for f in fields if not any(r.get(f) not in (None, "", []) for _, r in rows)]
    print("     (absent entirely):", ", ".join(missing) or "-")

    # ---- header audit: what did the site actually publish? ----
    hdr = collections.Counter()
    for _, r in rows:
        for h in (r.get("raw") or {}):
            hdr[h] += 1
    print("  distinct column headers seen on the official pages:")
    for h, c in hdr.most_common():
        print(f"     {c:4}x  {h}")

# ---- spot checks against independently-read page values ----
print("=" * 72)
print("SPOT CHECKS (expected values read separately from the same official pages)")

n = load("nippon")
m = [x for x in n["items"] if "MODUS" in x["model"] and "105" in x["model"]][0]
print(" NIPPON", m["model"], m["source"])
for r in m["flexes"]:
    print(f"   flex={r.get('flex')} weight_g={r.get('weight_g')} torque_deg={r.get('torque_deg')} "
          f"kick={r.get('kick_point')} bal={r.get('balance_point_pct')} "
          f"tip={r.get('tip_dia_text')} butt={r.get('butt_dia_text')} code={r.get('product_code')}")
print("   EXPECT: R/103/1.9, S/106.5/1.7, X/112/1.6, kick=GRIP, tip=0.355, butt=0.600")

t = load("truetemper")
m = [x for x in t["items"] if x["model"] == "Dynamic Gold"][0]
print(" TRUETEMPER", m["model"], m["source"])
for v in m["flexes"]:
    print(f"   variant={v.get('variant')} flex={v.get('flex')} weight_g={v.get('weight_g')} "
          f"torque_deg={v.get('torque_deg')} torque_text={v.get('torque_text')} rows={v['row_count']}")
print("   EXPECT: R300/127, S200/127, S300/130, S400/132, X100/130, torque published as 'Low'")

k = load("kbs")
m = [x for x in k["items"] if x["model"] == "TOUR"][0]
print(" KBS", m["model"], m["source"])
for g in m["spec_groups"]:
    print("   section:", g["section"])
    for r in g["rows"]:
        print(f"     flex={r.get('flex')} weight_g={r.get('weight_g')} tip={r.get('tip_dia_text')} "
              f"len={r.get('length_text')} butt={r.get('butt_dia_text')} torque={r.get('torque_deg')}")
print("   EXPECT taper: 110/115/120/125/130 ; parallel: 120/130/133")

# ---- invariant: no numeric field without matching source text ----
print("=" * 72)
bad = 0
for key in ["nippon", "truetemper", "kbs"]:
    for it, r in allrows(load(key)):
        if r.get("weight_g") is not None and not r.get("weight_text"):
            print(" !! weight_g without source text:", key, it["model"], r); bad += 1
        if r.get("torque_deg") is not None and not r.get("torque_text"):
            print(" !! torque_deg without source text:", key, it["model"], r); bad += 1
print("fabrication guard: %d violations (numeric value with no verbatim source cell)" % bad)
