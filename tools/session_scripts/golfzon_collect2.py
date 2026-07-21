# -*- coding: utf-8 -*-
"""골프존 보충 검색: 개명 구장·미검색 구장 변형 검색어"""
import json, time, os, sys, urllib.request, urllib.parse
sys.stdout.reconfigure(encoding="utf-8")
OUT = r"C:\Users\디자이너\Desktop\claude\Ri-weather\coursedata\golfzon"
BASE = "https://lobby.golfzon.com/v1/dotcom"

def get(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0", "Accept": "application/json",
        "Referer": "https://www.golfzon.com/"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode("utf-8"))

terms = ["원더클럽", "몽베르", "MONTVERT", "베스트", "밸리", "스카이", "SKY",
         "오션", "클럽", "감곡", "글렌", "알프스대영", "대영", "스프링", "포천",
         "더스타", "스타", "KU", "건국"]
found = {}
for t in terms:
    q = urllib.parse.quote(t)
    try:
        res = get(f"{BASE}/courses/course/search/list?searchWord={q}&page=1&size=30")
        lst = res if isinstance(res, list) else []
        names = [f'{c.get("ccName")}({c.get("ciCode")})' for c in lst]
        print(f"[{t}] {len(lst)}건: {', '.join(names[:12])}")
        for c in lst:
            found[c["ciCode"]] = c.get("ccName")
    except Exception as e:
        print(f"[{t}] 실패 {e}")
    time.sleep(1.0)

json.dump(found, open(os.path.join(OUT, "search_supplement_index.json"), "w", encoding="utf-8"), ensure_ascii=False)
