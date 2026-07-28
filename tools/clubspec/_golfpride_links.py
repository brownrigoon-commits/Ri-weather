# -*- coding: utf-8 -*-
"""골프프라이드 사이트맵에서 그립 제품 URL 수집."""
import sys, io, re, json, urllib.request, urllib.error, gzip, zlib
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def get(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "close"})
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
        print("  [ERR]", type(ex).__name__, ex)
        return -1, ""


IDX = "https://www.golfpride.com/content/golfpride.sitemap-index.xml"
s, body = get(IDX)
print(f"[index] {s} len={len(body)}")
if s != 200:
    s, body = get(IDX.replace("www.", ""))
    print(f"[index apex] {s} len={len(body)}")

subs = re.findall(r"<loc>\s*([^<]+?)\s*</loc>", body)
print(f"[sub-sitemaps] {len(subs)}")
for u in subs[:20]:
    print("   ", u)

allurls = []
for su in subs:
    if not su.endswith(".xml"):
        allurls.append(su)
        continue
    st, b = get(su)
    locs = re.findall(r"<loc>\s*([^<]+?)\s*</loc>", b)
    print(f"  [{st}] {su} -> {len(locs)}")
    allurls.extend(locs)

allurls = sorted(set(allurls))
print(f"\n[all urls] {len(allurls)}")

en = [u for u in allurls if "/us/en-us/" in u]
print(f"[us/en-us] {len(en)}")

grip = [u for u in en if re.search(r"grip", u, re.I)]
print(f"[grip-ish] {len(grip)}")
for u in grip[:200]:
    print("   ", u)

json.dump(allurls, open(r"C:/Users/PC/AppData/Local/Temp/claude/gp_all_urls.json",
                        "w", encoding="utf-8"), indent=1)
