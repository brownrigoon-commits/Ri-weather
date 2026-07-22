# -*- coding: utf-8 -*-
"""구장 등록 일괄 배포 스크립트
1) club72 수집본(workfiles/club72_courses.json)을 골프DB 두 항목으로 분리해 parsed.json 생성
2) holeimgdb.js 재조립 + 무결성 검사 (홀 수, 특수문자, 중괄호 균형)
3) APP_VER·sw.js 캐시 버전 +1
4) git add/commit/push (GitHub Pages 자동 배포)
사용: python tools/release_courses.py "커밋 메시지"
"""
import json, os, re, subprocess, sys, time
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from sync import rebase_with_autofix, write_status   # 동시 배포 안전장치

# ── 1. club72 → 스카이72 두 항목 분리 ──────────────────────────
cf = os.path.join(ROOT, "coursedata", "workfiles", "club72_courses.json")
if os.path.exists(cf):
    courses = json.load(open(cf, encoding="utf-8"))
    by_name = {c["name"]: c for c in courses}
    mapping = [
        ("클럽72 하늘코스", "club72_sky", ["하늘 OUT", "하늘 IN"]),
        ("클럽72 바다코스", "club72_bada",
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

# ── 3. 커밋 → 최신화 → 버전 → 푸시 (양쪽 PC 동시 배포 안전) ──────
app = os.path.join(ROOT, "js", "app.js")
sw = os.path.join(ROOT, "sw.js")
msg = sys.argv[1] if len(sys.argv) > 1 else "구장 등록 배포"

def git(*args, check=True):
    r = subprocess.run(["git", "-C", ROOT] + list(args), capture_output=True,
                       text=True, encoding="utf-8", errors="replace")
    if check and r.returncode != 0:
        print("git 실패:", " ".join(args), r.stderr[:300]); sys.exit(1)
    return r

def stage():
    git("add", "holeimg", "coursedata/homepages", "coursedata/workfiles",
        "tools", "js/holeimgdb.js", "js/golfdb.js", "js/holesdb.js",
        "js/app.js", "sw.js", "index.html", "css/style.css", ".sync", check=False)

def bump():
    """항상 '현재 파일에 적힌 버전 +1' — 최신화 직후 호출해야 유일한 버전이 됨.
    배포 메시지를 앱의 '업데이트 알림' 문구(APP_NOTE)로도 넣어준다."""
    a = open(app, encoding="utf-8").read()
    cur = int(re.search(r'APP_VER = "v(\d+)"', a).group(1))
    nxt = cur + 1
    a = a.replace(f'APP_VER = "v{cur}"', f'APP_VER = "v{nxt}"')
    # 메시지 앞부분만 사용자에게 보여준다(괄호·버전표기 제거, 40자 이내)
    note = re.split(r"[—\-(]", msg)[0].strip()
    note = re.sub(r'["\\\n]', "", note)[:40].strip()
    if note:
        a = re.sub(r'APP_NOTE = "[^"]*"', f'APP_NOTE = "{note}"', a)
    open(app, "w", encoding="utf-8", newline="\n").write(a)
    s = open(sw, encoding="utf-8").read()
    open(sw, "w", encoding="utf-8", newline="\n").write(
        s.replace(f"riweather-v{cur}", f"riweather-v{nxt}"))
    return cur, nxt

write_status()
stage()
git("commit", "-m", f"{msg}\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>", check=False)

for attempt in range(1, 4):
    ok, stuck = rebase_with_autofix()          # 상대 PC 작업 먼저 받기(충돌 자동해결)
    if not ok:
        print("✖ 자동 해결 못 한 충돌:", ", ".join(stuck)); sys.exit(1)
    old, new = bump()                          # 받은 최신 버전 기준으로 +1
    stage()
    git("commit", "--amend", "-m",
        f"{msg} (v{new})\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>")
    p = git("push", "origin", "main", check=False)
    if p.returncode == 0:
        print(f"버전: v{old} → v{new}")
        print(f"배포 완료: v{new} → GitHub Pages 반영까지 1~2분")
        break
    print(f"· 상대 PC가 방금 배포함 → 다시 합치는 중 ({attempt}/3)")
    time.sleep(2)
else:
    print("✖ 배포 실패 — 잠시 후 다시 실행해 주세요"); sys.exit(1)
