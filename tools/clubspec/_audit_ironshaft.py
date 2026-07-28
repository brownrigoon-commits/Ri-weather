# -*- coding: utf-8 -*-
"""Audit anomalies: non-numeric weights, odd KBS tables, torque availability."""
import sys, io, os, re, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
from _ironshaft_lib import fetch

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
D = os.path.join(ROOT, "coursedata", "clubspecs")
load = lambda k: json.load(open(os.path.join(D, k + ".json"), encoding="utf-8"))

print("--- NIPPON rows where weight is not a plain number ---")
for it in load("nippon")["items"]:
    for r in it["flexes"]:
        if r.get("weight_g") is None:
            print(f"  {it['model']:32} flex={r.get('flex')} weight_text={r.get('weight_text')!r}")
        if r.get("flex") is None:
            print(f"  {it['model']:32} NO FLEX COLUMN  weight={r.get('weight_text')!r}")

print("\n--- KBS rows with unusual columns (FREQUENCY / per-club / LAUNCH / SPIN) ---")
for it in load("kbs")["items"]:
    for g in it["spec_groups"]:
        for r in g["rows"]:
            keys = set(r.get("raw") or {})
            if keys & {"FREQUENCY", "LAUNCH", "SPIN", "4i", "5i"}:
                print(f"  {it['model']:28} section={g['section']}")
                print(f"     raw={json.dumps(r['raw'], ensure_ascii=False)}")

print("\n--- KBS rows missing weight ---")
for it in load("kbs")["items"]:
    for g in it["spec_groups"]:
        for r in g["rows"]:
            if r.get("weight_g") is None:
                print(f"  {it['model']:28} weight_text={r.get('weight_text')!r} raw={json.dumps(r['raw'], ensure_ascii=False)[:160]}")

print("\n--- TRUE TEMPER: distinct published torque wordings ---")
c = collections.Counter()
for it in load("truetemper")["items"]:
    for v in it["flexes"]:
        for r in v["rows"]:
            c[r.get("torque_text")] += 1
print("  ", dict(c))

print("\n--- Does KBS publish torque anywhere on its iron pages? (raw HTML grep) ---")
for url in ["https://kbsgolfshafts.com/products/tour",
            "https://kbsgolfshafts.com/products/c-taper",
            "https://kbsgolfshafts.com/products/tgi-tour-graphite-iron",
            "https://kbsgolfshafts.com/products/pgi-players-graphite-iron"]:
    h = fetch(url)
    hits = [m.start() for m in re.finditer(r'(?i)torque', h)]
    print(f"  {url.rsplit('/',1)[-1]:30} 'torque' occurrences: {len(hits)}")
    for p in hits[:4]:
        print("      ...", re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '|', h[max(0,p-120):p+120])))
