# -*- coding: utf-8 -*-
"""등록 구장명을 골프DB(golfdb.js) 표기와 일치시킴
holeimgdb의 키는 golfdb의 'n' 값과 정확히 같아야 앱에서 연결된다.
불일치 시 정규화 매칭으로 후보를 찾아 parsed.json의 course 값을 교정한다.
"""
import glob, json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def norm(s):
    return re.sub(r"(CC|GC|C\.C|G\.C|컨트리클럽|골프클럽|골프장|골프앤리조트|골프리조트|리조트|컨트리|클럽|\s|·|&|\(.*?\))", "", s or "", flags=re.I).lower()

t = open(os.path.join(ROOT, "js", "golfdb.js"), encoding="utf-8").read()
DB = json.loads(re.search(r"const GOLF_DB = (\[.*\]);", t, re.S).group(1))
kr = [g for g in DB if g.get("c") == "KR"]
by_norm = {}
for g in kr:
    by_norm.setdefault(norm(g["n"]), g["n"])

fixed = unmatched = 0
for f in sorted(glob.glob(os.path.join(ROOT, "coursedata", "homepages", "*", "parsed.json"))):
    d = json.load(open(f, encoding="utf-8"))
    name = d["course"]
    if any(g["n"] == name for g in kr):
        continue
    k = norm(name)
    cand = by_norm.get(k)
    if not cand:
        best = [(n, v) for n, v in by_norm.items() if k and (k in n or n in k) and abs(len(k) - len(n)) <= 4]
        if len(best) == 1:
            cand = best[0][1]
    if cand:
        print(f"  교정: '{name}' → '{cand}'")
        d["course"] = cand
        json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        fixed += 1
    else:
        print(f"  ⚠️ 골프DB에 없음: '{name}' (검색 불가 — 골프DB 추가 필요)")
        unmatched += 1
print(f"\n교정 {fixed}건, 미매칭 {unmatched}건")
