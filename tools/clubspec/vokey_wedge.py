# -*- coding: utf-8 -*-
"""
보키(Titleist Vokey) 웨지 스펙 수집 — vokey.com 공식.

주의: 지시서의 https://www.vokey.com/nav/sm10.aspx 는 현재 홈으로 리다이렉트된다.
      현행 모델은 SM11 (/nav/sm11.aspx) 이므로 그쪽에서 수집한다.
      또한 vokey.com 은 urllib/requests 에 403 을 반환하므로 셀레늄 필수.

원칙: 페이지에서 읽지 못한 값은 null. 추정/보간 없음.
출력: coursedata/clubspecs/vokey_wedge.json
"""
import sys, io, os, re, json, time, html as H
from datetime import date

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

SRC = "https://www.vokey.com/nav/sm11.aspx"
OUT = r"C:/Users/PC/Desktop/Ri-weather/coursedata/clubspecs/vokey_wedge.json"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def driver():
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


def rows_of(table):
    out = []
    for r in re.findall(r"<tr\b.*?</tr>", table, re.S | re.I):
        cells = [txt(c) for c in re.findall(r"<t[hd]\b.*?</t[hd]>", r, re.S | re.I)]
        if cells:
            out.append(cells)
    return out


def num(s):
    """'58°' -> 58.0, '35.00”' -> 35.0, 없으면 None"""
    if not s:
        return None
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    return float(m.group()) if m else None


def fetch(url):
    d = driver()
    try:
        d.get(url)
        time.sleep(4)
        for _ in range(5):
            d.execute_script("window.scrollBy(0, document.body.scrollHeight/5);")
            time.sleep(0.7)
        time.sleep(1.5)
        return d.page_source, d.current_url
    finally:
        d.quit()


def main():
    doc, final = fetch(SRC)
    print(f"[fetch] {final}  len={len(doc)}")
    if "sm11" not in final.lower():
        print(f"[WARN] 리다이렉트 발생: {final}")

    tables = re.findall(r"<table\b.*?</table>", doc, re.S | re.I)
    print(f"[parse] tables={len(tables)}")

    items = []
    shafts = []
    grips = []
    seen = set()

    for t in tables:
        rs = rows_of(t)
        if not rs:
            continue
        head = [c.lower() for c in rs[0]]

        # 웨지 로프트/바운스/그라인드 표
        if head[:3] == ["loft", "bounce", "grind"]:
            for r in rs[1:]:
                if len(r) < 3 or not r[0]:
                    continue
                loft = num(r[0])
                bounce = num(r[1])
                grind = r[2] or None
                if loft is None or grind is None:
                    continue
                key = (loft, bounce, grind)
                if key in seen:          # 페이지 내 중복 방지
                    continue
                seen.add(key)
                items.append({
                    "model": f"Vokey SM11 {r[0]}{r[1]} {grind}".replace("  ", " "),
                    "loft_deg": loft,
                    "bounce_deg": bounce,
                    "grind": grind,
                    "length_in": num(r[3]) if len(r) > 3 else None,
                    "swingweight": (r[4] or None) if len(r) > 4 else None,
                    "loft_raw": r[0],
                    "bounce_raw": r[1],
                    "length_raw": r[3] if len(r) > 3 else None,
                })

        # 샤프트 표
        elif head[:2] == ["flex", "weight"]:
            for r in rs[1:]:
                if len(r) < 4 or not r[0]:
                    continue
                shafts.append({
                    "flex": r[0],
                    "weight_g": num(r[1]),
                    "torque_deg": num(r[2]),
                    "launch": r[3] or None,
                })

        # 그립 코어/무게 표
        elif head[:2] == ["core", "weight"]:
            for r in rs[1:]:
                if len(r) < 2 or not r[0]:
                    continue
                grips.append({"core": r[0], "weight_g": num(r[1])})

    data = {
        "source": final,
        "fetched": date.today().isoformat(),
        "brand": "Titleist Vokey Design",
        "brand_ko": "타이틀리스트 보키",
        "category": "wedge",
        "model_line": "SM11",
        "note": ("지시서의 /nav/sm10.aspx 는 홈으로 리다이렉트되어 현행 SM11 페이지에서 수집. "
                 "vokey.com 은 requests/urllib 에 403 → 셀레늄 렌더링 사용. "
                 "표에 없는 값(라이각 등)은 채우지 않음."),
        "shaft_options": shafts,
        "grip_options": grips,
        "items": items,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    filled = {k: sum(1 for it in items if it.get(k) is not None)
              for k in ("loft_deg", "bounce_deg", "grind", "length_in", "swingweight")}
    print(f"[save] {OUT}")
    print(f"[stat] items={len(items)} shafts={len(shafts)} grips={len(grips)}")
    print(f"[stat] filled={filled}")
    for it in items[:3]:
        print("   ", it)


if __name__ == "__main__":
    main()
