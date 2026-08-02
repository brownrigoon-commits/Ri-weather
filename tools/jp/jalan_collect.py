# -*- coding: utf-8 -*-
"""じゃらんゴルフ — 홀맵 그림 + 홀별 파·티별 야드 수집 (2026-08-01 신설)

왜 이 출처인가 (설계 docs/일본_6메뉴_데이터_설계.md §2-1):
  아코디아 등 고화질 출처는 다 합쳐도 130곳 남짓이다. 우리 DB 2,014곳에 비하면
  "일본도 됩니다"라고 말할 수 없는 수준이라, **사실상 전 구장을 덮는 등뼈**가 필요했다.
  じゃらん은 사이트맵에 구장 2,433곳을 열어 두고 robots 도 허용이며,
  PGM·아코디아는 물론 **독립 구장까지** 홀맵을 갖고 있다(8/1 실측).
  다만 그림이 235×255 한 판뿐이라 **고화질 출처가 있으면 그쪽이 이긴다**(화질 사다리).

⚠️ 홀별 코멘트("S字の長いミドルホール" 등)는 **복제하지 않는다.**
   じゃらん/구장의 저작물이다. 도그레그 방향·池 유무 같은 **사실만 토큰으로** 뽑아
   AI 캐디의 재료로 쓰고, 문장은 우리가 만든다(東京建物 공략문과 같은 취급).

사용
  python tools/jp/jalan_collect.py --scan 60        표본 훑기 (그림 보유율·매칭률만, 저장 안 함)
  python tools/jp/jalan_collect.py --scan-all       2,433곳 전수 훑기 → 결과를 캐시에 저장
  python tools/jp/jalan_collect.py --collect        캐시를 보고 실제 수집(그림 내려받기)
  python tools/jp/jalan_collect.py --only gc00739   한 곳만
"""
import argparse, io, json, os, re, sys, unicodedata
from collections import Counter
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import (ROOT, HP_JP, Blocked, NameResolver, fetch, looks_like_image)

HOST = "https://golf-jalan.net"
SITEMAP = HOST + "/sitemap.xml"
SOURCE_MARK = "じゃらん"                  # ⚠️ tools/jp_takedown.py SOURCES 와 일치
SOURCE_NAME = "じゃらんゴルフ"
CACHE = os.path.join(ROOT, "coursedata", "homepages_jp", "_scan", "jalan_scan.json")

MAX_SIDE = 700          # 원본이 235px 라 확대하지 않는다 — 상한만 둔다
JPEG_Q = 82
MIN_IMG = 2_000         # じゃらん 그림은 4KB짜리도 있다(아코디아 기준 10KB 는 오탐)

NOT_TEE = ("HOLE", "パー", "ハンディキャップ")


def strip_tags(s):
    return re.sub(r"\s+", " ", re.sub(r"(?s)<[^>]+>", " ", s).replace("&nbsp;", " ")).strip()


def clean_name(title):
    """<title> → 구장 이름. 체인 꼬리(【ＰＧＭ】 등)와 페이지 설명을 뗀다."""
    n = title.split("のコースレイアウト")[0]
    n = re.sub(r"［.*?］|\[.*?\]", "", n)
    n = re.sub(r"【[^】]*】", "", n)          # 【ＰＧＭ】【アコーディア】 — 이름이 아니라 체인 표시
    n = re.sub(r"（[^）]*）$", "", n)
    return unicodedata.normalize("NFKC", n).strip()


# 홀별 한 줄 코멘트에서 **사실만** 뽑는다 (문장은 저장하지 않는다)
FACTS = [
    (r"右.?ドッグレッグ|右ドック", "dogleg_r"),
    (r"左.?ドッグレッグ|左ドック", "dogleg_l"),
    (r"池|ウォーター|水", "water"),
    (r"打ち下ろし", "downhill"),
    (r"打ち上げ", "uphill"),
    (r"バンカー", "bunker"),
    (r"ストレート|真っ直ぐ|まっすぐ", "straight"),
    (r"名物|難関|難易度", "signature"),
]


def facts_of(comment):
    out = []
    for pat, tag in FACTS:
        if re.search(pat, comment or ""):
            out.append(tag)
    return out


