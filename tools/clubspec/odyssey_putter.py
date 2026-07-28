# -*- coding: utf-8 -*-
"""
오디세이(Odyssey) 퍼터 스펙 수집 — 공식 도메인.

주의: odysseygolf.com 은 odyssey.callawaygolf.com 으로 리다이렉트된다(캘러웨이 공식 운영).
      제품 상세페이지 하단 "Product SPECS" 표에
      Model / Head Type / Loft / Lie / Availability / Standard Length / Toe Hang / Head Weight
      가 들어 있다. 이 표만 신뢰하고 파싱한다.

주의2: 목록 페이지는 무한스크롤이라 카테고리(전체/말렛/블레이드/왼손)를 모두 훑어
      제품 URL 을 모은 뒤(_odyssey_links2.py) 상세페이지를 순회한다.

원칙: 페이지에서 읽지 못한 값은 null. 추정/보간 없음.
출력: coursedata/clubspecs/odyssey_putter.json
"""
import sys, io, os, re, json, time, html as H
from datetime import date

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

LIST_SRC = "https://odyssey.callawaygolf.com/putters"
URLS_JSON = r"C:/Users/PC/AppData/Local/Temp/claude/odyssey_urls.json"
OUT = r"C:/Users/PC/Desktop/Ri-weather/coursedata/clubspecs/odyssey_putter.json"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def make_driver():
    o = Options()
    o.add_argument("--headless=new")
    o.add_argument("--window-size=1400,1000")
    o.add_argument(f"--user-agent={UA}")
    o.add_argument("--disable-gpu")
    o.add_argument("--no-sandbox")
    o.add_argument("--disable-blink-features=AutomationControlled")
    o.add_experimental_option("excludeSwitches", ["enable-automation"])
    d = webdriver.Chrome(options=o)
    d.set_page_load_timeout(90)
    return d


def txt(s):
    s = re.sub(r"<(script|style)\b.*?</\1>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", H.unescape(s)).strip()


def cells(row_html):
    return [txt(m.group(2))
            for m in re.finditer(r"<(t[hd])\b[^>]*>(.*?)</\1>", row_html, re.S | re.I)]


def num(s):
    if not s:
        return None
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    return float(m.group()) if m else None


# 제품군마다 스펙표 헤더 표기가 다르다.
#   Ai-DUAL 계열 : Model / Head Type / Loft / Lie / Availability / Standard Length / Toe Hang / Head Weight
#   구형 계열    : Model / Head Type / Hosel / Loft / Lie / RH-LH / Standard Lengths / Offset / Toe Hang / Head Weight
HEAD_ALIAS = {
    "standard lengths": "standard length",
    "rhlh": "availability",
    "rh lh": "availability",
    "headweight": "head weight",
    "toehang": "toe hang",
}


def norm_head(h):
    k = re.sub(r"[^a-z0-9 ]+", "", h.lower()).strip()
    k = re.sub(r"\s+", " ", k)
    return HEAD_ALIAS.get(k, k)


def build_item(rec, url):
    """헤더->값 dict 한 줄을 표준 항목으로 변환. 없는 값은 null."""
    return {
        "model": rec.get("model"),
        "url": url,
        "head_type": rec.get("head type") or None,
        "hosel": rec.get("hosel") or None,
        "loft_deg": num(rec.get("loft")),
        "lie_deg": num(rec.get("lie")),
        "hands": hands(rec.get("availability")),
        "lengths_in": lengths(rec.get("standard length")),
        "offset": rec.get("offset") or None,
        "toe_hang": rec.get("toe hang") or None,
        "head_weight_g": num(rec.get("head weight")),
        "loft_raw": rec.get("loft"),
        "lie_raw": rec.get("lie"),
        "length_raw": rec.get("standard length"),
        "toe_hang_raw": rec.get("toe hang"),
        "head_weight_raw": rec.get("head weight"),
        "availability_raw": rec.get("availability"),
        "specs_raw": rec,
    }


def lengths(s):
    """'33",34",35"' -> [33.0, 34.0, 35.0]"""
    if not s:
        return []
    return [float(x) for x in re.findall(r"(\d+(?:\.\d+)?)\s*\"", s)]


def hands(s):
    """'RH' / 'RH, LH' -> ['RH','LH']"""
    if not s:
        return []
    return sorted(set(re.findall(r"\b(RH|LH)\b", s.upper())))


def parse_specs(doc, url):
    """헤더가 Model 로 시작하는 Product SPECS 표를 파싱."""
    out = []
    for table in re.findall(r"<table\b.*?</table>", doc, re.S | re.I):
        rows = re.findall(r"<tr\b.*?</tr>", table, re.S | re.I)
        if len(rows) < 2:
            continue
        head = [norm_head(c) for c in cells(rows[0])]
        if not head or head[0] != "model" or "loft" not in head:
            continue
        for r in rows[1:]:
            vals = cells(r)
            if not vals or not vals[0]:
                continue
            if len(vals) != len(head):
                print(f"      [WARN] 열 불일치 head={len(head)} row={len(vals)}: {vals}")
                continue
            rec = dict(zip(head, vals))
            if not rec.get("model"):
                continue
            out.append(build_item(rec, url))
        if out:
            break
    return out


