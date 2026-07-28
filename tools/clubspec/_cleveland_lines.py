# -*- coding: utf-8 -*-
"""클리브랜드 웨지 카테고리에서 모델라인/제품 URL 확인."""
import sys, io, re, urllib.request, urllib.error, gzip, zlib, html as H
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def get(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Accept": "text/html,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate", "Connection": "close"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            b = r.read()
            e = r.headers.get("Content-Encoding", "")
            if "gzip" in e:
                b = gzip.decompress(b)
            elif "deflate" in e:
                b = zlib.decompress(b, -zlib.MAX_WBITS)
            return r.status, b.decode("utf-8", "replace")
    except urllib.error.HTTPError as ex:
        return ex.code, ""
    except Exception as ex:
        return -1, f"{type(ex).__name__}: {ex}"


for u in ["https://us.dunlopsports.com/cleveland-golf/clubs/wedges.html",
          "https://us.dunlopsports.com/cleveland-golf/clubs/wedges/",
          "https://us.dunlopsports.com/sitemap.xml"]:
    s, doc = get(u)
    print(f"\n===== {s}  len={len(doc)}  {u}")
    if s != 200:
        continue
    hrefs = sorted(set(re.findall(r'href="([^"]*wedge[^"]*)"', doc, re.I)))
    print(f"  wedge links: {len(hrefs)}")
    for h in hrefs[:80]:
        print("   ", h)
