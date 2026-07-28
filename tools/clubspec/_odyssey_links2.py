# -*- coding: utf-8 -*-
"""오디세이 전 제품 URL 수집 — SFCC 그리드 sz 파라미터 + 카테고리 순회."""
import sys, io, re, time, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

CATS = [
    "https://odyssey.callawaygolf.com/putters?sz=300",
    "https://odyssey.callawaygolf.com/putters/mallet-putters?sz=300",
    "https://odyssey.callawaygolf.com/putters/blade-putters?sz=300",
    "https://odyssey.callawaygolf.com/putters/left-handed-putters?sz=300",
]


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


PROD = re.compile(r'href="(https://odyssey\.callawaygolf\.com/putters/[^"]*?\.html)[^"]*"')

d = make_driver()
found = {}
try:
    for url in CATS:
        try:
            d.get(url)
            time.sleep(5)
            last = 0
            for i in range(30):
                d.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(1.0)
                h = d.execute_script("return document.body.scrollHeight")
                if h == last and i > 4:
                    break
                last = h
            time.sleep(2)
            doc = d.page_source
            hits = set(PROD.findall(doc))
            for h in hits:
                found.setdefault(h, url)
            print(f"[{url}] len={len(doc)} products={len(hits)}  total={len(found)}")
        except Exception as e:
            print(f"[ERR] {url} :: {type(e).__name__}: {e}")
finally:
    d.quit()

out = r"C:/Users/PC/AppData/Local/Temp/claude/odyssey_urls.json"
json.dump(sorted(found), open(out, "w", encoding="utf-8"), indent=1)
print(f"\n[TOTAL] {len(found)} -> {out}")
for u in sorted(found):
    print("  ", u)
