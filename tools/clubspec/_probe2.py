# -*- coding: utf-8 -*-
"""URL 접근성 프로브 — 상태코드/최종URL/길이/제목만 확인."""
import sys, io, re, urllib.request, urllib.error, gzip, zlib
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
HDRS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "close",
}

URLS = [
    "https://www.odysseygolf.com/",
    "https://www.odysseygolf.com/putters/",
    "https://www.odysseygolf.com/putters-2025-ai-one/",
    "https://www.callawaygolf.com/golf-clubs/putters/",
    "https://www.golfpride.com/",
    "https://www.golfpride.com/grips/",
    "https://www.golfpride.com/product-category/grips/",
]


def get(url):
    req = urllib.request.Request(url, headers=HDRS)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            enc = r.headers.get("Content-Encoding", "")
            if "gzip" in enc:
                raw = gzip.decompress(raw)
            elif "deflate" in enc:
                raw = zlib.decompress(raw, -zlib.MAX_WBITS)
            body = raw.decode("utf-8", "replace")
            t = re.search(r"<title[^>]*>(.*?)</title>", body, re.S | re.I)
            return r.status, r.url, len(body), (t.group(1).strip()[:70] if t else "")
    except urllib.error.HTTPError as e:
        return e.code, url, 0, f"HTTPError {e.reason}"
    except Exception as e:
        return -1, url, 0, f"{type(e).__name__}: {e}"


for u in URLS:
    s, fu, n, t = get(u)
    print(f"{s}\t{n:>8}\t{u}")
    if fu != u:
        print(f"\t-> final: {fu}")
    print(f"\ttitle: {t}")
