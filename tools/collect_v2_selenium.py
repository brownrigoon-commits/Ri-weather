# -*- coding: utf-8 -*-
"""수집기 v2: 크롬(Selenium) 렌더링 기반 — JS 사이트(SPA) 대응
1차 수집(collect_course_homepages.py)이 실패한 구장 대상:
  - 헤드리스 크롬으로 홈페이지를 실제 렌더링한 뒤 DOM에서 코스 링크 탐색
  - 코스 관련 페이지 최대 12개 방문, 렌더링된 HTML 저장
  - <img>와 CSS background-image에서 홀맵 후보 이미지 다운로드
출력: coursedata/homepages_auto/<클럽>/pages_v2/*.html, img/ (기존 폴더에 추가), meta_v2.json
진행 저장: coursedata/workfiles/collect_v2_progress.json (중단 후 재실행 시 이어하기)

사용: python tools/collect_v2_selenium.py [--limit N] [--only 이름,이름]
"""
import argparse, json, os, re, sys, time, urllib.parse, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "coursedata", "homepages_auto")
PROG = os.path.join(ROOT, "coursedata", "workfiles", "collect_v2_progress.json")
SURVEY = os.path.join(ROOT, "coursedata", "workfiles", "registrable_survey.json")

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

LINK_KW = re.compile(r"(course|cos|hole|yardage|layout|guide|코스|홀|공략|야디지|안내)", re.I)
IMG_KW = re.compile(r"(hole|course|cos|yardage|map|layout|green|min[ei]map)", re.I)
SKIP_IMG = re.compile(r"(logo|banner|btn|button|icon|ico_|bg_top|sns|kakao|insta|facebook|blog|quick|arrow|bullet|popup|visual|main_)", re.I)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"

def make_driver():
    o = Options()
    o.add_argument("--headless=new")
    o.add_argument("--window-size=1400,1000")
    o.add_argument("--disable-gpu")
    o.add_argument("--log-level=3")
    o.add_argument(f"--user-agent={UA}")
    o.add_argument("--disable-blink-features=AutomationControlled")
    d = webdriver.Chrome(options=o)
    d.set_page_load_timeout(35)
    return d

