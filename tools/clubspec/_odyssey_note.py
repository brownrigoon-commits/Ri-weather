# -*- coding: utf-8 -*-
"""오디세이 JSON 에 사용상 주의 note 추가 (모델명 중복 / 실패 1건 사유)."""
import sys, io, json, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

P = r"C:/Users/PC/Desktop/Ri-weather/coursedata/clubspecs/odyssey_putter.json"
j = json.load(open(P, encoding="utf-8"))
c = collections.Counter(i["model"] for i in j["items"])
dups = sorted(m for m, n in c.items() if n > 1)

extra = (" / 주의: 스펙표의 Model 열은 'Seven', 'Jailbird' 처럼 짧은 이름이라 "
         "제품군이 다르면 같은 이름이 반복된다. 항목 식별은 model 이 아니라 "
         "items[].url (제품 상세 URL) 을 키로 쓸 것. "
         f"중복 이름: {', '.join(dups)}. "
         "실패 1건(dfx-2-ball-blade-ch)은 해당 공식 페이지에 스펙표 자체가 없어서이며 "
         "값을 지어내지 않고 failed 에만 남겼다.")
if "주의: 스펙표의 Model 열은" not in j["note"]:
    j["note"] += extra
j["duplicate_model_names"] = dups

with open(P, "w", encoding="utf-8") as f:
    json.dump(j, f, ensure_ascii=False, indent=2)
print("중복 모델명:", dups)
print("note 갱신 완료")
