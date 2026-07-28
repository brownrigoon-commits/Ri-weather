# -*- coding: utf-8 -*-
"""보조 배포 검증 — 실제 서버 대신 **원격 저장소 main** 을 확인한다.

    python tools/verify_deploy_raw.py

⛔ **이건 tools/verify_deploy.py 를 대신하지 못합니다.**
   서버가 실제로 그 파일을 내보내는지는 확인하지 못합니다.
   PC 에서는 반드시 verify_deploy.py --wait 를 쓰세요.
   이 스크립트는 클라우드 세션처럼 github.io 접속이 막힌 환경에서
   "그래도 이만큼은 확인했다" 를 남기기 위한 것입니다.

확인하는 것: index.html 이 부르는 js/css, CSS 가 부르는 이미지,
manifest, sw.js, .nojekyll 이 원격 main 에 실제로 있는지 +
APP_VER 과 sw.js 캐시 버전이 일치하는지.
"""
import re, sys, urllib.request, json
BASE = "https://raw.githubusercontent.com/brownrigoon-commits/Ri-weather/main/"

def get(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "riweather-verify"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.status, r.read()

html = get("index.html")[1].decode("utf-8")
files = ["index.html", "sw.js", "manifest.webmanifest", ".nojekyll"]
files += re.findall(r'src="(js/[^"]+\.js)"', html)
files += re.findall(r'href="(css/[^"]+\.css)"', html)
# CSS 가 부르는 이미지까지 (js/legal.js 누락 사고와 같은 구멍이 이미지에도 있었음)
css = get("css/style.css")[1].decode("utf-8")
for u in re.findall(r"""url\(\s*['"]?([^'")]+)['"]?\s*\)""", css):
    u = u.split("?")[0]
    if u.startswith(("http", "data:")):
        continue
    files.append(u.replace("../", ""))
files = list(dict.fromkeys(files))

bad, ok = [], 0
for f in files:
    try:
        st, body = get(f)
        # .nojekyll 은 내용 없는 표식 파일이라 0바이트가 정상이다
        if st != 200 or (len(body) == 0 and f != ".nojekyll"):
            bad.append(f"{f} → {st} / {len(body)}바이트")
        elif f.endswith((".js", ".css", ".html")) and b"<!DOCTYPE html>" in body[:200] and not f.endswith(".html"):
            bad.append(f"{f} → 404 페이지가 대신 옴")   # legal.js 사고와 같은 유형
        else:
            ok += 1
    except Exception as e:
        bad.append(f"{f} → {type(e).__name__}")

ver = re.search(r'APP_VER = "(v\d+)"', get("js/app.js")[1].decode("utf-8")).group(1)
swv = re.search(r'CACHE = "riweather-(v\d+)"', get("sw.js")[1].decode("utf-8")).group(1)

print(f"파일 {ok}/{len(files)} 정상")
print(f"APP_VER = {ver} · sw.js 캐시 = {swv} · 일치: {'예' if ver == swv else '아니오 ⚠️'}")
if bad:
    print("문제:"); [print("  ✘", b) for b in bad]
sys.exit(1 if bad or ver != swv else 0)
