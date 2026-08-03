# -*- coding: utf-8 -*-
"""일본 구장 공식 홈페이지 자동 탐색 (2026-08-01 신설, 씨앗 확장)

왜 필요한가: 공식 홈페이지가 홀맵의 주 공급원인데, 주소를 아는 곳이 OSM 태그 243곳뿐이다.
golfdb 의 일본 구장은 2,014곳이라 나머지 ~1,770곳은 검색으로 찾아야 한다.
한국 `tools/find_missing_homepages.py` 를 일본어 질의로 옮긴 것이다.

지키는 것
  · 요청 간격 3초 이상, 연속 실패가 이어지면 5분 쉰다(검색엔진에 부담을 주지 않는다)
  · 결과는 매번 파일에 적어 중단·재개가 자유롭다
  · 애그리게이터·SNS 는 공식으로 치지 않는다(설계 §2-1-2 NOT_OFFICIAL 과 같은 잣대)

엔진 (2026-08-03 확장)
  · ddg: 무키. 그러나 집 망은 검색엔진 차단, 회사 망도 십수 회 만에 봇감지(HTTP 202
    anomaly 페이지)가 떴다. 차단은 우회하지 않는다는 원칙에 따라 막히면 접는다.
    이때 기록된 "못 찾음"(None)은 차단 부산물이라 믿으면 안 된다 — 지우고 재시도.
  · cse: Google Custom Search JSON API(공식 유료 경로, 하루 무료 100회 + $5/1000회).
    tools/jp/.cse_key 파일(1줄째 API 키, 2줄째 검색엔진 ID cx)이 있으면 자동 선택.
    공식 API 라 미스가 곧 '검색결과에 없음'이므로 연속실패 휴식이 필요 없다.

사용
  python tools/jp/find_official_jp.py --limit 50     앞 50곳만
  python tools/jp/find_official_jp.py                전체 (이어하기)
  python tools/jp/find_official_jp.py --engine ddg   엔진 강제 지정
"""
import argparse, json, os, random, re, sys, time, urllib.parse, urllib.request, urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import ROOT, HP_JP, load_golfdb_jp, norm_name

OUT = os.path.join(HP_JP, "_scan", "official_found.json")
SEEDS = os.path.join(HP_JP, "_scan", "official_seeds.json")
CSE_KEY = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".cse_key")
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

# 공식 홈페이지가 아닌 것들 — 검색 결과 상위를 이들이 차지한다
BAD = re.compile(
    r"(golf-jalan|jalan\.net|gora\.golf|rakuten|gdo\.co\.jp|golfdigest|alba\.co\.jp|shotnavi|"
    r"accordiagolf|pacificgolf|facebook|instagram|twitter|x\.com|youtube|wikipedia|"
    r"tripadvisor|google\.|yahoo\.|bing\.|duckduckgo|amazon|rakuten\.co|hotels|jtb|"
    # golf-medley: 회사망 첫 시험(2026-08-03)에서 공식으로 잘못 잡힌 중개 사이트.
    # navitime·ekiten·mapion 은 지도·전화번호부 — 구장 정보가 상위에 자주 뜬다.
    # golf-homepage.com: 디렉터리 사이트인데 이름 탓에 공식으로 오인되기 쉽다(2026-08-03 검출).
    r"golfjoy|golf-navi|golfnetwork|ikyu\.com|asoview|golf-medley|navitime|ekiten|mapion|"
    r"golf-homepage\.com)", re.I)


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


class QuotaOut(Exception):
    """CSE 하루 몫 소진(HTTP 429) — 오늘은 여기까지, 내일 이어한다."""


def cse(query):
    key, cx = open(CSE_KEY, encoding="utf-8").read().split()[:2]
    url = ("https://www.googleapis.com/customsearch/v1?key=%s&cx=%s"
           "&num=10&hl=ja&gl=jp&q=%s" % (key, cx, urllib.parse.quote(query)))
    try:
        data = json.loads(fetch(url))
    except urllib.error.HTTPError as e:
        if e.code == 429:
            raise QuotaOut()
        raise
    return [(it["link"], it.get("title", "")) for it in data.get("items", [])]


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
    ap.add_argument("--delay", type=float, default=0)   # 0 = 엔진 기본값(ddg 3초, cse 1초)
    ap.add_argument("--engine", choices=["ddg", "cse"], default="")
    a = ap.parse_args()
    engine = a.engine or ("cse" if os.path.exists(CSE_KEY) else "ddg")
    delay = a.delay or (1.0 if engine == "cse" else 3.0)

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

    # 파크골프·연습장류는 뺀다 — 코스공략 대상이 아니고, 공식 사이트도 거의 없어
    # 검색만 낭비한다(2026-08-03 회사 실측: 초반 못찾음 연속이 대부분 이 부류였다. 104곳).
    NOT_COURSE = re.compile(r"パークゴルフ|グラウンド[・･]?ゴルフ|練習場|打ちっ放し|"
                            r"ゴルフガーデン|ショートコース|ゴルフセンター|ドライビングレンジ")
    todo = [g["n"] for g in load_golfdb_jp()
            if g["n"] not in have and g["n"] not in found and not NOT_COURSE.search(g["n"])]
    random.seed(0)
    random.shuffle(todo)                    # 지역이 몰리지 않게 섞는다
    if a.limit:
        todo = todo[:a.limit]
    print(f"■ 찾을 구장 {len(todo)}곳 (이미 아는 곳 {len(have)} · 기록 {len(found)} · 엔진 {engine})")

    empty = 0
    for i, name in enumerate(todo, 1):
        if engine == "ddg" and empty >= 8:
            print("   검색이 막힌 듯합니다 — 5분 쉽니다", flush=True)
            time.sleep(300)
            empty = 0
        url = title = None
        skip = False
        try:
            hits = cse(f"{name} ゴルフ場 公式サイト") if engine == "cse" \
                else ddg(f"{name} ゴルフ場 公式サイト")
            url, title = pick(hits, name)
        except QuotaOut:
            print("   CSE 하루 몫 소진 — 내일 이어하면 됩니다", flush=True)
            break
        except Exception as e:
            if engine == "cse":     # 공식 API 오류는 '없음'이 아니다 — 기록 없이 건너뛴다
                print(f"  [{i}/{len(todo)}] {name[:20]:22s} API 오류: {e}", flush=True)
                skip = True
        if skip:
            time.sleep(delay)
            continue
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
        time.sleep(delay)

    ok = sum(1 for v in found.values() if v)
    print(f"\n■ 확보 {ok}/{len(found)} → {os.path.relpath(OUT, ROOT)}")
    print("   다음: 이 결과를 official_seeds.json 에 합쳐 official_scan.js 를 돌리세요")
    return 0


if __name__ == "__main__":
    sys.exit(main())
