# -*- coding: utf-8 -*-
"""
Titleist (titleist.com) official spec scraper — drivers + irons.

titleist.com returns HTTP 403 to plain urllib/requests and renders the spec
matrix client-side, so Selenium headless Chrome is required.

Page structure (verified 2026-07):
  div.primary-specs-container
    div.primary-specs-wrapper.headers  > table.primary-specs-table  (row labels)
    div.primary-specs-wrapper.content  > table.primary-specs-table  (data grid)
  The two tables are index-aligned row by row.
    - Drivers: columns = loft options, model rows = RH/LH availability
    - Irons:   columns = club numbers, model rows = loft per club
    - Trailing label rows (Lie*, Length**) are line-wide attributes per column.
  div.compare-table -> Head Size (cc) and Loft Options per model.

Rules enforced:
  * Only titleist.com (manufacturer official domain).
  * NEVER invent a number. Anything not printed on the page stays null.
  * Every item records the source URL and the fetch date.

Output: coursedata/clubspecs/titleist_drivers.json, titleist_irons.json
"""
import json, os, re, sys, time
from datetime import date

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

BASE = "https://www.titleist.com"
OUT_DIR = os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "coursedata", "clubspecs"))
TODAY = date.today().isoformat()

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

DRIVERS = [
    "/product/gt1-driver/672C.html",
    "/product/gts2-driver/678C.html",
    "/product/gts3-driver/679C.html",
    "/product/gts4-driver/680C.html",
    "/product/gts300-mini-driver/683C.html",
]
IRONS = [
    "/product/t100/559C.html",
    "/product/t150/560C.html",
    "/product/t250/561C.html",
    "/product/t250-launch-spec/562C.html",
    "/product/t350/563C.html",
    "/product/620-cb/540C.html",
    "/product/620-mb/541C.html",
    "/product/t250%E2%80%A2u/564C.html",
    "/product/u%E2%80%A2505/565C.html",
]

# ------------------------------------------------------------------ driver
LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "titleist_run.log")
_logf = open(LOG_PATH, "w", encoding="utf-8")

def log(*a):
    s = " ".join(str(x) for x in a)
    print(s)
    _logf.write(s + "\n")
    _logf.flush()

def make_driver():
    o = Options()
    o.add_argument("--headless=new")
    o.add_argument("--window-size=1400,1000")
    o.add_argument("--user-agent=" + UA)
    o.add_argument("--disable-blink-features=AutomationControlled")
    o.add_argument("--disable-gpu")
    o.add_argument("--no-sandbox")
    o.add_argument("--log-level=3")
    o.add_experimental_option("excludeSwitches", ["enable-automation"])
    # 'eager' keeps slow third-party assets from hanging the renderer
    o.page_load_strategy = "eager"
    d = webdriver.Chrome(options=o)
    d.set_page_load_timeout(45)
    return d

# ------------------------------------------------------------------ helpers
NUM = re.compile(r"-?\d+(?:\.\d+)?")
DASH = {"-", "--", "—", "–", "", "n/a", "N/A"}

def num(v):
    """First number in a string, else None. Never fabricates a value."""
    if v is None:
        return None
    s = str(v).strip()
    if s in DASH:
        return None
    m = NUM.search(s.replace(",", ""))
    return float(m.group()) if m else None

def inches(v):
    """'45.5\"' -> 45.5 ; '35 3/4\"' -> 35.75 ; else None."""
    if not v or str(v).strip() in DASH:
        return None
    s = str(v).replace('"', " ").replace("”", " ").strip()
    m = re.match(r"^(\d+)\s+(\d+)\s*/\s*(\d+)", s)
    if m:
        w, n, dd = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return round(w + n / dd, 4) if dd else None
    return num(s)

def clean(s):
    return re.sub(r"\s+", " ", (s or "")).strip()

def attr_key(label):
    return re.sub(r"[^a-z0-9]+", "_", clean(label).replace("*", "").lower()).strip("_")

def norm(s):
    """Uppercase alphanumeric-only form, for comparing model tokens."""
    return re.sub(r"[^A-Z0-9]+", "", (s or "").upper())

def cell_texts(row):
    """textContent, not .text — spec cells can be inside horizontally
    scrolled containers that Selenium reports as empty visible text."""
    els = row.find_elements(By.CSS_SELECTOR, "th, td")
    return [clean(e.get_attribute("textContent")) for e in els]

def row_label(row):
    """(alt_name, visible_label, is_model_row)."""
    visible = clean(row.get_attribute("textContent"))
    for img in row.find_elements(By.TAG_NAME, "img"):
        alt = clean(img.get_attribute("alt"))
        if alt:
            return alt, visible, True     # model row (has product thumbnail)
    return None, visible, False

# 'Lie (GT1)*' -> key 'lie', scope 'GT1'   |   'Lie*' -> key 'lie', scope None
SCOPED = re.compile(r"^\s*(?P<key>[^(]+?)\s*\(\s*(?P<scope>[^)]+?)\s*\)\s*\**\s*$")

