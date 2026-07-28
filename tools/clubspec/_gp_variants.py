# -*- coding: utf-8 -*-
"""골프프라이드 제품 페이지의 variants JSON 구조 확인."""
import sys, io, re, json, html as H
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

p = r"C:/Users/PC/AppData/Local/Temp/claude/gp_mcc.html"
doc = open(p, encoding="utf-8").read()

i = doc.find('"variants"')
print("variants idx:", i)
print("---- raw context (2500 chars) ----")
print(H.unescape(doc[max(0, i - 1200): i + 2500]))
