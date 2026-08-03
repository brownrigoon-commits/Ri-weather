# -*- coding: utf-8 -*-
"""브라우저로 찾아 둔 홀맵을 내려받아 등록한다 (2026-08-03 신설)

왜 따로 만들었나
  `official_collect.py --collect` 는 사이트를 **정적으로 다시 받아** 홀맵을 찾는다.
  그런데 요즘 구장 홈페이지는 홀맵을 자바스크립트로 그린다 — 정적 HTML 에는 없다.
  (그래서 official_scan.js 가 브라우저로 훑는 것이다. 실측: 정적 3곳 중 2곳이 '못 찾음'인데
   브라우저 훑기에서는 같은 구장에서 18홀 시리즈가 잡혔다.)
  훑기 결과에 이미지 **주소가 이미 다 들어 있으니**, 여기서는 그 주소만 내려받는다.
  사이트 HTML 을 다시 받지 않으므로 요청도 그림 수만큼뿐이다.

지키는 것 (등록 기준은 official_collect.py 와 같다)
  · 홀 1..N 이 하나도 빠지지 않아야 등록한다 — 한 장이라도 못 받으면 그 구장은 통째로 보류
  · 너무 작은 그림은 홀맵이 아니다(숫자칩·탭 버튼) — 짧은 변 200px 미만이면 버린다
  · 홀마다 그림이 달라야 한다 — 같은 그림이 두 홀에 걸리면 그 구장은 보류
  · 요청 간격은 호스트별 1.2초, 실패해도 우회하지 않는다
  · 파(PAR)는 훑을 때 저장해 둔 페이지 글에서 뽑는다. 못 뽑으면 **비워 둔다**
    (예전처럼 4로 지어내지 않는다 — 2026-08-03 사고)

사용
  python tools/jp/official_collect_from_dom.py --limit 5    표본 5곳
  python tools/jp/official_collect_from_dom.py              전체
"""
import argparse, hashlib, io, json, os, re, sys, time
import urllib.error, urllib.request
from collections import defaultdict
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import HP_JP, ROOT

DOM = os.path.join(HP_JP, "_scan", "official_dom.json")
LIST = os.path.join(HP_JP, "_scan", "official_holemaps.json")
REPORT = os.path.join(HP_JP, "_scan", "official_collect_from_dom.json")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
GAP = 1.2
# 크기 잣대 — '짧은 변 200px' 로 했더니 **좁고 긴 진짜 홀맵**까지 버렸다
# (下関GC 136x500 실측). 홀맵은 좁아도 길다. 넓이로 보고, 아주 얇은 띠만 막는다.
MIN_AREA = 40_000       # 200x200 상당
MIN_SIDE = 90           # 이보다 얇으면 띠·구분선이다
MIN_BYTES = 3_000
MAX_SIDE = 1200
JPEG_Q = 86
_last = defaultdict(float)
PAR_PAT = re.compile(r"(?:PAR|パー)\s*[:：]?\s*([3-6])", re.I)


def fetch(url):
    host = url.split("/")[2] if "//" in url else url
    w = GAP - (time.time() - _last[host])
    if w > 0:
        time.sleep(w)
    _last[host] = time.time()
    try:
        r = urllib.request.urlopen(
            urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30)
        return r.status, r.read(6_000_000)
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception:
        return 0, b""


