# -*- coding: utf-8 -*-
"""독립 구장 공식 홈페이지 — 홀맵 수집 (2026-08-01 신설, 화질 사다리 2층)

왜 이 층이 주력인가 (docs/일본_6메뉴_데이터_설계.md §2-1-1):
  체인(아코디아 등)은 다 합쳐도 130곳이고, じゃらん 은 235px 저화질이다.
  사장님 판정: "저 화질 차이로는 못 낸다." 한국판을 만든 방식 그대로
  **구장 공식 홈페이지**에서 고화질 홀맵을 받아온다.

한국 `universal_build.py` 의 사상을 이식했다 — 다만 사이트 유형을 손으로 등록하는 대신
**파일 이름 규칙(시리즈)** 을 자동으로 찾는다. 일본은 구장이 2,000곳이라 유형을 일일이
등록할 수 없기 때문이다.

  hole01_map.png · hole02_map.png … → 'holeN_map.png' 시리즈 = 홀맵 후보
  같은 페이지의 photo/green/thumb 시리즈는 사진이지 홀맵이 아니다 → 이름으로 가른다.

품질 기준(한국과 같음): 홀 번호가 1..N 연속(9/18/27), 그림이 홀마다 있어야 등록.
숫자(파·야드)가 없으면 등록하지 않고 '그림만 있음'으로 남긴다 —
나중에 다른 출처의 숫자와 합치는 것은 merge 단계의 몫이다(지어내지 않는다).

사용
  python tools/jp/official_collect.py --seeds            씨앗 목록 만들기(OSM website 태그)
  python tools/jp/official_collect.py --scan 20          표본 훑기(저장 안 함)
  python tools/jp/official_collect.py --scan-all
  python tools/jp/official_collect.py --collect          그림 내려받기·등록
"""
import argparse, io, json, os, re, ssl, sys, time, urllib.parse
import urllib.error, urllib.request
from collections import Counter, defaultdict
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import ROOT, HP_JP, NameResolver, MAGIC, km

SEEDS = os.path.join(ROOT, "coursedata", "homepages_jp", "_scan", "official_seeds.json")
SCAN = os.path.join(ROOT, "coursedata", "homepages_jp", "_scan", "official_scan.json")
SOURCE_MARK = "公式"          # ⚠️ tools/jp_takedown.py SOURCES 와 맞출 것
MAX_SIDE, JPEG_Q = 900, 80    # 공식 홀맵은 고화질이라 한국 규격(최대 900px)을 그대로 쓴다
MIN_IMG = 6_000

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
GAP = 1.2
_last = defaultdict(float)
CTX = ssl.create_default_context()
CTX.set_ciphers("DEFAULT@SECLEVEL=1")          # 옛 TLS 설정을 쓰는 일본 구장 사이트가 많다
CTX_OFF = ssl.create_default_context()
CTX_OFF.check_hostname = False
CTX_OFF.verify_mode = ssl.CERT_NONE            # 인증서 만료 사이트 (한국에서도 겪은 문제)


def fetch(url, binary=False, timeout=20):
    """호스트별로 간격을 지킨다 — 여러 구장을 도는 동안 한 서버만 두드리지 않게."""
    host = urllib.parse.urlsplit(url).netloc
    wait = GAP - (time.time() - _last[host])
    if wait > 0:
        time.sleep(wait)
    _last[host] = time.time()
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ja"})
    for ctx in (CTX, CTX_OFF):
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
                b = r.read(4_000_000)
                if binary:
                    return r.status, dict(r.headers), b
                head = b[:2500].decode("ascii", "ignore")
                m = re.search(r"charset=[\"']?([\w\-]+)", head, re.I)
                for enc in ([m.group(1)] if m else []) + ["utf-8", "shift_jis", "euc-jp"]:
                    try:
                        return r.status, dict(r.headers), b.decode(enc)
                    except Exception:
                        pass
                return r.status, dict(r.headers), b.decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            return e.code, {}, (b"" if binary else "")
        except ssl.SSLError:
            continue                                   # 인증서 문제면 한 번 더
        except Exception:
            return 0, {}, (b"" if binary else "")
    return 0, {}, (b"" if binary else "")