def parse_tee_names(body):
    """스코어카드 표에서 **첫 번째 그린**의 티 이름 순서를 얻는다.

    표 생김새(실측):
        HOLE | 1 2 3 …
        パー  | 4 5 4 …
        ベント | Blue 422 555 …     ← 그린 이름 + 첫 티 이름
        White | 394 510 …           ← 같은 그린의 다음 티
        Gold  | …
        コウライ | BACK 540 …        ← 두 번째 그린 (여기부터는 안 쓴다)
    """
    m = re.search(r"(?is)<table[^>]*>(?:(?!</table>).)*?単位：ヤード(?:(?!</table>).)*?</table>", body)
    if not m:
        return [], 0, None
    rows = []
    for tr in re.findall(r"(?is)<tr.*?</tr>", m.group(0)):
        cells = [strip_tags(c) for c in re.findall(r"(?is)<t[hd][^>]*>(.*?)</t[hd]>", tr)]
        if cells:
            rows.append(cells)
    tees, greens = [], []
    for r in rows:
        head = r[0].strip()
        if head in NOT_TEE or head.startswith("ドラコン") or not head:
            continue
        second = r[1].strip() if len(r) > 1 else ""
        if second and not second.replace(",", "").isdigit():
            greens.append(head)                       # 그린 이름 행
            if len(greens) == 1:
                tees.append(second)
        elif len(greens) <= 1:
            tees.append(head)                         # 같은 그린의 다음 티
    # 그린 이름을 그대로 돌려준다. 일본은 A/B 가 아니라 ベント(벤트)·コウライ(고려) 라고 쓴다 —
    # 화면에 'A그린 기준'이라고 적으면 없는 이름을 지어내는 것이 된다.
    return tees, len(greens), (greens[0] if greens else None)


def parse_detail(html):
    """상세 페이지 → {name, greens, courses:[{name, holes:[…]}]}

    🔴 홀과 그림을 **문서 순서로 짝짓는다.** 페이지가 같은 내용을 여러 번(탭마다)
       반복해서 싣기 때문에, 짝을 지은 뒤 (코스,홀) 기준으로 접는다.
       접을 때 같은 홀에 **다른 그림**이 붙으면 그 구장은 통째로 버린다 —
       아코디아에서 겪은 '다른 홀 홀맵이 표시되는' 사고를 원천 차단한다.
    """
    body = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    t = re.search(r"<title>(.*?)</title>", html, re.S)
    name = clean_name(strip_tags(t.group(1))) if t else ""

    tee_names, greens, green1 = parse_tee_names(body)

    # 홀 머리(번호·파·야드) — 문서 순서
    heads = []
    for m in re.finditer(
            r'class="holeNo"[^>]*>(?:<span>)?【HOLE\s*(\d+)】</span>PAR:(\d+).{0,400}?'
            r'class="holeYardage"[^>]*>\s*([\d/、,]+)', body, re.S):
        heads.append((m.start(), int(m.group(1)), int(m.group(2)), m.group(3)))

    # 그림 — 문서 순서 (loop 번호가 곧 그 코스의 열여덟 홀 묶음)
    figs = []
    for m in re.finditer(
            r"(?is)<figure>\s*<img src=\"(https://img\.golf-jalan\.net/image/course/[^\"]+/(\d+)_(\d+)\.jpg)\"[^>]*>"
            r"\s*(?:<figcaption>([^<]*)</figcaption>)?", body):
        figs.append((m.start(), m.group(1), m.group(2), int(m.group(3)), m.group(4) or ""))

    if not heads or not figs or len(heads) != len(figs):
        return {"name": name, "greens": greens, "green1": green1, "courses": [], "why":
                f"홀 {len(heads)}개 · 그림 {len(figs)}개 — 짝이 맞지 않아 등록하지 않음"}

    # 코스 이름 표시(‘ハマナスOUT’ 같은 것) — loop 첫 등장 앞의 것
    marks = [(m.start(), strip_tags(m.group(1)))
             for m in re.finditer(r"(?is)>([^<>]{2,20}?(?:OUT|IN|ＯＵＴ|ＩＮ|コース))<", body)]

    holes = {}          # (loop, no) → dict
    conflict = False
    for (hp, no, par, yd), (fp, url, loop, fno, cap) in zip(heads, figs):
        key = (loop, fno)
        ydv = [int(x) for x in re.split(r"[/]", yd.split("、")[0].split(",")[0]) if x.isdigit()]
        tees = [{"name": tee_names[i] if i < len(tee_names) else f"T{i+1}", "y": v}
                for i, v in enumerate(ydv)]
        rec = {"no": fno, "par": par, "tees": tees, "url": url,
               "facts": facts_of(cap), "pos": fp}
        old = holes.get(key)
        if old and (old["url"] != url or old["par"] != par):
            conflict = True
        holes.setdefault(key, rec)

    if conflict:
        return {"name": name, "greens": greens, "green1": green1, "courses": [], "why":
                "같은 홀에 서로 다른 그림·파가 붙어 있어 등록하지 않음"}

    loops = {}
    for (loop, no), rec in holes.items():
        loops.setdefault(loop, []).append(rec)
    for v in loops.values():
        v.sort(key=lambda x: x["no"])

    def label_of(pos, fallback):
        """‘ハマナスOUT’ → ‘ハマナス’ / ‘ＯＵＴコース’ → '' (그냥 OUT/IN 을 쓴다)"""
        before = [n for p, n in marks if p < pos]
        raw = before[-1] if before else ""
        raw = re.sub(r"コース\s*$", "", raw).strip()
        raw = re.sub(r"(OUT|IN|ＯＵＴ|ＩＮ)\s*$", "", raw).strip()
        # 전각 OUT/IN 만 있던 이름은 코스 이름이 아니라 방향 표기다 → 비운다
        if unicodedata.normalize("NFKC", raw).upper() in ("", "OUT", "IN"):
            return ""
        return raw

    courses = []
    ordered = sorted(loops.items(), key=lambda kv: kv[1][0]["pos"])
    for li, (loop, recs) in enumerate(ordered, start=1):
        base = label_of(recs[0]["pos"], "")
        if len(recs) > 9:                     # 18홀 묶음은 OUT/IN 으로 나눈다(일본 표준 표기)
            for part, rng in (("OUT", range(1, 10)), ("IN", range(10, 19))):
                hs = [r for r in recs if r["no"] in rng]
                if hs:
                    courses.append({"name": (base + " " + part).strip(), "holes": hs})
        else:
            courses.append({"name": base or (f"C{li}" if len(ordered) > 1 else "OUT"), "holes": recs})
    # 코스 이름이 겹치면 그림이 서로를 덮어쓴다 — 아코디아에서 겪은 사고와 같은 자리
    names = [c["name"] for c in courses]
    if len(set(names)) != len(names):
        return {"name": name, "greens": greens, "green1": green1, "courses": [],
                "why": f"코스 이름이 겹침 {names} — 등록하지 않음"}
    return {"name": name, "greens": greens, "green1": green1, "courses": courses, "why": ""}


