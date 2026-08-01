# -*- coding: utf-8 -*-
"""아코디아 골프 — 홀맵 그림 + 홀별 수치 수집 (2026-08-01 신설)

무엇을 모으나: 공식 예약 사이트가 공개하는 **홀별 파·HDCP·티별 야드**와 **홀맵 그림**.
왜 아코디아부터: 일본에서 그림과 수치를 **둘 다** 공개하는 곳 중 가장 크다(169곳).
                 PGM 은 그림이 없어(홀번호 배지를 홀맵으로 오인했던 것) 수치 전용이다.

사용
  python tools/jp/accordia_collect.py --list                 어떤 구장이 있고 몇 곳이 붙는지만 (수집 안 함)
  python tools/jp/accordia_collect.py --sample 3             앞에서 3곳만 (샘플 검증용)
  python tools/jp/accordia_collect.py --only chiba/aqualine  특정 구장만
  python tools/jp/accordia_collect.py --all                  golfdb 에 붙는 구장 전부
  (--dry 를 붙이면 아무것도 저장하지 않고 무엇을 할지만 보여준다)

만드는 것
  coursedata/homepages_jp/{현}_{슬러그}/parsed.json    ← 내리기 스위치(jp_takedown.py)가 보는 파일
  holeimg/jp_{현}_{슬러그}/{out|in}{홀}.jpg            ← 한국과 같은 규격(최대 900px)

지키는 것 (docs/일본_6메뉴_데이터_설계.md §7)
  · robots.txt 를 먼저 읽고 **차단된 구장은 건너뛴다**
  · 요청 간격 1초 · UA 1종 · 403/429 를 만나면 우회하지 않고 멈춘다
  · 그림은 Content-Type·매직넘버·크기를 확인한다 (200 인데 HTML 인 함정이 있다)
  · golfdb 이름에 확실히 붙는 구장만 등록한다 (부분일치 금지)
"""
import argparse, io, json, os, re, sys, unicodedata
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import (ROOT, HP_JP, Blocked, NameResolver, fetch, looks_like_image,
                       robots_blocklist)

HOST = "https://reserve.accordiagolf.com"
INDEX = HOST + "/golfCourse/"
SOURCE_MARK = "アコーディア"          # ⚠️ tools/jp_takedown.py 의 SOURCES 와 일치해야 한다
SOURCE_NAME = "アコーディア・ゴルフ 公式サイト"
# 홀맵 규격 — 2026-08-01 실측으로 정함.
# 아코디아 원본은 장당 300KB짜리 그림이라 그대로 담으면 169구장에 500MB가 넘는다
# (저장소가 이미 885MB). 크기·화질을 바꿔가며 재보니 **700px·q78** 에서
# 야드 숫자가 폰에서 또렷하게 읽히면서 장당 약 34KB(전체 약 60MB)로 들어온다.
# 한국 홀맵 평균(26KB)과 같은 급이다. 더 줄이면 그린 옆 숫자가 뭉갠다.
MAX_SIDE = 700
JPEG_Q = 78


# ── 인덱스 ───────────────────────────────────────────────────────
def course_list():
    code, _, html = fetch(INDEX)
    if code != 200:
        raise Blocked(f"구장 목록을 받지 못했습니다 (HTTP {code})")
    out, seen = [], set()
    for url, pref, slug, label in re.findall(
            r'href="(' + re.escape(HOST) + r'/golfCourse/([a-z0-9_\-]+)/([a-z0-9_\-]+)/)"[^>]*>(.*?)</a>',
            html, re.S):
        name = re.sub(r"\s+", " ", re.sub(r"(?s)<[^>]+>", "", label)).strip()
        if not name or url in seen or not re.search(r"[ぁ-んァ-ヶ一-龥]", name):
            continue
        seen.add(url)
        out.append({"url": url, "pref": pref, "slug": slug, "name": name})
    return out


# ── 페이지 파싱 ──────────────────────────────────────────────────
def strip_tags(s):
    return re.sub(r"\s+", " ", re.sub(r"(?s)<[^>]+>", " ", s).replace("&nbsp;", " ")).strip()


CNAME = r">\s*(東|西|南|北|中|OUT|IN|アウト|イン)\s*<"


