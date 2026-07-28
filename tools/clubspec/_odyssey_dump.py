# -*- coding: utf-8 -*-
"""오디세이 제품 상세 페이지 구조 조사."""
import sys, io, re, time, html as H
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
URL = sys.argv[1] if len(sys.argv) > 1 else \
    "https://odyssey.callawaygolf.com/putters/putters-2026-ai-dual-7-db.html"
TAG = sys.argv[2] if len(sys.argv) > 2 else "prod"


def make_driver():
    o = Options()
    o.add_argument("--headless=new")
    o.add_argument("--window-size=1400,1000")
    o.add_argument(f"--user-agent={UA}")
    o.add_argument("--disable-gpu")
    o.add_argument("--no-sandbox")
    o.add_argument("--disable-blink-features=AutomationControlled")
    o.add_experimental_option("excludeSwitches", ["enable-automation"])
    d = webdriver.Chrome(options=o)
    d.set_page_load_timeout(90)
    return d


d = make_driver()
try:
    d.get(URL)
    time.sleep(5)
    for _ in range(12):
        d.execute_script("window.scrollBy(0, 800);")
        time.sleep(0.6)
    # "Specs" 탭/아코디언이 있으면 열어본다
    for kw in ("spec", "Spec", "SPEC"):
        try:
            els = d.find_elements("xpath", f"//*[contains(text(),'{kw}')]")
            for e in els[:6]:
                try:
                    d.execute_script("arguments[0].click();", e)
                    time.sleep(0.8)
                except Exception:
                    pass
        except Exception:
            pass
    time.sleep(2)
    doc = d.page_source
    print("final:", d.current_url, "len:", len(doc))
finally:
    d.quit()

p = rf"C:/Users/PC/AppData/Local/Temp/claude/odyssey_{TAG}.html"
open(p, "w", encoding="utf-8").write(doc)
print("saved:", p)


def txt(s):
    s = re.sub(r"<(script|style)\b.*?</\1>", " ", s, flags=re.S | re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", H.unescape(s)).strip()


tables = re.findall(r"<table\b.*?</table>", doc, re.S | re.I)
print(f"\n[tables] {len(tables)}")
for i, t in enumerate(tables[:8]):
    print(f"--- table {i}: {txt(t)[:400]}")

# 스펙 키워드 주변 텍스트
body = txt(doc)
for kw in ("Loft", "Lie", "Length", "Head Weight", "Head Shape", "Toe Hang", "Offset", "Grip"):
    for m in re.finditer(rf"\b{kw}\b", body):
        print(f"[{kw}] ...{body[max(0,m.start()-80):m.start()+160]}...")
        break

print("\n[json-ld blocks]")
for m in re.finditer(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', doc, re.S | re.I):
    print("  ", m.group(1)[:500].replace("\n", " "))