def merge_length_rows(items):
    """'길이'만 다른 여러 줄을 한 항목으로 합친다.

    Ai-One/DFX/Eleven/MicroHinge 계열 스펙표는 33"/34"/35" 를 각각 다른 줄로 적는다.
    한 페이지에 사양이 다른 그룹이 섞여 있을 수 있으므로(예: 'RH / LH' 3줄 +
    'RH Only' 1줄), (url, 길이 제외한 나머지 값 전체) 를 키로 묶는다.
    길이 외 값이 다른 줄끼리는 합쳐지지 않으므로 정보가 뭉개지지 않는다.
    """
    from collections import OrderedDict
    groups = OrderedDict()
    for it in items:
        rec = {k: v for k, v in it["specs_raw"].items() if k != "standard length"}
        sig = json.dumps(rec, sort_keys=True, ensure_ascii=False)
        groups.setdefault((it["url"], sig), []).append(it)

    out = []
    for (url, sig), g in groups.items():
        base = dict(g[0])
        if len(g) > 1:
            base["lengths_in"] = sorted({L for it in g for L in it["lengths_in"]})
            raws, seen_raw = [], set()
            for it in g:
                r = it["length_raw"]
                if r and r not in seen_raw:
                    seen_raw.add(r)
                    raws.append(r)
            base["length_raw"] = " | ".join(raws)
            raw = dict(base["specs_raw"])
            raw["standard length"] = base["length_raw"]
            base["specs_raw"] = raw
            base["merged_length_rows"] = len(g)
        out.append(base)
    return out


def family_of(url):
    """URL 경로에서 제품군 추출 (예: .../putters/ai-one/xxx.html -> 'ai-one')"""
    m = re.search(r"/putters/([^/]+)/[^/]+\.html", url)
    return m.group(1) if m else None


def main():
    urls = json.load(open(URLS_JSON, encoding="utf-8"))
    print(f"[urls] {len(urls)}")

    d = make_driver()
    items, failed = [], []
    try:
        for i, url in enumerate(urls, 1):
            try:
                d.get(url)
                time.sleep(3.5)
                for _ in range(10):
                    d.execute_script("window.scrollBy(0, 900);")
                    time.sleep(0.45)
                # SPECS 아코디언이 접혀 있을 수 있으니 열어본다
                try:
                    for e in d.find_elements("xpath", "//*[contains(translate(text(),'specs','SPECS'),'SPECS')]")[:5]:
                        try:
                            d.execute_script("arguments[0].click();", e)
                            time.sleep(0.5)
                        except Exception:
                            pass
                except Exception:
                    pass
                time.sleep(1.2)
                doc = d.page_source
            except Exception as e:
                print(f"[{i}/{len(urls)}] [ERR] {url} :: {type(e).__name__}: {e}")
                failed.append({"url": url, "error": f"{type(e).__name__}: {e}"})
                continue

            got = parse_specs(doc, url)
            if not got:
                print(f"[{i}/{len(urls)}] [MISS] 스펙표 없음 {url}")
                failed.append({"url": url, "error": "spec table not found"})
                continue
            fam = family_of(url)
            for g in got:
                g["family"] = fam
            items.extend(got)
            print(f"[{i}/{len(urls)}] {got[0]['model']:<34} "
                  f"loft={got[0]['loft_deg']} lie={got[0]['lie_deg']} "
                  f"hw={got[0]['head_weight_g']} toe={got[0]['toe_hang']}")
    finally:
        d.quit()

    # 카테고리를 여러 번 훑으므로 같은 줄이 중복 수집된다.
    # 주의: 길이를 키에 넣지 않으면 길이별 다중행 스펙표에서 첫 줄만 남아
    #       33"/34"/35" 중 33" 만 저장되는 유실이 발생한다.
    dedup, seen = [], set()
    for it in items:
        k = (it["model"], it["url"], it.get("length_raw"))
        if k in seen:
            continue
        seen.add(k)
        dedup.append(it)

    dedup = merge_length_rows(dedup)

    data = {
        "source": LIST_SRC,
        "fetched": date.today().isoformat(),
        "brand": "Odyssey",
        "brand_ko": "오디세이",
        "category": "putter",
        "note": ("odysseygolf.com 은 odyssey.callawaygolf.com 으로 리다이렉트됨(캘러웨이 공식). "
                 "각 제품 상세페이지의 'Product SPECS' 표만 파싱. "
                 "표에 없는 값은 null(추정 없음). 항목별 출처는 items[].url."),
        "product_count": len(dedup),
        "failed": failed,
        "items": dedup,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    keys = ("loft_deg", "lie_deg", "head_type", "toe_hang", "head_weight_g")
    filled = {k: sum(1 for it in dedup if it.get(k) is not None) for k in keys}
    filled["lengths_in"] = sum(1 for it in dedup if it.get("lengths_in"))
    filled["hands"] = sum(1 for it in dedup if it.get("hands"))
    print(f"\n[save] {OUT}")
    print(f"[stat] items={len(dedup)} failed={len(failed)}")
    print(f"[stat] filled={filled}")
    for it in dedup[:3]:
        print("   ", {k: it[k] for k in ("model", "head_type", "loft_deg", "lie_deg",
                                         "lengths_in", "toe_hang", "head_weight_g")})


if __name__ == "__main__":
    main()