def parse_layout(html):
    """레이아웃 페이지 → (구장코드, [ {name, imgCourse, holes:[{no,par,hdcp,tees}]} ])

    수치는 `m-table__main` 표에서 읽는다 — HOLE·PAR·티별 야드·HDCP 가 한 표에 다 있다.

    🔴 코스 이름과 그림 번호를 **인덱스로 추측하지 않는다.**
       27홀 구장(土浦)은 세 코스가 모두 1~9번홀이라, 홀 번호로 이름을 정하면
       세 코스가 전부 'OUT' 이 되어 **그림이 서로를 덮어쓴다**(2026-08-01 실제로 겪음).
       페이지를 보면 순서가 이렇다:
           …NAME:西 → 표 → 그림 1_1…  NAME:南 → 표 → 그림 2_1…  NAME:東 → 표 → 그림 3_1…
       그래서 **'그 위치 바로 앞에 있는 이름'** 으로 짝을 짓는다. 이름이 없으면 등록하지 않는다.
    """
    body = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    codes = sorted(set(re.findall(r"images/course/(\d+)/", html)))
    code = codes[0] if codes else None

    names = [(m.start(), m.group(1)) for m in re.finditer(CNAME, body)]

    def name_before(pos):
        got = [n for p, n in names if p < pos]
        return got[-1] if got else None

    # 그림: 코스번호별 첫 등장 위치 → 그 앞의 이름
    img_first = {}
    for m in re.finditer(r"courseLayout/(\d+)_(\d+)\.jpg(?!\.webp)", body):
        c = int(m.group(1))
        img_first.setdefault(c, m.start())
    name_of_imgcourse = {c: name_before(p) for c, p in img_first.items()}

    sections = []
    for m in re.finditer(r'(?is)<table class="m-table__main".*?</table>', body):
        tbl = m.group(0)
        rows = []
        for tr in re.findall(r"(?is)<tr.*?</tr>", tbl):
            cells = [strip_tags(c) for c in re.findall(r"(?is)<t[hd][^>]*>(.*?)</t[hd]>", tr)]
            if cells:
                rows.append(cells)
        if not rows or not rows[0] or rows[0][0].upper() != "HOLE":
            continue
        holes = []
        for v in rows[0][1:]:
            if v.isdigit():
                holes.append(int(v))
            else:
                break                                   # '計' 부터는 합계 칸
        if not holes:
            continue
        # 🔴 2그린 구장은 **같은 이름의 티 행이 두 벌** 들어온다.
        #    표 안에 `Aグリーン` / `Bグリーン` 표시행이 두 벌을 나눈다.
        #    이걸 모르고 이름으로 덮어쓰면 A그린이라고 적어 놓고 B그린 거리를 담게 된다
        #    (2026-08-01 土浦 에서 실제로 그랬다 — 홀맵 그림의 범례와 대조해 잡았다).
        #    등록은 **A그린(주 그린) 기준**, 몇 그린인지도 함께 기록한다.
        data, greens, cur = {}, [], None
        for r in rows[1:]:
            lab = r[0].strip()
            g = re.match(r"^([AB])グリーン$", lab)
            if g:
                cur = g.group(1)
                if cur not in greens:
                    greens.append(cur)
                continue
            key = (cur, lab) if lab.lower().endswith("tee") else (None, lab)
            if key not in data:                      # 먼저 나온 값을 지킨다
                data[key] = r[1:1 + len(holes)]
        if (None, "PAR") not in data:
            continue
        main = greens[0] if greens else None         # A그린(= 먼저 나오는 그린)
        tee_keys = [k for k in data if k[1].lower().endswith("tee") and k[0] == main]
        out = []
        for i, no in enumerate(holes):
            def num(key, idx=i):
                try:
                    return int(re.sub(r"[^\d]", "", data[key][idx]))
                except Exception:
                    return None
            h = {"no": no, "par": num((None, "PAR"))}
            hd = num((None, "HDCP")) if (None, "HDCP") in data else None
            if hd:
                h["hdcp"] = hd
            tees = [{"name": k[1].replace(" Tee", "").strip(), "y": num(k)}
                    for k in tee_keys if num(k)]
            if tees:
                h["tees"] = tees
            out.append(h)
        sections.append({"name": name_before(m.start()), "holes": out, "green": main,
                         "greens": len(greens),
                         "_holekey": tuple(x["no"] for x in out),
                         "_park": tuple(x["par"] for x in out)})

    # 같은 코스가 페이지에 여러 번 나온다(홀상세·ヤーデージ). 이름+홀번호+파가 같으면 한 코스다.
    uniq = []
    for s in sections:
        if not any(u["name"] == s["name"] and u["_holekey"] == s["_holekey"]
                   and u["_park"] == s["_park"] for u in uniq):
            uniq.append(s)
    sections = uniq

    # 이름 ↔ 그림 코스번호 짝짓기 (추측 금지 — 못 지으면 그림 없이 둔다)
    for s in sections:
        s["imgCourse"] = next((c for c, n in name_of_imgcourse.items() if n and n == s["name"]), None)
        s.pop("_holekey", None)
        s.pop("_park", None)
    greens = max([s.get("greens", 0) for s in sections] or [0])
    for s in sections:
        s.pop("greens", None)
    return code, sections, greens


