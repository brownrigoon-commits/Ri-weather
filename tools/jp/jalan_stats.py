# -*- coding: utf-8 -*-
"""じゃらん 홀별 실전 통계 수집 (2026-08-02 신설)

사장님 지시(8/2): "이 내용은 너무 좋다. 모두 넣어 달라. 화질 좋은 그림 + 이 정리 내용."

무엇을 모으나 — 홀마다 **스코어대 5벌**로 다음 8가지:
    난이도 순위 · 평균 스코어 · 평균 퍼트 · 버디율 · 파온율 · FW안착률 · 벙커율 · OB율
    밴드: 全スコア / ～79 / 80～99 / 100～119 / 120～

왜 값어치가 큰가: 우리 앱은 이미 이용자의 스코어대를 안다(피팅·캐디가 쓰고 있다).
100돌이에게 "이 홀 평균 6.8타, OB율 4.3%" 는 싱글의 숫자보다 백배 쓸모 있다.

🔴 숫자만 가져온다. **홀 코멘트 문장은 복제하지 않는다** — じゃらん/구장 저작물이다.
   문장은 사실 토큰 + 이 통계를 재료로 우리가 따로 만든다(tools/jp/gen_hole_text.py).

⚠️ 그림을 어디서 받았든(아코디아·공식 홈페이지) 통계는 여기서 붙인다.
   구장 이름은 NameResolver 로 golfdb 에 맞춘다 — 이름이 다르면 화면에 못 붙는다.

사용
  python tools/jp/jalan_stats.py --only gc01997        한 곳 (검수용)
  python tools/jp/jalan_stats.py --sample 3            표본
  python tools/jp/jalan_stats.py --all                 전량 (등록된 구장 우선)
"""
import argparse, json, os, re, sys, unicodedata
from collections import Counter
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import ROOT, HP_JP, Blocked, NameResolver, fetch

HOST = "https://golf-jalan.net"
SITEMAP = HOST + "/sitemap.xml"
OUT_DIR = os.path.join(HP_JP, "_stats")
INDEX = os.path.join(HP_JP, "_scan", "jalan_gc_index.json")   # gc ↔ 구장이름
SOURCE = "じゃらんゴルフ"          # ⚠️ jp_takedown 의 jalan 항목과 같은 표기

# 밴드 순서는 **고정**이다 — 조립·화면이 이 순서를 그대로 믿는다
BANDS = ["all", "u79", "b80", "b100", "b120"]
BAND_LABEL = ["全スコア", "〜79", "80〜99", "100〜119", "120〜"]

# 지표 순서도 고정 (배열로 저장해 부피를 줄인다)
KEYS = ["難易度", "平均スコア", "平均パット", "バーディ率", "パーオン率",
        "FWキープ率", "バンカー率", "OB率"]
FIELDS = ["rank", "avg", "putt", "birdie", "gir", "fw", "bunker", "ob"]


def strip_tags(s):
    return re.sub(r"\s+", " ", re.sub(r"(?s)<[^>]+>", " ", s).replace("&nbsp;", " ")).strip()


def clean_name(title):
    """<title> → 구장 이름.

    🔴 홀맵 수집기(jalan_collect.clean_name)와 **똑같이** 다듬어야 한다.
       한쪽만 괄호를 떼면 같은 구장인데 이름이 달라져 통계가 안 붙는다.
       실제로 그랬다(2026-08-02): 'Ｇ－ｓｔｙｌｅカントリー倶楽部（旧ダイヤモンド佐用ＣＣ）'
       를 그대로 두는 바람에 G-style CC 44곳이 'データなし' 로 떴다.
    """
    n = title.split("のコースレイアウト")[0]
    n = re.sub(r"［.*?］|\[.*?\]", "", n)
    n = re.sub(r"【[^】]*】", "", n)          # 체인 표시 (【ＰＧＭ】 등)
    n = re.sub(r"（[^）]*）$", "", n)          # 옛 이름 병기 (（旧…）)
    return unicodedata.normalize("NFKC", n).strip()


