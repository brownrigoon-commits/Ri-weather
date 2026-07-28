# -*- coding: utf-8 -*-
"""셀레늄 헤드리스 크롬으로 페이지 HTML 저장 (403 우회용).
사용: python _sel_fetch_b.py <출력디렉토리> <URL> [URL...]
"""
import sys, io, os, time, hashlib
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def make_driver():
    o = Options()
    o.add_argument("--headless=new")
    o.add_argument("--window-size=1400,1000")
    o.add_argument(f"--user-agent={UA}")
    o.add_argument("--disable-gpu")
    o.add_argument("--no-sandbox")
    o.add_argument("--disable-blink-features=AutomationControlled")
    o.add_argument("--lang=en-US")
    o.add_experimental_option("excludeSwitches", ["enable-automation"])
    o.add_experimental_option("useAutomationExtension", False)
    d = webdriver.Chrome(options=o)
    d.set_page_load_timeout(60)
    return d


def slug(url):
    h = hashlib.md5(url.encode()).hexdigest()[:8]
    base = url.split("//")[-1].replace("/", "_").replace("?", "_").replace(":", "_")
    return (base[:70] + "_" + h + ".html")


def main():
    outdir = sys.argv[1]
    urls = sys.argv[2:]
    os.makedirs(outdir, exist_ok=True)
    d = make_driver()
    try:
        for u in urls:
            try:
                d.get(u)
                time.sleep(4.0)
                # 지연 로딩 대비 스크롤
                for _ in range(4):
                    d.execute_script("window.scrollBy(0, document.body.scrollHeight/4);")
                    time.sleep(0.8)
                time.sleep(1.5)
                html = d.page_source
                p = os.path.join(outdir, slug(u))
                with open(p, "w", encoding="utf-8") as f:
                    f.write(html)
                print(f"[OK] len={len(html):>8} tables={html.count('<table')} {u}")
                print(f"     -> {p}")
                print(f"     final={d.current_url}")
            except Exception as e:
                print(f"[ERR] {u} :: {type(e).__name__}: {e}")
    finally:
        d.quit()


if __name__ == "__main__":
    main()
