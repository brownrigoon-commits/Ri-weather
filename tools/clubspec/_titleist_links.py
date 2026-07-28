# -*- coding: utf-8 -*-
"""Discover Titleist driver/iron product URLs from the official category pages.

Used to find the PDP for models that only appear as sibling rows in another
page's shared spec matrix (GT2/GT3/GT4 etc.), so their Head Size can be read
from their own Compare module instead of being left blank.
"""
import re, sys, time
sys.stdout.reconfigure(encoding="utf-8")

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

CATS = [
    "https://www.titleist.com/golf-clubs/golf-drivers/",
    "https://www.titleist.com/golf-clubs/irons/",
]

o = Options()
o.add_argument("--headless=new")
o.add_argument("--window-size=1400,1000")
o.add_argument("--user-agent=" + UA)
o.add_argument("--disable-blink-features=AutomationControlled")
o.add_argument("--disable-gpu")
o.add_argument("--no-sandbox")
o.add_argument("--log-level=3")
o.page_load_strategy = "eager"
d = webdriver.Chrome(options=o)
d.set_page_load_timeout(45)

try:
    for cat in CATS:
        print("=" * 60)
        print(cat)
        try:
            d.get(cat)
        except TimeoutException:
            d.execute_script("window.stop();")
        time.sleep(4)
        seen = {}
        for a in d.find_elements(By.CSS_SELECTOR, "a[href*='/product/']"):
            href = a.get_attribute("href") or ""
            m = re.search(r"/product/([^/]+)/(\w+)\.html", href)
            if not m:
                continue
            label = re.sub(r"\s+", " ", (a.get_attribute("textContent") or "")).strip()
            key = m.group(0)
            if key not in seen or (not seen[key] and label):
                seen[key] = label
        for k in sorted(seen):
            print(f"  {k:<48} {seen[k][:60]}")
        print(f"  total {len(seen)}")
finally:
    d.quit()
