# -*- coding: utf-8 -*-
"""
골프프라이드(Golf Pride) 그립 스펙 수집 — golfpride.com 공식.

403 우회 방법 (실측):
  - https://www.golfpride.com/...  -> urllib 에 403 Forbidden
  - https://golfpride.com/...      -> 동일 콘텐츠가 200 으로 내려온다 (apex 도메인은 WAF 미적용)
  따라서 apex 도메인으로 요청한다. 셀레늄도 되지만 불필요.

URL 발견 경로:
  robots.txt -> Sitemap: https://www.golfpride.com/content/golfpride.sitemap-index.xml
  (이것도 www 는 403 이라 apex 로 받는다)
  -> us-sitemap.xml / gb-sitemap.xml

스펙 출처:
  /us/en-us/customer-service-hub/grip-advice/grip-specifications.html
  공식 "Grip Specifications by Collection" 목록.
  각 줄 형식: 모델 | 사이즈 | 코어 | 무게 [| 색상/비고]
  같은 블록이 데스크톱/모바일용으로 2번 렌더링되므로 중복 제거한다.

원칙: 페이지에서 읽지 못한 값은 null. 'TBD' 는 무게 null 로 둔다(추정 금지).
출력: coursedata/clubspecs/golfpride_grip.json
"""
import sys, io, os, re, json, urllib.request, urllib.error, gzip, zlib, html as H
from datetime import date

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

APEX = "https://golfpride.com"
WWW = "https://www.golfpride.com"
SPEC_PATH = "/us/en-us/customer-service-hub/grip-advice/grip-specifications.html"
SRC = WWW + SPEC_PATH                      # 공개 표기용(정식 URL)
SITEMAP_INDEX = "/content/golfpride.sitemap-index.xml"
OUT = r"C:/Users/PC/Desktop/Ri-weather/coursedata/clubspecs/golfpride_grip.json"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def get(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "close"})
    with urllib.request.urlopen(req, timeout=40) as r:
        b = r.read()
        e = r.headers.get("Content-Encoding", "")
        if "gzip" in e:
            b = gzip.decompress(b)
        elif "deflate" in e:
            b = zlib.decompress(b, -zlib.MAX_WBITS)
        return r.status, b.decode("utf-8", "replace")


def clean(s):
    s = re.sub(r"<[^>]+>", "", s)
    s = H.unescape(s).replace("\xa0", " ")
    return re.sub(r"\s+", " ", s).strip()


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "", s.lower())


def parse_weight(s):
    """'46.5 g' -> 46.5 / '52g' -> 52.0 / 'TBD' -> None"""
    if not s:
        return None
    if re.search(r"\bTBD\b", s, re.I):
        return None
    m = re.search(r"(\d+(?:\.\d+)?)\s*g\b", s, re.I)
    if m:
        return float(m.group(1))
    m = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*", s)
    return float(m.group(1)) if m else None


def parse_core(s):
    """'60 Round' -> (60.0, ['Round']) / '58 Round, Ribbed' -> (58.0, ['Round','Ribbed'])"""
    if not s:
        return None, []
    m = re.match(r"\s*(\d+(?:\.\d+)?)\s*(.*)$", s)
    if not m:
        return None, [t.strip() for t in s.split(",") if t.strip()]
    size = float(m.group(1))
    types = [t.strip() for t in m.group(2).split(",") if t.strip()]
    return size, types


