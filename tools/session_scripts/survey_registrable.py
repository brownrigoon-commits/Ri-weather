# -*- coding: utf-8 -*-
"""수집된 구장 자료 전수 조사: 코스공략 등록 가능성 평가
homepages_auto/<클럽>/ 의 이미지 파일명·페이지 내용을 분석해 등급 부여
  A: 홀별 이미지 9장+ & 홀 정보 텍스트 → 바로 등록 가능성 높음
  B: 홀별 이미지 9장+ → 이미지는 있음 (텍스트 확인 필요)
  C: 홀 관련 이미지 일부(3~8장) → 부분 자료
  -: 홀맵 자료 없음
출력: coursedata/workfiles/registrable_survey.json + 콘솔 요약
"""
import glob, json, os, re, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE = os.path.join(ROOT, "coursedata", "homepages_auto")

HOLE_IMG = re.compile(r"(hole|hall|cos|course)[\s_-]?(\d{1,2})|(?:^|[_\-/])([a-dsh])(\d{1,2})\.(?:jpg|png|gif)$|"
                      r"(out|in|east|west|south|north|lake|mountain|mount|sky|ocean|valley|hill|pine|star|hue|maple|cherry)[\s_-]?(\d{1,2})",
                      re.I)
HOLE_TXT = re.compile(r"(PAR\s*[3-5]|파\s*[3-5]|코스\s*공략|공략\s*(팁|TIP|법)|HOLE|홀별)", re.I)

done = {"서서울", "몽베르", "샴발라", "더스타휴", "신라", "파주", "클럽72"}
rows = []
for d in sorted(glob.glob(os.path.join(BASE, "*"))):
    if not os.path.isdir(d):
        continue
    name = os.path.basename(d)
    if any(k in name for k in done):
        continue
    imgs = [os.path.basename(f) for f in glob.glob(os.path.join(d, "img", "*"))]
    hole_imgs = [f for f in imgs if HOLE_IMG.search(f)]
    # 홀번호 다양성(1~18 몇 개나 커버하나)
    nums = set()
    for f in hole_imgs:
        for m in re.finditer(r"(\d{1,2})", f):
            v = int(m.group(1))
            if 1 <= v <= 18:
                nums.add(v)
    txt_hits = 0
    for p in (glob.glob(os.path.join(d, "pages", "*.html")) + glob.glob(os.path.join(d, "pages_v2", "*.html")))[:30]:
        try:
            h = open(p, encoding="utf-8", errors="ignore").read()
            if HOLE_TXT.search(h):
                txt_hits += 1
        except Exception:
            pass
    if len(hole_imgs) >= 9 and len(nums) >= 8 and txt_hits >= 2:
        grade = "A"
    elif len(hole_imgs) >= 9 and len(nums) >= 8:
        grade = "B"
    elif len(hole_imgs) >= 3:
        grade = "C"
    else:
        grade = "-"
    rows.append({"club": name, "grade": grade, "hole_imgs": len(hole_imgs),
                 "nums": len(nums), "txt_pages": txt_hits, "total_imgs": len(imgs)})

rows.sort(key=lambda r: (r["grade"], -r["hole_imgs"]))
out = os.path.join(ROOT, "coursedata", "workfiles", "registrable_survey.json")
json.dump(rows, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

from collections import Counter
cnt = Counter(r["grade"] for r in rows)
print(f"조사 대상: {len(rows)}개 구장 (이미 등록된 곳 제외)")
print(f"A등급(바로 등록 후보): {cnt.get('A', 0)}개")
print(f"B등급(이미지 있음·텍스트 확인 필요): {cnt.get('B', 0)}개")
print(f"C등급(부분 자료): {cnt.get('C', 0)}개")
print(f"자료 없음: {cnt.get('-', 0)}개")
print()
print("=== A등급 목록 ===")
for r in rows:
    if r["grade"] == "A":
        print(f"  {r['club']}: 홀이미지 {r['hole_imgs']}장, 홀번호 {r['nums']}종, 정보페이지 {r['txt_pages']}개")
print()
print("=== B등급 목록 ===")
for r in rows:
    if r["grade"] == "B":
        print(f"  {r['club']}: 홀이미지 {r['hole_imgs']}장, 홀번호 {r['nums']}종")
print()
print("저장:", out)
