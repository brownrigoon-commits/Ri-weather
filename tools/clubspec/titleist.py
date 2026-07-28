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

# Model names carry '•' (T250*U, U*505). On a cp949 console the log line
# raises UnicodeEncodeError *after* the page was parsed, which used to record a
# perfectly good page as a failure. Force UTF-8 so logging never masks a success.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

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
    "/product/t250-black-vapor/561BC.html",
    # The Black Vapor matrix is shared across four PDPs. Visiting each of them
    # is what lets every Black Vapor row be named from its *own* page title
    # instead of from a sibling page's thumbnail alt text.
    "/product/t100-black-vapor/559BC.html",
    "/product/t150-black-vapor/560BC.html",
    "/product/t350-black-vapor/563BC.html",
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
    try:
        print(s)
    except UnicodeEncodeError:
        # console codepage can't show the glyph; the file copy still gets it
        print(s.encode("ascii", "replace").decode("ascii"))
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

PID_RE = re.compile(r"/product/[^/]+/([0-9A-Za-z]+)\.html")

def page_pid(url):
    m = PID_RE.search(url)
    return m.group(1) if m else url

def row_pid(row, url):
    """Product id this matrix row belongs to.

    Every model row either links to its own PDP or *is* the page's own product
    (the active row carries no link). The id in that link is Titleist's own
    product key, so it identifies a row far more reliably than the thumbnail
    alt text — which on the T-Series pages is simply wrong: the plain T250 row
    (/product/t250/561C.html) is tagged alt="T-Series T250 Star Irons", the
    name that belongs to the T250 Launch Spec sitting one row below it.
    """
    for a in row.find_elements(By.TAG_NAME, "a"):
        href = a.get_attribute("href") or ""
        m = PID_RE.search(href)
        if m:
            return m.group(1), href
    return page_pid(url), url

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
                pid, href = row_pid(lab_rows[i], url)
                models.append((alt, visible, vals, pid, href))
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

# Legacy pages (620 CB / 620 MB) predate the split header/content widget and
# render one plain table instead: first column holds the row label, the header
# row holds the club numbers. Same logical grid, different DOM.
FREEFORM_SEL = "div[class*='m-product-specifications__free-form'] table"
ATTR_LABELS = {"lie", "length"}

def parse_freeform(drv, url):
    """Return blocks in the same shape as parse_specs, from legacy tables."""
    out = []
    pid = page_pid(url)
    for t in drv.find_elements(By.CSS_SELECTOR, FREEFORM_SEL):
        rows = t.find_elements(By.CSS_SELECTOR, "tr")
        if len(rows) < 3:
            continue
        head = cell_texts(rows[0])
        cols = head[1:] if head else []      # head[0] is the empty corner cell
        if not cols or not any(cols):
            continue
        models, attrs = [], {}
        for r in rows[1:]:
            cells = cell_texts(r)
            if len(cells) < 2:
                continue
            label, vals = cells[0], cells[1:]
            key, scope = split_attr_label(label)
            if key in ATTR_LABELS:
                attrs[(key, scope)] = vals
            else:
                models.append((None, label, vals, pid, url))
        if models:
            out.append({"category": "", "columns": cols, "models": models,
                        "attrs": attrs, "note": ""})
    return out

LOFT_COL = re.compile(r"^\d+(\.\d+)?\s*°$")
CC_RE = re.compile(r"(\d{3})\s?cc", re.I)

def body_head_size(drv):
    """('305cc', "<sentence it appears in>") if the page copy states exactly
    one head volume, else None. Ambiguity is never resolved by guessing."""
    try:
        text = clean(drv.find_element(By.TAG_NAME, "body").get_attribute("innerText"))
    except Exception:
        return None
    found = CC_RE.findall(text)
    if not found or len(set(found)) != 1:
        return None
    m = CC_RE.search(text)
    lo = max(0, m.start() - 120)
    return m.group(0).replace(" ", ""), clean(text[lo:m.end() + 60])