# ── 그림 ─────────────────────────────────────────────────────────
def save_image(url, dest):
    """받아서 검증하고 한국 규격으로 줄여 저장. → (성공, 사유)"""
    code, hdr, body = fetch(url, binary=True)
    if code != 200:
        return False, f"HTTP {code}"
    ok, why = looks_like_image(hdr, body)
    if not ok:
        return False, why
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(body))
        img = img.convert("RGB")
        if max(img.size) > MAX_SIDE:
            r = MAX_SIDE / max(img.size)
            img = img.resize((max(1, int(img.width * r)), max(1, int(img.height * r))), Image.LANCZOS)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        img.save(dest, "JPEG", quality=JPEG_Q, optimize=True)
        return True, f"{os.path.getsize(dest) // 1024}KB"
    except Exception as e:
        return False, f"이미지 처리 실패 {type(e).__name__}"


# ── 구장 한 곳 ───────────────────────────────────────────────────
def collect_one(c, resolver, blocked_gids, blocked_paths, dry=False):
    tag = f"{c['pref']}/{c['slug']}"
    key = f"{c['pref']}_{c['slug']}"

    if f"golfCourse/{tag}" in blocked_paths:
        return {"skip": "robots 가 막은 구장"}

    gname, why, level = resolver.resolve(c["name"], c["pref"])
    if not gname:
        return {"skip": why}

    code, _, html = fetch(c["url"] + "layout")
    if code != 200:
        return {"skip": f"레이아웃 페이지 HTTP {code}"}
    ccode, sections, greens = parse_layout(html)
    if not ccode:
        return {"skip": "구장코드를 찾지 못함"}
    if ccode in blocked_gids:
        return {"skip": f"robots 가 막은 구장 (gid={ccode})"}
    if not sections:
        return {"skip": "홀 표를 찾지 못함"}

    total = sum(len(s["holes"]) for s in sections)
    if total % 9 or total < 9:
        return {"skip": f"홀 수가 이상함({total}홀)"}

    # 코스 이름이 없거나 겹치면 등록하지 않는다 — 겹치면 그림이 서로를 덮어쓴다
    labels = [s.get("name") for s in sections]
    if any(not x for x in labels):
        return {"skip": "코스 이름을 찾지 못함 (그림이 섞일 수 있어 등록하지 않음)"}
    if len(set(labels)) != len(labels):
        return {"skip": f"코스 이름이 겹침 {labels} — 그림이 덮어써지므로 등록하지 않음"}

    imgdir = f"holeimg/jp_{key}"
    got = miss = 0
    used = set()
    for s in sections:
        ic = s.get("imgCourse")
        for hi, h in enumerate(s["holes"], start=1):
            if not ic:
                miss += 1
                continue
            fn = f"{s['name']}{h['no']}.jpg".replace("/", "_")
            rel = f"{imgdir}/{fn}"
            if rel in used:                      # 절대 일어나면 안 되는 일 — 일어나면 멈춘다
                return {"skip": f"그림 파일명이 겹침({rel}) — 자료가 섞입니다"}
            used.add(rel)
            url = f"{HOST}/images/course/{ccode}/courseLayout/{ic}_{hi}.jpg"
            if dry:
                h["img"] = rel
                got += 1
                continue
            ok, note = save_image(url, os.path.join(ROOT, rel))
            if ok:
                h["img"] = rel
                got += 1
            else:
                miss += 1
                print(f"      · {s['name']} {h['no']}번홀 그림 없음 — {note}")

    parsed = {
        "course": gname,
        "source": SOURCE_NAME,
        "sourceUrl": c["url"] + "layout",
        "country": "JP",
        "unit": "yd",                      # ⚠️ 야드다. 미터로 읽으면 캐디가 틀린다
        # 2그린 구장은 **A그린(주 그린) 거리**만 담는다. 어느 그린인지 반드시 적는다 —
        # 화면에 A라고 써놓고 B거리를 보여주면 캐디가 통째로 틀린다.
        "greens": greens or 1,
        "green": (sections[0].get("green") if greens else None),
        "collectedAt": str(date.today()),
        "origName": c["name"],             # 출처 표기 이름 (golfdb 이름과 다를 수 있다)
        "courses": sections,
    }
    if not dry:
        d = os.path.join(HP_JP, key)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "parsed.json"), "w", encoding="utf-8", newline="\n") as w:
            json.dump(parsed, w, ensure_ascii=False, indent=1)
    return {"ok": True, "golfdb": gname, "level": level, "holes": total,
            "img": got, "imgmiss": miss, "code": ccode}


