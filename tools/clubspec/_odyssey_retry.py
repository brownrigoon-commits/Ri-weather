# -*- coding: utf-8 -*-
"""실패한 1건 재시도 — 스펙표가 실제로 없는지 확인하고, 있으면 JSON 에 추가."""
import sys, json, time, re
sys.path.insert(0, r"C:/Users/PC/Desktop/Ri-weather/tools/clubspec")
from odyssey_putter import make_driver, parse_specs, family_of, txt

P = r"C:/Users/PC/Desktop/Ri-weather/coursedata/clubspecs/odyssey_putter.json"
j = json.load(open(P, encoding="utf-8"))
fails = list(j.get("failed", []))
print("실패 목록:", [f["url"] for f in fails])

d = make_driver()
added, still = [], []
try:
    for f in fails:
        url = f["url"]
        d.get(url)
        time.sleep(6)
        for _ in range(14):
            d.execute_script("window.scrollBy(0, 700);")
            time.sleep(0.5)
        time.sleep(3)
        doc = d.page_source
        print(f"\n[retry] {url}\n  final={d.current_url} len={len(doc)}")
        tabs = re.findall(r"<table\b.*?</table>", doc, re.S | re.I)
        print(f"  tables={len(tabs)}")
        for i, t in enumerate(tabs[:5]):
            print(f"   t{i}: {txt(t)[:220]}")
        got = parse_specs(doc, url)
        if got:
            for g in got:
                g["family"] = family_of(url)
            added.extend(got)
            print(f"  -> 수집 성공 {len(got)}건")
        else:
            still.append(f)
            print("  -> 여전히 스펙표 없음")
finally:
    d.quit()

if added:
    j["items"].extend(added)
    j["failed"] = still
    j["product_count"] = len(j["items"])
    with open(P, "w", encoding="utf-8") as fp:
        json.dump(j, fp, ensure_ascii=False, indent=2)
    print(f"\n[save] items={len(j['items'])} failed={len(still)}")
else:
    print(f"\n변경 없음. items={len(j['items'])} failed={len(still)}")
