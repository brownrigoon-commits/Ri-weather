# -*- coding: utf-8 -*-
"""Dump the raw table structure of the 620 CB page to learn its spec layout."""
import sys, time, re
sys.stdout.reconfigure(encoding="utf-8")
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
o = Options()
for a in ["--headless=new", "--window-size=1400,1000", "--user-agent=" + UA,
          "--disable-gpu", "--no-sandbox", "--log-level=3"]:
    o.add_argument(a)
o.page_load_strategy = "eager"
d = webdriver.Chrome(options=o)
d.set_page_load_timeout(45)

def cl(s):
    return re.sub(r"\s+", " ", s or "").strip()

try:
    for u in ["https://www.titleist.com/product/620-cb/540C.html"]:
        try:
            d.get(u)
        except TimeoutException:
            d.execute_script("window.stop();")
        time.sleep(4)
        for i, t in enumerate(d.find_elements(By.TAG_NAME, "table")):
            cls = t.get_attribute("class")
            # nearest ancestor div class, for locating the container
            try:
                anc = t.find_element(By.XPATH, "./ancestor::div[@class][1]").get_attribute("class")
            except Exception:
                anc = None
            rows = t.find_elements(By.CSS_SELECTOR, "tr")
            print("=" * 70)
            print(f"[{i}] class={cls!r} ancestor={anc!r} rows={len(rows)}")
            for r in rows[:14]:
                cells = [cl(c.get_attribute("textContent"))
                         for c in r.find_elements(By.CSS_SELECTOR, "th,td")]
                imgs = [cl(g.get_attribute("alt"))
                        for g in r.find_elements(By.TAG_NAME, "img")]
                print("    ", cells[:14], "IMG:", imgs[:3])
finally:
    d.quit()
