# -*- coding: utf-8 -*-
"""일본 구장 공식 홈페이지 자동 탐색 (2026-08-01 신설, 씨앗 확장)

왜 필요한가: 공식 홈페이지가 홀맵의 주 공급원인데, 주소를 아는 곳이 OSM 태그 243곳뿐이다.
golfdb 의 일본 구장은 2,014곳이라 나머지 ~1,770곳은 검색으로 찾아야 한다.
한국 `tools/find_missing_homepages.py` 를 일본어 질의로 옮긴 것이다.

지키는 것
  · 요청 간격 3초 이상, 연속 실패가 이어지면 5분 쉰다(검색엔진에 부담을 주지 않는다)
  · 결과는 매번 파일에 적어 중단·재개가 자유롭다
  · 애그리게이터·SNS 는 공식으로 치지 않는다(설계 §2-1-2 NOT_OFFICIAL 과 같은 잣대)

사용
  python tools/jp/find_official_jp.py --limit 50     앞 50곳만
  python tools/jp/find_official_jp.py                전체 (이어하기)
"""
import argparse, json, os, random, re, sys, time, urllib.parse, urllib.request, urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import ROOT, HP_JP, load_golfdb_jp, norm_name

OUT = os.path.join(HP_JP, "_scan", "official_found.json")
SEEDS = os.path.join(HP_JP, "_scan", "official_seeds.json")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

# 공식 홈페이지가 아닌 것들 — 검색 결과 상위를 이들이 차지한다
BAD = re.compile(
    r"(golf-jalan|jalan\.net|gora\.golf|rakuten|gdo\.co\.jp|golfdigest|alba\.co\.jp|shotnavi|"
    r"accordiagolf|pacificgolf|facebook|instagram|twitter|x\.com|youtube|wikipedia|"
    r"tripadvisor|google\.|yahoo\.|bing\.|duckduckgo|amazon|rakuten\.co|hotels|jtb|"
    r"golfjoy|golf-navi|golfnetwork|ikyu\.com|asoview)", re.I)


def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ja"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read(1_500_000)
    for enc in ("utf-8", "shift_jis", "euc-jp"):
        try:
            return data.decode(enc)
        except Exception:
            pass
    return data.decode("utf-8", errors="ignore")


def ddg(query):
    res = []
    for ep in ("https://html.duckduckgo.com/html/?q=", "https://lite.duckduckgo.com/lite/?q="):
        try:
            html = fetch(ep + urllib.parse.quote(query))
        except Exception:
            continue
        for m in re.finditer(r'href="([^"]+)"[^>]*>(.*?)</a>', html, re.S):
            href, title = m.group(1), re.sub(r"<[^>]+>", "", m.group(2))
            if "uddg=" in href:
                q = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
                href = q.get("uddg", [href])[0]
            if href.startswith("http") and "duckduckgo" not in href:
                res.append((href, title.strip()))
        if res:
            break
    return res


def pick(results, name):
    """구장 이름이 도메인·제목에 걸리는 첫 결과. 애그리게이터는 제외."""
    key = norm_name(name, True)
    core = key[:3]
    for href, title in results:
        host = urllib.parse.urlparse(href).netloc
        if not host or BAD.search(href):
            continue
        if core and (core in norm_name(title, True) or core in norm_name(host, True)):
            return href, title
    for href, title in results:            # 차선: 애그리게이터가 아닌 첫 결과
        if urllib.parse.urlparse(href).netloc and not BAD.search(href):
            return href, title
    return None, None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--delay", type=float, default=3.0)
    a = ap.parse_args()

    found = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}
    have = set()
    if os.path.exists(SEEDS):
        have = {s["golfdb"] for s in json.load(open(SEEDS, encoding="utf-8"))}
    # 이미 홀맵을 등록한 구장은 찾을 필요가 없다
    for d in os.listdir(HP_JP) if os.path.isdir(HP_JP) else []:
        f = os.path.join(HP_JP, d, "parsed.json")
        if os.path.exists(f):
            try:
                have.add(json.load(open(f, encoding="utf-8"))["course"])
            except Exception:
                pass

    todo = [g["n"] for g in load_golfdb_jp() if g["n"] not in have and g["n"] not in found]
    random.seed(0)
    random.shuffle(todo)                    # 지역이 몰리지 않게 섞는다
    if a.limit:
        todo = todo[:a.limit]
    print(f"■ 찾을 구장 {len(todo)}곳 (이미 아는 곳 {len(have)} · 기록 {len(found)})")

    empty = 0
    for i, name in enumerate(todo, 1):
        if empty >= 8:
            print("   검색이 막힌 듯합니다 — 5분 쉽니다", flush=True)
            time.sleep(300)
            empty = 0
        url = title = None
        try:
            url, title = pick(ddg(f"{name} ゴルフ場 公式サイト"), name)
        except Exception:
            pass
        if url:
            found[name] = {"url": url, "title": (title or "")[:60]}
            empty = 0
            print(f"  [{i}/{len(todo)}] {name[:20]:22s} → {url[:60]}", flush=True)
        else:
            found[name] = None
            empty += 1
            print(f"  [{i}/{len(todo)}] {name[:20]:22s} 못 찾음", flush=True)
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        json.dump(found, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        time.sleep(a.delay)

    ok = sum(1 for v in found.values() if v)
    print(f"\n■ 확보 {ok}/{len(found)} → {os.path.relpath(OUT, ROOT)}")
    print("   다음: 이 결과를 official_seeds.json 에 합쳐 official_scan.js 를 돌리세요")
    return 0


if __name__ == "__main__":
    sys.exit(main())