def course_urls():
    code, _, body = fetch(SITEMAP)
    if code != 200:
        raise Blocked(f"사이트맵을 받지 못했습니다 (HTTP {code})")
    return sorted(set(re.findall(r"<loc>(https://golf-jalan\.net/gc\d+/)</loc>", body)))


def save_image(url, dest):
    code, hdr, body = fetch(url, binary=True)
    if code != 200:
        return False, f"HTTP {code}"
    ok, why = looks_like_image(hdr, body)
    if not ok and "너무 작음" in why and len(body) >= MIN_IMG:
        ok, why = True, ""                    # じゃらん 그림은 원래 작다
    if not ok:
        return False, why
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(body)).convert("RGB")
        if max(img.size) > MAX_SIDE:
            r = MAX_SIDE / max(img.size)
            img = img.resize((int(img.width * r), int(img.height * r)), Image.LANCZOS)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        img.save(dest, "JPEG", quality=JPEG_Q, optimize=True)
        return True, ""
    except Exception as e:
        return False, f"이미지 처리 실패 {type(e).__name__}"


def one(gcurl, resolver, download, existing):
    gc = re.search(r"/(gc\d+)/", gcurl).group(1)
    code, _, html = fetch(gcurl + "detail/")
    if code != 200:
        return {"gc": gc, "skip": f"HTTP {code}"}
    d = parse_detail(html)
    if not d["courses"]:
        return {"gc": gc, "name": d["name"], "skip": d["why"] or "홀 자료 없음"}
    g, why, level = resolver.resolve(d["name"])
    if not g:
        return {"gc": gc, "name": d["name"], "skip": why, "holes": sum(len(c["holes"]) for c in d["courses"])}
    if g in existing:
        return {"gc": gc, "name": d["name"], "golfdb": g,
                "skip": "이미 더 좋은 출처로 등록됨 (화질 사다리)"}

    total = sum(len(c["holes"]) for c in d["courses"])
    if not download:
        return {"gc": gc, "name": d["name"], "golfdb": g, "level": level,
                "holes": total, "courses": len(d["courses"]), "greens": d["greens"]}

    key = gc
    imgdir = f"holeimg/jp_jalan_{key}"
    got = miss = 0
    used = set()
    for c in d["courses"]:
        for h in c["holes"]:
            fn = re.sub(r"[^\w]", "", c["name"]) + str(h["no"]) + ".jpg"
            rel = f"{imgdir}/{fn}"
            if rel in used:
                return {"gc": gc, "skip": f"그림 파일명이 겹침({rel})"}
            used.add(rel)
            ok, note = save_image(h["url"], os.path.join(ROOT, rel))
            if ok:
                h["img"] = rel
                got += 1
            else:
                miss += 1
            h.pop("url", None)
            h.pop("pos", None)
    parsed = {
        "course": g, "source": SOURCE_NAME, "sourceUrl": gcurl + "detail/",
        "country": "JP", "unit": "yd",
        # 2그린이면 **첫 번째 그린 이름 그대로**(ベント 등). 일본은 A/B 라고 안 쓴다.
        "greens": d["greens"] or 1,
        "green": (d.get("green1") if d["greens"] and d["greens"] >= 2 else None),
        "collectedAt": str(date.today()), "origName": d["name"],
        "courses": [{"name": c["name"], "holes": c["holes"]} for c in d["courses"]],
    }
    outdir = os.path.join(HP_JP, "jalan_" + key)
    os.makedirs(outdir, exist_ok=True)
    with open(os.path.join(outdir, "parsed.json"), "w", encoding="utf-8", newline="\n") as w:
        json.dump(parsed, w, ensure_ascii=False, indent=1)
    return {"gc": gc, "name": d["name"], "golfdb": g, "level": level,
            "holes": total, "img": got, "imgmiss": miss, "ok": True}


