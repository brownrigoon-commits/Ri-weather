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

# 티별 거리가 화면에 적히는 순서대로 내림차순인지 (v130 의 챔피언/백 뒤집힘 재발 방지)
from check_tees import violations as tee_violations
tee_bad, tee_note = tee_violations(ROOT)
for s in tee_note:
    print("  · 참고:", s)
if tee_bad:
    print(f"✖ 티 거리 검사 실패 {len(tee_bad)}건 — 배포를 멈춥니다")
    for s in tee_bad[:20]:
        print("   -", s)
    print("  원본 자료를 대조해 고치거나, 확인된 예외면 tools/check_tees.py 의 ALLOW 에 근거와 함께 적으세요.")
    sys.exit(1)
print("티 거리 검사 OK: 모든 홀이 거리 내림차순")

# 등록명과 자료 출처가 같은 구장인지 (2026-07-30 '그린골프클럽←골드그린GC' 사고 재발 방지)
from check_sources import violations as src_violations
src_bad, _ = src_violations(ROOT)
if src_bad:
    print(f"✖ 등록명과 자료 출처가 다릅니다 {len(src_bad)}건 — 배포를 멈춥니다")
    for s in src_bad[:20]:
        print("   -", s)
    print("  tools/check_sources.py 참고. 새 도메인이면 SITE_NAME 에 확인 결과를 적으세요.")
    sys.exit(1)
print("출처 검사 OK: 등록명과 자료 출처 일치")

# 옛 브랜드명이 사용자 화면에 남아 있는지 (2026-07-31 골프라이프→투어리스트 개명)
from check_brand import violations as brand_violations
brand_bad, _ = brand_violations(ROOT)
if brand_bad:
    print(f"✖ 옛 브랜드명이 남아 있습니다 {len(brand_bad)}건 — 배포를 멈춥니다")
    for s in brand_bad[:20]:
        print("   -", s)
    print("  tools/check_brand.py 참고.")
    sys.exit(1)
print("브랜드명 검사 OK: 사용자 화면에 옛 이름 없음")

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
    # 폴더 통째로 담는다 — 파일을 하나씩 나열하면 새로 만든 파일이 누락되어
    # 앱이 깨진 채 배포된다(실제로 js/legal.js 누락 사고 발생).
    # ⚠️ assets 가 빠져 있어서 클럽 아이콘을 바꿔도 배포에 안 들어갔다(2026-07-29).
    #    로컬 미리보기는 작업본을 그대로 읽으니 화면상으론 멀쩡해 보여 더 위험하다.
    # ⚠️ 관리자 화면(ops-k58zq.html)도 반드시 여기 있어야 한다 — v171 때 admin.html 이
    #    이 목록에 없어서, 고쳤어도 sync 를 안 거치면 배포에서 빠질 뻔했다(2026-07-31 발견).
    git("add", "holeimg", "coursedata/homepages", "coursedata/workfiles",
        "tools", "js", "css", "icons", "assets", "docs", "sw.js", "index.html",
        "ops-k58zq.html", "manifest.webmanifest", ".nojekyll", ".gitignore", ".sync",
        "robots.txt", "HANDOFF.md", "README.md", "CLAUDE.md", check=False)

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
        # 앱이 실제로 불러오는 파일이 저장소에 다 있는지 확인 (누락 배포 방지)
        need = re.findall(r'src="(js/[^"]+\.js)"', open(
            os.path.join(ROOT, "index.html"), encoding="utf-8").read())
        need += ["css/style.css", "sw.js", "index.html", "ops-k58zq.html"]
        # CSS 가 불러오는 파일(마스크·배경 이미지 등)도 확인한다.
        # js/legal.js 누락 때처럼, 참조는 있는데 저장소에 없으면 조용히 깨진다.
        css = open(os.path.join(ROOT, "css", "style.css"), encoding="utf-8").read()
        for u in re.findall(r"""url\(\s*['"]?([^'")]+)['"]?\s*\)""", css):
            u = u.split("?")[0]
            if u.startswith(("http", "data:")):
                continue
            need.append(os.path.normpath(os.path.join("css", u)).replace("\\", "/"))
        tracked = set(git("ls-files").stdout.split())
        missing = [f for f in need if f.split("?")[0] not in tracked]
        if missing:
            print("✖ 저장소에 없는 파일이 있습니다 — 앱이 깨집니다:", ", ".join(missing))
            print("  git add 로 추가한 뒤 다시 배포하세요.")
            sys.exit(1)
        print(f"필수 파일 {len(need)}개 모두 저장소에 있음")
        print(f"배포 요청 완료: v{new} → 1~2분 뒤 tools/verify_deploy.py 로 확인하세요")
        break
    print(f"· 상대 PC가 방금 배포함 → 다시 합치는 중 ({attempt}/3)")
    time.sleep(2)
else:
    print("✖ 배포 실패 — 잠시 후 다시 실행해 주세요"); sys.exit(1)
