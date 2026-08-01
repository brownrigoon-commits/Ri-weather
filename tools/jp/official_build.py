# -*- coding: utf-8 -*-
"""공식 홈페이지 DOM 스캔 → 홀맵 등록 (2026-08-01 신설, 화질 사다리 2층)

앞 단계: tools/jp/official_scan.js 가 브라우저로 사이트를 열어 이미지·글자를 긁어
        coursedata/homepages_jp/_scan/official_dom.json 을 만든다.
이 도구: 그 안에서 **홀맵 시리즈**를 골라 내려받고 parsed.json 으로 등록한다.

왜 둘로 나눴나: 긁기는 느리고(사이트당 10초) 판정은 빠르다. 판정 규칙을 고칠 때마다
다시 긁지 않으려고 분리했다 — 한국판에서 수집(collect_course_homepages)과
조립(universal_build)을 나눈 것과 같은 이유다.

사용
  python tools/jp/official_build.py --report      무엇이 잡히는지만 (저장 안 함)
  python tools/jp/official_build.py --collect     내려받아 등록
"""
import argparse, io, json, os, re, sys, urllib.parse
from collections import Counter
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import ROOT, HP_JP, MAGIC
from official_collect import fetch, series_of, qualifying_series

DOM = os.path.join(ROOT, "coursedata", "homepages_jp", "_scan", "official_dom.json")
MAX_SIDE, JPEG_Q, MIN_IMG = 900, 80, 6_000
SOURCE_MARK = "公式"          # tools/jp_takedown.py SOURCES 와 맞출 것

# 코스 구분 이름 — 주소·시리즈 이름에서 얻는다
SECT = [("east", "EAST"), ("west", "WEST"), ("center", "CENTER"), ("south", "SOUTH"),
        ("north", "NORTH"), ("out", "OUT"), ("in", "IN"),
        ("東", "東"), ("西", "西"), ("南", "南"), ("北", "北"), ("中", "中")]


def section_name(url, base, idx, total):
    hay = urllib.parse.unquote(url).lower() + " " + base.lower()
    for k, v in SECT:
        if re.search(r"(?<![a-z])" + k + r"(?![a-z])", hay) or (k in hay and not k.isascii()):
            return v
    return f"C{idx}" if total > 1 else "OUT"


PAR_TXT = re.compile(r"(?:PAR|Par|par|パー)\s*[:：]?\s*([3-6])\b")


def pars_from(text, n):
    """화면 글자에서 홀별 파를 뽑는다. 홀 수와 정확히 같을 때만 인정한다(추측 금지)."""
    v = [int(x) for x in PAR_TXT.findall(text or "")]
    return v if len(v) == n else []


def save(url, dest):
    """→ 저장된 상대경로 or None. SVG 는 그대로 두고, 래스터만 줄인다."""
    code, hdr, raw = fetch(url, binary=True)
    if code != 200 or not isinstance(raw, bytes):
        return None
    # 벡터(SVG) — PGM 계열 구장이 이 형식이다. 매직넘버가 없어 예전엔 통째로 버려졌다.
    # 확대해도 안 깨지므로 손대지 않고 그대로 담는다(용량도 작다).
    head = raw[:400].lstrip()
    if url.lower().split("?")[0].endswith(".svg") or head.startswith((b"<?xml", b"<svg")):
        if b"<svg" not in raw[:4000] or len(raw) < 800:
            return None
        dest = os.path.splitext(dest)[0] + ".svg"
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        open(dest, "wb").write(raw)
        return dest
    if not any(raw.startswith(m) for m in MAGIC) or len(raw) < MIN_IMG:
        return None
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        if max(im.size) > MAX_SIDE:
            r = MAX_SIDE / max(im.size)
            im = im.resize((int(im.width * r), int(im.height * r)), Image.LANCZOS)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        im.save(dest, "JPEG", quality=JPEG_Q, optimize=True)
        return dest
    except Exception:
        return None


def already():
    out = {}
    if os.path.isdir(HP_JP):
        for d in os.listdir(HP_JP):
            f = os.path.join(HP_JP, d, "parsed.json")
            if os.path.exists(f):
                try:
                    j = json.load(open(f, encoding="utf-8"))
                    out[j["course"]] = j.get("source", "")
                except Exception:
                    pass
    return out


# OSM 의 website 태그가 늘 '공식 사이트'인 것은 아니다 — 애그리게이터를 적어 둔 곳이 있다.
# 특히 ShotNavi·GDO·ALBA 는 우리가 접근하지 않기로 한 출처다(설계 §2-3).
# 이걸 그대로 담으면 '공식이라 적고 남의 자료를 담는' 꼴이 된다(2026-08-01 관문이 잡음).
NOT_OFFICIAL = ("shotnavi", "golfdigest.co.jp", "alba.co.jp", "golf-jalan.net",
                "gora.golf.rakuten", "accordiagolf.com", "jalan.net", "rakuten.co.jp",
                "gdo.co.jp", "golfnetwork", "facebook.com", "instagram.com")


