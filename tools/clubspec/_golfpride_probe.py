# -*- coding: utf-8 -*-
"""골프프라이드 403 우회 경로 탐색."""
import sys, io, re, time, json, urllib.request, urllib.error, gzip, zlib
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def raw_get(url, hdrs=None):
    h = {"User-Agent": UA,
         "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
         "Accept-Language": "en-US,en;q=0.9",
         "Accept-Encoding": "gzip, deflate",
         "Upgrade-Insecure-Requests": "1",
         "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate",
         "Sec-Fetch-Site": "none", "Sec-Fetch-User": "?1",
         "Connection": "close"}
    if hdrs:
        h.update(hdrs)
    req = urllib.request.Request(url, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            b = r.read()
            e = r.headers.get("Content-Encoding", "")
            if "gzip" in e:
                b = gzip.decompress(b)
            elif "deflate" in e:
                b = zlib.decompress(b, -zlib.MAX_WBITS)
            return r.status, r.url, b.decode("utf-8", "replace")
    except urllib.error.HTTPError as ex:
        return ex.code, url, ""
    except Exception as ex:
        return -1, url, f"{type(ex).__name__}: {ex}"


print("=== 1) urllib with full browser headers")
for u in ["https://www.golfpride.com/robots.txt",
          "https://www.golfpride.com/sitemap.xml",
          "https://www.golfpride.com/sitemap_index.xml",
          "https://golfpride.com/",
          "https://www.golfpride.com/wp-json/wp/v2/types"]:
    s, fu, body = raw_get(u)
    print(f"  {s}\t{len(body):>7}\t{u}")
    if s == 200:
        print("   ", body[:400].replace("\n", " "))

print("\n=== 2) selenium headless")
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

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
    for u in ["https://www.golfpride.com/", "https://www.golfpride.com/grips/"]:
        try:
            d.get(u)
            time.sleep(6)
            doc = d.page_source
            t = re.search(r"<title[^>]*>(.*?)</title>", doc, re.S | re.I)
            print(f"  {u}\n    final={d.current_url} len={len(doc)} title={(t.group(1).strip()[:80] if t else '')}")
            open(rf"C:/Users/PC/AppData/Local/Temp/claude/gp_{u.rstrip('/').split('/')[-1] or 'home'}.html",
                 "w", encoding="utf-8").write(doc)
        except Exception as e:
            print(f"  [ERR] {u} :: {type(e).__name__}: {e}")
finally:
    d.quit()
