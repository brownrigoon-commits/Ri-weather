# -*- coding: utf-8 -*-
"""수집된 클럽 사이트의 솔루션 유형 분류 — 자동 등록 파서 대상 파악
지문:
  tabpane  : course_title + tab-pane 구조 (서서울 h1club / 감곡 동일 솔루션)
  holeinfo : holeInfo + swiper (몽베르형)
  asp_hole : /course/xN.asp 홀별 페이지 (샴발라형)
  table    : PAR/HOLE 표 형태
사용: python tools/pattern_scan.py
"""
import glob, json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "coursedata", "homepages_auto")

def classify(cdir):
    sigs = set()
    for p in glob.glob(os.path.join(cdir, "pages", "*.html")):
        try:
            t = open(p, encoding="utf-8", errors="ignore").read()
        except Exception:
            continue
        if 'course_title' in t and 'tab-pane' in t:
            sigs.add("tabpane")
        if 'class="holeInfo' in t:
            sigs.add("holeinfo")
        if re.search(r'/course/[a-z]\d\.asp', t):
            sigs.add("asp_hole")
        if re.search(r'코스공략|공략\s*TIP|공략포인트', t):
            sigs.add("tiptext")
        if re.search(r'(BACK|REGULAR|CHAMPION|블루|화이트|레드)\s*(TEE|티)?', t, re.I) and re.search(r'PAR|파\s*[345]', t):
            sigs.add("teetable")
    return sigs

rows = []
for m in glob.glob(os.path.join(BASE, "*", "meta.json")):
    cdir = os.path.dirname(m)
    j = json.load(open(m, encoding="utf-8"))
    sigs = classify(cdir)
    nimg = len(j.get("images", {}))
    rows.append((j["name"], sorted(sigs), nimg))

from collections import Counter
cnt = Counter()
for n, s, i in rows:
    for x in s:
        cnt[x] += 1
print("클럽 수:", len(rows))
print("지문 분포:", dict(cnt))
print()
print("=== tabpane (서서울/감곡형 — 자동 등록 1순위) ===")
for n, s, i in rows:
    if "tabpane" in s:
        print(f"  {n} (이미지 {i}) {s}")
print()
print("=== holeinfo (몽베르형) ===")
for n, s, i in rows:
    if "holeinfo" in s:
        print(f"  {n} (이미지 {i})")
