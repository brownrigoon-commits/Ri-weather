# -*- coding: utf-8 -*-
"""lengths_in / hands 가 빈 항목의 원문 값 확인."""
import sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

j = json.load(open(r"C:/Users/PC/Desktop/Ri-weather/coursedata/clubspecs/odyssey_putter.json",
                   encoding="utf-8"))
for it in j["items"]:
    if not it["lengths_in"] or not it["hands"] or it["head_weight_g"] is None or not it["toe_hang"]:
        print(f"{it['model']:<34} len_raw={it['length_raw']!r:<28} "
              f"avail_raw={it['availability_raw']!r:<18} "
              f"toe={it['toe_hang_raw']!r} hw={it['head_weight_raw']!r}")
        print(f"    specs_raw={it['specs_raw']}")
print("\n--- 실패 목록 ---")
for f in j.get("failed", []):
    print("  ", f)
