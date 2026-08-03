# -*- coding: utf-8 -*-
"""홀 자료 다시 파싱 — 홈페이지 템플릿별 정밀 추출 (2026-08-03 신설)

왜 필요한가
  `tools/universal_build.py` 의 parse_generic 은 홀 이미지 앞뒤 ±2200자를 잘라
  그 안에서 **가장 긴 한국어 문장**을 공략 TIP 으로 삼는다. 창이 옆 홀까지 덮으면
  옆 홀 문장이 더 길어서 그게 뽑힌다. 그래서 광주CC·한림안성CC 는 홀 23개가
  남의 홀 설명을 달고 있었고(2026-08-02 발견, 원인 미상으로 미뤄져 있었다),
  par·거리도 같은 창에서 주워 온 값이라 공식 표기와 어긋났다. 같은 원인으로
  써닝포인트CC·골드그린GC·일레븐CC 도 공략이 옆 홀 것이었다(2026-08-03,
  새 관문 `tools/check_holequality.py` 가 찾아냈다).

  다행히 이 구장들의 홈페이지는 홀마다 경계가 분명한 덩어리를 준다. 창을
  어림잡을 이유가 없다 — 덩어리 하나 = 홀 하나로 보고 그 안에서만 뽑는다.

템플릿(프로필) 3종
  holetitle   <div class="hole-title"><i>동악 코스</i><strong>HOLE 1</strong>
              <span>PAR 4</span><span>HDCP 9</span></div> …            광주CC·한림안성CC
  holecontent <div class="hole_1 hole_content"> … hole_num/hole_length/
              grade_length/hole_txt …                                   골드그린GC·일레븐CC
  tabhole     <div id="tab1" class="tab_content"> … hole-size(1Hole
              Par4 / 415m) · hole-vod-info(공략) …                       써닝포인트CC

무엇을 지키나
  · 새로 뽑은 홀 수·번호가 기존과 다르면 그 코스는 손대지 않는다
  · 이미지는 홀 덩어리 안에 있는 것만 쓴다(사이트 파일명을 믿지 않는다)
  · 공략에 남의 홀 표식(HOLE n·Par n)이 남아 있으면 통째로 버린다
    — 틀린 것을 보여 주느니 비운다(제1원칙)
  · 저장된 원본(coursedata/homepages_auto/<폴더>/pages*)만 읽는다 — 재수집 없음

사용
  python tools/reparse_holes.py            무엇이 바뀌는지만 보여 준다
  python tools/reparse_holes.py --write    parsed.json 을 실제로 고친다
  python tools/reparse_holes.py --images   홀맵 이미지도 원본에서 다시 만든다
"""
import argparse, glob, html as htmlmod, json, os, re, shutil, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUTO = os.path.join(ROOT, "coursedata", "homepages_auto")
HP = os.path.join(ROOT, "coursedata", "homepages")

# 구장 slug → (원본 폴더, 코스별 페이지)
#   코스명은 페이지에서 읽지 않고 기존 parsed.json 의 것을 그대로 쓴다
#   (앱 검색·일본어 사전이 그 이름에 붙어 있다).
TARGETS = {
    "kjcc":        {"folder": "광주CC",     "profile": "holetitle", "prefer": "pages_v2",
                    "pages": {"OUT": "p2.html", "섬진": "p7.html", "설산": "p8.html"}},
    "ansung":      {"folder": "한림안성CC", "profile": "holetitle", "prefer": "pages",
                    "pages": {"OUT": "p2.html"}},
    "goldgreen":   {"folder": "골드그린GC", "profile": "holecontent", "prefer": "pages",
                    "pages": {"OUT": "p2.html"}},
    "elevencc":    {"folder": "일레븐CC",   "profile": "holecontent", "prefer": "pages",
                    "pages": {"OUT": "p1.html", "IN": "p2.html"}},
    "sunningpoint": {"folder": "써닝포인트CC", "profile": "tabhole", "prefer": "pages_v2",
                     "pages": {"SUN": "p2.html", "POINT": "p3.html"}},
    # 웰링턴CC 는 홀마다 페이지가 따로다(.../golf/one/hole01.do). 코스 slug 로 묶는다.
    "wellingtoncc": {"folder": "웰링턴CC", "profile": "greeninfo", "prefer": "pages",
                     "pages": {"OUT": "one"}},
}

