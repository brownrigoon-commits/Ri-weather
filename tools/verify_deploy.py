# -*- coding: utf-8 -*-
"""배포가 실제로 사용자에게 도달했는지 확인한다.
'배포 완료'라고 말하기 전에 반드시 이걸 통과시킬 것.
  - GitHub Pages 빌드 성공 여부
  - 앱이 불러오는 모든 파일이 200 으로 응답하는지 (404 페이지가 오면 앱이 깨진다)
  - 배포된 APP_VER 가 로컬과 같은지
사용: python tools/verify_deploy.py [--wait]
"""
import json, os, re, subprocess, sys, time, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://brownrigoon-commits.github.io/Ri-weather"
GH = r"C:\Program Files\GitHub CLI\gh.exe"


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
    try:
        out = subprocess.run([GH, "api", "repos/brownrigoon-commits/Ri-weather/pages/builds/latest"],
                             capture_output=True, text=True, encoding="utf-8", timeout=30).stdout
        j = json.loads(out)
        return j.get("status"), (j.get("error") or {}).get("message") or ""
    except Exception as e:
        return "unknown", str(e)[:60]


def check():
    want = local_version()
    st, err = build_status()
    problems = []
    if st != "built":
        problems.append(f"Pages 빌드 상태: {st} {err}")

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

    try:
        _, appjs = fetch("js/app.js")
        m = re.search(r'APP_VER = "(v\d+)"', appjs)
        live = m.group(1) if m else "?"
        if live != want:
            problems.append(f"배포된 버전 {live} ≠ 로컬 {want} (아직 반영 안 됨)")
    except Exception as e:
        problems.append(f"app.js 확인 실패: {str(e)[:40]}")
        live = "?"

    return problems, want, live


def main():
    wait = "--wait" in sys.argv
    tries = 20 if wait else 1
    for i in range(tries):
        problems, want, live = check()
        if not problems:
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
