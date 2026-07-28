# -*- coding: utf-8 -*-
"""담당 5개 JSON 최종 점검 — 필수 규격(source/fetched/items) + 필드 채움 통계."""
import sys, io, os, json, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

B = r"C:/Users/PC/Desktop/Ri-weather/coursedata/clubspecs/"
FILES = ["cleveland_wedge.json", "vokey_wedge.json",
         "odyssey_putter.json", "scotty_cameron_putter.json", "golfpride_grip.json"]

total = 0
for f in FILES:
    p = B + f
    if not os.path.exists(p):
        print(f"\n===== {f}   [파일 없음]")
        continue
    j = json.load(open(p, encoding="utf-8"))
    its = j.get("items", [])
    total += len(its)
    print(f"\n===== {f}   items={len(its)}   {os.path.getsize(p):,} bytes")
    print(f"  source : {j.get('source')}")
    print(f"  fetched: {j.get('fetched')}   brand={j.get('brand')}   category={j.get('category')}")
    # 규격 검사
    prob = []
    for k in ("source", "fetched", "brand", "category", "items"):
        if not j.get(k):
            prob.append(f"최상위 '{k}' 누락")
    if not all(isinstance(i, dict) and i.get("model") for i in its):
        prob.append("model 없는 항목 존재")
    print("  규격: " + ("OK" if not prob else " / ".join(prob)))

    # 항목별 출처 URL 보유 여부
    with_url = sum(1 for i in its if i.get("url") or i.get("product_url"))
    print(f"  항목별 URL 보유: {with_url}/{len(its)}"
          + ("  (없으면 최상위 source/sources 가 출처)" if with_url < len(its) else ""))

    cnt = collections.Counter()
    for it in its:
        for k, v in it.items():
            if v not in (None, [], {}, ""):
                cnt[k] += 1
    core = {k: v for k, v in cnt.items() if not k.endswith("_raw") and k != "specs_raw"}
    print(f"  필드 채움: {core}")

print(f"\n\n총 items = {total}")
