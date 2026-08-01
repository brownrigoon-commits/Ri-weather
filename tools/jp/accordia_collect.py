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


# 코스 이름은 ホール詳細 구획의 <h4 class="a-heading -lv4">筑波 OUT</h4> 하나로 통일돼 있다.
# (ヤーデージ 구획의 >OUT< 같은 짧은 토큰은 쓰지 않는다 — 자유 형식 이름 구장에는 아예 없다)
CNAME_H4 = r'<h4 class="a-heading -lv4[^"]*"[^>]*>\s*([^<]{1,30}?)\s*</h4>'
CARD = r'(?is)<table class="m-table__heading">(?:(?!</table>).)*?</table>'
IMG = r"courseLayout/(\d+)_(\d+)\.jpg(?!\.webp)"


def parse_layout(html):
    """레이아웃 페이지 → (구장코드, [ {name, holes:[{no,par,hdcp,tees,imgIdx}]} ], 그린수)

    🔴 **국소 짝짓기** — 홀 카드와 그림은 문서에서 바로 붙어 나온다:
           H4(코스이름) → CARD(HOLE:1 PAR 4, 티값) → IMG(1_1) → CARD(HOLE:2) → IMG(1_2) …
       이 붙어 있는 짝만 쓰면 코스·홀·그림이 어긋날 자리가 없다.

       처음엔 요약표(ヤーデージ)에서 수치를 읽고 이름은 '표 앞의 마커'로 붙였는데,
       **요약표는 h4 마커보다 뒤에 있어서** 모든 표가 마지막 코스 이름을 받았다
       (castlehill 이 OUT·IN 둘 다 'IN' 이 되는 회귀). 표 위치로 이름을 찾지 않는다.

       HDCP 만 요약표에 있으므로, **홀 번호와 파 배열이 똑같은 표**를 찾아 붙인다
       (위치가 아니라 내용으로 맞춘다 — 못 찾으면 HDCP 없이 둔다).
    """
    body = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    codes = sorted(set(re.findall(r"images/course/(\d+)/", html)))
    code = codes[0] if codes else None

    # ── 1. 문서 순서로 이벤트 모으기 ──────────────────────────────
    ev = []
    for m in re.finditer(CNAME_H4, body):
        ev.append((m.start(), "H4", m.group(1)))
    for m in re.finditer(IMG, body):
        ev.append((m.start(), "IMG", (int(m.group(1)), int(m.group(2)))))
    for m in re.finditer(CARD, body):
        t = m.group(0)
        no = re.search(r"HOLE:(\d+)", t)
        par = re.search(r"PAR&nbsp;\s*(\d+)|PAR\s*(\d+)", t)
        tees = re.findall(r'__tee__top">([^<]+)</span>\s*<span class="m-table__tee__bottom">([^<]*)<', t)
        if no:
            ev.append((m.start(), "CARD", (int(no.group(1)),
                                           int(par.group(1) or par.group(2)) if par else None, tees)))
    ev.sort(key=lambda x: x[0])

    # ── 2. 붙어 있는 CARD→IMG 짝만 채택 ───────────────────────────
    sections, cur, greens_seen = [], None, 1
    for i, (pos, kind, val) in enumerate(ev):
        if kind == "H4":
            cur = {"name": val.strip(), "holes": []}
            sections.append(cur)
            continue
        if kind != "CARD" or cur is None:
            continue
        if i + 1 >= len(ev) or ev[i + 1][1] != "IMG":
            continue                                  # 그림이 안 붙은 카드(요약 구획) 는 버린다
        no, par, tees = val
        imgc, imgn = ev[i + 1][2]

        # 2그린 구장은 카드에 티가 두 벌 들어온다(Blue White Green Red Blue White Green Red).
        # 이름이 되풀이되는 지점에서 끊어 **먼저 나오는 그린(A)** 만 쓴다.
        names_seen, per_green = [], len(tees)
        for k, (tn, _) in enumerate(tees):
            if tn in names_seen:
                per_green = k
                break
            names_seen.append(tn)
        if per_green and len(tees) % per_green == 0:
            greens_seen = max(greens_seen, len(tees) // per_green)
        first = tees[:per_green] if per_green else tees

        h = {"no": no, "par": par, "imgIdx": (imgc, imgn),
             "tees": [{"name": tn.replace(" Tee", "").strip(), "y": int(re.sub(r"[^\d]", "", tv))}
                      for tn, tv in first if re.sub(r"[^\d]", "", tv)]}
        cur["holes"].append(h)

    sections = [s for s in sections if s["holes"]]

    # ── 3. HDCP 를 '내용이 같은' 요약표에서 가져오기 ────────────────
    tables = []
    for m in re.finditer(r'(?is)<table class="m-table__main".*?</table>', body):
        rows = []
        for tr in re.findall(r"(?is)<tr.*?</tr>", m.group(0)):
            cells = [strip_tags(c) for c in re.findall(r"(?is)<t[hd][^>]*>(.*?)</t[hd]>", tr)]
            if cells:
                rows.append(cells)
        if not rows or rows[0][0].upper() != "HOLE":
            continue
        nums = []
        for v in rows[0][1:]:
            if v.isdigit():
                nums.append(int(v))
            else:
                break
        d = {r[0].strip(): r[1:1 + len(nums)] for r in rows[1:]}
        if "PAR" not in d or "HDCP" not in d:
            continue
        pars = [int(x) if x.isdigit() else None for x in d["PAR"]]
        hd = [int(re.sub(r"[^\d]", "", x)) if re.sub(r"[^\d]", "", x) else None for x in d["HDCP"]]
        tables.append((tuple(nums), tuple(pars), hd))

    for s in sections:
        key = (tuple(h["no"] for h in s["holes"]), tuple(h["par"] for h in s["holes"]))
        cands = [t for t in tables if (t[0], t[1]) == key]
        if len(cands) == 1:                            # 딱 하나일 때만 — 애매하면 안 붙인다
            for h, v in zip(s["holes"], cands[0][2]):
                if v:
                    h["hdcp"] = v
    return code, sections, greens_seen


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
def collect_one(c, resolver, blocked_gids, blocked_paths, dry=False, reuse=False):
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
        for h in s["holes"]:
            ic, inum = h.pop("imgIdx")          # 카드 바로 뒤에 붙어 있던 그 그림
            fn = re.sub(r"[^\w]", "", s["name"]) + f"{h['no']}.jpg"   # "筑波 OUT" → 筑波OUT1.jpg
            rel = f"{imgdir}/{fn}"
            if rel in used:                      # 절대 일어나면 안 되는 일 — 일어나면 멈춘다
                return {"skip": f"그림 파일명이 겹침({rel}) — 자료가 섞입니다"}
            used.add(rel)
            url = f"{HOST}/images/course/{ccode}/courseLayout/{ic}_{inum}.jpg"
            if dry:
                h["img"] = rel
                got += 1
                continue
            dest = os.path.join(ROOT, rel)
            # 이미 받아 둔 그림 재사용 — 같은 URL 규칙이라 내용이 같다.
            # (표본을 다시 받아 바이트로 대조해 확인한 뒤에만 쓰는 선택지다)
            if reuse and os.path.exists(dest) and os.path.getsize(dest) > 3000:
                h["img"] = rel
                got += 1
                continue
            ok, note = save_image(url, dest)
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
        "green": ("A" if greens and greens >= 2 else None),   # 아코디아 표기는 Aグリーン/Bグリーン
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
    ap.add_argument("--reuse-img", action="store_true",
                    help="이미 받아 둔 그림은 다시 받지 않는다(표본 대조로 안전 확인 후 사용)")
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
            r = collect_one(c, resolver, gids, paths, a.dry, a.reuse_img)
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
