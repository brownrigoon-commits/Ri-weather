# -*- coding: utf-8 -*-
"""vokey.com 내비게이션에서 스펙 페이지 후보 확인 (SM11 외 라인 존재 여부)."""
import sys, io, re, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

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
    for u in ["https://www.vokey.com/", "https://www.vokey.com/nav/sm11.aspx"]:
        d.get(u)
        time.sleep(5)
        doc = d.page_source
        hrefs = sorted(set(re.findall(r'href="([^"#]+)"', doc)))
        inner = [h for h in hrefs if "vokey.com" in h or h.startswith("/")]
        print(f"\n===== {u} -> {d.current_url}  len={len(doc)}  links={len(inner)}")
        for h in inner:
            if re.search(r"(nav/|wedge|spec|grind|sm\d|works)", h, re.I):
                print("   ", h)
        tabs = re.findall(r"<table\b.*?</table>", doc, re.S | re.I)
        print(f"   tables={len(tabs)}")
finally:
    d.quit()
