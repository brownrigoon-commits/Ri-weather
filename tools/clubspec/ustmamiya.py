# -*- coding: utf-8 -*-
"""
UST Mamiya 우드/아이언 샤프트 스펙 수집 (공식 도메인 ustmamiya.com 만 사용)

원칙:
 - 페이지에서 실제로 읽은 값만 기록. 못 읽으면 null. 추정/보간 없음.
 - 각 item 에 출처 URL(source_url) 기록.
 - 스펙 표는 Elementor 위젯 그리드로 되어 있어 heading(헤더) + text-editor(셀) 순서로 파싱.

출력: coursedata/clubspecs/ustmamiya.json
"""
import json
import os
import re
import html
import time
import urllib.request
import urllib.error
from datetime import date

BASE = "https://www.ustmamiya.com"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "coursedata", "clubspecs", "ustmamiya.json")

CATEGORIES = [
    ("wood-shafts", "wood"),
    ("iron-shafts", "iron"),
    ("tspx-wood-shafts", "wood"),
    ("tspx-iron-shafts", "iron"),
]

# 헤더 라벨 -> JSON 필드명
FIELD_MAP = {
    "shaft": "model",
    "flex": "flex",
    "weight": "weight",
    "torque": "torque",
    "launch": "launch",
    "spin": "spin",
    "tip od": "tip_od",
    "tip o.d.": "tip_od",
    "butt od": "butt_od",
    "butt o.d.": "butt_od",
    "tip parallel": "tip_parallel",
    "length": "length",
    "bend profile": "bend_profile",
    "kick point": "kick_point",
    "tip": "tip_od",
    "butt": "butt_od",
}


def fetch(url, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=45) as r:
                return r.read().decode("utf-8", "ignore")
        except Exception as e:  # noqa
            last = e
            time.sleep(2 + i * 2)
    print("    FETCH FAIL %s -> %s" % (url, last))
    return None


