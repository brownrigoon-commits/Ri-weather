# -*- coding: utf-8 -*-
"""Extract product links matching a substring from a listing page."""
import sys, re, urllib.request, gzip

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept": "text/html,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9", "Accept-Encoding": "gzip, deflate"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        d = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            d = gzip.decompress(d)
        return d.decode("utf-8", "replace")

url, pat = sys.argv[1], sys.argv[2]
doc = fetch(url)
found = sorted(set(re.findall(r'href="([^"]*' + pat + r'[^"]*)"', doc)))
for f in found:
    print(f)
