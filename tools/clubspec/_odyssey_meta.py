# -*- coding: utf-8 -*-
"""오디세이 JSON 메타데이터 정정 — 재수집 없이 items 에서 파생되는 값만 다시 계산.

- product_count 가 실제로는 '항목 수'였다. 항목 수(item_count)와
  고유 제품 URL 수(product_count)를 분리한다.
- 길이 병합 규칙과 모델명 중복 주의를 note 에 명시한다.
- duplicate_model_names 를 다시 채운다.
값을 새로 만들어내지 않는다.
"""
import sys, io, json, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

P = r"C:/Users/PC/Desktop/Ri-weather/coursedata/clubspecs/odyssey_putter.json"
j = json.load(open(P, encoding="utf-8"))
items = j["items"]

NOTE = ("odysseygolf.com 은 odyssey.callawaygolf.com 으로 리다이렉트됨(캘러웨이 공식). "
        "각 제품 상세페이지의 'Product SPECS' 표만 파싱. "
        "표에 없는 값은 null(추정 없음). 항목별 출처는 items[].url. "
        "스펙표가 길이별로 여러 줄인 제품군(Ai-One/DFX/Eleven/MicroHinge 등)은 "
        "'길이만 다른' 줄을 한 항목으로 합치고 lengths_in 에 전체 길이를 담았다"
        "(합친 줄 수는 items[].merged_length_rows). 길이 외 값이 다르면 "
        "합치지 않으므로 한 URL 에서 항목이 2개 이상 나올 수 있다. "
        "주의: 스펙표의 Model 열은 'Seven', 'Jailbird' 처럼 짧아 제품군이 다르면 "
        "이름이 겹친다. 항목 식별은 model 이 아니라 items[].url 을 키로 쓸 것.")

dups = sorted(m for m, n in collections.Counter(i["model"] for i in items).items() if n > 1)

j["note"] = NOTE
j["item_count"] = len(items)
j["product_count"] = len({i["url"] for i in items})
j["duplicate_model_names"] = dups

# 키 순서 정리: items 를 마지막으로
items_v = j.pop("items")
j["items"] = items_v

with open(P, "w", encoding="utf-8") as f:
    json.dump(j, f, ensure_ascii=False, indent=2)

print("item_count   :", j["item_count"])
print("product_count:", j["product_count"])
print("failed       :", len(j["failed"]))
print("dup models   :", dups)
