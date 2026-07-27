# -*- coding: utf-8 -*-
"""클럽 스펙 수집기 — 제조사 공식 페이지에서 스펙표를 받아온다.

    python tools/collect_club_specs.py --list                 대상 목록 보기
    python tools/collect_club_specs.py --only fujikura        한 곳만
    python tools/collect_club_specs.py --all --write          전부 수집 후 저장

⚠️ 이 스크립트는 **사장님 PC에서 돌려야 합니다.**
   클라우드 세션은 외부 사이트 접속이 막혀 있어(프록시 403) 제조사 페이지를 못 받습니다.
   집·회사 PC 는 제한이 없으니 여기서 받아 저장소에 올려주시면 제가 이어서 정리합니다.

수집 결과는 coursedata/clubspecs/<카테고리>.json 에 **원문 그대로** 저장합니다.
가공은 build_clubdb.py 가 따로 합니다 — 원문을 남겨야 나중에 판단이 바뀌어도 다시 안 받습니다.

절대 원칙 2(틀릴 수 있으면 표시하지 않음)에 따라
  · 숫자를 못 읽은 항목은 비워 둡니다. 추정해서 채우지 않습니다.
  · 각 항목에 출처 URL 과 받은 날짜를 함께 남깁니다.
"""
import argparse, json, os, re, sys, time
from datetime import date

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "coursedata", "clubspecs")

# 수집 대상 — 공식 스펙표가 있는 곳만 넣는다. 리뷰 사이트는 숫자가 틀린 경우가 많다.
TARGETS = [
    # (키, 분류, 브랜드, URL, 비고)
    ("fujikura",   "driver_shaft", "후지쿠라",        "https://fujikuragolf.com/shaft-specs/", "우드 샤프트 전 모델 스펙표"),
    ("graphitedesign", "driver_shaft", "그라파이트디자인", "https://www.graphitedesign.com/collections/tour-ad", ""),
    ("mitsubishi", "driver_shaft", "미쓰비시",        "https://www.mitsubishichemical-golf.com/shafts/", ""),
    ("projectx",   "driver_shaft", "프로젝트X",       "https://www.projectxgolf.com/shafts/", ""),
    ("ustmamiya",  "driver_shaft", "UST마미야",       "https://www.ustmamiya.com/collections/wood-shafts", ""),
    ("nippon",     "iron_shaft",   "니폰",            "https://www.nssgolf.com/product/", "N.S.PRO 시리즈"),
    ("truetemper", "iron_shaft",   "트루템퍼",        "https://www.truetempersports.com/golf-shafts/", "다이나믹골드 계열"),
    ("kbs",        "iron_shaft",   "KBS",             "https://kbsgolfshafts.com/collections/iron-shafts", ""),
    ("titleist",   "head",         "타이틀리스트",    "https://www.titleist.com/golf-clubs/", ""),
    ("ping",       "head",         "핑",              "https://ping.com/en-us/clubs", ""),
    ("taylormade", "head",         "테일러메이드",    "https://www.taylormadegolf.com/clubs/", ""),
    ("callaway",   "head",         "캘러웨이",        "https://www.callawaygolf.com/golf-clubs/", ""),
    ("mizuno",     "head",         "미즈노",          "https://mizunogolf.com/us/clubs/", ""),
    ("cleveland",  "wedge",        "클리브랜드",      "https://www.clevelandgolf.com/wedges/", ""),
    ("scotty",     "putter",       "스카티카메론",    "https://www.scottycameron.com/putters/", ""),
    ("odyssey",    "putter",       "오디세이",        "https://www.odysseygolf.com/putters/", ""),
    ("golfpride",  "grip",         "골프프라이드",    "https://www.golfpride.com/grips/", "사이즈·무게 표"),
]


def fetch(url, timeout=30):
    """공식 페이지 받기 — 정적 페이지는 requests, 자바스크립트로 그리는 곳은 selenium."""
    import requests
    ua = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
          "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
    r = requests.get(url, headers={"User-Agent": ua, "Accept-Language": "en-US,en;q=0.9"},
                     timeout=timeout)
    r.raise_for_status()
    html = r.text
    # 스펙표가 비어 있으면 자바스크립트로 그리는 페이지 — 크롬으로 다시 받는다
    if html.count("<table") == 0 and ("spec" in url.lower() or "shaft" in url.lower()):
        html = fetch_rendered(url)
    return html


def fetch_rendered(url, wait=4):
    """SPA 대응 — 기존 collect_v2_selenium.py 와 같은 방식."""
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    o = Options()
    o.add_argument("--headless=new")
    o.add_argument("--disable-gpu")
    o.add_argument("--window-size=1400,2400")
    d = webdriver.Chrome(options=o)
    try:
        d.get(url)
        time.sleep(wait)
        return d.page_source
    finally:
        d.quit()


def tables(html):
    """<table> 을 2차원 배열로. 스펙은 거의 항상 표로 되어 있다."""
    out = []
    for t in re.findall(r"<table[^>]*>(.*?)</table>", html, re.S | re.I):
        rows = []
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", t, re.S | re.I):
            cells = re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", tr, re.S | re.I)
            cells = [re.sub(r"<[^>]+>", " ", c) for c in cells]
            cells = [re.sub(r"\s+", " ", c).replace("&nbsp;", " ").strip() for c in cells]
            if any(cells):
                rows.append(cells)
        if len(rows) >= 2:
            out.append(rows)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--only")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()

    if a.list or not (a.only or a.all):
        print("수집 대상\n")
        for k, cat, brand, url, note in TARGETS:
            print(f"  {k:14s} {cat:13s} {brand:12s} {note}")
            print(f"  {'':14s} {url}")
        print("\n  python tools/collect_club_specs.py --all --write")
        return

    os.makedirs(OUT, exist_ok=True)
    todo = [t for t in TARGETS if not a.only or t[0] == a.only]
    ok = fail = 0
    for k, cat, brand, url, note in todo:
        try:
            html = fetch(url)
            tb = tables(html)
            rec = {"key": k, "category": cat, "brand": brand, "source": url,
                   "fetched": date.today().isoformat(),
                   "tables": tb, "table_count": len(tb)}
            print(f"✔ {k:14s} 표 {len(tb)}개 · 행 {sum(len(t) for t in tb)}")
            if a.write:
                with open(os.path.join(OUT, k + ".json"), "w", encoding="utf-8") as f:
                    json.dump(rec, f, ensure_ascii=False, indent=1)
            ok += 1
        except Exception as e:
            print(f"✘ {k:14s} {type(e).__name__}: {str(e)[:120]}")
            fail += 1
    print(f"\n성공 {ok} · 실패 {fail}")
    if a.write:
        print(f"저장 위치: {OUT}")
        print("→ python tools/sync.py \"클럽 스펙 원문 수집\" 로 올려주세요.")


if __name__ == "__main__":
    main()