def pars_from(text, n):
    """훑을 때 저장해 둔 페이지 글에서 홀별 파를 뽑는다. 개수가 안 맞으면 쓰지 않는다."""
    pars = [int(x) for x in PAR_PAT.findall(text or "")]
    return pars[:n] if len(pars) >= n else []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()

    rows = json.load(open(LIST, encoding="utf-8"))
    dom = {r["golfdb"]: r for r in json.load(open(DOM, encoding="utf-8"))}
    if a.limit:
        rows = rows[:a.limit]
    print(f"■ 대상 {len(rows)}곳 (브라우저 훑기에서 홀맵이 잡힌 곳)")

    report, stat = [], defaultdict(int)
    for i, r in enumerate(rows, 1):
        g, n = r["golfdb"], r["n"]
        holes = {int(k): v for k, v in r["holes"].items()}
        key = re.sub(r"[^\w]", "", g)[:24] or "jp"
        # 이미 등록된 구장은 그림을 다시 받지 않는다(같은 서버를 두 번 두드리지 않는다).
        # 규칙을 고쳐 두 번째로 돌릴 때, 지난번에 걸러진 곳만 다시 보게 된다.
        if os.path.exists(os.path.join(HP_JP, "off_" + key, "parsed.json")):
            stat["이미 등록"] += 1
            continue
        imgdir = os.path.join(ROOT, "holeimg", f"jp_off_{key}")
        got, seen, out_holes, why = {}, {}, [], ""
        from PIL import Image
        for no in sorted(holes):
            code, raw = fetch(holes[no])
            if code != 200 or len(raw) < MIN_BYTES:
                why = f"{no}번 그림을 받지 못함(HTTP {code}, {len(raw)}B)"
                break
            try:
                im = Image.open(io.BytesIO(raw)).convert("RGB")
            except Exception:
                why = f"{no}번이 그림이 아님"
                break
            if im.width * im.height < MIN_AREA or min(im.size) < MIN_SIDE:
                why = f"{no}번이 너무 작음({im.width}x{im.height}) — 홀맵이 아니라 아이콘"
                break
            h = hashlib.md5(raw).hexdigest()
            if h in seen:
                why = f"{no}번 그림이 {seen[h]}번과 같음"
                break
            seen[h] = no
            got[no] = im
        if why or len(got) != n:
            stat["보류"] += 1
            report.append({"golfdb": g, "n": n, "skip": why or f"{len(got)}/{n}장만 받음"})
            print(f"  [{i}/{len(rows)}] – {g[:20]:22s} {why[:44]}", flush=True)
            continue

        os.makedirs(imgdir, exist_ok=True)
        for no, im in sorted(got.items()):
            if max(im.size) > MAX_SIDE:
                s = MAX_SIDE / max(im.size)
                im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
            im.save(os.path.join(imgdir, f"h{no}.jpg"), "JPEG", quality=JPEG_Q, optimize=True)
            out_holes.append({"no": no, "img": f"holeimg/jp_off_{key}/h{no}.jpg"})

        page_text = ""
        for p in dom.get(g, {}).get("pages", []):
            if p.get("url") == r["page"]:
                page_text = p.get("text") or ""
        pars = pars_from(page_text, n)
        for idx, h in enumerate(out_holes):
            if pars:
                h["par"] = pars[idx]

        sect = []
        for name, rng in (("OUT", range(1, 10)), ("IN", range(10, 19)), ("C3", range(19, 28))):
            hs = [h for h in out_holes if h["no"] in rng]
            if hs:
                sect.append({"name": name, "holes": hs})
        parsed = {"course": g, "source": f"{g} 公式ホームページ", "sourceUrl": r["page"],
                  "country": "JP", "unit": "yd", "greens": 1, "green": None,
                  "collectedAt": str(date.today()), "origName": g, "courses": sect}
        outdir = os.path.join(HP_JP, "off_" + key)
        os.makedirs(outdir, exist_ok=True)
        json.dump(parsed, open(os.path.join(outdir, "parsed.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
        stat["등록"] += 1
        report.append({"golfdb": g, "n": n, "ok": True, "pars": bool(pars)})
        print(f'  [{i}/{len(rows)}] ✔ {g[:20]:22s} {n}홀 · 파 {"있음" if pars else "없음"}', flush=True)

    print("\n■ 결과:", dict(stat))
    json.dump({"at": str(date.today()), "rows": report},
              open(REPORT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"   자세히: {os.path.relpath(REPORT, ROOT)}")
    print("   다음: python tools/jp/build_holeimgdb_jp.py 로 재조립")
    return 0


if __name__ == "__main__":
    sys.exit(main())
