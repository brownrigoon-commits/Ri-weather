# -*- coding: utf-8 -*-
"""골프존에 없는 국내 구장의 공식 홈페이지 자동 탐색
golfdb.js(KR) - 골프존 클럽 = 누락 구장 → DuckDuckGo/Bing 검색으로 홈페이지 후보 확보.
결과: coursedata/homepages_missing.json  { 구장명: {url, title, via} }

사용:
  python tools/find_missing_homepages.py             # 전체
  python tools/find_missing_homepages.py --limit 10
  python tools/find_missing_homepages.py --only 베스트밸리,더스타휴
"""
import argparse, glob, json, os, re, sys, time, urllib.parse, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GZ = os.path.join(ROOT, "coursedata", "golfzon")
OUTF = os.path.join(ROOT, "coursedata", "homepages_missing.json")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"

BAD_HOSTS = re.compile(r"(naver|kakao|daum|google|youtube|facebook|instagram|kimcaddie|golfzon|smartscore|xgolf|sbs|blog|tistory|namu\.wiki|wikipedia|11st|coupang|teescanner|golfpang|dbegl|voicecaddie|golfmon|yeogi|tripadvisor|agoda)", re.I)

def norm(s):
    return re.sub(r"(CC|GC|C\.C|G\.C|컨트리클럽|골프클럽|골프장|리조트|앤|&|\s)", "", s, flags=re.I).lower()

def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ko"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read(1_200_000)
    for enc in ("utf-8", "euc-kr", "cp949"):
        try:
            return data.decode(enc)
        except Exception:
            pass
    return data.decode("utf-8", errors="ignore")

def ddg(query):
    res = []
    for endpoint in ("https://html.duckduckgo.com/html/?q=", "https://lite.duckduckgo.com/lite/?q="):
        try:
            html = fetch(endpoint + urllib.parse.quote(query))
        except Exception:
            continue
        for m in re.finditer(r'href="([^"]+)"[^>]*(?:class="result__a"[^>]*)?>(.*?)</a>', html, re.S):
            href, title = m.group(1), re.sub(r"<[^>]+>", "", m.group(2))
            if "uddg=" in href:
                q = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
                href = q.get("uddg", [href])[0]
            if href.startswith("http") and "duckduckgo" not in href:
                res.append((href, title.strip()))
        if res:
            break
    return res

def bing(query):
    u = "https://www.bing.com/search?q=" + urllib.parse.quote(query) + "&setlang=ko"
    html = fetch(u)
    res = []
    for m in re.finditer(r'<h2><a href="(http[^"]+)"[^>]*>(.*?)</a></h2>', html, re.S):
        res.append((m.group(1), re.sub(r"<[^>]+>", "", m.group(2)).strip()))
    return res

def pick(results, name):
    key = norm(name)
    for href, title in results:
        host = urllib.parse.urlparse(href).netloc
        if not host or BAD_HOSTS.search(href):
            continue
        # 제목이나 도메인에 구장명 일부가 걸리면 우선 채택
        if key[:3] and (key[:3] in norm(title) or key[:3] in norm(host)):
            return href, title
    for href, title in results:  # 차선: 포털 아닌 첫 결과
        if urllib.parse.urlparse(href).netloc and not BAD_HOSTS.search(href):
            return href, title
    return None, None

def load_missing():
    txt = open(os.path.join(ROOT, "js", "golfdb.js"), encoding="utf-8").read()
    kr = re.findall(r'\{"n":"([^"]+)","lat":[\d.]+,"lon":[\d.]+,"c":"KR"', txt)
    gz_names = set()
    for f in glob.glob(os.path.join(GZ, "cc_*.json")):
        j = json.load(open(f, encoding="utf-8"))
        if j.get("detail", {}).get("country") != 1:
            continue
        gz_names.add(norm((j.get("ccName") or "").split(" - ")[0]))
    def matched(k, g):
        if not k or not g:
            return False
        return k == g or (len(k) >= 3 and k in g) or (len(g) >= 3 and g in k)
    missing = []
    for n in kr:
        k = norm(n)
        if not any(matched(k, g) for g in gz_names):
            missing.append(n)
    return missing

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only", type=str, default="")
    ap.add_argument("--retry-missing", action="store_true", help="못 찾은 항목 재시도")
    ap.add_argument("--delay", type=float, default=7.0)
    args = ap.parse_args()
    found = {}
    if os.path.exists(OUTF):
        found = json.load(open(OUTF, encoding="utf-8"))
    missing = load_missing()
    if args.only:
        keys = [k.strip() for k in args.only.split(",")]
        missing = [n for n in missing if any(k in n for k in keys)]
    if args.limit:
        missing = missing[:args.limit]
    print(f"골프존 미보유 구장: {len(missing)}개 (기존 확보 {sum(1 for v in found.values() if v)}건)")
    consec_empty = 0
    for i, name in enumerate(missing):
        if name in found and (found[name] or not args.retry_missing):
            continue
        if consec_empty >= 8:
            print("검색엔진 차단 감지 — 5분 대기...", flush=True)
            time.sleep(300)
            consec_empty = 0
        q = f"{name} 골프장 공식 홈페이지"
        url = title = via = None
        try:
            url, title = pick(ddg(q), name)
            via = "ddg"
        except Exception:
            pass
        if not url:
            try:
                url, title = pick(bing(q), name)
                via = "bing"
            except Exception as e:
                print(f"[{i+1}/{len(missing)}] {name}: 검색 실패 {e}", flush=True)
        if url:
            found[name] = {"url": url, "title": title, "via": via}
            consec_empty = 0
            print(f"[{i+1}/{len(missing)}] {name} → {url} ({title[:30]})", flush=True)
        else:
            found[name] = None
            consec_empty += 1
            print(f"[{i+1}/{len(missing)}] {name}: 홈페이지 못 찾음", flush=True)
        json.dump(found, open(OUTF, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        time.sleep(args.delay)
    ok = sum(1 for v in found.values() if v)
    print(f"완료: {ok}/{len(found)} 홈페이지 확보 → {OUTF}")

if __name__ == "__main__":
    main()
