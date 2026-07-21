# -*- coding: utf-8 -*-
"""골프존 코스 DB 수집기
사장님 방문 구장 + 기존 등록 구장의 검색결과/상세/홀정보를
Ri-weather/coursedata/golfzon/ 에 JSON으로 보관한다.
"""
import json, time, os, sys, urllib.request, urllib.parse
sys.stdout.reconfigure(encoding="utf-8")

OUT = r"C:\Users\디자이너\Desktop\claude\Ri-weather\coursedata\golfzon"
os.makedirs(OUT, exist_ok=True)
BASE = "https://lobby.golfzon.com/v1/dotcom"

def get(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json",
        "Referer": "https://www.golfzon.com/",
    })
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode("utf-8"))

terms = ["서서울", "자유로", "몽베르", "노스팜", "베스트밸리", "스마트KU",
         "서원힐스", "동강시스타", "더스타휴", "스타휴", "감곡", "힐마루",
         "알프스", "샴발라", "푸른솔", "라싸", "신라", "클럽72", "스카이72",
         "스프링힐스", "파주", "타이거", "필로스"]

found = {}   # ciCode -> {ccName, term}
for t in terms:
    q = urllib.parse.quote(t)
    try:
        res = get(f"{BASE}/courses/course/search/list?searchWord={q}&page=1&size=20")
        lst = res if isinstance(res, list) else res.get("list", res.get("content", []))
        names = []
        for c in lst:
            ci = c.get("ciCode")
            if ci and ci not in found:
                found[ci] = {"ccName": c.get("ccName"), "term": t, "raw": c}
            names.append(f'{c.get("ccName")}({c.get("ciCode")})')
        print(f"[검색] {t}: {len(lst)}건 — {', '.join(names[:6])}")
        json.dump(lst, open(os.path.join(OUT, f"search_{t}.json"), "w", encoding="utf-8"), ensure_ascii=False)
    except Exception as e:
        print(f"[검색] {t}: 실패 {e}")
    time.sleep(1.2)

print(f"\n총 고유 코스 {len(found)}개. 상세+홀정보 수집 시작")
ok = 0
for ci, info in found.items():
    name = (info["ccName"] or str(ci)).replace(" ", "").replace("/", "_")
    try:
        detail = get(f"{BASE}/courses/course/{ci}/details")
        time.sleep(0.8)
        holes = get(f"{BASE}/courses/course/{ci}/details/hole-info")
        json.dump({"ciCode": ci, "ccName": info["ccName"], "detail": detail, "holeInfo": holes},
                  open(os.path.join(OUT, f"cc_{ci}_{name}.json"), "w", encoding="utf-8"), ensure_ascii=False)
        nines = holes.get("holeInfoList", [])
        total = sum(len(n) for n in nines)
        print(f"  OK {info['ccName']} ({ci}): 코스 {len(nines)}개, 홀 {total}개")
        ok += 1
    except Exception as e:
        print(f"  FAIL {info['ccName']} ({ci}): {e}")
    time.sleep(1.2)

print(f"\n완료: {ok}/{len(found)} 저장 → {OUT}")