def already_registered():
    """이미 등록된 구장(고화질 출처 포함) — 같은 구장을 덮어쓰지 않기 위해."""
    out = {}
    if not os.path.isdir(HP_JP):
        return out
    for d in os.listdir(HP_JP):
        f = os.path.join(HP_JP, d, "parsed.json")
        if os.path.exists(f):
            try:
                j = json.load(open(f, encoding="utf-8"))
                if SOURCE_MARK not in j.get("source", ""):
                    out[j["course"]] = j.get("source", "")
            except Exception:
                pass
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scan", type=int, default=0)
    ap.add_argument("--scan-all", action="store_true")
    ap.add_argument("--collect", action="store_true")
    ap.add_argument("--only", action="append", default=[])
    a = ap.parse_args()

    print("■ 구장 목록 (사이트맵)")
    urls = course_urls()
    print(f"  {len(urls)}곳")

    resolver = NameResolver()
    existing = already_registered()
    if existing:
        print(f"■ 이미 고화질 출처로 등록된 구장 {len(existing)}곳 — 건너뜁니다")

    if a.only:
        targets = [u for u in urls if any(o in u for o in a.only)]
    elif a.scan_all or a.collect:
        targets = urls
    else:
        step = max(1, len(urls) // max(1, a.scan))       # 전국에 고르게 흩어 뽑는다
        targets = urls[::step][:a.scan]

    print(f"■ 대상 {len(targets)}곳" + (" · 그림 내려받기" if a.collect else " · 훑기만(저장 안 함)"))
    stats = Counter()
    rows = []
    for i, u in enumerate(targets, 1):
        try:
            r = one(u, resolver, a.collect, existing)
        except Blocked as e:
            print(f"  🔴 {e}")
            return 1
        rows.append(r)
        if r.get("skip"):
            key = ("이미 등록" if "이미" in r["skip"] else
                   "golfdb 없음" if "golfdb" in r["skip"] else
                   "홀자료 없음" if ("홀" in r["skip"] or "자료" in r["skip"]) else "기타")
            stats[key] += 1
        else:
            stats["사용 가능"] += 1
            stats["홀"] += r.get("holes", 0)
        if a.collect and r.get("ok"):
            print(f"  [{i}/{len(targets)}] ✔ {r['golfdb']} · {r['holes']}홀 · 그림 {r['img']}장")
        elif i % 25 == 0 or i == len(targets):
            print(f"  [{i}/{len(targets)}] 사용가능 {stats['사용 가능']} · "
                  f"golfdb없음 {stats['golfdb 없음']} · 홀자료없음 {stats['홀자료 없음']}")

    print("\n■ 결과")
    n = len(targets)
    for k in ("사용 가능", "golfdb 없음", "홀자료 없음", "이미 등록", "기타"):
        if stats[k]:
            print(f"   {k:12s} {stats[k]:5d}곳 ({stats[k]*100//n}%)")
    print(f"   총 홀 수 {stats['홀']:,}홀")
    if not a.collect and n >= 20:
        rate = stats["사용 가능"] / n
        print(f"\n   → 전체 {len(urls):,}곳에 적용하면 약 {int(len(urls)*rate):,}곳 예상")

    # ⚠️ 한 곳만 돌렸을 때 전수 기록을 덮어쓰지 않는다.
    #    2026-08-02 에 --only 실행이 2,433곳 기록을 1줄로 날려, 나중에 '통계 없는 구장'의
    #    gc 를 되짚지 못했다. 전수 결과는 전수 실행일 때만 쓴다.
    if len(targets) > 50 or not os.path.exists(CACHE):
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        json.dump({"at": str(date.today()), "n": n, "stats": dict(stats), "rows": rows},
                  open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"   (자세한 결과: {os.path.relpath(CACHE, ROOT)})")
    else:
        print("   (일부만 돌렸으므로 전수 기록은 그대로 둡니다)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
