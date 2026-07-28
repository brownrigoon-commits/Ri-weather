# -*- coding: utf-8 -*-
"""오디세이 결과 검증 — 모델명이 실제로 그 URL 의 제품과 일치하는지 대조.

수집 스크립트가 'SPECS' 아코디언을 열려고 클릭을 하므로,
혹시 클릭이 다른 제품 페이지로 이동시켜 엉뚱한 표를 가져왔을 가능성을 배제한다.
모델명 토큰이 URL 슬러그에 얼마나 들어 있는지로 판정한다.
"""
import sys, io, re, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

P = r"C:/Users/PC/Desktop/Ri-weather/coursedata/clubspecs/odyssey_putter.json"
j = json.load(open(P, encoding="utf-8"))
its = j["items"]
print(f"items={len(its)}  failed={len(j.get('failed', []))}\n")

# URL 중복 = 한 URL 에서 여러 행이 나온 경우(정상) / 모델 중복 = 의심
from collections import Counter
cm = Counter(i["model"] for i in its)
dup = {m: c for m, c in cm.items() if c > 1}
print(f"중복 모델명: {dup if dup else '없음'}\n")

NOISE = {"putters", "putter", "html", "odyssey", "db", "ch", "s", "sb", "cs", "slant",
         "2025", "2024", "2026", "2022"}


def toks(s):
    return [t for t in re.split(r"[^a-z0-9]+", s.lower()) if t and t not in NOISE]


bad = []
for it in its:
    slug = it["url"].rsplit("/", 1)[-1]
    su = re.sub(r"[^a-z0-9]+", "", slug.lower())
    mt = toks(it["model"])
    hit = [t for t in mt if t in su]
    ratio = len(hit) / len(mt) if mt else 0
    if ratio < 0.5:
        bad.append((it["model"], slug, hit, mt))

print(f"모델명 ↔ URL 슬러그 불일치 의심: {len(bad)}")
for m, s, hit, mt in bad:
    print(f"   model='{m}'  slug='{s}'  일치토큰={hit} / {mt}")

print("\n=== 전체 목록 ===")
for it in sorted(its, key=lambda x: (x.get("family") or "", x["model"])):
    print(f"  {(it.get('family') or '-'):<22} {it['model']:<34} "
          f"{str(it['head_type']):<7} loft={str(it['loft_deg']):<5} lie={str(it['lie_deg']):<5} "
          f"len={it['lengths_in']} toe={str(it['toe_hang']):<6} hw={it['head_weight_g']}")
