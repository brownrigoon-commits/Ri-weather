# -*- coding: utf-8 -*-
"""Smart Sole / CBX4 페이지의 표 헤더 확인."""
import sys, io, re, urllib.request, gzip, zlib, html as H
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
B = "https://us.dunlopsports.com"
URLS = {
    "SmartSoleFF": B + "/cleveland-golf/clubs/wedges/smart-sole-full-face/smart-sole-full-face-wedge/MSMARTSOLEFF.html",
    "WSmartSoleFF": B + "/cleveland-golf/clubs/wedges/womens-wedges/womens-smart-sole-full-face-wedge/MWSMARTSOLEFF.html",
    "WCBX4ZC": B + "/cleveland-golf/sale/wedges/womens-cbx-4-zipcore-wedges/womens-cbx-4-zipcore-wedge/MWCBX4ZC.html",
}


def get(u):
    r = urllib.request.Request(u, headers={"User-Agent": UA, "Accept": "text/html,*/*",
                                           "Accept-Encoding": "gzip, deflate",
                                           "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(r, timeout=45) as x:
        b = x.read()
        e = x.headers.get("Content-Encoding", "")
        if "gzip" in e:
            b = gzip.decompress(b)
        elif "deflate" in e:
            b = zlib.decompress(b, -zlib.MAX_WBITS)
        return b.decode("utf-8", "replace")


def txt(s):
    s = re.sub(r"<(script|style)\b.*?</\1>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", H.unescape(s)).strip()


for tag, u in URLS.items():
    doc = get(u)
    tabs = re.findall(r"<table\b.*?</table>", doc, re.S | re.I)
    print(f"\n===== {tag}  len={len(doc)}  tables={len(tabs)}")
    for i, t in enumerate(tabs):
        rows = re.findall(r"<tr\b.*?</tr>", t, re.S | re.I)
        head = [txt(c) for c in re.findall(r"<t[hd]\b.*?</t[hd]>", rows[0], re.S | re.I)] if rows else []
        print(f"  t{i} rows={len(rows)} head={head}")
        if head and re.search(r"loft", " ".join(head), re.I):
            for r in rows[1:4]:
                print("      ", [txt(c) for c in re.findall(r"<t[hd]\b.*?</t[hd]>", r, re.S | re.I)])