# ── 실행 ─────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--sample", type=int, default=0)
    ap.add_argument("--only", action="append", default=[])
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    print("■ robots.txt 확인")
    gids, paths = robots_blocklist(HOST)
    print(f"  차단된 구장코드 {len(gids)}개 · 차단된 경로 {len(paths)}개 — 전부 건너뜁니다")

    print("■ 구장 목록")
    courses = course_list()
    print(f"  {len(courses)}곳")

    resolver = NameResolver()

    if a.list:
        ok = ng = 0
        rows = []
        for c in courses:
            g, why, lv = resolver.resolve(c["name"], c["pref"])
            rows.append((c, g, why, lv))
            ok, ng = (ok + 1, ng) if g else (ok, ng + 1)
        print(f"\n  golfdb 에 붙는 구장 {ok}곳 / 안 붙는 구장 {ng}곳")
        print("\n  ── 붙는 구장 (앞 15) ──")
        for c, g, why, lv in [r for r in rows if r[1]][:15]:
            same = "" if g == c["name"] else f"  → {g}"
            print(f"   {c['pref']}/{c['slug']:22s} {c['name']}{same}   [{lv}]")
        print("\n  ── 안 붙는 구장 (전부) ──")
        for c, g, why, lv in [r for r in rows if not r[1]]:
            print(f"   {c['pref']}/{c['slug']:22s} {c['name']}  — {why}")
        return 0

    if a.only:
        want = set(a.only)
        targets = [c for c in courses if f"{c['pref']}/{c['slug']}" in want]
    elif a.all:
        targets = courses
    else:
        targets = []
        for c in courses:
            g, _, _ = resolver.resolve(c["name"], c["pref"])
            if g:
                targets.append(c)
            if len(targets) >= max(1, a.sample):
                break

    print(f"\n■ 수집 대상 {len(targets)}곳" + (" (연습 — 저장하지 않음)" if a.dry else ""))
    done = skipped = 0
    for i, c in enumerate(targets, 1):
        print(f"\n[{i}/{len(targets)}] {c['name']}  ({c['pref']}/{c['slug']})")
        try:
            r = collect_one(c, resolver, gids, paths, a.dry)
        except Blocked as e:
            print(f"  🔴 {e}")
            print("  → 우회하지 않고 중단합니다. docs/일본_6메뉴_데이터_설계.md §2-3 에 기록하세요.")
            return 1
        if r.get("skip"):
            print(f"  건너뜀 — {r['skip']}")
            skipped += 1
            continue
        done += 1
        print(f"  ✔ {r['golfdb']} · {r['holes']}홀 · 그림 {r['img']}장"
              + (f" (없음 {r['imgmiss']})" if r["imgmiss"] else "")
              + f" · 구장코드 {r['code']} · 이름대조[{r['level']}]")

    print(f"\n■ 끝 — 수집 {done}곳 / 건너뜀 {skipped}곳")
    if done and not a.dry:
        print("  다음: python tools/jp/check_sources_jp.py")
        print("        python tools/jp/build_holeimgdb_jp.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
