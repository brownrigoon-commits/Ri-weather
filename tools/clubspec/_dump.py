# -*- coding: utf-8 -*-
"""Dump tables of a page fetched via urllib, to inspect structure."""
import sys, re, urllib.request, gzip, html as ihtml

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            data = gzip.decompress(data)
        return data.decode("utf-8", "replace")

TAG = re.compile(r"<[^>]+>")
def txt(s):
    s = re.sub(r"(?is)<(script|style).*?</\1>", " ", s)
    s = TAG.sub(" ", s)
    return re.sub(r"\s+", " ", ihtml.unescape(s)).strip()

url = sys.argv[1]
doc = fetch(url)
if len(sys.argv) > 2 and sys.argv[2] == "raw":
    sys.stdout.write(doc)
    raise SystemExit

for i, tb in enumerate(re.findall(r"(?is)<table.*?</table>", doc)):
    rows = re.findall(r"(?is)<tr.*?</tr>", tb)
    print(f"===== TABLE {i}  rows={len(rows)} =====")
    for r in rows[:30]:
        cells = [txt(c) for c in re.findall(r"(?is)<t[hd].*?</t[hd]>", r)]
        if any(cells):
            print("  | " + " | ".join(cells))
    print()
