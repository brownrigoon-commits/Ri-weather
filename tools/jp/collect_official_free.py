# -*- coding: utf-8 -*-
"""일본 구장 공식 홈페이지 — 무료 출처로 모으기 (2026-08-03 신설)

왜 이 도구가 생겼나
  공식 홈페이지 주소를 모르는 일본 구장이 1,140곳이다. 검색으로 찾으려 했으나 두 길이 다 막혔다.
    · DuckDuckGo 스크래핑 → 회사 망에서도 봇 감지(HTTP 202 anomaly). 우회하지 않는 원칙대로 접었다.
    · Google Custom Search JSON API → 공식 문서 "신규 고객에게 제공되지 않습니다"(2026-02).
      프로젝트 2곳에서 403 실측.
  그래서 **검색엔진을 거치지 않는 무료 출처**로 방향을 바꿨다. 골프 단체가 회원 구장 명부에
  공식 홈페이지 주소를 직접 싣는다 — 검색 결과보다 오히려 정확하다.

출처 (전부 무료·키 없음)
  · NGK 日本ゴルフ場経営者協会 加盟コース一覧
  · JGA 산하 지구 골프연맹 8곳: 北海道(HGA)·東北(TGA)·関東(KGA)·中部(CGA)·関西(KGU)·
    中国(CGU)·四国(SGU)·九州(GUK)
  · Wikidata (P856 공식 웹사이트)

지키는 것
  · robots.txt 준수(2026-08-03 실측: NGK·KGA·CGA·TGA 는 robots.txt 없음, 나머지는 /wp-admin/ 만 금지)
  · 요청 간격 1.2초 이상 · User-Agent 1종 고정
  · 403/429 를 만나면 **우회하지 않고 그 출처를 접는다**
  · 좌표는 어떤 형태로도 수집하지 않는다 — 이름과 URL 만 다룬다
  · 애그리게이터(자란·GORA·GDO 등)는 공식으로 치지 않는다

붙이는 기준 (엄격 — 틀린 주소를 넣느니 비운다)
  ① 명부의 구장명이 golfdb 구장명과 **확정 대조**된다(NameResolver, 후보 둘 이상이면 버린다)
  ② URL 이 실제로 열린다(HTTP 200)
  ③ 열린 페이지의 제목·본문 앞부분에 그 구장 이름의 핵심어가 들어 있다(엉뚱한 사이트 배제)

사용
  python tools/jp/collect_official_free.py --assoc      단체 명부 내려받기·파싱 (재실행 시 캐시 사용)
  python tools/jp/collect_official_free.py --wikidata   Wikidata 에서 공식 주소 찾기
  python tools/jp/collect_official_free.py --verify     모은 주소를 실제로 열어 확인
  python tools/jp/collect_official_free.py --merge      official_seeds.json 에 합치기
"""
import argparse, json, os, re, sys, time
import urllib.error, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import HP_JP, ROOT, NameResolver, TYPE_CLASSES, load_golfdb_jp, norm_name

SCAN = os.path.join(HP_JP, "_scan")
RAW = os.path.join(SCAN, "assoc_pages")            # 내려받은 명부 HTML (재실행 때 다시 받지 않는다)
URLS = os.path.join(SCAN, "assoc_urls.json")       # 명부에서 뽑은 {구장명: URL}
WD = os.path.join(SCAN, "wikidata_urls.json")      # Wikidata 에서 뽑은 {구장명: URL}
VERIFIED = os.path.join(SCAN, "official_verified.json")
SEEDS = os.path.join(SCAN, "official_seeds.json")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
GAP = 1.2
_last = [0.0]

PAGES = {
    "ngk_hokkaido.html": "https://www.golf-ngk.or.jp/course/hokkaido.html",
    "ngk_touhoku_kantou.html": "https://www.golf-ngk.or.jp/course/touhoku_kantou.html",
    "ngk_toukai.html": "https://www.golf-ngk.or.jp/course/toukai.html",
    "ngk_kansai.html": "https://www.golf-ngk.or.jp/course/kansai.html",
    "ngk_kyusyu.html": "https://www.golf-ngk.or.jp/course/kyusyu.html",
    "hga_clubs.html": "https://www.hga.gr.jp/clubs/",
    **{f"tga_{p}.html": f"https://www.tga.gr.jp/{p}/reports_membership.php"
       for p in ("aomori", "iwate", "miyagi", "akita", "yamagata", "fukushima")},
    "cga_aichi.html": "http://www.cga.jp/clubs_aichi/",
    "cga_gifu.html": "http://www.cga.jp/clubs_gifu/",
    "cga_mie.html": "http://www.cga.jp/clubs_mie/",
    "cga_hokuriku.html": "http://www.cga.jp/clubs_hokuriku/",
    "kgu.html": "https://www.kgu.gr.jp/accession/",
    "cgu_club.html": "https://www.cgu.gr.jp/club/",
    "sgu_clubs.html": "https://sgu.gr.jp/club_summary/",
    "guk_club.html": "https://www.guk.jp/club/",
}