HOLE_SPLIT = re.compile(r'<div class="hole-title"')
HDR = re.compile(r"HOLE\s*(\d+)\s*</strong>\s*<span>\s*PAR\s*(\d+)\s*</span>"
                 r"(?:\s*<span>\s*HDCP\s*(\d+)\s*</span>)?", re.I)
DIST = re.compile(r"거리\s*:\s*([\d.]+)\s*m", re.I)
IMG = re.compile(r'<img[^>]+src="([^"]+\.(?:jpg|jpeg|png))"', re.I)


def text_of(chunk):
    t = re.sub(r"(?is)<(script|style).*?</\1>", " ", chunk)
    t = re.sub(r"<br\s*/?>", " ", t, flags=re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", htmlmod.unescape(t)).strip()


def tip_of(chunk):
    """공략 문구 — 코스공략법 뒤 문단, 없으면 class="info" 문단."""
    m = re.search(r"코스공략법\s*</div>\s*(.*?)(?=<div class=\"veno_wrap|<ul|<table|</section|$)",
                  chunk, re.S | re.I)
    if not m:
        m = re.search(r'<div class="info">(.*?)</div>', chunk, re.S | re.I)
    if not m:
        return ""
    t = text_of(m.group(1))
    # 남의 홀 글이 섞여 들어온 흔적이면 통째로 버린다(틀린 것을 보여 주느니 비운다)
    if re.search(r"HOLE\s*\d+", t, re.I) or len(t) < 10:
        return ""
    return t


TEE_NAME = {"white": "화이트", "white1": "화이트", "white2": "화이트2", "red": "레드",
            "blue": "블루", "black": "블랙", "gold": "골드", "green": "그린",
            "yellow": "옐로", "silver": "실버", "pro": "프로",
            "champion": "챔피언", "back": "백"}


def tees_of(chunk):
    """티별 거리표(한림안성 템플릿) — <th>티 이름</th> … <td>320 m / 350.0 YD</td>.

    티 사다리(긴 티가 앞)는 check_tees.py 가 배포 때 다시 확인한다.
    """
    tb = re.search(r"<table[^>]*>(.*?)</table>", chunk, re.S | re.I)
    if not tb:
        return []
    names = [text_of(x).lower() for x in re.findall(r"<th[^>]*>(.*?)</th>", tb.group(1), re.S | re.I)]
    vals = [text_of(x) for x in re.findall(r"<td[^>]*>(.*?)</td>", tb.group(1), re.S | re.I)]
    out = []
    for nm, v in zip(names, vals):
        m = re.search(r"([\d.]+)\s*m", v, re.I)
        if not m:
            continue
        key = re.sub(r"[^a-z0-9]", "", nm)
        out.append({"name": TEE_NAME.get(key, nm.strip() or "티"), "m": int(float(m.group(1)))})
    return sorted(out, key=lambda t: -t["m"])


def hole_img(chunk):
    """홀맵 이미지 — 두 사이트 모두 오른쪽 칸(col-lg-5)에 홀맵을 둔다.

    같은 덩어리 안의 다른 그림을 집으면 안 된다:
      · `veno_wrap` 갤러리 = 홀 사진(광주)
      · `hole_green_0n.png` = 그린 모양만 그린 투명 오버레이(한림안성)
        — 이걸 흰 배경에 합성해서 앱에 넣는 바람에 9홀 전부 백지가 됐다(2026-08-03 발견).
    """
    m = re.search(r'class="col-lg-5[^"]*"[^>]*>\s*<img[^>]+src="([^"]+)"', chunk, re.I)
    if m:
        return os.path.basename(m.group(1)).lower()
    for src in IMG.findall(chunk):
        base = os.path.basename(src).lower()
        if "green" in base or "/common/" in src.lower() or base.endswith(".svg"):
            continue
        return base
    return None


def clean_tip(t, no, par):
    """남의 홀 글이 섞인 흔적이 있으면 통째로 버린다."""
    t = re.sub(r"\s+", " ", t).strip()
    if len(t) < 10:
        return ""
    m = re.search(r"HOLE\s*(\d+)|(\d+)\s*Hole", t, re.I)
    if m and int(m.group(1) or m.group(2)) != no:
        return ""
    p = re.search(r"PAR\s*(\d)|파\s*(\d)홀", t, re.I)
    if p and int(p.group(1) or p.group(2)) != par:
        return ""
    return t


def parse_holetitle(html):
    """광주CC·한림안성CC — <div class="hole-title"> 로 갈린다."""
    out = []
    for chunk in HOLE_SPLIT.split(html)[1:]:
        m = HDR.search(chunk)
        if not m:
            continue
        h = {"no": int(m.group(1)), "par": int(m.group(2))}
        if m.group(3):
            h["hdcp"] = int(m.group(3))
        d = DIST.search(text_of(chunk[:1200]))
        if d:
            h["len"] = int(float(d.group(1)))
        tees = tees_of(chunk)
        if tees:
            h["tees"] = tees
            h.setdefault("len", tees[0]["m"])     # 대표 거리는 가장 긴 티
        t = tip_of(chunk)
        if t:
            h["tip"] = t
        img = hole_img(chunk)
        if img:
            h["_siteimg"] = img
        out.append(h)
    return out


HC_SPLIT = re.compile(r'<div class="hole_(\d+) hole_content')
HC_TEE = re.compile(r'<li class="(\w+)">\s*([\d.]+)\s*m\s*</li>', re.I)


def parse_holecontent(html):
    """골드그린GC·일레븐CC — <div class="hole_1 hole_content"> 덩어리."""
    out = []
    marks = list(HC_SPLIT.finditer(html))
    for i, m in enumerate(marks):
        chunk = html[m.end():marks[i + 1].start() if i + 1 < len(marks) else len(html)]
        no = int(m.group(1))
        par = re.search(r"Par\s*<em>\s*(\d)\s*</em>", chunk, re.I)
        if not par:
            continue
        h = {"no": no, "par": int(par.group(1))}
        tees = [{"name": TEE_NAME.get(nm.lower(), nm), "m": int(float(v))}
                for nm, v in HC_TEE.findall(chunk)]
        if tees:
            h["tees"] = sorted(tees, key=lambda t: -t["m"])
            h["len"] = h["tees"][0]["m"]
        body = re.search(r'<p class="hole_txt[^"]*">(.*?)</p>', chunk, re.S | re.I)
        if body:
            t = clean_tip(text_of(body.group(1)), no, h["par"])
            if t:
                h["tip"] = t
        img = re.search(r'<img[^>]+src="([^"]+\.(?:jpg|jpeg|png))"[^>]*>', chunk, re.I)
        if img:
            h["_siteimg"] = os.path.basename(img.group(1)).lower()
        out.append(h)
    return out


TAB_SPLIT = re.compile(r'<div id="tab(\d+)" class="tab_content"')
TAB_TEE = re.compile(r'<span class="hole-(\w+)">\w+</span><span class="unit-value">\s*([\d.]+)\s*</span>', re.I)


def parse_tabhole(html):
    """써닝포인트CC — <div id="tab1" class="tab_content"> 덩어리."""
    out = []
    marks = list(TAB_SPLIT.finditer(html))
    for i, m in enumerate(marks):
        chunk = html[m.end():marks[i + 1].start() if i + 1 < len(marks) else len(html)]
        no = int(m.group(1))
        head = re.search(r'class="hole-size">\s*(\d+)Hole\s*<span class="par-count">\s*'
                         r"Par\s*(\d)\s*/\s*([\d.]+)\s*m", chunk, re.I)
        if not head or int(head.group(1)) != no:
            continue
        h = {"no": no, "par": int(head.group(2)), "len": int(float(head.group(3)))}
        tees = [{"name": TEE_NAME.get(nm.lower().replace("block", "black"), nm),
                 "m": int(float(v))} for nm, v in TAB_TEE.findall(chunk)]
        if tees:
            h["tees"] = sorted(tees, key=lambda t: -t["m"])
        body = re.search(r'<div class="hole-vod-info">(.*?)</div>', chunk, re.S | re.I)
        if body:
            t = clean_tip(text_of(body.group(1)), no, h["par"])
            if t:
                h["tip"] = t
        img = re.search(r'<div class="hole-img">\s*<img[^>]+src="([^"]+)"', chunk, re.I)
        if img:
            h["_siteimg"] = os.path.basename(img.group(1)).lower()
        out.append(h)
    return out


GI_HEAD = re.compile(r"<strong>(\d+)</strong>\s*Par\s*(\d)", re.I)
GI_DIST = re.compile(r"([\d.]+)\s*yds?\s*/\s*([\d.]+)\s*m", re.I)


def parse_greeninfo_page(html):
    """웰링턴CC — 홀 하나에 페이지 하나. <div class="green_info"> 안이 그 홀 것이다."""
    box = re.search(r'<div class="green_info">(.*?)</div>\s*</div>', html, re.S | re.I)
    if not box:
        return None
    chunk = box.group(1)
    m = GI_HEAD.search(chunk)
    if not m:
        return None
    h = {"no": int(m.group(1)), "par": int(m.group(2))}
    d = GI_DIST.search(text_of(chunk))
    if d:
        h["len"] = int(float(d.group(2)))
    body = re.findall(r'<span class="pc_block">(.*?)</span>', chunk, re.S | re.I)
    if body:
        t = clean_tip(" ".join(text_of(b) for b in body), h["no"], h["par"])
        if t:
            h["tip"] = t
    img = re.search(r'<img[^>]+src="([^"]*/hole\d+\.(?:png|jpg))"', html, re.I)
    if img:
        h["_siteimg"] = os.path.basename(img.group(1)).lower()
    return h


def parse_greeninfo(pages):
    """pages = [(파일경로, URL)] — 한 코스에 속한 홀 페이지들."""
    out = []
    for path, _url in pages:
        h = parse_greeninfo_page(open(path, encoding="utf-8", errors="ignore").read())
        if h:
            out.append(h)
    return sorted(out, key=lambda x: x["no"])


PROFILES = {"holetitle": parse_holetitle, "holecontent": parse_holecontent,
            "tabhole": parse_tabhole}


def remake_image(folder, site_base, app_rel):
    """사이트 원본(저장본)을 앱 규격으로 다시 만든다. 되돌아본 밝기·편차를 알려 준다."""
    from PIL import Image, ImageStat
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from standardize_holemaps import standardize
    src = os.path.join(AUTO, folder, "img", site_base)
    if not os.path.exists(src):
        return f"원본 없음({site_base})"
    dst = os.path.join(ROOT, app_rel.replace("/", os.sep))

    def look(p):
        st = ImageStat.Stat(Image.open(p).convert("L").resize((64, 64)))
        return st.stddev[0], st.mean[0]

    before = look(dst) if os.path.exists(dst) else (0, 255)
    if os.path.exists(dst):
        shutil.copy(dst, dst + ".bak")
    standardize(src, dst)
    after = look(dst)
    return (f"{site_base} → 편차 {before[0]:.0f}→{after[0]:.0f} "
            f"밝기 {before[1]:.0f}→{after[1]:.0f}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--images", action="store_true", help="홀맵 이미지도 원본에서 다시 만든다")
    a = ap.parse_args()

    for slug, cfg in TARGETS.items():
        pj = os.path.join(HP, slug, "parsed.json")
        old = json.load(open(pj, encoding="utf-8"))
        print("=" * 78)
        print(f'{slug} · {old["course"]}')
        newcourses, ok = [], True
        for c in old["courses"]:
            page = cfg["pages"].get(c["name"])
            if not page:
                print(f'  ✖ {c["name"]}: 어느 페이지인지 모릅니다 — 건드리지 않습니다')
                ok = False
                break
            if cfg["profile"] == "greeninfo":
                # 홀마다 페이지가 따로인 사이트 — meta.json 의 URL 로 코스·홀을 가른다
                meta = json.load(open(os.path.join(AUTO, cfg["folder"], "meta.json"), encoding="utf-8"))
                pages = [(os.path.join(AUTO, cfg["folder"], cfg["prefer"], fn), url)
                         for fn, url in meta["pages"].items() if f"/{page}/hole" in url]
                holes = parse_greeninfo(sorted(pages, key=lambda x: x[1]))
            else:
                f = os.path.join(AUTO, cfg["folder"], cfg["prefer"], page)
                holes = PROFILES[cfg["profile"]](open(f, encoding="utf-8", errors="ignore").read())
            # 사이트가 IN 코스를 1..9 로 적는 곳도, 10..18 로 적는 곳도 있다.
            # 앱은 기존 번호 체계를 그대로 쓴다(마이스코어·일본어 사전이 거기 붙어 있다).
            want = [h["no"] for h in c["holes"]]
            if len(holes) == len(want) and [h["no"] for h in holes] != want:
                shift = want[0] - holes[0]["no"]
                if shift and [h["no"] + shift for h in holes] == want:
                    for h in holes:
                        h["no"] += shift
                    print(f'  · {c["name"]}: 홀 번호를 {shift:+d} 맞춤(사이트 표기와 앱 표기가 다릅니다)')
            nos = [h["no"] for h in holes]
            if len(holes) != len(c["holes"]) or nos != want:
                print(f'  ✖ {c["name"]}: {len(holes)}홀 {nos} — 기존 {len(c["holes"])}홀과 달라 멈춥니다')
                ok = False
                break
            old_by_no = {h["no"]: h for h in c["holes"]}
            merged = []
            for h in holes:
                o = old_by_no[h["no"]]
                h = dict(h)
                site = h.pop("_siteimg", None)
                h["img"] = o.get("img")          # 앱이 쓰는 크롭 이미지는 그대로 둔다
                h["_site"] = site
                merged.append(h)
                mark = []
                if (o.get("tip") or "") != (h.get("tip") or ""):
                    mark.append("공략")
                if o.get("par") != h.get("par"):
                    mark.append(f'파 {o.get("par")}→{h.get("par")}')
                if o.get("len") != h.get("len"):
                    mark.append(f'거리 {o.get("len")}→{h.get("len")}')
                if o.get("hdcp") != h.get("hdcp"):
                    mark.append(f'HDCP {o.get("hdcp")}→{h.get("hdcp")}')
                if h.get("tees"):
                    mark.append("티 " + "·".join(f'{t["name"]}{t["m"]}' for t in h["tees"]))
                if a.images and site and h.get("img"):
                    mark.append("이미지 " + remake_image(cfg["folder"], site, h["img"]))
                print(f'  {c["name"]:4s} {h["no"]}번 par{h["par"]} '
                      f'{str(h.get("len") or "-"):>4}m img={site or "?"} '
                      f'| 바뀜: {", ".join(mark) or "없음"}')
                if h.get("tip"):
                    print(f'        “{h["tip"][:70]}…”')
                else:
                    print("        (공략 문구 없음 — 비웁니다)")
            newcourses.append({"name": c["name"], "holes": merged})
        if not ok:
            continue
        if a.write:
            shutil.copy(pj, pj + ".bak")
            out = dict(old)
            out["courses"] = [{"name": c["name"],
                               "holes": [{k: v for k, v in h.items() if k != "_site" and v is not None}
                                         for h in c["holes"]]}
                              for c in newcourses]
            json.dump(out, open(pj, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            print(f"  ✅ {pj} 갱신 (원본은 .bak)")
        else:
            print("  (미리보기입니다 — 실제로 고치려면 --write)")
    if a.write:
        print("\n다음: python tools/build_holeimgdb.py 로 다시 조립하세요")
    return 0


if __name__ == "__main__":
    sys.exit(main())
