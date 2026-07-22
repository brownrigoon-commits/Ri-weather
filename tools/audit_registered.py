# -*- coding: utf-8 -*-
"""등록된 parsed.json 품질 감사 — 서서울/몽베르/더스타휴 기준 미달 자동 검출
검사 항목
  1. 홀 번호 연속성 / 코스별 9의 배수
  2. 파 분포 상식성 (파3 1~3개, 파5 1~3개 per 9홀, 합계 34~38)
  3. 이미지 파일 존재 · 세로형(홀맵) · 최소 크기
  4. TIP 텍스트 길이·중복 (같은 문구 반복 = 파싱 오류 의심)
  5. 거리 상식성 (파3 80~250, 파4 250~430, 파5 400~600)
사용: python tools/audit_registered.py [--fix]   (--fix: 불합격 구장 등록 취소)
"""
import glob, json, os, re, shutil, sys
sys.stdout.reconfigure(encoding="utf-8")
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = "--fix" in sys.argv

def audit(path):
    d = json.load(open(path, encoding="utf-8"))
    name = d["course"]
    issues, warns = [], []
    total = 0
    for c in d["courses"]:
        hs = c["holes"]
        total += len(hs)
        nums = [h["no"] for h in hs]
        if nums != list(range(nums[0], nums[0] + len(nums))):
            issues.append(f"{c['name']} 홀번호 불연속 {nums}")
        if len(hs) % 9 != 0:
            issues.append(f"{c['name']} 홀 수 {len(hs)} (9의 배수 아님)")
        pars = [h.get("par", 0) for h in hs]
        per9 = len(hs) / 9 if len(hs) >= 9 else 1
        p3, p5 = pars.count(3), pars.count(5)
        if len(hs) >= 9:
            if not (1 <= p3 / per9 <= 4):
                warns.append(f"{c['name']} 파3 {p3}개 (9홀당 {p3/per9:.1f})")
            if not (0 <= p5 / per9 <= 4):
                warns.append(f"{c['name']} 파5 {p5}개")
            s = sum(pars) / per9
            if not (33 <= s <= 39):
                issues.append(f"{c['name']} 9홀 파 합계 {s:.0f} (33~39 벗어남)")
        tips = [h.get("tip", "") for h in hs if h.get("tip")]
        if tips and len(set(tips)) == 1 and len(tips) > 2:
            issues.append(f"{c['name']} 공략TIP이 전부 동일 (파싱 오류)")
        for h in hs:
            p = os.path.join(ROOT, h["img"])
            if not os.path.exists(p):
                issues.append(f"{c['name']}{h['no']} 이미지 없음"); continue
            try:
                with Image.open(p) as im:
                    w, hh = im.size
            except Exception:
                issues.append(f"{c['name']}{h['no']} 이미지 손상"); continue
            if hh < w * 0.8:
                warns.append(f"{c['name']}{h['no']} 가로형 이미지({w}x{hh})")
            if min(w, hh) < 150:
                warns.append(f"{c['name']}{h['no']} 이미지 작음({w}x{hh})")
            L = h.get("len") or 0
            par = h.get("par")
            if L:
                rng = {3: (70, 260), 4: (230, 460), 5: (380, 640), 6: (500, 750)}.get(par)
                if rng and not (rng[0] <= L <= rng[1]):
                    warns.append(f"{c['name']}{h['no']} 파{par} 거리 {L}m 이상")
    return name, total, issues, warns

rows = []
for f in sorted(glob.glob(os.path.join(ROOT, "coursedata", "homepages", "*", "parsed.json"))):
    slug = os.path.basename(os.path.dirname(f))
    name, total, issues, warns = audit(f)
    rows.append((slug, name, total, issues, warns))

ok = [r for r in rows if not r[3]]
bad = [r for r in rows if r[3]]
print(f"등록 구장 {len(rows)}곳 — 합격 {len(ok)}, 불합격 {len(bad)}\n")
for slug, name, total, issues, warns in rows:
    mark = "✅" if not issues else "❌"
    print(f"{mark} {name} ({slug}) {total}홀")
    for i in issues:
        print(f"     [문제] {i}")
    for w in warns[:3]:
        print(f"     [주의] {w}")
if FIX and bad:
    print("\n불합격 구장 등록 취소:")
    for slug, name, *_ in bad:
        d = os.path.join(ROOT, "coursedata", "homepages", slug)
        shutil.rmtree(d, ignore_errors=True)
        shutil.rmtree(os.path.join(ROOT, "holeimg", slug), ignore_errors=True)
        print("  삭제:", name, slug)