def build_one(rec, collect, ex):
    g = rec["golfdb"]
    site = (rec.get("site") or "").lower()
    if any(x in site for x in NOT_OFFICIAL):
        return {"golfdb": g, "skip": "공식 사이트가 아님(애그리게이터·접근 금지 출처)"}
    # 화질 사다리 — 공식 홈페이지(고화질)는 じゃらん(235px)을 **덮어쓴다**.
    # 체인(아코디아 등)이 이미 등록한 곳은 건드리지 않는다(같은 급이거나 더 좋다).
    if g in ex and "じゃらん" not in ex[g]:
        return {"golfdb": g, "skip": f"이미 등록됨({ex[g][:18]})"}
    if rec.get("error"):
        return {"golfdb": g, "skip": "사이트 접속 실패"}

    found = []            # (페이지, 시리즈)
    for p in rec.get("pages", []):
        for s in qualifying_series(series_of(p["imgs"])):
            found.append((p, s))
    if not found:
        return {"golfdb": g, "skip": "홀맵 시리즈 없음"}

    # 같은 시리즈가 여러 페이지에 나오면 한 번만
    uniq, seen = [], set()
    for p, s in found:
        if s["key"] in seen:
            continue
        seen.add(s["key"])
        uniq.append((p, s))
    total_holes = sum(s["n"] for _, s in uniq)
    if total_holes % 9 or total_holes > 45:
        return {"golfdb": g, "skip": f"홀 수가 이상함({total_holes}홀 · 시리즈 {len(uniq)}벌)"}

    sections, names = [], set()
    for i, (p, s) in enumerate(uniq, 1):
        nm = section_name(p["url"], s["base"], i, len(uniq))
        if nm in names:
            nm = f"{nm}{i}"
        names.add(nm)
        pars = pars_from(p.get("text", ""), s["n"])
        sections.append({"name": nm, "page": p["url"], "series": s,
                         "pars": pars})

    if not collect:
        return {"golfdb": g, "holes": total_holes,
                "sections": [(x["name"], x["series"]["n"], len(x["pars"])) for x in sections],
                "site": rec["site"]}

    key = re.sub(r"[^\w]", "", g)[:24] or "jp"
    imgdir = f"holeimg/jp_off_{key}"
    out_sect, got = [], 0
    for sec in sections:
        holes = []
        base = 0 if sec["series"]["n"] > 9 else (len(out_sect) * 9)
        for no in sorted(sec["series"]["holes"]):
            rel = f"{imgdir}/{re.sub(r'[^A-Za-z0-9]', '', sec['name'])}{no}.jpg"
            saved = save(sec["series"]["holes"][no], os.path.join(ROOT, rel))
            if not saved:
                continue
            rel = os.path.relpath(saved, ROOT).replace("\\", "/")   # SVG 면 확장자가 바뀐다
            h = {"no": no + base, "img": rel}
            if sec["pars"]:
                h["par"] = sec["pars"][no - 1]
            holes.append(h)
            got += 1
        if len(holes) != sec["series"]["n"]:
            return {"golfdb": g, "skip": f"그림을 다 받지 못함({len(holes)}/{sec['series']['n']})"}
        if sec["series"]["n"] > 9:
            # 18홀 한 벌은 OUT/IN 으로 나눈다. 다만 **36홀 구장은 두 벌**이라
            # 그냥 OUT/IN 을 붙이면 ['OUT','IN','OUT','IN'] 로 겹친다(2026-08-01 관문이 잡음).
            # 벌이 둘 이상이면 코스 이름을 앞에 붙여 구분한다.
            pre = (sec["name"] + " ") if len(sections) > 1 else ""
            for nm2, rng in (("OUT", range(1, 10)), ("IN", range(10, 19))):
                hs = [h for h in holes if h["no"] in rng]
                if hs:
                    out_sect.append({"name": pre + nm2, "holes": hs})
        else:
            out_sect.append({"name": sec["name"], "holes": holes})

    # ⚠️ '公式サイト' 로 쓰면 아코디아 출처와 겹쳐 내리기 스위치가 엉뚱한 자료를 잡는다
    #    (tools/jp_takedown.py 주석 참고). 표기는 반드시 '公式ホームページ'.
    parsed = {"course": g, "source": f"{rec['osm']} 公式ホームページ",
              "sourceUrl": sections[0]["page"], "country": "JP", "unit": "yd",
              "greens": 1, "green": None, "collectedAt": str(date.today()),
              "origName": rec["osm"], "courses": out_sect}
    d = os.path.join(HP_JP, "off_" + key)
    os.makedirs(d, exist_ok=True)
    json.dump(parsed, open(os.path.join(d, "parsed.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    # 같은 구장의 じゃらん 등록분은 치운다 — 두 벌이 남으면 조립기가 중복으로 멈춘다
    for other in os.listdir(HP_JP):
        if not other.startswith("jalan_"):
            continue
        f = os.path.join(HP_JP, other, "parsed.json")
        try:
            if json.load(open(f, encoding="utf-8")).get("course") == g:
                import shutil
                shutil.rmtree(os.path.join(HP_JP, other), ignore_errors=True)
        except Exception:
            pass
    return {"golfdb": g, "ok": True, "holes": got,
            "pars": sum(1 for s in out_sect for h in s["holes"] if h.get("par"))}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--collect", action="store_true")
    a = ap.parse_args()
    if not os.path.exists(DOM):
        print("먼저 node tools/jp/official_scan.js 로 긁으세요")
        return 1
    recs = json.load(open(DOM, encoding="utf-8"))
    ex = already()
    print(f"■ 스캔된 구장 {len(recs)}곳 · 이미 등록 {len(ex)}곳")
    stat = Counter()
    for i, r in enumerate(recs, 1):
        res = build_one(r, a.collect, ex)
        if res.get("ok"):
            stat["등록"] += 1
            print(f"  [{i}] ✔ {res['golfdb']} · {res['holes']}홀 · 파 {res['pars']}")
        elif res.get("skip"):
            stat[res["skip"].split("(")[0].strip()] += 1
        else:
            stat["홀맵 발견"] += 1
            print(f"  [{i}] ○ {res['golfdb'][:20]:22s} {res['holes']}홀 {res['sections']}")
    print("\n■", dict(stat))
    return 0


if __name__ == "__main__":
    sys.exit(main())
