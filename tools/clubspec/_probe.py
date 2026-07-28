# -*- coding: utf-8 -*-
"""URL probe: check status/size/spec-keyword presence for candidate official pages."""
import sys, re, urllib.request, gzip, io

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            data = gzip.decompress(data)
        return r.status, r.geturl(), data.decode("utf-8", "replace")

KEYS = ["Loft", "Lie", "Volume", "Head Size", "Length", "Swing Weight", "Specification"]

for url in sys.argv[1:]:
    try:
        st, final, html = fetch(url)
        hits = {k: html.count(k) for k in KEYS if k in html}
        ntable = html.count("<table")
        print(f"[{st}] len={len(html):>8}  tables={ntable}  {url}")
        if final != url:
            print(f"      -> redirected: {final}")
        print(f"      keys={hits}")
    except Exception as e:
        print(f"[ERR] {url} :: {type(e).__name__}: {e}")
