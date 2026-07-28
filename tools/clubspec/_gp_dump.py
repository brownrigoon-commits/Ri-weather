# -*- coding: utf-8 -*-
"""골프프라이드 페이지 구조 조사 (apex 도메인 urllib 우회)."""
import sys, io, re, json, urllib.request, urllib.error, gzip, zlib, html as H
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def get(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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


TARGETS = [
    ("specpage", "https://golfpride.com/us/en-us/customer-service-hub/grip-advice/grip-specifications.html"),
    ("mcc", "https://golfpride.com/us/en-us/swing-grips/mcc-collection/mcc.html"),
    ("tourvelvet", "https://golfpride.com/us/en-us/swing-grips/tour-velvet-collection/tour-velvet.html"),
    ("revtaper", "https://golfpride.com/us/en-us/putter-grips/reverse-taper-collection/reverse-taper---pistol.html"),
]

for tag, url in TARGETS:
    s, doc = get(url)
    print(f"\n========== [{tag}] {s} len={len(doc)}  {url}")
    if s != 200:
        continue
    open(rf"C:/Users/PC/AppData/Local/Temp/claude/gp_{tag}.html", "w",
         encoding="utf-8").write(doc)

    tables = re.findall(r"<table\b.*?</table>", doc, re.S | re.I)
    print(f"  [tables] {len(tables)}")
    for i, t in enumerate(tables[:6]):
        print(f"   -- t{i}: {txt(t)[:500]}")

    body = txt(doc)
    for kw in ("Weight", "Core", "Size", "Undersize", "Midsize", "Jumbo", "gram"):
        m = re.search(rf"\b{kw}\b", body)
        if m:
            print(f"  [{kw}] ...{body[max(0,m.start()-100):m.start()+250]}...")

    # AEM 데이터 속성 / JSON 블록
    for pat in (r'data-cmp-data-layer="([^"]{0,300})"',
                r'"variants?"\s*:\s*\[',
                r'"weight"', r'"core"', r'"size"'):
        n = len(re.findall(pat, doc, re.I))
        if n:
            print(f"  [pat {pat[:30]}] x{n}")
