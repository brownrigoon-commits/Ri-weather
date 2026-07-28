# -*- coding: utf-8 -*-
"""저장된 HTML에서 링크 추출 + 키워드 필터"""
import sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

path = sys.argv[1]
kws = [k.lower() for k in sys.argv[2:]]
html = open(path, encoding="utf-8", errors="replace").read()
seen = set()
for m in re.finditer(r'href="([^"]+)"', html):
    u = m.group(1)
    if u in seen:
        continue
    seen.add(u)
    low = u.lower()
    if not kws or any(k in low for k in kws):
        print(u)