# ── 씨앗 ─────────────────────────────────────────────────────────
def build_seeds():
    """OSM(Overpass)에서 일본 골프장의 공식 홈페이지 주소를 받아 golfdb 와 맞춘다.

    golfdb 자체가 OSM 에서 만든 것이라 이름·좌표가 그대로 맞는다 —
    한국판이 골프존 DB 의 homepageUrl 을 씨앗으로 쓴 것과 같은 자리다.
    """
    q = ('[out:json][timeout:180];area["ISO3166-1"="JP"][admin_level=2]->.jp;'
         '(way["leisure"="golf_course"](area.jp);relation["leisure"="golf_course"](area.jp););'
         'out tags center;')
    # ⚠️ Overpass 는 브라우저 UA 를 거절한다(HTTP 406). 정직한 식별 UA 를 쓴다 —
    #    운영 정책상 권장 사항이기도 하다.
    body, code = "", 0
    for base in ("https://overpass-api.de/api/interpreter",
                 "https://overpass.kumi.systems/api/interpreter"):
        url = base + "?data=" + urllib.parse.quote(q, safe="")
        req = urllib.request.Request(url, headers={
            "User-Agent": "tourlist-course-research/1.0 (contact: brown.rigoon@gmail.com)",
            "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=240) as r:
                code, body = r.status, r.read().decode("utf-8", "replace")
            if code == 200 and body.lstrip().startswith("{"):
                break
        except Exception as e:
            print(f"   {base} 실패: {type(e).__name__}")
    if code != 200 or not body.lstrip().startswith("{"):
        print(f"✖ Overpass 실패 (HTTP {code})")
        return []
    els = json.loads(body).get("elements", [])
    res = NameResolver()
    seeds = []
    for e in els:
        t = e.get("tags", {})
        site = t.get("website") or t.get("contact:website") or t.get("url")
        if not (site and t.get("name")):
            continue
        g, why, level = res.resolve(t["name"])
        if not g:
            continue
        c = e.get("center") or e
        seeds.append({"golfdb": g, "osm": t["name"], "site": site,
                      "lat": c.get("lat"), "lon": c.get("lon")})
    os.makedirs(os.path.dirname(SEEDS), exist_ok=True)
    json.dump(seeds, open(SEEDS, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"씨앗 {len(seeds)}곳 → {os.path.relpath(SEEDS, ROOT)}")
    return seeds


# ── 페이지에서 홀맵 시리즈 찾기 ───────────────────────────────────
GUIDE_KW = re.compile(r"(course|hole|layout|guide|コース|ホール|攻略)", re.I)
MAPPY = re.compile(r"(map|layout|zu|figure|コース)", re.I)
PHOTOY = re.compile(r"(photo|pic|thumb|banner|logo|icon|btn|bg_|green|sample|slide|main|top)", re.I)
HOLENO = re.compile(r"(?<!\d)(\d{1,2})(?!\d)")


def series_of(urls):
    """이미지 URL 목록 → {시리즈템플릿: {홀번호: url}}

    'hole01_map.png' 처럼 숫자 한 군데만 바뀌는 묶음을 시리즈로 본다.
    """
    out = defaultdict(dict)
    for u in urls:
        name = u.split("/")[-1]
        for m in HOLENO.finditer(name):
            n = int(m.group(1))
            if not (1 <= n <= 27):
                continue
            tmpl = name[:m.start()] + "{}" + name[m.end():]
            key = u[: -len(name)] + tmpl
            if n not in out[key]:
                out[key][n] = u
    return out


def qualifying_series(cands):
    """홀맵일 법한 시리즈를 **전부** 돌려준다 (한 구장에 East/West/Center 처럼 여러 벌).

    2026-08-01 실측: 青梅ゴルフ倶楽부는 course-east-{}map.jpg / -west- / -center- 로
    9홀씩 세 벌이다. 하나만 고르면 27홀 중 9홀만 등록된다.
    """
    out = []
    for key, holes in cands.items():
        nums = sorted(holes)
        full = [k for k in (9, 18, 27) if set(range(1, k + 1)) <= set(nums)]
        if not full:
            continue
        base = os.path.basename(key)
        if PHOTOY.search(base) and not MAPPY.search(base):
            continue                                   # 사진·배너 시리즈는 홀맵이 아니다
        n = max(full)
        out.append({"key": key, "base": base, "n": n,
                    "holes": {k: v for k, v in holes.items() if k <= n},
                    "mapish": bool(MAPPY.search(base))})
    # 같은 페이지에 map 계열과 img(사진) 계열이 나란히 있으면 map 계열만 쓴다
    if any(s["mapish"] for s in out):
        out = [s for s in out if s["mapish"]]
    return out


def pick_series(cands):
    """홀맵일 가능성이 가장 높은 시리즈 하나 → (키, {홀:url}, 사유) / 못 고르면 (None,None,사유)"""
    scored = []
    for key, holes in cands.items():
        nums = sorted(holes)
        n = len(nums)
        if n < 9:
            continue
        # 1..N 연속인가 (9·18·27홀)
        full = [k for k in (9, 18, 27) if set(range(1, k + 1)) <= set(nums)]
        if not full:
            continue
        base = os.path.basename(key)
        score = max(full)
        if MAPPY.search(base):
            score += 100
        if PHOTOY.search(base):
            score -= 60
        scored.append((score, max(full), key, holes, base))
    if not scored:
        return None, None, "홀맵 시리즈를 찾지 못함(1~9 연속 이미지 없음)"
    scored.sort(reverse=True)
    top = scored[0]
    if len(scored) > 1 and scored[1][0] == top[0]:
        return None, None, (f"홀맵 후보가 여럿이라 확정 못 함: "
                            f"{top[4]} / {scored[1][4]} — 사람 확인 필요")
    holes = {k: v for k, v in top[3].items() if k <= top[1]}
    return top[2], holes, ""


# 링크 글자로도 찾는다 — 일본 구장 사이트는 주소가 /cms/page3.html 인데
# 글자만 'コース紹介' 인 경우가 흔하다. 주소만 보면 절반을 놓친다(2026-08-01 실측: 20곳 중 1곳).
ANCHOR_KW = re.compile(r"(コース|ホール|攻略|レイアウト|course|hole|layout|guide)", re.I)
# 자주 쓰이는 고정 경로 (cource 는 일본 사이트에 흔한 오타)
COMMON = ("course/", "course.html", "cource/", "guide/", "hole/", "layout/",
          "course/index.html", "courseguide/", "course_guide/")


def guide_pages(site):
    """톱 → 코스 안내 페이지 후보. 주소·링크글자·고정경로 세 갈래로 찾고 두 단계까지 본다."""
    code, _, html = fetch(site)
    if code != 200 or not html:
        # www 유무·http 도 한 번씩 (구장 사이트는 리다이렉트가 부실한 곳이 많다)
        sp = urllib.parse.urlsplit(site)
        alts = []
        if sp.netloc.startswith("www."):
            alts.append(site.replace("://www.", "://", 1))
        else:
            alts.append(site.replace("://", "://www.", 1))
        alts.append(site.replace("https://", "http://", 1))
        for alt in alts:
            code, _, html = fetch(alt)
            if code == 200 and html:
                site = alt
                break
        if code != 200 or not html:
            return None, []

    host = urllib.parse.urlsplit(site).netloc

    def links_of(page, base):
        out = []
        for m in re.finditer(r'<a[^>]+href="([^"#]+)"[^>]*>(.*?)</a>', page, re.S | re.I):
            href, label = m.group(1), re.sub(r"(?s)<[^>]+>", " ", m.group(2))
            if href.startswith(("javascript", "mailto", "tel")):
                continue
            u = urllib.parse.urljoin(base, href)
            if urllib.parse.urlsplit(u).netloc != host:
                continue
            if GUIDE_KW.search(u) or ANCHOR_KW.search(label):
                out.append(u)
        return out

    cands, seen = [], set()
    for u in links_of(html, site) + [urllib.parse.urljoin(site, c) for c in COMMON]:
        if u not in seen:
            seen.add(u)
            cands.append(u)
    return html, cands[:14], site


def imgs_in(html, base):
    urls = []
    for m in re.finditer(r'(?:src|data-src|data-original|href)="([^"]+\.(?:jpg|jpeg|png|gif|svg))"',
                         html, re.I):
        urls.append(urllib.parse.urljoin(base, m.group(1)))
    return urls


PAR_PAT = re.compile(r"(?:PAR|パー)\s*[:：]?\s*([3-6])", re.I)


def numbers_near(html):
    """페이지에서 홀별 파를 뽑는다 — 홀 번호 순서대로 나오는 PAR 표기만 인정한다."""
    body = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    txt = re.sub(r"\s+", " ", re.sub(r"(?s)<[^>]+>", " ", body))
    pars = [int(x) for x in PAR_PAT.findall(txt)]
    return pars


def scan_one(seed, download=False, existing=None):
    site = seed["site"]
    g = seed["golfdb"]
    if existing and g in existing:
        return {"golfdb": g, "skip": f"이미 등록됨({existing[g]})"}
    got = guide_pages(site)
    if got[0] is None:
        return {"golfdb": g, "site": site, "skip": "사이트에 접속하지 못함"}
    html, pages, site = got
    best, deeper = None, []
    for u in [site] + pages:
        code, _, p = (200, None, html) if u == site else fetch(u)
        if code != 200 or not p:
            continue
        cands = series_of(imgs_in(p, u))
        key, holes, why = pick_series(cands)
        if holes:
            pars = numbers_near(p)
            cur = {"page": u, "series": os.path.basename(key), "holes": holes,
                   "pars": pars if len(pars) == len(holes) else []}
            if best is None or len(holes) > len(best["holes"]):
                best = cur
        elif u != site:
            # 한 단계 더 — 코스 소개 페이지가 목차이고 홀맵은 그 안쪽인 경우가 많다
            for m in re.finditer(r'<a[^>]+href="([^"#]+)"[^>]*>(.*?)</a>', p, re.S | re.I):
                href, label = m.group(1), re.sub(r"(?s)<[^>]+>", " ", m.group(2))
                if href.startswith(("javascript", "mailto", "tel")):
                    continue
                v = urllib.parse.urljoin(u, href)
                if (urllib.parse.urlsplit(v).netloc == urllib.parse.urlsplit(site).netloc
                        and (GUIDE_KW.search(v) or ANCHOR_KW.search(label)) and v not in pages):
                    deeper.append(v)
    for u in deeper[:10]:
        if best:
            break
        code, _, p = fetch(u)
        if code != 200 or not p:
            continue
        key, holes, why = pick_series(series_of(imgs_in(p, u)))
        if holes:
            pars = numbers_near(p)
            best = {"page": u, "series": os.path.basename(key), "holes": holes,
                    "pars": pars if len(pars) == len(holes) else []}
    if not best:
        return {"golfdb": g, "site": site, "skip": "홀맵 시리즈를 찾지 못함"}

    n = len(best["holes"])
    if not download:
        return {"golfdb": g, "site": site, "holes": n, "series": best["series"],
                "page": best["page"], "pars": len(best["pars"])}

    # ── 내려받기 ──
    key = re.sub(r"[^\w]", "", g)[:24] or "jp"
    imgdir = f"holeimg/jp_off_{key}"
    got, sizes = 0, []
    holes_out = []
    for no in sorted(best["holes"]):
        url = best["holes"][no]
        code, hdr, raw = fetch(url, binary=True)
        if code != 200 or not isinstance(raw, bytes) or not any(raw.startswith(m) for m in MAGIC):
            continue
        if len(raw) < MIN_IMG:
            continue
        try:
            from PIL import Image
            im = Image.open(io.BytesIO(raw)).convert("RGB")
            if max(im.size) > MAX_SIDE:
                r = MAX_SIDE / max(im.size)
                im = im.resize((int(im.width * r), int(im.height * r)), Image.LANCZOS)
            rel = f"{imgdir}/h{no}.jpg"
            dest = os.path.join(ROOT, rel)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            im.save(dest, "JPEG", quality=JPEG_Q, optimize=True)
            sizes.append(im.size)
            got += 1
            h = {"no": no, "img": rel}
            if best["pars"]:
                h["par"] = best["pars"][sorted(best["holes"]).index(no)]
            holes_out.append(h)
        except Exception:
            continue
    if got < n:
        return {"golfdb": g, "site": site, "skip": f"그림 {got}/{n}장만 받아져 등록하지 않음"}
    if not best["pars"]:
        return {"golfdb": g, "site": site, "holes": n, "noPar": True,
                "skip": "파 정보를 찾지 못해 등록 보류(그림은 받아 둠)"}

    sect = []
    for name, rng in (("OUT", range(1, 10)), ("IN", range(10, 19)), ("C3", range(19, 28))):
        hs = [h for h in holes_out if h["no"] in rng]
        if hs:
            sect.append({"name": name, "holes": hs})
    parsed = {"course": g, "source": f"{seed['osm']} 公式サイト", "sourceUrl": best["page"],
              "country": "JP", "unit": "yd", "greens": 1, "green": None,
              "collectedAt": str(date.today()), "origName": seed["osm"], "courses": sect}
    outdir = os.path.join(HP_JP, "off_" + key)
    os.makedirs(outdir, exist_ok=True)
    json.dump(parsed, open(os.path.join(outdir, "parsed.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    return {"golfdb": g, "site": site, "holes": n, "img": got, "ok": True}


def already():
    out = {}
    if not os.path.isdir(HP_JP):
        return out
    for d in os.listdir(HP_JP):
        f = os.path.join(HP_JP, d, "parsed.json")
        if os.path.exists(f):
            try:
                j = json.load(open(f, encoding="utf-8"))
                out[j["course"]] = j.get("source", "")
            except Exception:
                pass
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", action="store_true")
    ap.add_argument("--scan", type=int, default=0)
    ap.add_argument("--scan-all", action="store_true")
    ap.add_argument("--collect", action="store_true")
    a = ap.parse_args()

    if a.seeds:
        build_seeds()
        return 0
    if not os.path.exists(SEEDS):
        print("씨앗이 없습니다 — 먼저 --seeds 를 실행하세요")
        return 1
    seeds = json.load(open(SEEDS, encoding="utf-8"))
    ex = already()
    print(f"■ 씨앗 {len(seeds)}곳 · 이미 등록 {len(ex)}곳")

    targets = seeds if (a.scan_all or a.collect) else seeds[:max(1, a.scan)]
    print(f"■ 대상 {len(targets)}곳" + (" · 내려받기" if a.collect else " · 훑기만"))
    rows, stat = [], Counter()
    for i, s in enumerate(targets, 1):
        r = scan_one(s, a.collect, ex)
        rows.append(r)
        if r.get("ok"):
            stat["등록"] += 1
            print(f"  [{i}/{len(targets)}] ✔ {r['golfdb']} · {r['holes']}홀 · 그림 {r['img']}장")
        elif r.get("skip"):
            stat["건너뜀"] += 1
            if "이미 등록" not in r["skip"]:
                print(f"  [{i}/{len(targets)}] – {r['golfdb'][:20]:22s} {r['skip'][:46]}")
        else:
            stat["홀맵 있음"] += 1
            print(f"  [{i}/{len(targets)}] ○ {r['golfdb'][:20]:22s} {r['holes']}홀 "
                  f"· 파 {r.get('pars', 0)} · {r['series'][:26]}")
    print("\n■ 결과:", dict(stat))
    os.makedirs(os.path.dirname(SCAN), exist_ok=True)
    json.dump({"at": str(date.today()), "rows": rows}, open(SCAN, "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"   자세히: {os.path.relpath(SCAN, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
