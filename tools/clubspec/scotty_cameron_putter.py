# -*- coding: utf-8 -*-
"""
스카티 카메론 퍼터 스펙 수집 — scottycameron.com 공식.

주의: scottycameron.com 은 urllib/requests 에 403 → 셀레늄 필수.
스펙 마크업: <dt class="specs__title">Loft</dt><dd class="specs__description">3º</dd>

원칙: 페이지에서 읽지 못한 값은 null. 추정/보간 없음.
      헤드형태(blade/mallet 등)는 페이지가 명시하지 않으면 null 로 두고,
      페이지에 실제로 있는 제품군(family) 만 기록한다.
출력: coursedata/clubspecs/scotty_cameron_putter.json
"""
import sys, io, os, re, json, time, html as H
from datetime import date

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

BASE = "https://www.scottycameron.com"
INDEXES = [
    "/putters/",
    "/putters/studio-style/",
    "/putters/phantom/",
    "/putters/long-design/",
    "/putters/left-handed-models/",
    "/putters/limited-release/",
]
OUT = r"C:/Users/PC/Desktop/Ri-weather/coursedata/clubspecs/scotty_cameron_putter.json"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

MODEL_RE = re.compile(r'href="(/putters/[a-z0-9\-]+/[a-z0-9\-\.]+/)"', re.I)


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
    d.set_page_load_timeout(60)
    return d


def txt(s):
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", H.unescape(s)).strip()


def num(s):
    if not s:
        return None
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    return float(m.group()) if m else None


def get(d, url):
    d.get(url)
    time.sleep(3.0)
    for _ in range(4):
        d.execute_script("window.scrollBy(0, document.body.scrollHeight/4);")
        time.sleep(0.6)
    time.sleep(1.0)
    return d.page_source


def parse_specs(doc):
    """모든 dt/dd 스펙 쌍을 원문 그대로 dict 로"""
    out = {}
    for m in re.finditer(
            r'<dt class="specs__title">(.*?)</dt>\s*<dd class="specs__description">(.*?)</dd>',
            doc, re.S):
        k, v = txt(m.group(1)), txt(m.group(2))
        if k:
            out[k] = v
    return out


def parse_lengths(s):
    """'33\", 34\", 35\"' -> [33.0, 34.0, 35.0]"""
    if not s:
        return []
    return [float(x) for x in re.findall(r"(\d+(?:\.\d+)?)\s*[\"”]", s)]


def parse_weights(s):
    """'2 x 20 grams (33\") 2 x 15 grams (34\")' -> 구조화. 못 읽으면 빈 리스트."""
    if not s:
        return []
    out = []
    for m in re.finditer(r"(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*grams?(?:\s*\((\d+(?:\.\d+)?)\s*[\"”]\))?",
                         s, re.I):
        out.append({
            "count": int(m.group(1)),
            "grams_each": float(m.group(2)),
            "for_length_in": float(m.group(3)) if m.group(3) else None,
        })
    return out


def main():
    d = make_driver()
    models, items, failed = [], [], []
    try:
        # 1) 인덱스에서 모델 URL 수집
        for idx in INDEXES:
            try:
                doc = get(d, BASE + idx)
            except Exception as e:
                print(f"[ERR idx] {idx} :: {type(e).__name__}: {e}")
                continue
            found = set(MODEL_RE.findall(doc))
            new = [u for u in sorted(found) if u not in models]
            models.extend(new)
            print(f"[idx] {idx}  found={len(found)}  new={len(new)}")

        print(f"[idx] 총 모델 후보 = {len(models)}")

        # 2) 각 모델 페이지 파싱
        for u in models:
            url = BASE + u
            try:
                doc = get(d, url)
            except Exception as e:
                failed.append({"url": url, "error": f"{type(e).__name__}: {e}"})
                continue

            specs = parse_specs(doc)
            if not specs:
                failed.append({"url": url, "error": "스펙 표 없음(모델 상세페이지 아님)"})
                print(f"  [skip] {u}")
                continue

            h1 = re.search(r"<h1[^>]*>(.*?)</h1>", doc, re.S | re.I)
            h2 = re.search(r"<h2[^>]*>(.*?)</h2>", doc, re.S | re.I)
            name = txt(h1.group(1)) if h1 else None
            family = txt(h2.group(1)) if h2 else None
            if family in ("Specifications", "Options"):
                family = None

            lengths = parse_lengths(specs.get("Length"))
            items.append({
                "model": name,
                "family": family,
                "section": u.split("/")[2],
                "url": url,
                "loft_deg": num(specs.get("Loft")),
                "lie_deg": num(specs.get("Lie")),
                "lengths_in": lengths,
                "head_material": specs.get("Head Material"),
                "offset": specs.get("Offset"),
                "grip": specs.get("Grip"),
                "head_shape": specs.get("Head Shape"),   # 페이지에 없으면 None
                "weights": parse_weights(specs.get("Weights")),
                "weights_raw": specs.get("Weights"),
                "length_raw": specs.get("Length"),
                "specs_raw": specs,                      # 원문 전부 보존
            })
            print(f"  [ok] {name}  loft={specs.get('Loft')} lie={specs.get('Lie')} len={specs.get('Length')}")
    finally:
        d.quit()

    data = {
        "source": BASE + "/putters/",
        "fetched": date.today().isoformat(),
        "brand": "Scotty Cameron",
        "brand_ko": "스카티 카메론",
        "category": "putter",
        "note": ("scottycameron.com 은 requests/urllib 에 403 → 셀레늄 렌더링 사용. "
                 "각 모델 상세페이지의 Specifications 표를 원문 그대로 specs_raw 에 보존. "
                 "헤드형태(blade/mallet)는 스펙표에 항목이 없어 head_shape 는 null 이며 "
                 "대신 페이지가 명시한 family/section 을 기록함."),
        "failed": failed,
        "items": items,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    keys = ("model", "family", "loft_deg", "lie_deg", "head_material", "offset", "grip", "weights_raw")
    filled = {k: sum(1 for it in items if it.get(k)) for k in keys}
    filled["lengths_in"] = sum(1 for it in items if it.get("lengths_in"))
    filled["weights"] = sum(1 for it in items if it.get("weights"))
    print(f"[save] {OUT}")
    print(f"[stat] items={len(items)} failed={len(failed)}")
    print(f"[stat] filled={filled}")


if __name__ == "__main__":
    main()
