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
    code, hdr, raw = fetch(url, binary=True)
    if code != 200 or not isinstance(raw, bytes):
        return False
    if not any(raw.startswith(m) for m in MAGIC) or len(raw) < MIN_IMG:
        return False
    try:
        from PIL import Image
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        if max(im.size) > MAX_SIDE:
            r = MAX_SIDE / max(im.size)
            im = im.resize((int(im.width * r), int(im.height * r)), Image.LANCZOS)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        im.save(dest, "JPEG", quality=JPEG_Q, optimize=True)
        return True
    except Exception:
        return False


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


def build_one(rec, collect, ex):
    g = rec["golfdb"]
    if g in ex:
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
            if not save(sec["series"]["holes"][no], os.path.join(ROOT, rel)):
                continue
            h = {"no": no + base, "img": rel}
            if sec["pars"]:
                h["par"] = sec["pars"][no - 1]
            holes.append(h)
            got += 1
        if len(holes) != sec["series"]["n"]:
            return {"golfdb": g, "skip": f"그림을 다 받지 못함({len(holes)}/{sec['series']['n']})"}
        if sec["series"]["n"] > 9:            # 18홀 한 벌은 OUT/IN 으로 나눈다
            for nm2, rng in (("OUT", range(1, 10)), ("IN", range(10, 19))):
                hs = [h for h in holes if h["no"] in rng]
                if hs:
                    out_sect.append({"name": nm2, "holes": hs})
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
