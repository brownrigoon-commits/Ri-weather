# -*- coding: utf-8 -*-
"""내 담당 4개 JSON 점검."""
import sys, io, json, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

B = r"C:/Users/PC/Desktop/Ri-weather/coursedata/clubspecs/"

for f in ("cleveland_wedge.json", "vokey_wedge.json",
          "scotty_cameron_putter.json", "golfpride_grip.json"):
    try:
        j = json.load(open(B + f, encoding="utf-8"))
    except FileNotFoundError:
        print(f"\n===== {f}  [없음]")
        continue
    its = j["items"]
    print(f"\n===== {f}   items={len(its)}  fetched={j.get('fetched')}")
    print("  source:", j.get("source"))
    if j.get("sources"):
        for s in j["sources"]:
            print("   -", s)
    keys = collections.Counter()
    for it in its:
        for k, v in it.items():
            if v is not None and v != [] and v != {}:
                keys[k] += 1
    print("  필드 채움:", dict(keys))
    # 그룹별 개수
    for gk in ("model_line", "family", "grind", "grip_type", "collection"):
        if any(gk in it for it in its):
            c = collections.Counter(str(it.get(gk)) for it in its)
            print(f"  {gk}: {dict(c)}")