AGG = re.compile(r"(jalan|gora|rakuten|gdo\.co\.jp|golfdigest|alba\.co\.jp|shotnavi|"
                 r"facebook|instagram|twitter|x\.com|youtube|wikipedia|tripadvisor|"
                 r"google\.|yahoo\.|bing\.|goo\.gl|ikyu\.com|asoview|navitime|ekiten|"
                 r"mapion|golf-medley|golf-homepage|"
                 # 관광 포털·지자체·블로그 — 제목에 구장 이름이 들어가 관문을 그냥 통과한다
                 # (那覇ゴルフ倶楽부 → okinawastory.jp 실측, 2026-08-03 반증조사)
                 r"okinawastory|kankou|kanko\.|/kanko|jnto|城下町|city\.[a-z]+\.\w+\.jp|"
                 r"pref\.[a-z]+\.jp|creativecommons|ameblo|hatenablog|livedoor|"
                 r"note\.com|fc2\.com|blogspot)", re.I)
# 관광 안내·정보 사이트 제목 — 구장 공식 사이트가 아니다
PORTAL_TITLE = re.compile(r"観光|情報(サイト|WEB)|ポータル|まとめ|ランキング|用語|辞典|口コミ")
SELF = re.compile(r"(golf-ngk\.or\.jp|kga\.gr\.jp|cga\.jp|kgu\.gr\.jp|cgu\.gr\.jp|"
                  r"sgu\.gr\.jp|guk\.jp|hga\.gr\.jp|tga\.gr\.jp|jga\.or\.jp)", re.I)
NAMEY = re.compile(r"(ゴルフ|カントリー|カンツリー|CC|GC|C\.C|G\.C|クラブ|倶楽部|リンクス|"
                   r"ヒルズ|パブリック|Golf|Country)", re.I)
NOTCLUB = re.compile(r"(連盟|協会|会報|ルール|ジュニア|競技|ハンディ|振興|リンク集|"
                     r"練習場|事務局|加盟|一覧|ログイン|サイトマップ)")


def fetch(url, cap=400_000):
    """요청 간격을 지키며 한 번 받는다. 403/429 는 그 출처를 접는 신호다."""
    w = GAP - (time.time() - _last[0])
    if w > 0:
        time.sleep(w)
    _last[0] = time.time()
    try:
        r = urllib.request.urlopen(
            urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ja"}),
            timeout=30)
        b = r.read(cap)
    except urllib.error.HTTPError as e:
        return e.code, "", url
    except Exception:
        return 0, "", url
    for enc in ("utf-8", "shift_jis", "euc-jp"):
        try:
            return r.status, b.decode(enc), r.url
        except Exception:
            pass
    return r.status, b.decode("utf-8", "ignore"), r.url


def anchors(html):
    for m in re.finditer(r'<a[^>]+href="(https?://[^"]+)"[^>]*>(.*?)</a>', html, re.S | re.I):
        name = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", m.group(2))).strip()
        yield m.group(1), name


KGA = os.path.join(SCAN, "kga_clubs.json")   # 関東ゴルフ連盟 — 구장별 상세페이지에서 받은 것


def parse_pages():
    """내려받은 명부 HTML → {구장명: 공식 URL}"""
    out = {}
    # 関東連盟은 목록에 URL 이 없어 구장별 상세페이지에서 받아 뒀다(505곳, 2026-08-03)
    if os.path.exists(KGA):
        for name, v in json.load(open(KGA, encoding="utf-8")).items():
            u = (v or {}).get("url") or ""
            if u.startswith("http") and not AGG.search(u) and not SELF.search(u):
                out.setdefault(name.strip(), u)
    for fn in sorted(os.listdir(RAW)) if os.path.isdir(RAW) else []:
        if not fn.endswith(".html"):
            continue
        html = open(os.path.join(RAW, fn), encoding="utf-8", errors="ignore").read()
        if fn.startswith("hga"):
            # 北海道: club-name 블록 안에 'ホームページ' 링크가 따로 있다
            for b in re.split(r"club-name", html)[1:]:
                m = re.match(r'[^"]*"[^>]*>\s*([^<]+?)\s*<', b)
                u = re.search(r'href="(https?://[^"]+)"[^>]*>\s*ホームページ', b[:4000])
                if m and u and not SELF.search(u.group(1)) and not AGG.search(u.group(1)):
                    out.setdefault(m.group(1).strip(), u.group(1))
            continue
        for url, name in anchors(html):
            if not name or SELF.search(url) or AGG.search(url):
                continue
            if NOTCLUB.search(name) or not NAMEY.search(name):
                continue
            out.setdefault(re.sub(r"^(一般社団法人|公益社団法人|株式会社)\s*", "", name), url)
    return out


