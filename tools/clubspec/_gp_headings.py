# -*- coding: utf-8 -*-
"""스펙 페이지의 섹션 제목 + 표 컬럼 라벨 확인."""
import sys, io, re, html as H
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

doc = open(r"C:/Users/PC/AppData/Local/Temp/claude/gp_specpage.html", encoding="utf-8").read()
u = doc.replace("\\n", "\n").replace("\\u003c", "<").replace("\\u003e", ">")
u = H.unescape(u)


def clean(s):
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", s.replace("\xa0", " ")).strip()


# 헤딩과 문단을 문서 순서대로
print("=== 문서 순서 (헤딩 h1-h4 + 파이프 문단) ===")
for m in re.finditer(r"<(h[1-4])\b[^>]*>(.*?)</\1>|<p>(.*?)</p>", u, re.S | re.I):
    if m.group(1):
        t = clean(m.group(2))
        if t:
            print(f"\n## [{m.group(1)}] {t}")
    else:
        t = clean(m.group(3))
        if t and (t.count("|") >= 2 or len(t) < 90):
            print("    ", t)