def split_attr_label(label):
    m = SCOPED.match(clean(label))
    if m:
        return attr_key(m.group("key")), m.group("scope")
    return attr_key(label), None

def pick_attr(attrs, key, model_alt, model_label):
    """Model-scoped attribute row wins over the line-wide row.

    The GT1 page carries both 'Lie (GT1)*' (59.0deg) and 'Lie' (58.5deg);
    attaching the line-wide value to GT1 would publish a wrong number.
    """
    scoped, generic = None, None
    for (k, scope), vals in attrs.items():
        if k != key:
            continue
        if scope is None:
            generic = vals
        elif norm(scope) and (norm(scope) == norm(model_label)
                              or norm(model_alt).startswith(norm(scope))):
            scoped = vals
    return scoped if scoped is not None else generic

# ------------------------------------------------------------------ parsing
def parse_specs(drv, url):
    """Return (rows_meta, items_raw) from every primary-specs-container."""
    out = []
    containers = drv.find_elements(By.CSS_SELECTOR, "div.primary-specs-container")
    for cont in containers:
        try:
            lab_tbl = cont.find_element(
                By.CSS_SELECTOR, "div.primary-specs-wrapper.headers table")
            dat_tbl = cont.find_element(
                By.CSS_SELECTOR, "div.primary-specs-wrapper.content table")
        except Exception:
            continue

        col_headers = []
        for tr in dat_tbl.find_elements(By.CSS_SELECTOR, "thead tr"):
            col_headers = cell_texts(tr)
        category = ""
        for tr in lab_tbl.find_elements(By.CSS_SELECTOR, "thead tr"):
            c = cell_texts(tr)
            if c:
                category = c[0]

        lab_rows = lab_tbl.find_elements(By.CSS_SELECTOR, "tbody tr")
        dat_rows = dat_tbl.find_elements(By.CSS_SELECTOR, "tbody tr")
        n = min(len(lab_rows), len(dat_rows))
        if not n or not col_headers:
            continue

        models, attrs = [], {}
        for i in range(n):
            alt, visible, is_model = row_label(lab_rows[i])
            vals = cell_texts(dat_rows[i])
            if is_model:
                models.append((alt, visible, vals))
            else:
                attrs[split_attr_label(visible)] = vals

        # footnote (explains the * on Lie / Length)
        note = ""
        try:
            fn = cont.find_element(By.XPATH,
                "./ancestor::*[contains(@class,'tab-pane')][1]//*[contains(@class,'footnote')]")
            note = clean(fn.text)
        except Exception:
            pass

        out.append({"category": category, "columns": col_headers,
                    "models": models, "attrs": attrs, "note": note})
    return out

def parse_compare(drv):
    """{model_name: {attribute: value}} from the Compare module."""
    res = {}
    for ct in drv.find_elements(By.CSS_SELECTOR, "div.compare-table"):
        name = ""
        try:
            sel = ct.find_element(By.CSS_SELECTOR, "select.compare-prod-selector")
            for opt in sel.find_elements(By.TAG_NAME, "option"):
                if opt.get_attribute("selected") is not None or opt.is_selected():
                    name = clean(opt.text)
                    break
        except Exception:
            pass
        if not name:
            continue
        d = {}
        for row in ct.find_elements(By.CSS_SELECTOR, "div.compare-row"):
            try:
                k = clean(row.find_element(
                    By.CSS_SELECTOR, ".compare-attribute-title").text)
                v = clean(row.find_element(
                    By.CSS_SELECTOR, ".compare-attribute-value").text)
            except Exception:
                continue
            if k:
                d[attr_key(k)] = v
        if d:
            res[name] = d
    return res

LOFT_COL = re.compile(r"^\d+(\.\d+)?\s*°$")

def build_items(blocks, compare, url, category):
    items = []
    for b in blocks:
        cols = b["columns"]
        col_is_loft = bool(cols) and all(LOFT_COL.match(c) for c in cols if c)

        for alt, visible, vals in b["models"]:
            model = alt or visible
            cmp_d = compare.get(model, {})
            lie_row = pick_attr(b["attrs"], "lie", alt, visible)
            len_row = pick_attr(b["attrs"], "length", alt, visible)

            for j, col in enumerate(cols):
                v = vals[j] if j < len(vals) else ""
                if clean(v) in DASH:
                    continue                      # not offered — emit nothing
                lie_v = clean(lie_row[j]) if lie_row and j < len(lie_row) else None
                len_v = clean(len_row[j]) if len_row and j < len(len_row) else None

                rec = {"model": model, "model_label": visible,
                       "source": url, "fetched": TODAY}
                if col_is_loft:                   # driver-style grid
                    rec["loft_deg"] = num(col)
                    rec["loft_raw"] = col
                    rec["hand_availability"] = clean(v)
                else:                             # iron-style grid
                    rec["club"] = clean(col)
                    rec["loft_deg"] = num(v)
                    rec["loft_raw"] = clean(v)
                rec["lie_deg"] = num(lie_v)
                rec["lie_raw"] = lie_v if lie_v not in DASH else None
                rec["length_in"] = inches(len_v)
                rec["length_raw"] = len_v if len_v not in DASH else None
                rec["head_size_cc"] = num(cmp_d.get("head_size"))
                rec["head_size_raw"] = cmp_d.get("head_size")
                rec["loft_options_raw"] = cmp_d.get("loft_options")
                # any further attribute rows the page carries for this model
                for (k, scope), arr in b["attrs"].items():
                    if k in ("lie", "length"):
                        continue
                    if scope and not (norm(scope) == norm(visible)
                                      or norm(alt).startswith(norm(scope))):
                        continue
                    if j < len(arr) and clean(arr[j]) not in DASH:
                        rec["attr_" + k] = clean(arr[j])
                rec["spec_note"] = b["note"] or None
                items.append({k: v2 for k, v2 in rec.items() if v2 is not None})
    return items

