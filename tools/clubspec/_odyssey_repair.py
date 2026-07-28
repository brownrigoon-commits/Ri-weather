# -*- coding: utf-8 -*-
"""오디세이 JSON 보정 — 재수집 없이 저장된 specs_raw 로 파생필드를 다시 계산.

최초 수집 때 헤더 별칭('Standard Lengths' 복수형, 'RH-LH')을 놓쳐
lengths_in / hands 가 비어 있던 항목을 되살린다.
specs_raw 는 페이지 원문 그대로이므로 새로 만들어내는 값은 없다.
누락됐던 Hosel / Offset 열도 항목으로 승격한다.
"""
import sys, io, json, re
sys.path.insert(0, r"C:/Users/PC/Desktop/Ri-weather/tools/clubspec")

# odyssey_putter 가 import 시점에 sys.stdout 을 UTF-8 로 감싼다.
# 여기서 또 감싸면 원래 래퍼가 GC 되며 버퍼를 닫아버리므로, import 에 맡긴다.
from odyssey_putter import build_item, norm_head        # 동일 로직 재사용

P = r"C:/Users/PC/Desktop/Ri-weather/coursedata/clubspecs/odyssey_putter.json"
j = json.load(open(P, encoding="utf-8"))

before_len = sum(1 for i in j["items"] if i["lengths_in"])
before_hand = sum(1 for i in j["items"] if i["hands"])

new = []
for it in j["items"]:
    raw = it["specs_raw"]
    # 저장된 원문 키를 별칭 규칙으로 다시 정규화
    rec = {norm_head(k): v for k, v in raw.items()}
    ni = build_item(rec, it["url"])
    ni["family"] = it.get("family")
    if ni["model"] != it["model"]:
        print(f"  [WARN] 모델명 변화 {it['model']!r} -> {ni['model']!r}")
    new.append(ni)

j["items"] = new
j["note"] += (" / 최초 파싱에서 'Standard Lengths'(복수형)·'RH-LH' 헤더 별칭을 놓쳐 "
              "일부 항목의 길이·손잡이가 비어 있었고, 저장된 specs_raw(원문)로 "
              "재계산해 채웠다. Hosel/Offset 열도 항목으로 승격.")

with open(P, "w", encoding="utf-8") as f:
    json.dump(j, f, ensure_ascii=False, indent=2)

after_len = sum(1 for i in new if i["lengths_in"])
after_hand = sum(1 for i in new if i["hands"])
keys = ("head_type", "hosel", "loft_deg", "lie_deg", "offset", "toe_hang", "head_weight_g")
filled = {k: sum(1 for i in new if i.get(k) is not None) for k in keys}
print(f"[repair] items={len(new)}")
print(f"[repair] lengths_in {before_len} -> {after_len}   hands {before_hand} -> {after_hand}")
print(f"[repair] filled={filled}")