def clean(s):
    """태그 제거 + HTML 엔티티 복원 + 특수 기호 정규화."""
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    # 인치 기호(″ ‟ ") -> "  /  도 기호는 ° 로 유지
    s = s.replace("″", '"').replace("”", '"').replace("’", "'")
    s = s.replace(" ", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


WIDGET_RE = re.compile(
    r'data-widget_type="(heading|text-editor)\.default">\s*'
    r'<div class="elementor-widget-container">(.*?)</div>\s*</div>',
    re.S,
)


def widget_sequence(page):
    """페이지의 heading / text-editor 위젯을 문서 순서대로 (종류, 텍스트) 로 반환."""
    seq = []
    for m in WIDGET_RE.finditer(page):
        txt = clean(m.group(2))
        if txt:
            seq.append((m.group(1), txt))
    return seq


# 스펙 표의 열 제목으로 인정하는 라벨(화이트리스트).
# 제품 설명용 마케팅 heading / 네비게이션 메뉴가 헤더 구간에 섞여
# 열이 통째로 밀리는 것을 막는다.
SPEC_HEADERS = {
    "flex", "weight", "torque", "launch", "spin",
    "tip od", "tip o.d", "butt od", "butt o.d",
    "tip", "butt", "tip parallel", "parallel tip", "length", "raw length",
    "bend profile", "kick point", "trajectory", "tip dia", "butt dia",
    "class", "weight class",
}

# 첫 열(모델명 열)의 제목으로 쓰이는 라벨. 제품마다 다르다.
MODEL_HEADERS = {
    "shaft", "model", "shafts",
    "wood shafts", "wood shaft", "iron shafts", "iron shaft",
    "hybrid shafts", "hybrid shaft", "putter shafts", "putter shaft",
}

# 모델 열 제목 -> 하위 카테고리
SUBCAT = {
    "wood shafts": "wood", "wood shaft": "wood",
    "iron shafts": "iron", "iron shaft": "iron",
    "hybrid shafts": "hybrid", "hybrid shaft": "hybrid",
    "putter shafts": "putter", "putter shaft": "putter",
}


def norm_label(label):
    h = label.lower().strip().rstrip(".").strip()
    return re.sub(r"\s+", " ", h)


def is_known_header(label):
    h = norm_label(label)
    return h in SPEC_HEADERS or h in MODEL_HEADERS


def parse_spec_tables(page):
    """
    Elementor 그리드에서 스펙 표를 추출.

    heading 위젯이 연속으로 나오는 구간(run) 안에서 '알려진 열 이름'이
    연속으로 이어지는 최대 구간(window)들을 찾고, 그 중 flex+weight 를
    모두 포함하는 것만 실제 스펙 표 헤더로 채택한다.
    (네비게이션 메뉴나 마케팅 문구 heading 이 섞여도 안전)

    헤더 뒤에 이어지는 text-editor 들을 헤더 개수만큼 잘라 행으로 만든다.
    """
    seq = widget_sequence(page)
    tables = []
    i = 0
    n = len(seq)
    while i < n:
        if seq[i][0] != "heading":
            i += 1
            continue
        # 연속된 heading 수집
        j = i
        run = []
        while j < n and seq[j][0] == "heading":
            run.append(seq[j][1])
            j += 1

        # run 안에서 '알려진 헤더'가 연속되는 최대 구간들을 추출
        windows = []
        cur = []
        for lab in run:
            if is_known_header(lab):
                cur.append(lab)
            else:
                if cur:
                    windows.append(cur)
                cur = []
        if cur:
            windows.append(cur)

        headers = None
        for w in windows:
            low = [norm_label(x) for x in w]
            if len(w) >= 4 and "flex" in low and "weight" in low:
                headers = w  # 스펙 표 헤더로 확정
        if headers:
            cells = []
            k = j
            while k < n and seq[k][0] == "text-editor":
                cells.append(seq[k][1])
                k += 1
            if cells:
                w = len(headers)
                if len(cells) % w != 0:
                    print("      (경고) 셀수 %d 가 열수 %d 로 나누어떨어지지 "
                          "않음 - 표 폐기: %s" % (len(cells), w, headers))
                else:
                    rows = [cells[x:x + w] for x in range(0, len(cells), w)]
                    tables.append((headers, rows))
                i = k
                continue
        i = j
    return tables


def norm_field(header):
    h = norm_label(header)
    if h in MODEL_HEADERS:
        return "model"
    if h in FIELD_MAP:
        return FIELD_MAP[h]
    for key, val in FIELD_MAP.items():
        if h.startswith(key):
            return val
    return re.sub(r"[^a-z0-9]+", "_", h).strip("_")


def collect():
    today = date.today().isoformat()
    # 1) 카테고리별 제품 URL 수집
    products = []  # (slug, category)
    seen = set()
    for cat, kind in CATEGORIES:
        url = "%s/%s/" % (BASE, cat)
        page = fetch(url)
        if not page:
            continue
        slugs = sorted(set(re.findall(
            r'https://www\.ustmamiya\.com/product/([a-z0-9\-]+)/', page)))
        print("[cat] %-20s %d products" % (cat, len(slugs)))
        for s in slugs:
            if s not in seen:
                seen.add(s)
                products.append((s, kind))

    items = []
    no_table = []
    for slug, kind in products:
        purl = "%s/product/%s/" % (BASE, slug)
        page = fetch(purl)
        if not page:
            no_table.append(slug)
            continue
        # 제품명(원문)
        m = re.search(r'<h1[^>]*class="[^"]*product_title[^"]*"[^>]*>(.*?)</h1>',
                      page, re.S)
        pname = clean(m.group(1)) if m else slug

        tables = parse_spec_tables(page)
        cnt = 0
        for headers, rows in tables:
            fields = [norm_field(h) for h in headers]
            # 모델 열 제목이 'Wood Shafts'/'Iron Shafts' 식이면 하위 카테고리로 사용
            sub = kind
            for h in headers:
                if norm_label(h) in SUBCAT:
                    sub = SUBCAT[norm_label(h)]
                    break
            for row in rows:
                it = {
                    "model": None,
                    "product": pname,
                    "category": sub,
                    "listing_category": kind,
                    "source_url": purl,
                }
                for f, v in zip(fields, row):
                    v = v.strip()
                    # 사이트가 '값 없음'으로 표시하는 기호 -> null (임의 보간 금지)
                    if v in ("", "-", "--", "—", "–", "N/A", "n/a", "NA", "TBD"):
                        v = None
                    it[f] = v
                if not it.get("model"):
                    # 'Shaft' 열이 없으면 모델명은 제품명으로 두되 임의 생성 금지
                    it["model"] = pname
                items.append(it)
                cnt += 1
        print("  %-45s %-5s rows=%d" % (slug, kind, cnt))
        if cnt == 0:
            no_table.append(slug)
        time.sleep(0.6)

    data = {
        "source": BASE + "/ust-golf-shafts/",
        "fetched": today,
        "brand": "UST Mamiya",
        "category": "wood/iron shafts",
        "source_pages": [
            "%s/%s/" % (BASE, c) for c, _ in CATEGORIES
        ],
        "items": items,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print("\n=== UST Mamiya ===")
    print("products scanned : %d" % len(products))
    print("items collected  : %d" % len(items))
    print("no spec table    : %d %s" % (len(no_table), no_table))
    print("saved -> %s" % OUT)

    # 필드 채움율
    keys = {}
    for it in items:
        for k, v in it.items():
            if v not in (None, ""):
                keys[k] = keys.get(k, 0) + 1
    print("-- 필드 채움율 --")
    for k in sorted(keys, key=lambda x: -keys[x]):
        print("   %-15s %d/%d" % (k, keys[k], len(items)))

    # 열 정렬 검증: 값의 형태가 열 이름과 맞는지 확인 (밀림 감지)
    checks = {
        "weight": r"^\d{2,3}\s*g$",
        "torque": r"^\d+(\.\d+)?\s*°?$",
        "tip_od": r'^\.?\d?\.?\d{3}\s*"?$',
        "length": r'^\d{2}(\.\d+)?\s*"?$',
        "flex": r"^[A-Za-z0-9加\.\- /]{1,12}$",
    }
    print("-- 열 정렬 검증(형식 일치율) --")
    bad_any = 0
    for f, pat in checks.items():
        vals = [it[f] for it in items if it.get(f)]
        if not vals:
            continue
        good = sum(1 for v in vals if re.match(pat, v.strip()))
        pct = 100.0 * good / len(vals)
        flag = "OK" if pct >= 95 else "** 확인필요 **"
        if pct < 95:
            bad_any += 1
            odd = [v for v in vals if not re.match(pat, v.strip())][:5]
            print("   %-8s %5.1f%% (%d/%d) %s  예:%s"
                  % (f, pct, good, len(vals), flag, odd))
        else:
            print("   %-8s %5.1f%% (%d/%d) %s" % (f, pct, good, len(vals), flag))
    if bad_any == 0:
        print("   => 모든 열 형식 일치. 정렬 이상 없음.")


if __name__ == "__main__":
    collect()