# ------------------------------------------------------------------ run
def load(drv, url, tries=2):
    """Navigate resiliently: some PDPs never fire 'load', so stop and parse."""
    for a in range(tries):
        try:
            drv.get(url)
        except TimeoutException:
            try:
                drv.execute_script("window.stop();")
            except Exception:
                pass
        try:
            WebDriverWait(drv, 30).until(EC.presence_of_element_located(
                (By.CSS_SELECTOR, "div.primary-specs-container")))
            time.sleep(2.5)
            return True
        except TimeoutException:
            if a + 1 < tries:
                time.sleep(3)
    return False

def run(drv, paths, category, outfile):
    products, items, fails = [], [], []
    for p in paths:
        url = BASE + p
        try:
            if not load(drv, url):
                fails.append({"url": url, "reason": "no primary-specs-container rendered"})
                log(f"  MISS {url} (no spec matrix)")
                continue
            h1 = None
            els = drv.find_elements(By.TAG_NAME, "h1")
            if els:
                h1 = clean(els[0].get_attribute("textContent"))
            blocks = parse_specs(drv, url)
            compare = parse_compare(drv)
            got = build_items(blocks, compare, url, category)
            items.extend(got)
            products.append({"page_title": h1, "url": url,
                             "models_on_page": sorted({(a or v) for b in blocks
                                                       for a, v, _ in b["models"]}),
                             "compare": compare})
            log(f"  ok  {str(h1):<26} blocks={len(blocks)} items={len(got):<4} "
                f"compare={len(compare)}")
        except Exception as e:
            fails.append({"url": url, "reason": f"{type(e).__name__}: {str(e)[:160]}"})
            log(f"  ERR {url} :: {type(e).__name__}: {str(e)[:120]}")
        time.sleep(1.0)

    # The same spec matrix repeats across pages of one line. Merge duplicates
    # field-wise (a model's own page carries head size; sibling pages do not)
    # instead of first-wins, so no collected value is thrown away.
    merged = {}
    order = []
    for it in items:
        k = (norm(it.get("model")), it.get("club"), it.get("loft_raw"),
             it.get("hand_availability"))
        if k not in merged:
            merged[k] = dict(it)
            merged[k]["sources"] = [it["source"]]
            order.append(k)
        else:
            tgt = merged[k]
            for f, v in it.items():
                if f == "source":
                    continue
                if tgt.get(f) in (None, "") and v not in (None, ""):
                    tgt[f] = v
            if it["source"] not in tgt["sources"]:
                tgt["sources"].append(it["source"])
    uniq = [merged[k] for k in order]

    doc = {
        "source": BASE + ("/golf-clubs/golf-drivers/" if category == "driver"
                          else "/golf-clubs/irons/"),
        "fetched": TODAY,
        "brand": "Titleist",
        "category": category,
        "note": ("Transcribed verbatim from Titleist official product pages "
                 "(Selenium-rendered). Lie/Length come from the line-wide rows of "
                 "the same spec matrix. Fields not printed on the page are omitted, "
                 "never estimated. Duplicates removed across pages sharing one matrix."),
        "pages_visited": [p["url"] for p in products],
        "failed_pages": fails,
        "product_count": len(products),
        "item_count": len(uniq),
        "products": products,
        "items": uniq,
    }
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, outfile)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    log(f"-> {path}  pages={len(products)} items={len(uniq)} fail={len(fails)}")

    # field-fill report, so coverage is auditable
    fields = ("loft_deg", "lie_deg", "length_in", "head_size_cc",
              "hand_availability", "club")
    log("   filled: " + ", ".join(
        f"{f}={sum(1 for i in uniq if i.get(f) is not None)}/{len(uniq)}"
        for f in fields))
    return doc

if __name__ == "__main__":
    drv = make_driver()
    try:
        log("== Titleist drivers ==")
        run(drv, DRIVERS, "driver", "titleist_drivers.json")
        log("== Titleist irons ==")
        run(drv, IRONS, "iron", "titleist_irons.json")
    finally:
        drv.quit()
        _logf.close()