# ---------------------------------------------------------------- 사이트맵
def collect_product_urls():
    st, body = get(APEX + SITEMAP_INDEX)
    subs = re.findall(r"<loc>\s*([^<]+?)\s*</loc>", body)
    urls = []
    for su in subs:
        su_apex = su.replace(WWW, APEX).replace("https://golfpride.com", APEX)
        try:
            s2, b2 = get(su_apex)
            urls += re.findall(r"<loc>\s*([^<]+?)\s*</loc>", b2)
        except Exception as e:
            print(f"  [ERR] {su} :: {type(e).__name__}: {e}")
    urls = sorted(set(urls))

    # 컬렉션 페이지 (예: /swing-grips/cp2-collection.html) — 2차 매칭용
    coll = {}
    for u in urls:
        m = re.match(r"https?://[^/]+/us/en-us/(swing-grips|putter-grips)/([^/]+)\.html$", u)
        if m and m.group(2).endswith("-collection"):
            coll[slugify(m.group(2)[:-len("-collection")])] = {
                "url": u.replace(APEX, WWW) if u.startswith(APEX) else u,
                "grip_type": "swing" if m.group(1) == "swing-grips" else "putter",
                "collection": m.group(2),
            }

    # 미국 사이트의 그립 '제품 상세' 페이지만 (컬렉션 하위 leaf)
    prod = {}
    for u in urls:
        m = re.match(r"https?://[^/]+/us/en-us/(swing-grips|putter-grips)/([^/]+)/([^/]+)\.html$", u)
        if m:
            prod[slugify(m.group(3))] = {
                "url": u.replace(APEX, WWW) if u.startswith(APEX) else u,
                "grip_type": "swing" if m.group(1) == "swing-grips" else "putter",
                "collection": m.group(2),
                "slug": m.group(3),
            }
        else:
            m2 = re.match(r"https?://[^/]+/us/en-us/(swing-grips|putter-grips)/([^/]+)\.html$", u)
            if m2 and not m2.group(2).endswith("-collection") and \
               m2.group(2) not in ("best-sellers", "shop-by-feel", "align-grips",
                                   "plus4-grips", "jumbo-grips", "firm-grips",
                                   "soft-grips", "tacky-grips", "hybrid-grips"):
                prod[slugify(m2.group(2))] = {
                    "url": u.replace(APEX, WWW) if u.startswith(APEX) else u,
                    "grip_type": "swing" if m2.group(1) == "swing-grips" else "putter",
                    "collection": None,
                    "slug": m2.group(2),
                }
    return urls, prod, coll


def match_model(model, prod_by_slug, coll_by_slug):
    """모델명 -> 공식 URL 매칭. 어느 수준에서 맞았는지(match_level)를 함께 남긴다.

    product    : 제품 상세페이지 슬러그와 정확히 일치
    collection : 컬렉션 페이지 슬러그와 정확히 일치 (개별 제품 페이지가 없는 경우)
    collection-prefix : 모델 슬러그가 컬렉션 슬러그로 시작 (분류만 채우고 URL 은 null)
    none       : 매칭 실패 -> 전부 null
    """
    s = slugify(model)
    p = prod_by_slug.get(s)
    if p:
        return {"grip_type": p["grip_type"], "collection": p["collection"],
                "product_url": p["url"], "match_level": "product"}
    c = coll_by_slug.get(s)
    if c:
        return {"grip_type": c["grip_type"], "collection": c["collection"],
                "product_url": c["url"], "match_level": "collection"}
    # 가장 긴 컬렉션 슬러그부터 접두 일치 검사
    for cs in sorted(coll_by_slug, key=len, reverse=True):
        if s.startswith(cs):
            c = coll_by_slug[cs]
            return {"grip_type": c["grip_type"], "collection": c["collection"],
                    "product_url": None, "match_level": "collection-prefix"}
    return {"grip_type": None, "collection": None,
            "product_url": None, "match_level": "none"}


# ---------------------------------------------------------------- 스펙 페이지
def parse_spec_page(doc, prod_by_slug, coll_by_slug):
    # AEM 이 JSON 문자열 안에 이스케이프해 넣은 마크업을 복원
    u = doc.replace("\\n", "\n").replace("\\u003c", "<").replace("\\u003e", ">")
    paras = [clean(p) for p in re.findall(r"<p>(.*?)</p>", u, re.S)]

    items, seen, unmatched = [], set(), set()
    for line in paras:
        if line.count("|") < 2:
            continue
        parts = [c.strip() for c in line.split("|")]
        if len(parts) < 4:
            continue
        model, size, core, weight = parts[0], parts[1], parts[2], parts[3]
        note = " | ".join(parts[4:]).strip() or None
        if not model or not re.search(r"[A-Za-z]", model):
            continue

        key = (model.lower(), size.lower(), core.lower(), weight.lower(), (note or "").lower())
        if key in seen:                     # 데스크톱/모바일 중복 렌더링 제거
            continue
        seen.add(key)

        core_size, core_types = parse_core(core)
        w = parse_weight(weight)

        mt = match_model(model, prod_by_slug, coll_by_slug)
        if mt["match_level"] == "none":
            unmatched.add(model)

        items.append({
            "model": model,
            "size": size or None,
            "core": core or None,
            "core_size": core_size,
            "core_types": core_types,
            "weight_g": w,
            "weight_raw": weight or None,
            "weight_tbd": bool(re.search(r"\bTBD\b", weight, re.I)),
            "color_note": note,
            "grip_type": mt["grip_type"],
            "collection": mt["collection"],
            "product_url": mt["product_url"],
            "match_level": mt["match_level"],
        })
    return items, sorted(unmatched)


