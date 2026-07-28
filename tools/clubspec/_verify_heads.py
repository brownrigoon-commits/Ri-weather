# -*- coding: utf-8 -*-
"""Audit: every published number must appear verbatim on its own source page.

Guards absolute rule 1 (never invent a number). For each item in the Titleist
and PING head-spec JSONs we re-fetch the item's `source` URL and assert that the
raw strings we published (loft_raw / lie_raw / length_raw / head_size_raw) are
literally present in that page's text. Anything not found is reported.

Run:  python tools/clubspec/_verify_heads.py
"""
import json, os, re, sys, time, gzip, html as ihtml
import urllib.request
sys.stdout.reconfigure(encoding="utf-8")

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException

HERE = os.path.dirname(os.path.abspath(__file__))
SPECS = os.path.normpath(os.path.join(HERE, "..", "..", "coursedata", "clubspecs"))
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

RAW_FIELDS = ["loft_raw", "lie_raw", "length_raw", "head_size_raw"]


def normtext(s):
    """Collapse whitespace and unify the degree/quote/dash glyph variants."""
    s = ihtml.unescape(s or "")
    s = (s.replace("″", '"').replace("”", '"').replace("′", "'")
           .replace("’", "'").replace("–", "-").replace("—", "-")
           .replace("\xa0", " "))
    return re.sub(r"\s+", " ", s)


def page_text_static(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate"})
    with urllib.request.urlopen(req, timeout=40) as r:
        d = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            d = gzip.decompress(d)
    doc = d.decode("utf-8", "replace")
    doc = re.sub(r"(?is)<(script|style).*?</\1>", " ", doc)
    return normtext(re.sub(r"<[^>]+>", " ", doc))


def make_drv():
    o = Options()
    for a in ["--headless=new", "--window-size=1400,1000", "--user-agent=" + UA,
              "--disable-gpu", "--no-sandbox", "--log-level=3"]:
        o.add_argument(a)
    o.page_load_strategy = "eager"
    d = webdriver.Chrome(options=o)
    d.set_page_load_timeout(45)
    return d


def page_text_rendered(drv, url):
    try:
        drv.get(url)
    except TimeoutException:
        drv.execute_script("window.stop();")
    time.sleep(3.5)
    return normtext(drv.find_element(By.TAG_NAME, "body").get_attribute("textContent"))


def audit(fname, rendered, drv=None):
    path = os.path.join(SPECS, fname)
    doc = json.load(open(path, encoding="utf-8"))
    items = doc["items"]
    by_url = {}
    for it in items:
        by_url.setdefault(it["source"], []).append(it)

    checked = missing = 0
    problems = []
    for url, its in by_url.items():
        text = page_text_rendered(drv, url) if rendered else page_text_static(url)
        for it in its:
            for f in RAW_FIELDS:
                v = it.get(f)
                if v in (None, ""):
                    continue
                checked += 1
                if normtext(str(v)) not in text:
                    missing += 1
                    problems.append((it.get("model"), it.get("club"), f, v, url))
    print(f"{fname:<24} items={len(items):<4} urls={len(by_url):<3} "
          f"values_checked={checked:<5} not_found_on_page={missing}")
    for p in problems[:25]:
        print("    MISSING", p)
    return missing


if __name__ == "__main__":
    total = 0
    total += audit("ping_drivers.json", rendered=False)
    total += audit("ping_irons.json", rendered=False)
    drv = make_drv()
    try:
        total += audit("titleist_drivers.json", rendered=True, drv=drv)
        total += audit("titleist_irons.json", rendered=True, drv=drv)
    finally:
        drv.quit()
    print("\nTOTAL values not found on their source page:", total)