def cmd_assoc():
    os.makedirs(RAW, exist_ok=True)
    got = 0
    for fn, url in PAGES.items():
        p = os.path.join(RAW, fn)
        if os.path.exists(p):                      # 이미 받은 것은 다시 받지 않는다
            continue
        code, html, _ = fetch(url, cap=1_500_000)
        if code in (403, 429):
            print(f"  ✖ 차단 의사표시 HTTP {code} — 이 출처를 접습니다: {url}")
            continue
        if code != 200 or not html:
            print(f"  · 실패 {code} {url}")
            continue
        open(p, "w", encoding="utf-8").write(html)
        got += 1
        print(f"  {fn} {len(html):,}B")
    urls = parse_pages()
    json.dump(urls, open(URLS, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"■ 새로 받은 명부 {got}장 · 뽑은 구장 {len(urls)}곳 → {os.path.relpath(URLS, ROOT)}")
    return 0


WD_QUERY = """SELECT ?item ?itemLabel ?site WHERE {
  ?item wdt:P31/wdt:P279* wd:Q1048525 .
  ?item wdt:P17 wd:Q17 .
  ?item wdt:P856 ?site .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ja,en". }
}"""


def cmd_wikidata():
    """일본 골프장(Q1048525) 중 공식 웹사이트(P856)가 적힌 것 전부.

    공개 SPARQL 엔드포인트는 동시 사용자가 많으면 429(잠시 뒤 다시)를 준다.
    이건 차단 의사표시가 아니라 혼잡 신호라 몇 번 기다렸다 다시 묻는다 —
    그래도 계속 429 면 접는다.
    """
    url = ("https://query.wikidata.org/sparql?format=json&query="
           + urllib.parse.quote(WD_QUERY))
    code, body = 0, ""
    for wait in (0, 20, 45, 90):
        if wait:
            print(f"   혼잡(429) — {wait}초 쉬고 다시 묻습니다")
            time.sleep(wait)
        code, body, _ = fetch(url, cap=4_000_000)
        if code == 200 and body:
            break
    if code != 200 or not body:
        print(f"  ✖ Wikidata 응답 {code} — 오늘은 접습니다(나중에 다시)")
        return 1
    rows = json.loads(body)["results"]["bindings"]
    out = {}
    for r in rows:
        name = r["itemLabel"]["value"].strip()
        site = r["site"]["value"].strip()
        if name and site and not AGG.search(site):
            out.setdefault(name, site)
    json.dump(out, open(WD, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"■ Wikidata 에서 {len(out)}곳 → {os.path.relpath(WD, ROOT)}")
    return 0


def strip_type(s):
    s = norm_name(s)
    for _tag, words in TYPE_CLASSES:
        for w in words:
            s = re.sub(w, "", s, flags=re.I)
    return s


def cmd_verify(limit=0):
    """모은 주소를 실제로 열어 '그 구장 사이트가 맞는지'까지 본다."""
    have = set()
    if os.path.exists(SEEDS):
        have = {s["golfdb"] for s in json.load(open(SEEDS, encoding="utf-8"))}
    for d in os.listdir(HP_JP) if os.path.isdir(HP_JP) else []:
        f = os.path.join(HP_JP, d, "parsed.json")
        if os.path.exists(f):
            try:
                have.add(json.load(open(f, encoding="utf-8"))["course"])
            except Exception:
                pass

    cand = {}
    for path, tag in ((URLS, "단체명부"), (WD, "Wikidata")):
        if os.path.exists(path):
            for name, url in json.load(open(path, encoding="utf-8")).items():
                cand.setdefault(name, (url, tag))
    print(f"■ 후보 {len(cand)}곳 (단체명부·Wikidata 합)")

    R = NameResolver()
    todo = {}
    for name, (url, tag) in cand.items():
        g, _why, _lv = R.resolve(name)
        if g and g not in have:
            todo.setdefault(g, (url, tag, name))
    print(f"■ golfdb 와 확정 대조되고 아직 주소를 모르는 구장: {len(todo)}곳")

    done = json.load(open(VERIFIED, encoding="utf-8")) if os.path.exists(VERIFIED) else {}
    items = [(g, v) for g, v in sorted(todo.items()) if g not in done]
    if limit:
        items = items[:limit]
    for i, (g, (url, tag, srcname)) in enumerate(items, 1):
        code, html, final = fetch(url)
        head = re.sub(r"<[^>]+>", " ", html[:6000])
        # 이름이 맞는지 — 우리 DB 이름과 명부 이름 둘 다로 본다
        keys = [strip_type(x)[:3] for x in (g, srcname)]
        namehit = any(k and k in strip_type(head) for k in keys)
        # 골프장 사이트처럼 보이는지 — 명부에서 온 주소라 이건 보조 잣대다
        golfish = bool(re.search(r"ゴルフ|ゴルフ場|コース|倶楽部|クラブ|カントリー|GOLF", html[:20000], re.I))
        ok = code == 200 and namehit
        done[g] = {"url": final or url, "src": tag, "srcname": srcname,
                   "http": code, "namehit": namehit, "golfish": golfish, "ok": ok,
                   "title": (re.search(r"<title>(.*?)</title>", html, re.S | re.I).group(1).strip()[:60]
                             if re.search(r"<title>(.*?)</title>", html, re.S | re.I) else "")}
        mark = ("✓" if ok else
                ("사람 확인 필요(가나·한자 표기차일 수 있음)" if code == 200 and golfish else
                 "이름 안 맞음" if code == 200 else f"HTTP {code}"))
        print(f"  [{i}/{len(items)}] {g[:22]:24s} {mark}", flush=True)
        json.dump(done, open(VERIFIED, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    ok = sum(1 for v in done.values() if v["ok"])
    maybe = sum(1 for v in done.values() if not v["ok"] and v["http"] == 200 and v.get("golfish"))
    print(f"\n■ 확인 완료 {len(done)}곳 · 바로 쓸 수 있는 주소 {ok}곳 · 사람 확인 필요 {maybe}곳")
    return 0


def cmd_merge():
    """확인된 것만 official_seeds.json 에 합친다(중복은 건드리지 않는다)."""
    if not os.path.exists(VERIFIED):
        print("먼저 --verify 를 돌리세요")
        return 1
    done = json.load(open(VERIFIED, encoding="utf-8"))
    seeds = json.load(open(SEEDS, encoding="utf-8")) if os.path.exists(SEEDS) else []
    have = {s["golfdb"] for s in seeds}
    added = dropped = 0
    for g, v in sorted(done.items()):
        if not v["ok"] or g in have:
            continue
        # 관광 포털·블로그가 제목에 구장 이름을 달고 관문을 통과하는 일이 있다(반증조사 실측).
        # 최종 주소와 제목을 한 번 더 본다 — 공식이 아니면 넣지 않는다.
        if AGG.search(v["url"]) or PORTAL_TITLE.search(v.get("title") or ""):
            print(f'  · 뺌(공식이 아님) {g} ← {v["url"][:50]} "{v.get("title","")[:30]}"')
            dropped += 1
            continue
        # 형식은 기존 씨앗과 같게 — official_scan.js 가 s.site 와 s.osm 을 읽는다.
        # 좌표(lat·lon)는 넣지 않는다(수집·보관하지 않는 것이 원칙이고, 스캐너도 쓰지 않는다).
        seeds.append({"golfdb": g, "osm": v.get("srcname") or g,
                      "site": v["url"], "src": f'무료명부:{v["src"]}'})
        added += 1
    if dropped:
        print(f"  (관광포털·블로그로 판단해 뺀 것 {dropped}곳)")
    json.dump(seeds, open(SEEDS, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"■ official_seeds.json 에 {added}곳 추가 (전체 {len(seeds)}곳)")
    print("   다음: node tools/jp/official_scan.js 로 홀맵이 있는지 훑습니다")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--assoc", action="store_true")
    ap.add_argument("--wikidata", action="store_true")
    ap.add_argument("--verify", nargs="?", const=0, type=int)
    ap.add_argument("--merge", action="store_true")
    a = ap.parse_args()
    if a.assoc:
        return cmd_assoc()
    if a.wikidata:
        return cmd_wikidata()
    if a.verify is not None:
        return cmd_verify(a.verify)
    if a.merge:
        return cmd_merge()
    print(__doc__)
    return 0


if __name__ == "__main__":
    sys.exit(main())
