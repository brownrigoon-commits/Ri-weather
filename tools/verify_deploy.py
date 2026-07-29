# -*- coding: utf-8 -*-
"""배포가 실제로 사용자에게 도달했는지 확인한다.
'배포 완료'라고 말하기 전에 반드시 이걸 통과시킬 것.
  - GitHub Pages 빌드 성공 여부
  - 앱이 불러오는 모든 파일이 200 으로 응답하는지 (404 페이지가 오면 앱이 깨진다)
  - 배포된 APP_VER 가 로컬과 같은지
사용: python tools/verify_deploy.py [--wait]
"""
import json, os, re, shutil, subprocess, sys, time, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://brownrigoon-commits.github.io/Ri-weather"


def find_gh():
    """gh CLI 위치. 집 PC에는 설치돼 있지 않을 수 있다."""
    for p in (r"C:\Program Files\GitHub CLI\gh.exe",
              r"C:\Program Files (x86)\GitHub CLI\gh.exe",
              os.path.expandvars(r"%LOCALAPPDATA%\GitHubCLI\gh.exe")):
        if os.path.exists(p):
            return p
    return shutil.which("gh")


GH = find_gh()


def local_version():
    a = open(os.path.join(ROOT, "js", "app.js"), encoding="utf-8").read()
    return re.search(r'APP_VER = "(v\d+)"', a).group(1)


def needed_files():
    html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    files = re.findall(r'src="(js/[^"]+\.js)"', html)
    files += re.findall(r'href="(css/[^"]+\.css)"', html)
    return ["index.html", "sw.js", "manifest.webmanifest"] + files


def fetch(path):
    url = f"{BASE}/{path}?t={int(time.time()*1000)}"
    req = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status, r.read(400000).decode("utf-8", errors="replace")


def build_status():
    """실제 배포 성공 여부는 **최신 워크플로 실행 결과**로 판정한다.

    `/pages/builds/latest` 는 짧은 간격으로 두 번 push 해서 앞 실행이
    취소(supersede)되면 그걸 'errored' 로 보고한다. 뒤 실행이 성공했는데도
    실패로 뜨는 헛경보라, v134 때 실제로 한 번 속았다. (2026-07-28)
    """
    if not GH:
        return "no-gh", "gh CLI 없음 — 빌드상태 확인 생략(HTTP 검사로 판정)"
    try:
        out = subprocess.run(
            [GH, "run", "list", "--limit", "1", "--json", "status,conclusion,displayTitle"],
            capture_output=True, text=True, encoding="utf-8", timeout=30).stdout
        runs = json.loads(out)
        if not runs:
            return "unknown", "워크플로 실행 기록 없음"
        r = runs[0]
        if r.get("status") != "completed":
            return "building", f"진행 중: {r.get('status')}"
        c = r.get("conclusion")
        return ("built" if c == "success" else c or "unknown"), r.get("displayTitle") or ""
    except Exception as e:
        return "unknown", str(e)[:60]


