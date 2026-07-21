# -*- coding: utf-8 -*-
"""더스타휴 parsed.json 조립
- thestarhue_ocr.json(Gemini OCR) × starhue_official.json(공식 scourse 표) 교차검증
- 파/전장 불일치 시 중단(검증 필수 원칙)
- 티별 거리는 '검정티 == 전장'일 때만 채택 (공식 카드 자체 오류 4홀은 제외)
출력: coursedata/homepages/thestarhue/parsed.json
"""
import json, os, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
WF = os.path.join(ROOT, "coursedata", "workfiles")
ocr = json.load(open(os.path.join(WF, "thestarhue_ocr.json"), encoding="utf-8"))
off = json.load(open(os.path.join(WF, "starhue_official.json"), encoding="utf-8"))
official = {h["no"]: h for h in off["holes"]}

CMAP = {"빨강": "레드", "분홍": "핑크", "흰색": "화이트", "하늘색": "블루", "검정": "블랙", "파랑": "블루", "검은색": "블랙"}

courses = {"STAR": [], "HUE": []}
errors = []
for key, r in sorted(ocr.items()):
    if not r:
        errors.append(f"{key}: OCR 없음"); continue
    is_star = key.startswith("shole")
    cname = "STAR" if is_star else "HUE"
    n = int(key.split("_")[1])
    gno = n if is_star else 9 + n          # 공식표 홀번호(1-18)
    o = official[gno]
    if r["par"] != o["par"] or r["m"] != o["m"]:
        errors.append(f"{key}: OCR 파{r['par']}/{r['m']}m ≠ 공식 파{o['par']}/{o['m']}m")
        continue
    hole = {
        "no": n,
        "par": o["par"],
        "img": f"holeimg/thestarhue/{'s' if is_star else 'h'}{n}.jpg",
        "tip": r["tip"].strip(),
        "len": o["m"],
    }
    tees = [{"name": CMAP.get(t["color"], t["color"]), "m": t["m"]} for t in r.get("tees", [])]
    tees = list(reversed(tees))            # 긴 티(블랙)부터
    if len(tees) == 5 and tees[0]["name"] == "블랙" and tees[0]["m"] == o["m"]:
        hole["tees"] = tees
    else:
        print(f"  {key}: 범례-전장 모순 → 티별 거리 생략 (블랙 {tees[0]['m'] if tees else '?'} vs 전장 {o['m']})")
    courses[cname].append(hole)

if errors:
    print("검증 실패:"); [print(" ", e) for e in errors]; sys.exit(1)

out = {
    "course": "더스타휴 골프앤리조트",
    "source": "더스타휴 골프앤리조트 공식 홈페이지",
    "sourceUrl": "https://www.thestarhue.com/scourse.asp",
    "courses": [
        {"name": "STAR", "holes": sorted(courses["STAR"], key=lambda h: h["no"])},
        {"name": "HUE", "holes": sorted(courses["HUE"], key=lambda h: h["no"])},
    ],
}
dst = os.path.join(ROOT, "coursedata", "homepages", "thestarhue")
os.makedirs(dst, exist_ok=True)
json.dump(out, open(os.path.join(dst, "parsed.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
total = sum(len(c["holes"]) for c in out["courses"])
withtees = sum(1 for c in out["courses"] for h in c["holes"] if "tees" in h)
print(f"저장: {total}홀 (티별거리 {withtees}홀) → {os.path.join(dst, 'parsed.json')}")
