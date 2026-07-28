# -*- coding: utf-8 -*-
"""vokey SM11 / SM10 / wedgegrinds 페이지의 모든 표 헤더 확인."""
import sys, io, re, time, html as H
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def txt(s):
    s = re.sub(r"<(script|style)\b.*?</\1>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", H.unescape(s)).strip()


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
try:
    for u in ["https://www.vokey.com/nav/sm11.aspx",
              "https://www.vokey.com/nav/sm10.aspx",
              "https://www.vokey.com/nav/wedgegrinds.aspx"]:
        d.get(u)
        time.sleep(5)
        for _ in range(6):
            d.execute_script("window.scrollBy(0, 900);")
            time.sleep(0.6)
        time.sleep(2)
        doc = d.page_source
        tabs = re.findall(r"<table\b.*?</table>", doc, re.S | re.I)
        print(f"\n===== {u} -> {d.current_url}  tables={len(tabs)}")
        for i, t in enumerate(tabs):
            rows = re.findall(r"<tr\b.*?</tr>", t, re.S | re.I)
            head = [txt(c) for c in re.findall(r"<t[hd]\b.*?</t[hd]>", rows[0], re.S | re.I)] if rows else []
            print(f"  t{i} rows={len(rows)} head={head}")
            if len(rows) > 1:
                print(f"      row1={[txt(c) for c in re.findall(r'<t[hd]\\b.*?</t[hd]>', rows[1], re.S|re.I)]}")
finally:
    d.quit()
