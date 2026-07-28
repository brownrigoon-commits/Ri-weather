# -*- coding: utf-8 -*-
"""Selenium explorer: load URL headless, dump h1/title, tables, and matching links."""
import sys, re, time, html as ihtml
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

def driver():
    o = Options()
    o.add_argument("--headless=new")
    o.add_argument("--window-size=1400,1000")
    o.add_argument("--user-agent=" + UA)
    o.add_argument("--disable-blink-features=AutomationControlled")
    o.add_argument("--log-level=3")
    o.add_experimental_option("excludeSwitches", ["enable-automation"])
    d = webdriver.Chrome(options=o)
    d.set_page_load_timeout(60)
    return d

TAG = re.compile(r"<[^>]+>")
def txt(s):
    s = re.sub(r"(?is)<(script|style).*?</\1>", " ", s)
    return re.sub(r"\s+", " ", ihtml.unescape(TAG.sub(" ", s))).strip()

url = sys.argv[1]
pat = sys.argv[2] if len(sys.argv) > 2 else None
d = driver()
try:
    d.get(url)
    time.sleep(6)
    doc = d.page_source
    print("URL :", d.current_url)
    print("TTL :", d.title)
    m = re.search(r"(?is)<h1[^>]*>(.*?)</h1>", doc)
    print("H1  :", txt(m.group(1)) if m else None)
    print("LEN :", len(doc))
    if pat:
        links = sorted(set(re.findall(r'href="([^"]*' + pat + r'[^"]*)"', doc)))
        print(f"LINKS ({len(links)}):")
        for l in links:
            print("   ", l)
    tbs = re.findall(r"(?is)<table.*?</table>", doc)
    print(f"TABLES: {len(tbs)}")
    for i, tb in enumerate(tbs[:12]):
        rows = re.findall(r"(?is)<tr.*?</tr>", tb)
        print(f"--- table {i} rows={len(rows)}")
        for r in rows[:14]:
            cells = [txt(c) for c in re.findall(r"(?is)<t[hd][^>]*>.*?</t[hd]>", r)]
            if any(cells):
                print("   | " + " | ".join(cells))
finally:
    d.quit()