def check():
    want = local_version()
    st, err = build_status()
    problems, warnings = [], []
    if st == "no-gh":
        # gh 가 없어도 '버전이 갱신됐는지' 검사가 빌드 실패를 잡아낸다(빌드 실패 시 옛 버전이 계속 서빙됨)
        warnings.append(err)
    elif st != "built":
        problems.append(f"Pages 빌드 상태: {st} {err}")

    # .nojekyll 이 없으면 Pages 빌드가 조용히 실패한다 (7/22 사고 원인)
    if not os.path.exists(os.path.join(ROOT, ".nojekyll")):
        problems.append(".nojekyll 이 없습니다 — Pages 빌드가 실패합니다")

    for f in needed_files():
        try:
            code, body = fetch(f)
        except Exception as e:
            problems.append(f"{f}: 요청 실패 {str(e)[:40]}")
            continue
        # 404 는 GitHub 이 HTML 페이지를 200 으로 주기도 하므로 내용으로 판별
        if f.endswith(".js") and body.lstrip().startswith("<!DOCTYPE"):
            problems.append(f"{f}: 파일이 없습니다(404 페이지가 옴) — 앱이 깨집니다")
        elif f.endswith(".css") and body.lstrip().startswith("<!DOCTYPE"):
            problems.append(f"{f}: 파일이 없습니다(404 페이지가 옴)")

    # ── 그림 파일이 로컬과 같은 것인지 (내용까지) ──────────────────
    # 파일이 200 으로 응답한다고 최신인 게 아니다. 배포 스크립트에 assets 가
    # 빠져 있어 클럽 아이콘을 바꿔도 옛 그림이 계속 서빙됐다(2026-07-29).
    # 로컬 미리보기는 작업본을 읽으니 화면으로는 절대 못 잡는다 → 바이트로 대조한다.
    try:
        import hashlib
        adir = os.path.join(ROOT, "assets")
        for name in sorted(os.listdir(adir)) if os.path.isdir(adir) else []:
            if not name.lower().endswith((".png", ".jpg", ".svg", ".webp")):
                continue
            local = open(os.path.join(adir, name), "rb").read()
            url = f"{BASE}/assets/{name}?t={int(time.time()*1000)}"
            req = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
            with urllib.request.urlopen(req, timeout=20) as r:
                remote = r.read()
            if hashlib.md5(local).hexdigest() != hashlib.md5(remote).hexdigest():
                problems.append(
                    f"assets/{name} 이 로컬과 다릅니다 (배포 {len(remote)}B ≠ 로컬 {len(local)}B) "
                    "— git add 가 안 됐거나 배포가 아직 안 끝났습니다")
    except Exception as e:
        warnings.append(f"그림 파일 대조 생략 ({str(e)[:40]})")

    try:
        _, appjs = fetch("js/app.js")
        m = re.search(r'APP_VER = "(v\d+)"', appjs)
        live = m.group(1) if m else "?"
        if live != want:
            problems.append(f"배포된 버전 {live} ≠ 로컬 {want} (아직 반영 안 됨)")
    except Exception as e:
        problems.append(f"app.js 확인 실패: {str(e)[:40]}")
        live = "?"

    # ── 봇 차단이 실제로 서빙되는지 (2026-07-30 사장님 지시) ────────
    # robots.txt 는 신사협정이지만, 그마저 안 떠 있으면 아무 봇도 안 막는다.
    try:
        code, body = fetch("robots.txt")
        if "Disallow: /" not in body:
            problems.append("robots.txt 에 차단 규칙이 없습니다 (봇 수집 차단 풀림)")
    except Exception as e:
        problems.append(f"robots.txt 요청 실패 {str(e)[:40]} — 봇 차단이 서빙되지 않음")

    # ── 백엔드(Apps Script)가 최신인지 ─────────────────────────────
    # Apps Script 는 '저장'만으로는 서버에 반영되지 않는다. 배포를 따로 해야 한다.
    # 이걸 몰라서 두 번이나 기능이 죽은 채로 며칠을 보냈다:
    #   · 기록 백업·복구 (2026-07-27) — 사장님 기록 손실
    #   · 숙소 객실사진 우선 (2026-07-28) — 블로그 사진이 계속 나옴
    # 그래서 로컬 Code.gs 의 판(版) 표시와 서버 응답을 대조한다.
    try:
        import json as _json
        gs = os.path.join(ROOT, "tools", "apps_script", "Code.gs")
        if os.path.exists(gs):
            src = open(gs, encoding="utf-8").read()
            mv = re.search(r'BACKEND_VER\s*=\s*"([^"]+)"', src)
            murl = re.search(r'RIW_BACKEND\s*=\s*"([^"]+)"',
                             open(os.path.join(ROOT, "js", "stats.js"), encoding="utf-8").read())
            if mv and murl:
                want_ver = mv.group(1)
                req = urllib.request.Request(murl.group(1), headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=30) as r:
                    live_ver = (_json.loads(r.read().decode("utf-8")) or {}).get("ver")
                if live_ver != want_ver:
                    problems.append(
                        f"백엔드가 옛 버전입니다 (서버 {live_ver or '표시없음'} ≠ 로컬 {want_ver}) — "
                        "Apps Script 에서 '배포 관리 → 기존 배포 수정 → 새 버전' 을 해야 반영됩니다")
    except Exception as e:
        warnings.append(f"백엔드 버전 확인 생략 ({str(e)[:40]})")

    return problems, want, live, warnings


def main():
    wait = "--wait" in sys.argv
    tries = 20 if wait else 1
    for i in range(tries):
        problems, want, live, warnings = check()
        if not problems:
            for w in warnings:
                print("  ※", w)
            print(f"✅ 배포 확인 완료 — 사용자가 받는 버전 {live}, 필수 파일 모두 정상")
            return 0
        if i < tries - 1:
            print(f"[{i+1}/{tries}] 대기 중… (로컬 {want} / 배포 {live})")
            time.sleep(20)
    print("✖ 배포에 문제가 있습니다:")
    for p in problems:
        print("  -", p)
    return 1


if __name__ == "__main__":
    sys.exit(main())
