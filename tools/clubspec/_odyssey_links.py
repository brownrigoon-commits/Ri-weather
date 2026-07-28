# -*- coding: utf-8 -*-
"""오디세이 퍼터 목록 페이지에서 제품 상세 URL 수집 (셀레늄)."""
import sys, io, re, time, json, html as H
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
SRC = "https://odyssey.callawaygolf.com/putters"


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


d = make_driver()
try:
    d.get(SRC)
    time.sleep(5)
    for _ in range(14):
        d.execute_script("window.scrollBy(0, 900);")
        time.sleep(0.6)
    time.sleep(3)
    doc = d.page_source
    print("final:", d.current_url, "len:", len(doc))
finally:
    d.quit()

open(r"C:/Users/PC/AppData/Local/Temp/claude/odyssey_list.html", "w",
     encoding="utf-8").write(doc)

hrefs = sorted(set(re.findall(r'href="([^"]+)"', doc)))
prod = [h for h in hrefs if re.search(r"/(putters?|product)/", h, re.I)]
print(f"\n[all hrefs] {len(hrefs)}   [putter-ish] {len(prod)}")
for h in prod[:120]:
    print("  ", h)
