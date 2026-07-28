# -*- coding: utf-8 -*-
"""
Shared helpers for iron-shaft spec collection (Nippon / True Temper / KBS).

Rules enforced here:
  * Never fabricate a value. If a cell is absent or unparseable as a number,
    the numeric field is None and the original text is preserved verbatim.
  * Every parsed row keeps its raw header->text mapping for auditability.
"""
import re, gzip, json, time, urllib.request, urllib.error, html as htmllib

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")


def fetch(url, timeout=45, retries=3):
    """GET a URL, return decoded HTML text. Raises on final failure."""
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": UA,
                "Accept": "text/html,application/xhtml+xml,application/json,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9,ja;q=0.8",
            })
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
            m = re.search(rb'charset=["\']?([\w-]+)', raw[:2000], re.I)
            enc = m.group(1).decode("ascii", "ignore") if m else "utf-8"
            try:
                return raw.decode(enc, "replace")
            except LookupError:
                return raw.decode("utf-8", "replace")
        except Exception as e:                      # noqa: BLE001
            last = e
            time.sleep(1.2 * (attempt + 1))
    raise last


def clean(frag):
    """HTML fragment -> plain text (<br> becomes a space)."""
    frag = re.sub(r'(?i)<br\s*/?>', ' ', frag)
    frag = re.sub(r'(?i)<(script|style)[^>]*>.*?</\1>', ' ', frag, flags=re.S)
    frag = re.sub(r'<[^>]+>', '', frag)
    return re.sub(r'\s+', ' ', htmllib.unescape(frag)).strip()


def page_title(html_text):
    m = re.search(r'<h1[^>]*>(.*?)</h1>', html_text, re.S | re.I)
    if m and clean(m.group(1)):
        return clean(m.group(1))
    m = re.search(r'<title[^>]*>(.*?)</title>', html_text, re.S | re.I)
    return clean(m.group(1)).split("|")[0].split("–")[0].strip() if m else ""


def _grid(section_html):
    """Expand a <tr> collection into a rectangular grid, honouring rowspan/colspan."""
    rows_html = re.findall(r'<tr[^>]*>(.*?)</tr>', section_html, re.S | re.I)
    occupied, maxc = {}, 0
    for r, rh in enumerate(rows_html):
        c = 0
        for tag, attrs, inner in re.findall(r'<(t[hd])([^>]*)>(.*?)</\1>', rh, re.S | re.I):
            while (r, c) in occupied:
                c += 1
            ms = re.search(r'rowspan\s*=\s*["\']?(\d+)', attrs, re.I)
            rs = int(ms.group(1)) if ms else 1
            mc = re.search(r'colspan\s*=\s*["\']?(\d+)', attrs, re.I)
            cs = int(mc.group(1)) if mc else 1
            txt = clean(inner)
            for dr in range(min(rs, 40)):
                for dc in range(min(cs, 20)):
                    occupied.setdefault((r + dr, c + dc), txt)
            c += cs
            maxc = max(maxc, c)
    return [[occupied.get((r, c), "") for c in range(maxc)] for r in range(len(rows_html))]


def parse_tables(html_text):
    """
    Return [{caption, headers[], rows[[...]]}] for every <table> in the document.
    Header cells come from <thead>; if absent, the first row is used.
    """
    out = []
    for m in re.finditer(r'<table[^>]*>(.*?)</table>', html_text, re.S | re.I):
        body = m.group(1)
        cap = re.search(r'<caption[^>]*>(.*?)</caption>', body, re.S | re.I)
        caption = clean(cap.group(1)) if cap else ""
        thead = re.search(r'<thead[^>]*>(.*?)</thead>', body, re.S | re.I)
        tbody = re.search(r'<tbody[^>]*>(.*?)</tbody>', body, re.S | re.I)
        if thead:
            hgrid = _grid(thead.group(1))
            headers = [" ".join(dict.fromkeys(filter(None, col))).strip()
                       for col in zip(*hgrid)] if hgrid else []
            rows = _grid(tbody.group(1)) if tbody else []
        else:
            g = _grid(body)
            if not g:
                continue
            headers, rows = g[0], g[1:]
        rows = [r for r in rows if any(x.strip() for x in r)]
        if headers and rows:
            out.append({"caption": caption, "headers": headers, "rows": rows,
                        "start": m.start()})
    return out


# ---- header -> canonical field name -------------------------------------
def canon(header):
    h = re.sub(r'[^a-z0-9]+', ' ', header.lower()).strip()
    if not h:
        return None
    if h.startswith("product") or "part" in h:            return "product_code"
    if h.startswith("flex"):                              return "flex"
    if "balance" in h:                                    return "balance_point_pct"
    if "weight" in h:                                     return "weight"
    if "torque" in h:                                     return "torque"
    if "kick" in h or "bend point" in h:                  return "kick_point"
    if "length" in h:                                     return "length"
    if "tip" in h and "dia" in h:                         return "tip_dia"
    if h in ("tip",) or h.startswith("tip size") or h.startswith("tip o"):
        return "tip_dia"
    if "butt" in h:                                       return "butt_dia"
    if h.startswith("tip"):                               return "tip_dia"
    if "club" in h:                                       return "clubs"
    if "finish" in h:                                     return "finish"
    if "launch" in h:                                     return "launch"
    if "spin" in h:                                       return "spin"
    if "trajectory" in h:                                 return "trajectory"
    return re.sub(r'\s+', '_', h)


NUM = re.compile(r'^\s*([0-9]+(?:\.[0-9]+)?)\s*(?:g|gram|grams|°|deg|in|inch|")?\s*$', re.I)


def num(text):
    """Return float only when the cell IS a plain number. Otherwise None."""
    if text is None:
        return None
    t = str(text).replace("″", '"').replace("′", "'").strip()
    m = NUM.match(t)
    if not m:
        return None
    v = float(m.group(1))
    return int(v) if v.is_integer() else v


def row_to_spec(headers, row):
    """Map one table row to {canonical fields} + verbatim raw dict."""
    raw, spec = {}, {}
    for h, cell in zip(headers, row):
        cell = (cell or "").strip()
        if h:
            raw[h] = cell
        key = canon(h)
        if not key or not cell:
            continue
        if key == "weight":
            spec["weight_g"] = num(cell)
            spec["weight_text"] = cell
        elif key == "torque":
            spec["torque_deg"] = num(cell)
            spec["torque_text"] = cell
        elif key == "balance_point_pct":
            spec["balance_point_pct"] = num(cell)
        elif key in ("length", "tip_dia", "butt_dia"):
            spec[key + "_text" if key == "length" else key + "_text"] = cell
            spec[key] = num(cell)
        else:
            spec[key] = cell
    spec["raw"] = raw
    return spec


def uniq(seq):
    return list(dict.fromkeys([s for s in seq if s not in (None, "")]))


def save(path, payload):
    import os
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return path
