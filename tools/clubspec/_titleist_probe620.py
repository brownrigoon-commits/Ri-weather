# -*- coding: utf-8 -*-
"""Probe pages that produced no spec matrix, to record WHY (discontinued vs parser gap)."""
import sys, time, re
sys.stdout.reconfigure(encoding="utf-8")
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
URLS = [
    "https://www.titleist.com/product/620-cb/540C.html",
    "https://www.titleist.com/product/620-mb/541C.html",
    "https://www.titleist.com/product/t250-black-vapor/561BC.html",
]
o = Options()
for a in ["--headless=new", "--window-size=1400,1000", "--user-agent=" + UA,
          "--disable-blink-features=AutomationControlled", "--disable-gpu",
          "--no-sandbox", "--log-level=3"]:
    o.add_argument(a)
o.page_load_strategy = "eager"
d = webdriver.Chrome(options=o)
d.set_page_load_timeout(45)
try:
    for u in URLS:
        print("=" * 60)
        print(u)
        try:
            d.get(u)
        except TimeoutException:
            d.execute_script("window.stop();")
        time.sleep(4)
        print("  final_url:", d.current_url)
        h1 = d.find_elements(By.TAG_NAME, "h1")
        print("  h1:", re.sub(r"\s+", " ", h1[0].get_attribute("textContent")).strip() if h1 else None)
        print("  primary-specs-container:",
              len(d.find_elements(By.CSS_SELECTOR, "div.primary-specs-container")))
        print("  tables:", len(d.find_elements(By.TAG_NAME, "table")))
        print("  compare-table:", len(d.find_elements(By.CSS_SELECTOR, "div.compare-table")))
        body = re.sub(r"\s+", " ", d.find_element(By.TAG_NAME, "body").get_attribute("textContent"))
        print("  body_len:", len(body))
        print("  snippet:", body[:260])
finally:
    d.quit()