def dl_image(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = r.read(4_000_000)
    if len(data) > 4000:
        open(path, "wb").write(data)
        return True
    return False

def collect_club(driver, name, seed):
    cdir = os.path.join(BASE, name)
    pdir = os.path.join(cdir, "pages_v2")
    idir = os.path.join(cdir, "img")
    os.makedirs(pdir, exist_ok=True)
    os.makedirs(idir, exist_ok=True)
    meta = {"seed": seed, "pages": {}, "images": {}, "errors": []}
    visited = set()
    queue = [seed]
    n_pages = n_imgs = 0
    host = urllib.parse.urlparse(seed).netloc
    while queue and n_pages < 12:
        url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)
        try:
            driver.get(url)
            time.sleep(3.5)          # 렌더링 대기
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight)")
            time.sleep(1.0)          # 지연 로딩 대응
            html = driver.page_source
        except Exception as e:
            meta["errors"].append(f"{url}: {str(e)[:60]}")
            continue
        fn = f"p{n_pages}.html"
        open(os.path.join(pdir, fn), "w", encoding="utf-8").write(html)
        meta["pages"][fn] = url
        n_pages += 1
        # 렌더링된 DOM에서 링크 수집: a[href] + onclick 이동 + iframe 내부까지
        try:
            links = driver.execute_script("""
                const out = new Set();
                const harvest = (doc, baseHref) => {
                    doc.querySelectorAll('a[href]').forEach(a => { try { out.add(new URL(a.getAttribute('href'), baseHref).href); } catch(e){} });
                    doc.querySelectorAll('[onclick]').forEach(el => {
                        const m = el.getAttribute('onclick').match(/['"]([^'"]+\\.(?:asp|php|html?|do|jsp)[^'"]*)['"]/);
                        if (m) { try { out.add(new URL(m[1], baseHref).href); } catch(e){} }
                    });
                    doc.querySelectorAll('frame[src], iframe[src]').forEach(f => {
                        try { out.add(new URL(f.getAttribute('src'), baseHref).href); } catch(e){}
                        try { if (f.contentDocument) harvest(f.contentDocument, f.src); } catch(e){}
                    });
                };
                harvest(document, location.href);
                return [...out];
            """)
        except Exception:
            links = []
        # 첫 페이지에서 코스 링크를 하나도 못 찾으면 흔한 경로 추측 시도
        if n_pages == 1 and not any(LINK_KW.search(l) for l in links):
            for guess in ("course", "course/course.asp", "golf/course", "sub/course",
                          "course_info", "club/course", "kor/course", "course01"):
                queue.append(urllib.parse.urljoin(seed if seed.endswith("/") else seed + "/", guess))
        for l in links:
            try:
                p = urllib.parse.urlparse(l)
            except Exception:
                continue
            if p.netloc == host and LINK_KW.search(l) and l not in visited and len(queue) < 30:
                queue.append(l.split("#")[0])
        # 이미지: <img> + background-image
        try:
            srcs = driver.execute_script("""
                const out = new Set();
                document.querySelectorAll('img[src]').forEach(i => out.add(i.src));
                document.querySelectorAll('*').forEach(el => {
                    const b = getComputedStyle(el).backgroundImage;
                    const m = b && b.match(/url\\(["']?([^"')]+)/);
                    if (m) out.add(new URL(m[1], location.href).href);
                });
                return [...out];
            """)
        except Exception:
            srcs = []
        for s in srcs:
            base = os.path.basename(urllib.parse.urlparse(s).path)
            if not base or SKIP_IMG.search(s) or not IMG_KW.search(s):
                continue
            if not re.search(r"\.(jpg|jpeg|png|gif|webp)$", base, re.I):
                continue
            path = os.path.join(idir, base)
            if os.path.exists(path) and os.path.getsize(path) > 4000:
                meta["images"][base] = s
                continue
            try:
                if dl_image(s, path):
                    meta["images"][base] = s
                    n_imgs += 1
            except Exception:
                pass
    json.dump(meta, open(os.path.join(cdir, "meta_v2.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    return n_pages, n_imgs

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only", type=str, default="")
    args = ap.parse_args()
    survey = json.load(open(SURVEY, encoding="utf-8"))
    targets = [r["club"] for r in survey if r["grade"] in ("-", "C")]
    if args.only:
        keys = [k.strip() for k in args.only.split(",")]
        targets = [t for t in targets if any(k in t for k in keys)]
    prog = json.load(open(PROG, encoding="utf-8")) if os.path.exists(PROG) else {}
    if args.limit:
        targets = [t for t in targets if t not in prog][:args.limit]
    print(f"대상: {len(targets)}개 (완료 {len(prog)}개 제외 후 진행)")
    driver = make_driver()
    done = 0
    for name in targets:
        if name in prog:
            continue
        meta_f = os.path.join(BASE, name, "meta.json")
        if not os.path.exists(meta_f):
            prog[name] = {"skip": "meta 없음"}
            continue
        seed = json.load(open(meta_f, encoding="utf-8")).get("seed")
        if not seed:
            prog[name] = {"skip": "seed 없음"}
            continue
        try:
            np, ni = collect_club(driver, name, seed)
            prog[name] = {"pages": np, "imgs": ni}
            print(f"[{done+1}] {name}: 페이지 {np}, 이미지 {ni}", flush=True)
        except Exception as e:
            prog[name] = {"error": str(e)[:80]}
            print(f"[{done+1}] {name}: 실패 {str(e)[:60]}", flush=True)
            try:
                driver.quit()
            except Exception:
                pass
            driver = make_driver()
        done += 1
        json.dump(prog, open(PROG, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    driver.quit()
    ok = sum(1 for v in prog.values() if v.get("imgs", 0) > 0)
    print(f"완료: {done}개 처리, 이미지 확보 {ok}개 구장")

if __name__ == "__main__":
    main()