def parse_stats(html):
    """상세 페이지 → (홀 목록, 오류사유)

    반환은 **문서 순서 그대로의 배열**이다:
        [{"no":1,"par":5,"b":[[…8지표…]×5밴드]}, …]

    🔴 홀 번호를 열쇠로 쓰지 않는다. 27·36홀 구장은 코스마다 홀 번호가 1~9 로 다시 시작해
       번호로 묶으면 세 코스가 한 홀로 뭉개진다(2026-08-02 大宮国際에서 27홀→9홀로 겪음).
       아코디아에서 겪은 '코스 이름이 겹쳐 그림이 덮어써진' 사고와 같은 자리다.

    구조(2026-08-02 실측):
      <div class="tabContent"> ×5  ← 스코어대 밴드. 순서가 곧 全/～79/80～99/100～119/120～
        … 【HOLE n】PAR:p …  <table class="holeInfo"><tr><th>難易度</th><td>5位/18h中</td>…
      한 패널 안에서 홀 헤더와 통계표가 **같은 개수·같은 순서**로 나온다.
    """
    body = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    panels = [m.start() for m in re.finditer(r'<div[^>]*class="[^"]*tabContent[^"]*"', body)]
    if len(panels) != 5:
        return None, f"스코어대 패널이 5개가 아님({len(panels)}개)"
    edges = panels + [len(body)]

    holes_pos = [(m.start(), int(m.group(1)), int(m.group(2))) for m in
                 re.finditer(r'class="holeNo"[^>]*>(?:<span>)?【HOLE\s*(\d+)】</span>PAR:(\d+)', body)]
    stat_tbl = [(m.start(), m.group(0)) for m in
                re.finditer(r'(?is)<table class="holeInfo">.*?</table>', body)]

    rows = None
    for bi in range(5):
        lo, hi = edges[bi], edges[bi + 1]
        hs = [(n, p) for q, n, p in holes_pos if lo <= q < hi]
        ss = [t for q, t in stat_tbl if lo <= q < hi]
        if not hs or len(hs) != len(ss):
            return None, f"{BAND_LABEL[bi]} 밴드에서 홀 {len(hs)}개 · 통계 {len(ss)}개 — 짝이 안 맞음"
        if rows is None:
            rows = [{"no": n, "par": p, "b": [None] * 5} for n, p in hs]
        elif [(r["no"], r["par"]) for r in rows] != hs:
            return None, f"{BAND_LABEL[bi]} 밴드의 홀 구성이 첫 밴드와 다름"
        for i, tbl in enumerate(ss):
            row = {}
            for m in re.finditer(r"(?is)<th>\s*([^<]+?)\s*</th>\s*<td>\s*([^<]*?)\s*</td>", tbl):
                row[strip_tags(m.group(1))] = strip_tags(m.group(2))
            vals = []
            for k in KEYS:
                v = row.get(k, "")
                if k == "難易度":
                    mm = re.match(r"(\d+)位", v)
                    vals.append(int(mm.group(1)) if mm else None)
                else:
                    mm = re.match(r"([\d.]+)", v)
                    vals.append(float(mm.group(1)) if mm else None)
            rows[i]["b"][bi] = sanitize(vals)
    return rows, ""


def sanitize(v):
    """출처 자체가 이상한 값을 걸러 낸다 (신뢰 우선 원칙).

    🔴 2026-08-02 실측: 大宮国際CC せきれい 1번홀의 '～79' 밴드가
       평균 스코어 4.3 · **평균 퍼트 6.8** 이었다. 퍼트가 총타수보다 많을 수는 없다 —
       그 스코어대를 친 사람이 몇 명뿐이라 じゃらん 쪽에서 만들어진 엉터리 값이다.
       파서 오류가 아니라 **원문이 그렇다**(원문 HTML 로 확인).
       틀린 숫자는 없는 것보다 나쁘므로 그 값만 비운다.
    """
    rank, avg, putt = v[0], v[1], v[2]
    if putt is not None and avg is not None and putt > avg:
        v[2] = None                     # 퍼트 > 총타수 = 불가능
    if putt is not None and v[2] is not None and not (1.0 <= v[2] <= 4.5):
        v[2] = None                     # 홀당 퍼트가 이 범위를 벗어나면 믿지 않는다
    if avg is not None and not (2.0 <= avg <= 12.0):
        v[1] = None
    for i in (3, 4, 5, 6, 7):           # 퍼센트 지표
        if v[i] is not None and not (0 <= v[i] <= 100):
            v[i] = None
    return v


