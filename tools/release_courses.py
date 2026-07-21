# -*- coding: utf-8 -*-
"""구장 등록 일괄 배포 스크립트
1) club72 수집본(workfiles/club72_courses.json)을 골프DB 두 항목으로 분리해 parsed.json 생성
2) holeimgdb.js 재조립 + 무결성 검사 (홀 수, 특수문자, 중괄호 균형)
3) APP_VER·sw.js 캐시 버전 +1
4) git add/commit/push (GitHub Pages 자동 배포)
사용: python tools/release_courses.py "커밋 메시지"
"""
import json, os, re, subprocess, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── 1. club72 → 스카이72 두 항목 분리 ──────────────────────────
cf = os.path.join(ROOT, "coursedata", "workfiles", "club72_courses.json")
if os.path.exists(cf):
    courses = json.load(open(cf, encoding="utf-8"))
    by_name = {c["name"]: c for c in courses}
    mapping = [
        ("스카이72 골프장 하늘코스", "club72_sky", ["하늘 OUT", "하늘 IN"]),
        ("스카이72 골프장 바다코스 (제5활주로 건설 예정지)", "club72_bada",
         ["오션 OUT", "오션 IN", "레이크 OUT", "레이크 IN", "클래식 OUT", "클래식 IN", "듄스"]),
    ]
    for dbname, folder, names in mapping:
        sel = [by_name[n] for n in names if n in by_name]
        if not sel:
            continue
        out = {"course": dbname, "source": "클럽72(옛 스카이72) 공식 홈페이지",
               "sourceUrl": "https://www.onetheclub.com/club72/course", "courses": sel}
        dst = os.path.join(ROOT, "coursedata", "homepages", folder)
        os.makedirs(dst, exist_ok=True)
        json.dump(out, open(os.path.join(dst, "parsed.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
        print(f"매핑: {dbname} ← {', '.join(c['name'] for c in sel)} ({sum(len(c['holes']) for c in sel)}홀)")

# ── 2. holeimgdb 재조립 + 검사 ────────────────────────────────
r = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "build_holeimgdb.py")],
                   capture_output=True, text=True, encoding="utf-8")
print(r.stdout.strip())
if r.returncode != 0:
    print("조립 실패:", r.stderr[:500]); sys.exit(1)
txt = open(os.path.join(ROOT, "js", "holeimgdb.js"), encoding="utf-8").read()
assert "\r" not in txt.replace("\r\n", "\n") or "\r" not in txt, "CR 문자 잔존"
assert txt.count("{") == txt.count("}"), "중괄호 불균형"
holes = txt.count("no:")
imgs = re.findall(r'img: "([^"]+)"', txt)
missing = [p for p in imgs if not os.path.exists(os.path.join(ROOT, p))]
assert not missing, f"이미지 파일 없음: {missing[:5]}"
print(f"무결성 OK: 총 {holes}홀, 이미지 {len(imgs)}개 전부 존재")

# ── 3. 버전 올리기 ────────────────────────────────────────────
app = os.path.join(ROOT, "js", "app.js")
sw = os.path.join(ROOT, "sw.js")
a = open(app, encoding="utf-8").read()
m = re.search(r'APP_VER = "v(\d+)"', a)
old, new = int(m.group(1)), int(m.group(1)) + 1
open(app, "w", encoding="utf-8", newline="\n").write(a.replace(f'APP_VER = "v{old}"', f'APP_VER = "v{new}"'))
s = open(sw, encoding="utf-8").read()
open(sw, "w", encoding="utf-8", newline="\n").write(s.replace(f"riweather-v{old}", f"riweather-v{new}"))
print(f"버전: v{old} → v{new}")

# ── 4. 커밋 + 푸시 ────────────────────────────────────────────
msg = sys.argv[1] if len(sys.argv) > 1 else f"구장 등록 배포 (v{new})"
def git(*args):
    r = subprocess.run(["git", "-C", ROOT] + list(args), capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        print("git 실패:", " ".join(args), r.stderr[:300]); sys.exit(1)
    return r.stdout
git("add", "holeimg", "coursedata/homepages", "coursedata/workfiles",
    "tools", "js/holeimgdb.js", "js/app.js", "sw.js")
git("commit", "-m", msg + f" (v{new})\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>")
git("push")
print(f"배포 완료: v{new} → GitHub Pages 반영까지 1~2분")
