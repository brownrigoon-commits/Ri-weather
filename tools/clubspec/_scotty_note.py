# -*- coding: utf-8 -*-
"""스카티 카메론 JSON 에 사용상 주의 note 추가 (모델명 중복).

오디세이와 같은 문제: 'Fastback', 'Squareback 2' 처럼 같은 이름이 다른 섹션
(studio-style / long-design)에 각각 존재한다. 항목 식별 키는 model 이 아니라 url.
값은 새로 만들지 않고 메타데이터만 덧붙인다.
"""
import sys, io, json, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

P = r"C:/Users/PC/Desktop/Ri-weather/coursedata/clubspecs/scotty_cameron_putter.json"
j = json.load(open(P, encoding="utf-8"))

c = collections.Counter(i["model"] for i in j["items"])
dups = sorted(m for m, n in c.items() if n > 1)

extra = (" / 주의: 같은 모델명이 다른 섹션(studio-style / long-design)에 각각 존재한다. "
         "항목 식별은 model 이 아니라 items[].url 을 키로 쓸 것. "
         f"중복 이름: {', '.join(dups)}.")
if "주의: 같은 모델명이" not in j["note"]:
    j["note"] += extra
j["duplicate_model_names"] = dups

with open(P, "w", encoding="utf-8") as f:
    json.dump(j, f, ensure_ascii=False, indent=2)

print("중복 모델명:", dups)
print("items:", len(j["items"]), "unique urls:", len({i["url"] for i in j["items"]}))