# 홀 코멘트에서 **사실만** — 문장은 저장하지 않는다 (저작권)
FACTS = [
    (r"右.?ドッグレッグ|右ドック", "dogleg_r"), (r"左.?ドッグレッグ|左ドック", "dogleg_l"),
    (r"池|ウォーター", "water"), (r"打ち下ろし", "downhill"), (r"打ち上げ", "uphill"),
    (r"バンカー", "bunker"), (r"ストレート|真っ直ぐ|まっすぐ", "straight"),
    (r"谷", "valley"), (r"OB", "ob"), (r"名物|難関", "signature"),
    (r"広い", "wide"), (r"狭い", "narrow"), (r"砲台", "elevated_green"),
]


def facts_of(html):
    """홀 순서대로 사실 토큰 목록 (첫 밴드 패널의 figcaption 기준)"""
    body = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    caps = re.findall(r"<figcaption>([^<]*)</figcaption>", body)
    out = []
    for c in caps:
        t = []
        for pat, tag in FACTS:
            if re.search(pat, c):
                t.append(tag)
        out.append(t)
    return out


def course_urls():
    code, _, body = fetch(SITEMAP)
    if code != 200:
        raise Blocked(f"사이트맵 실패 HTTP {code}")
    return sorted(set(re.findall(r"<loc>(https://golf-jalan\.net/gc\d+/)</loc>", body)))


def registered_courses():
    """등록된 홀맵의 **파 배열**(문서 순서) — 통계를 어느 홀에 붙일지 확인하는 열쇠.

    홀 번호는 코스마다 1~9 로 반복되므로 열쇠가 못 된다. 대신 파 배열이 같으면
    같은 순서라고 확신할 수 있다(HDCP 를 붙일 때 쓴 방법과 같다).
    """
    out = {}
    if not os.path.isdir(HP_JP):
        return out
    for d in os.listdir(HP_JP):
        f = os.path.join(HP_JP, d, "parsed.json")
        if os.path.exists(f):
            try:
                j = json.load(open(f, encoding="utf-8"))
                pars = [h.get("par") for c in j.get("courses", []) for h in c["holes"]]
                out[j["course"]] = pars
            except Exception:
                pass
    return out


def key_of(name):
    return re.sub(r"[^\w]", "", name)[:40]


