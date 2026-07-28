# -*- coding: utf-8 -*-
"""추가 클리브랜드 웨지 라인의 제품 URL 확보 + urllib 로 스펙표 파싱 가능한지 확인."""
import sys, io, re, urllib.request, urllib.error, gzip, zlib, html as H
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
BASE = "https://us.dunlopsports.com"


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


def txt(s):
    s = re.sub(r"<(script|style)\b.*?</\1>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", H.unescape(s)).strip()


print("### 1) 카테고리에서 제품 URL 찾기")
for cat in ["/cleveland-golf/clubs/wedges/cbx-full-face-2",
            "/cleveland-golf/clubs/wedges/smart-sole-full-face",
            "/cleveland-golf/clubs/wedges/womens-wedges",
            "/cleveland-golf/sale/wedges"]:
    s, doc = get(BASE + cat)
    prods = sorted(set(re.findall(r'href="((?:https://us\.dunlopsports\.com)?/cleveland-golf/[^"]*?/M[A-Z0-9]+\.html)"', doc)))
    print(f"\n[{s}] {cat}  -> {len(prods)}")
    for p in prods:
        print("   ", p)

print("\n\n### 2) urllib 로 스펙표가 나오는지 확인 (RTZ 기존 페이지)")
s, doc = get(BASE + "/cleveland-golf/clubs/wedges/rtz/rtz-tour-satin-wedge/MRTZTS.html")
tabs = re.findall(r"<table\b.*?</table>", doc, re.S | re.I)
print(f"[{s}] len={len(doc)} tables={len(tabs)}")
for i, t in enumerate(tabs[:5]):
    print(f"  -- t{i}: {txt(t)[:260]}")
