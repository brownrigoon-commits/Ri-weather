# -*- coding: utf-8 -*-
"""저장 HTML 에서 키워드 주변 문맥 출력 (스펙 마크업 패턴 탐색용)"""
import sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

path = sys.argv[1]
kw = sys.argv[2]
win = int(sys.argv[3]) if len(sys.argv) > 3 else 300
lim = int(sys.argv[4]) if len(sys.argv) > 4 else 8

doc = open(path, encoding="utf-8", errors="replace").read()
n = 0
for m in re.finditer(re.escape(kw), doc, re.I):
    a = max(0, m.start() - win)
    b = min(len(doc), m.end() + win)
    print(f"\n===== hit@{m.start()} =====")
    print(re.sub(r"\s+", " ", doc[a:b]))
    n += 1
    if n >= lim:
        break
print(f"\n#total hits: {len(re.findall(re.escape(kw), doc, re.I))}")