def one(url, resolver, reg, force=False):
    gc = re.search(r"/(gc\d+)/", url).group(1)
    code, _, html = fetch(url + "detail/")
    if code != 200:
        return {"gc": gc, "skip": f"HTTP {code}"}
    t = re.search(r"<title>(.*?)</title>", html, re.S)
    if not t:
        return {"gc": gc, "skip": "제목 없음"}
    name = clean_name(strip_tags(t.group(1)))
    g, why, _ = resolver.resolve(name)
    if not g:
        return {"gc": gc, "name": name, "skip": why}

    # gc ↔ 구장이름 색인 — 다음 실행 때 '어느 gc 가 어느 구장인지' 되짚는 데 쓴다
    # (전수를 다시 훑지 않고 빠진 곳만 받기 위해)
    try:
        idx = json.load(open(INDEX, encoding="utf-8")) if os.path.exists(INDEX) else {}
        if idx.get(gc) != g:
            idx[gc] = g
            os.makedirs(os.path.dirname(INDEX), exist_ok=True)
            json.dump(idx, open(INDEX, "w", encoding="utf-8"), ensure_ascii=False)
    except Exception:
        pass

    dest = os.path.join(OUT_DIR, key_of(g) + ".json")
    if os.path.exists(dest) and not force:
        return {"gc": gc, "golfdb": g, "skip": "이미 있음"}

    rows, err = parse_stats(html)
    if not rows:
        return {"gc": gc, "golfdb": g, "skip": err}

    # 등록된 홀맵과 **파 배열**이 같은지 — 같으면 순서가 확실하니 그대로 붙일 수 있다.
    # 다르면 '붙일 수 없음'으로 표시해 둔다(추측해서 엉뚱한 홀에 붙이지 않는다).
    pars = [r["par"] for r in rows]
    match = "none"
    if g in reg:
        if reg[g] == pars:
            match = "exact"
        elif len(reg[g]) == len(pars):
            match = "count-only"          # 홀 수는 같은데 파가 다름 — 사람이 봐야 한다
        else:
            match = "mismatch"

    facts = facts_of(html)
    doc = {
        "course": g, "source": SOURCE, "sourceUrl": url + "detail/",
        "collectedAt": str(date.today()), "origName": name,
        "bands": BANDS, "fields": FIELDS,
        "pars": pars, "match": match,
        "holes": [{"no": r["no"], "par": r["par"], "b": r["b"]} for r in rows],
        "facts": facts[:len(rows)] if len(facts) >= len(rows) else [],
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    json.dump(doc, open(dest, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return {"gc": gc, "golfdb": g, "holes": len(rows), "ok": True,
            "warn": "" if match in ("exact", "none") else f"파 배열 {match}",
            "registered": g in reg}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", action="append", default=[])
    ap.add_argument("--sample", type=int, default=0)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--missing", action="store_true",
                    help="홀맵은 있는데 통계가 없는 구장만 다시 받는다")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    urls = course_urls()
    resolver = NameResolver()
    reg = registered_courses()
    print(f"■ じゃらん 구장 {len(urls)}곳 · 홀맵 등록 구장 {len(reg)}곳")

    if a.only:
        targets = [u for u in urls if any(o in u for o in a.only)]
    elif a.missing:
        # 홀맵은 있는데 통계가 없는 구장만 — 전수를 다시 훑지 않고 그 곳만 받는다.
        # 어느 gc 인지는 이전 훑기 기록(_scan/jalan_scan.json)의 이름으로 되짚는다.
        have = set()
        for fn in os.listdir(OUT_DIR) if os.path.isdir(OUT_DIR) else []:
            if fn.endswith(".json") and fn != "tip_ja_cache.json":
                try:
                    have.add(json.load(open(os.path.join(OUT_DIR, fn), encoding="utf-8"))["course"])
                except Exception:
                    pass
        want = set(reg) - have
        gcs = set()
        for src in (INDEX, os.path.join(HP_JP, "_scan", "jalan_scan.json")):
            if not os.path.exists(src):
                continue
            data = json.load(open(src, encoding="utf-8"))
            rows = data.get("rows", []) if isinstance(data, dict) and "rows" in data else None
            if rows is not None:
                for r in rows:
                    nm = r.get("name")
                    if nm:
                        g, _, _ = resolver.resolve(clean_name(nm))
                        if g in want:
                            gcs.add(r["gc"])
            else:                                    # gc → 구장이름 색인
                for gc, g in data.items():
                    if g in want:
                        gcs.add(gc)
        targets = [u for u in urls if re.search(r"/(gc\d+)/", u).group(1) in gcs]
        print(f"  통계 없는 구장 {len(want)}곳 중 gc 를 아는 {len(targets)}곳을 받습니다")
        if len(targets) < len(want):
            print(f"  ⚠ 나머지 {len(want)-len(targets)}곳은 gc 를 몰라 --all 로 훑어야 합니다")
    elif a.all:
        targets = urls
    else:
        step = max(1, len(urls) // max(1, a.sample))
        targets = urls[::step][:a.sample]

    print(f"■ 대상 {len(targets)}곳")
    stat = Counter()
    for i, u in enumerate(targets, 1):
        try:
            r = one(u, resolver, reg, a.force)
        except Blocked as e:
            print(f"  🔴 {e}")
            return 1
        if r.get("ok"):
            stat["수집"] += 1
            stat["등록구장"] += 1 if r["registered"] else 0
            print(f"  [{i}/{len(targets)}] ✔ {r['golfdb'][:22]:24s} {r['holes']}홀"
                  + (f"  ⚠ {r['warn']}" if r["warn"] else "")
                  + ("" if r["registered"] else "  (홀맵 미등록 구장)"))
        else:
            key = "이미 있음" if "이미" in r["skip"] else \
                  "golfdb 없음" if "golfdb" in r["skip"] else \
                  "통계 없음" if ("패널" in r["skip"] or "짝" in r["skip"]) else "기타"
            stat[key] += 1
            if i % 50 == 0:
                print(f"  [{i}/{len(targets)}] … {dict(stat)}")
    print("\n■", dict(stat))
    print(f"   저장: {os.path.relpath(OUT_DIR, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
