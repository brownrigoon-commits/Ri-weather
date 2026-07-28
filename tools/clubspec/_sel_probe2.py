# -*- coding: utf-8 -*-
"""Selenium probe #2: tables with the nearest preceding heading, plus 'cc'/volume hunt."""
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
d = driver()
try:
    d.get(url)
    time.sleep(7)
    doc = d.page_source
    print("URL :", d.current_url)
    print("H1  :", txt(re.search(r"(?is)<h1[^>]*>(.*?)</h1>", doc).group(1))
          if re.search(r"(?is)<h1[^>]*>(.*?)</h1>", doc) else None)

    # volume / cc hunt over visible body text
    body = txt(re.sub(r"(?is)<(script|style|noscript).*?</\1>", " ", doc))
    for m in re.finditer(r"[^.]{0,90}\b\d{2,3}\s?cc\b[^.]{0,50}", body, re.I):
        print("CC? :", m.group().strip()[:170])
    for m in re.finditer(r"[^.]{0,70}(volume|head size)[^.]{0,70}", body, re.I):
        print("VOL?:", m.group().strip()[:170])

    for i, m in enumerate(re.finditer(r"(?is)<table.*?</table>", doc)):
        tb = m.group()
        pre = doc[max(0, m.start() - 2500):m.start()]
        heads = re.findall(r"(?is)<(?:h[1-6]|button|summary)[^>]*>(.*?)</(?:h[1-6]|button|summary)>", pre)
        heads = [txt(h) for h in heads if txt(h)]
        rows = re.findall(r"(?is)<tr.*?</tr>", tb)
        print(f"--- table {i} rows={len(rows)} nearHeading={heads[-3:] if heads else None}")
        for r in rows[:16]:
            cells = [txt(c) for c in re.findall(r"(?is)<t[hd][^>]*>.*?</t[hd]>", r)]
            if any(cells):
                print("   | " + " | ".join(cells))
finally:
    d.quit()
