# -*- coding: utf-8 -*-
"""등록물 정리 — 중복·불량 자동 제거
1. 같은 구장명이 여러 slug로 등록 → 홀 수 많은 쪽만 남김
2. 코스명이 무의미(코스11, 021 등) → 제거
3. 거리 상식 위반(파별 범위) → 해당 홀의 거리 정보만 삭제 (홀맵·파·TIP은 유지)
4. 손수 만든 원본 구장(seoseoul/montvert/... )은 보호
"""
import glob, json, os, re, shutil, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HP = os.path.join(ROOT, "coursedata", "homepages")
PROTECTED = {"seoseoul", "montvert", "thestarhue", "shambhala", "shilla", "paju",
             "club72_sky", "club72_bada", "gamgok", "pinecreek", "pinevalley"}
PAR_RANGE = {3: (70, 260), 4: (230, 470), 5: (380, 650), 6: (500, 780)}
BAD_NAME = re.compile(r"^(코스)?\d+$|^코스\d+$")

def load(slug):
    p = os.path.join(HP, slug, "parsed.json")
    return json.load(open(p, encoding="utf-8")), p

def drop(slug, why):
    shutil.rmtree(os.path.join(HP, slug), ignore_errors=True)
    shutil.rmtree(os.path.join(ROOT, "holeimg", slug), ignore_errors=True)
    print(f"  삭제 {slug}: {why}")

slugs = [os.path.basename(os.path.dirname(p)) for p in glob.glob(os.path.join(HP, "*", "parsed.json"))]
info = {}
for s in slugs:
    try:
        d, _ = load(s)
    except Exception:
        drop(s, "parsed.json 손상"); continue
    info[s] = d

print("=== 1) 중복 구장명 정리 ===")
byname = {}
for s, d in info.items():
    byname.setdefault(d["course"], []).append(s)
for name, ss in byname.items():
    if len(ss) < 2:
        continue
    ss.sort(key=lambda s: (s in PROTECTED, sum(len(c["holes"]) for c in info[s]["courses"])), reverse=True)
    keep = ss[0]
    print(f"  '{name}' 중복 {len(ss)}건 → {keep} 유지")
    for s in ss[1:]:
        drop(s, f"'{name}' 중복")
        info.pop(s, None)

print("=== 2) 코스명 불량 정리 ===")
for s in list(info):
    if s in PROTECTED:
        continue
    names = [c["name"] for c in info[s]["courses"]]
    if any(BAD_NAME.match(n or "") for n in names):
        drop(s, f"코스명 불량 {names}")
        info.pop(s, None)

print("=== 2-2) 구장 내 코스명 중복 정리 ===")
for s, d in info.items():
    if s in PROTECTED:
        continue
    names = [c["name"] for c in d["courses"]]
    if len(names) > 1 and len(set(names)) < len(names):
        for i, c in enumerate(d["courses"]):
            c["name"] = chr(ord("A") + i)          # A, B, C 코스 (실제 이름 불명 → 중립 표기)
        json.dump(d, open(os.path.join(HP, s, "parsed.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"  {d['course']}: {names} → {[c['name'] for c in d['courses']]}")

print("=== 3) 거리 상식 위반 정리 ===")
fixed = 0
for s, d in info.items():
    ch = False
    for c in d["courses"]:
        for h in c["holes"]:
            rng = PAR_RANGE.get(h.get("par"))
            L = h.get("len") or 0
            tees = [t for t in h.get("tees", [])
                    if isinstance(t.get("m"), int) and rng and rng[0] * 0.75 <= t["m"] <= rng[1] * 1.1]
            if h.get("tees") and len(tees) != len(h["tees"]):
                h["tees"] = tees; ch = True
            if tees:
                if h.get("len") != max(t["m"] for t in tees):
                    h["len"] = max(t["m"] for t in tees); ch = True
            elif L and rng and not (rng[0] <= L <= rng[1]):
                h.pop("len", None); ch = True
            if not h.get("tees"):
                h.pop("tees", None); ch = True
    if ch:
        json.dump(d, open(os.path.join(HP, s, "parsed.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        fixed += 1
print(f"  거리 정보 정리: {fixed}개 구장")

print(f"\n최종 등록 구장: {len(info)}곳")
for s, d in sorted(info.items(), key=lambda x: x[1]["course"]):
    t = sum(len(c["holes"]) for c in d["courses"])
    print(f"  {d['course']} ({s}) {t}홀 — {', '.join(c['name'] for c in d['courses'])}")
