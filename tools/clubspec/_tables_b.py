# -*- coding: utf-8 -*-
"""저장 HTML의 <table> 을 텍스트로 덤프 (구조 확인용)"""
import sys, io, re, html as H
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

path = sys.argv[1]
maxt = int(sys.argv[2]) if len(sys.argv) > 2 else 99
doc = open(path, encoding="utf-8", errors="replace").read()

def txt(s):
    s = re.sub(r"<[^>]+>", " ", s)
    s = H.unescape(s)
    return re.sub(r"\s+", " ", s).strip()

tables = re.findall(r"<table\b.*?</table>", doc, re.S | re.I)
print(f"### tables={len(tables)}")
for i, t in enumerate(tables[:maxt]):
    print(f"\n--- TABLE {i} ---")
    cls = re.search(r'<table\b([^>]*)>', t, re.I)
    print("attrs:", txt(cls.group(1)) if cls else "")
    rows = re.findall(r"<tr\b.*?</tr>", t, re.S | re.I)
    for r in rows[:40]:
        cells = re.findall(r"<t[hd]\b.*?</t[hd]>", r, re.S | re.I)
        print(" | ".join(txt(c) for c in cells))