def main():
    print("[1] 사이트맵에서 제품 URL 수집")
    all_urls, prod_by_slug, coll_by_slug = collect_product_urls()
    print(f"    전체 URL={len(all_urls)}  그립 제품페이지={len(prod_by_slug)} "
          f"컬렉션페이지={len(coll_by_slug)}")

    print("[2] 스펙 페이지 수집")
    try:
        st, doc = get(APEX + SPEC_PATH)
    except urllib.error.HTTPError as e:
        print(f"    [FATAL] {e.code}")
        return
    print(f"    status={st} len={len(doc)}")

    items, unmatched = parse_spec_page(doc, prod_by_slug, coll_by_slug)
    print(f"    파싱 항목={len(items)}  제품페이지 미매칭 모델={len(unmatched)}")
    for m in unmatched:
        print("      (미매칭)", m)

    data = {
        "source": SRC,
        "source_note": ("www 는 urllib 에 403 이라 apex(https://golfpride.com) 로 동일 문서를 받았다. "
                        "표기 URL 은 정식 www 주소."),
        "fetched": date.today().isoformat(),
        "brand": "Golf Pride",
        "brand_ko": "골프프라이드",
        "category": "grip",
        "note": ("공식 'Grip Specifications by Collection' 목록에서 "
                 "모델|사이즈|코어|무게[|색상] 를 파싱. "
                 "같은 블록이 데스크톱/모바일용으로 2회 렌더링되어 중복 제거함. "
                 "무게가 'TBD' 인 항목은 weight_g=null, weight_tbd=true (추정 금지). "
                 "grip_type/collection/product_url 은 공식 사이트맵 URL 과 모델명 슬러그를 "
                 "대조해 채웠고, 어느 수준에서 맞았는지 items[].match_level 에 남겼다 "
                 "(product=제품페이지 정확일치 / collection=컬렉션페이지 정확일치 / "
                 "collection-prefix=컬렉션 접두일치라 분류만 채우고 URL 은 null / none=매칭실패)."),
        "product_pages": sorted(prod_by_slug.values(), key=lambda x: x["url"]),
        "unmatched_models": unmatched,
        "items": items,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    keys = ("size", "core", "core_size", "weight_g", "grip_type", "product_url", "color_note")
    filled = {k: sum(1 for it in items if it.get(k) is not None) for k in keys}
    models = sorted({it["model"] for it in items})
    print(f"\n[save] {OUT}")
    print(f"[stat] items={len(items)}  고유모델={len(models)}  제품페이지={len(prod_by_slug)}")
    print(f"[stat] filled={filled}")
    print(f"[stat] weight TBD(null)={sum(1 for it in items if it['weight_tbd'])}")
    print(f"[stat] swing={sum(1 for it in items if it['grip_type']=='swing')} "
          f"putter={sum(1 for it in items if it['grip_type']=='putter')} "
          f"unknown={sum(1 for it in items if it['grip_type'] is None)}")
    lv = {}
    for it in items:
        lv[it["match_level"]] = lv.get(it["match_level"], 0) + 1
    print(f"[stat] match_level={lv}")
    for it in items[:5]:
        print("   ", {k: it[k] for k in ("model", "size", "core", "weight_g", "grip_type")})


if __name__ == "__main__":
    main()