def build_items(blocks, compare, url, category, body_cc=None):
    items = []
    this_pid = page_pid(url)
    for b in blocks:
        cols = b["columns"]
        col_is_loft = bool(cols) and all(LOFT_COL.match(c) for c in cols if c)

        for alt, visible, vals, pid, href in b["models"]:
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

                rec = {"model": model, "model_alt": alt, "model_label": visible,
                       "product_id": pid, "product_url": href or url,
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
                if cmp_d.get("head_size"):
                    rec["head_size_cc"] = num(cmp_d.get("head_size"))
                    rec["head_size_raw"] = cmp_d.get("head_size")
                    rec["head_size_from"] = "compare-module"
                elif pid == this_pid and body_cc:
                    # Some PDPs (the mini drivers) carry no Compare module, yet
                    # print the head volume in the product copy. That is still
                    # the manufacturer stating the number, so take it verbatim
                    # and record the sentence it came from — only for this
                    # page's own product, and only when the page names exactly
                    # one volume, so a sibling model's figure can never leak in.
                    raw, evidence = body_cc
                    rec["head_size_cc"] = num(raw)
                    rec["head_size_raw"] = raw
                    rec["head_size_from"] = "product-page-copy"
                    rec["head_size_evidence"] = evidence
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
                (By.CSS_SELECTOR, "div.primary-specs-container, " + FREEFORM_SEL)))
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
            layout = "primary"
            if not blocks:
                # Legacy layout. Its table is a cross-model comparison whose other
                # rows (T100/T150/T250) are already collected from their own pages
                # under canonical names, so keep only this page's own product row —
                # otherwise the same iron lands twice under two different names.
                layout = "free-form"
                blocks = parse_freeform(drv, url)
                for b in blocks:
                    b["models"] = [m for m in b["models"] if norm(m[1]) == norm(h1)]
                blocks = [b for b in blocks if b["models"]]
            compare = parse_compare(drv)
            got = build_items(blocks, compare, url, category, body_head_size(drv))
            items.extend(got)
            products.append({"page_title": h1, "url": url,
                             "product_id": page_pid(url),
                             "models_on_page": sorted({(a or v) for b in blocks
                                                       for a, v, _, _, _ in b["models"]}),
                             "compare": compare})
            log(f"  ok  {str(h1):<26} blocks={len(blocks)} items={len(got):<4} "
                f"compare={len(compare)} layout={layout}")
        except Exception as e:
            fails.append({"url": url, "reason": f"{type(e).__name__}: {str(e)[:160]}"})
            log(f"  ERR {url} :: {type(e).__name__}: {str(e)[:120]}")
        time.sleep(1.0)

    # The same spec matrix repeats across pages of one line. Merge duplicates
    # field-wise (a model's own page carries head size; sibling pages do not)
    # instead of first-wins, so no collected value is thrown away.
    # Keyed on Titleist's product id, not on the display name: two rows are the
    # same club only if they are the same product, whatever the page called it.
    merged = {}
    order = []
    for it in items:
        k = (it.get("product_id"), it.get("club"), it.get("loft_raw"),
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

    # Name each product from its own page's <h1>. The matrix thumbnails are
    # unreliable (the T250 row is tagged "T-Series T250 Star Irons", which is
    # the Launch Spec's name), so the alt text only survives as a fallback for
    # products whose PDP is not in this run, and is always kept as model_alt.
    pid2title = {p["product_id"]: p["page_title"] for p in products if p["page_title"]}
    renamed = 0
    for it in uniq:
        title = pid2title.get(it.get("product_id"))
        if title and title != it.get("model"):
            it["model"] = title
            renamed += 1
        it["model_name_from"] = "product-page-title" if title else "spec-matrix-thumbnail-alt"
    log(f"   named from own PDP title: {sum(1 for i in uniq if i['model_name_from'] == 'product-page-title')}/{len(uniq)}"
        f" (renamed {renamed})")

    doc = {
        "source": BASE + ("/golf-clubs/golf-drivers/" if category == "driver"
                          else "/golf-clubs/irons/"),
        "fetched": TODAY,
        "brand": "Titleist",
        "category": category,
        "note": ("Transcribed verbatim from Titleist official product pages "
                 "(Selenium-rendered). Lie/Length come from the line-wide rows of "
                 "the same spec matrix. Fields not printed on the page are omitted, "
                 "never estimated. Rows are keyed on Titleist's own product id and "
                 "de-duplicated across the pages that share one matrix. 'model' is "
                 "the product page's own <h1>; 'model_alt' keeps the spec-matrix "
                 "thumbnail alt text, which Titleist mislabels on the T-Series "
                 "pages. head_size_from says whether a volume came from the Compare "
                 "module or from the product copy (with the sentence quoted)."),
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
