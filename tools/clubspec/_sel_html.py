# -*- coding: utf-8 -*-
"""Save rendered page_source to a file for offline inspection."""
import sys, time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
o = Options()
o.add_argument("--headless=new")
o.add_argument("--window-size=1400,1000")
o.add_argument("--user-agent=" + UA)
o.add_argument("--disable-blink-features=AutomationControlled")
o.add_argument("--log-level=3")
o.add_experimental_option("excludeSwitches", ["enable-automation"])
d = webdriver.Chrome(options=o)
d.set_page_load_timeout(60)
try:
    d.get(sys.argv[1])
    time.sleep(7)
    open(sys.argv[2], "w", encoding="utf-8").write(d.page_source)
    print("saved", sys.argv[2], len(d.page_source))
finally:
    d.quit()
