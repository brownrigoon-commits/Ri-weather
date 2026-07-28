# -*- coding: utf-8 -*-
"""grip-specifications 페이지 본문 + 제품페이지 API 흔적 조사."""
import sys, io, re, json, html as H
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# --- 1) 스펙 페이지 본문 ---
doc = open(r"C:/Users/PC/AppData/Local/Temp/claude/gp_specpage.html", encoding="utf-8").read()

# \n 이스케이프된 <p> 덩어리를 복원
u = doc.replace("\\n", "\n").replace("\\u003c", "<").replace("\\u003e", ">")
u = H.unescape(u)

paras = re.findall(r"<p>(.*?)</p>", u, re.S)
print(f"[spec page] <p> count = {len(paras)}")


def clean(s):
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("\xa0", " ").replace("&nbsp;", " ")
    return re.sub(r"\s+", " ", s).strip()


lines = [clean(p) for p in paras]
lines = [l for l in lines if l]
pipe = [l for l in lines if l.count("|") >= 2]
print(f"[pipe lines] {len(pipe)}")
for l in pipe[:400]:
    print("   ", l)

print("\n\n=== 2) 제품 페이지 API 흔적 ===")
prod = open(r"C:/Users/PC/AppData/Local/Temp/claude/gp_mcc.html", encoding="utf-8").read()
for pat in [r'"[^"]*[Ee]ndpoint[^"]*"\s*:\s*"([^"]+)"',
            r'data-[a-z-]*url="([^"]+)"',
            r'"(/[a-z0-9/_.-]*(?:api|product|sku|variant)[a-z0-9/_.-]*)"']:
    hits = sorted(set(re.findall(pat, prod, re.I)))
    print(f"\n-- {pat}  ({len(hits)})")
    for h in hits[:40]:
        print("    ", h)

print("\n-- weight-ish numbers in product page")
for m in list(re.finditer(r'"?(?:weight|grams?)"?\s*[:=]\s*"?([0-9.]+)', prod, re.I))[:20]:
    print("    ", prod[max(0, m.start() - 120):m.end() + 60].replace("\n", " "))
