# -*- coding: utf-8 -*-
"""
coursedata/clubspecs/*.json (제조사 공식 스펙 수집본) → js/clubdb.js 생성

원칙 (이 파일을 고칠 때도 반드시 지킬 것)
─────────────────────────────────────────────────────────────────────
1. **지어내지 않는다.** 수집본에 없는 값은 null 로 둔다. 추정·보간 금지.
   null 로 남은 필드는 각 항목의 `nv`(not verified / not published) 배열에 이름을 남겨
   나중에 사람이 무엇을 채워야 하는지 바로 알 수 있게 한다.
2. **엔진(js/clubfit.js)을 고치지 않아도 되게 한다.**
   필드 이름·타입·값(한글 라벨)을 clubfit.js 의 데모 배열과 완전히 동일하게 맞춘다.
   브랜드 문자열은 clubfit.js 의 HEAD_BRANDS / SHAFT_BRANDS 선택지 값과 **글자까지 같아야**
   선호 브랜드 추천(pickByBrand)이 동작한다.
3. **수집 못 한 브랜드는 데모 데이터를 그대로 둔다.** verified:false 로 표시만 한다.
   브랜드 단위로 교체한다 — 한 브랜드에 실측 행이 1개라도 있으면 그 브랜드의 데모 행은 빠진다.
4. **가격대(pr) 는 수집 대상이 아니다.** 제조사 스펙표에 가격이 없다.
   데모에 같은 모델이 있으면 그 값을 물려받고, 없으면 null.
   (엔진 inBudget 은 pr===undefined 를 통과시키고 null<=1/null<=2 도 true 라 동작은 동일하다.)
5. **엔진이 아직 쓸 수 없는 실측치는 버리지 않고 REF 에 담는다.**
   헤드(관용성·드로바이어스·스핀 등)는 계측 스펙이 아니라 주관 평가라 수집본에 없다.
   그래서 헤드는 데모 행을 유지하고, 실측 로프트/라이/길이/체적은 REF 로 따로 넘긴다.

킥포인트(k) 표기 통일 — clubfit.js 의 k 는 "탄도(런치) 높이" 를 뜻한다.
  (엔진: k=="고" → 낮은 탄도를 끌어올림 / k=="낮음" → 뜨는 탄도를 누름)
  · launch 컬럼이 있는 소스(후지쿠라·UST마미야)는 그 값을 그대로 매핑한다.
  · kick point(샤프트상의 위치)만 있는 소스(미쓰비시·니폰·그라파이트디자인)는
    업계 통용 규칙대로 **뒤집어서** 매핑한다 — 킥포인트가 높다(=그립 쪽) → 런치는 낮다.
    이 항목들은 k_src 에 "kick_point(inverted)" 를 남긴다. 사람이 검토할 때 여기부터 보면 된다.

실행:  python tools/build_clubdb.py
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPECS = ROOT / "coursedata" / "clubspecs"
CLUBFIT = ROOT / "js" / "clubfit.js"
OUT = ROOT / "js" / "clubdb.js"

# ───────────────────────── 공통 유틸 ─────────────────────────


def load(name: str):
    p = SPECS / name
    if not p.exists():
        return None
    with p.open(encoding="utf-8") as f:
        return json.load(f)


def num(v):
    """문자열 어디에 있든 첫 숫자를 뽑는다. 숫자가 없으면 None (0 으로 채우지 않는다)."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return v
    m = re.search(r"-?\d+(?:\.\d+)?", str(v).replace(",", ""))
    if not m:
        return None
    f = float(m.group())
    return int(f) if f == int(f) else f


def clean(s):
    if s is None:
        return None
    return re.sub(r"\s+", " ", str(s)).strip()


# ── 플렉스: 엔진의 FLEX = ["R","SR","S","X"] 네 칸에만 넣을 수 있다.
#    이 네 칸으로 옮길 근거가 없는 표기(L·A·R2·R3·Lite·Senior 등 R 보다 무른 것,
#    SX·R/S 같은 중간 표기)는 None → 엔진 배열에서 제외한다(REF 로도 넘기지 않는다).
FLEX_MAP = {
    "R": "R", "REGULAR": "R", "R FLEX": "R", "LIGHT R": "R", "5.0": "R",
    "R300": "R", "R400": "R", "R200": "R",
    "SR": "SR", "R+": "SR", "STIFF REGULAR": "SR", "5.5": "SR",
    "S": "S", "STIFF": "S", "LIGHT S": "S", "6.0": "S",
    "S200": "S", "S300": "S", "S400": "S",
    "X": "X", "XSTIFF": "X", "X STIFF": "X", "X-STIFF": "X",
    "EXTRA STIFF": "X", "TX": "X", "TOUR X": "X", "XX": "X",
    "X100": "X", "X7": "X", "6.5": "X", "7.0": "X",
}


def flex_std(raw):
    """표준 4단계(R/SR/S/X)로 옮길 수 있을 때만 값을 준다."""
    if raw is None:
        return None
    t = str(raw).upper().strip()
    t = re.sub(r"\s*#\s*\w+$", "", t)          # 미쓰비시 "R #3" → "R"
    t = re.sub(r"\s*=\s*.*$", "", t)           # 니폰 "R2 = AI-3B14PRO" → "R2"
    t = re.sub(r"^\d+\s*", "", t)              # 후지쿠라 "7S" → "S", "9TX" → "TX"
    t = t.replace("FLEX", "").strip()
    return FLEX_MAP.get(t)


# ── 킥포인트 → 런치 높이(한글 라벨)
LAUNCH_MAP = {
    "L": "낮음", "LOW": "낮음",
    "L/M": "중저", "M/L": "중저", "LOW-MID": "중저", "MID-LOW": "중저", "MID/LOW": "중저",
    "M": "중", "MID": "중", "MIDDLE": "중", "MEDIUM": "중",
    "M/H": "중고", "MID-HIGH": "중고", "MID/HIGH": "중고", "H/M": "중고",
    "H": "고", "HIGH": "고",
}
# 샤프트상의 킥포인트 위치 → 런치(뒤집는다: 높은 킥포인트 = 낮은 런치)
KICKPOS_MAP = {
    "HIGH": "낮음", "H": "낮음", "GRIP": "낮음", "BUTT": "낮음",
    "MID/HIGH": "중저", "MID-HIGH": "중저", "H/M": "중저",
    "MID": "중", "M": "중", "MIDDLE": "중",
    "MID/LOW": "중고", "MID-LOW": "중고",
    "LOW": "고", "L": "고", "TIP": "고",
}
# 그라파이트디자인 일본어 조자 표기 (先=팁=고탄도 / 元=버트=저탄도)
KICK_JA_MAP = {
    "元調子": "낮음", "中元調子": "중저", "中調子": "중",
    "先中調子": "중고", "先調子": "고",
}


def launch_k(raw):
    if raw is None:
        return None
    return LAUNCH_MAP.get(str(raw).upper().strip())


def kickpos_k(raw):
    if raw is None:
        return None
    return KICKPOS_MAP.get(str(raw).upper().strip())


# 스펙 라벨용 짧은 표기 — 값을 바꾸는 게 아니라 같은 뜻의 표기를 줄이는 것뿐이다.
FLEX_SHORT = {"REGULAR": "R", "STIFF": "S", "XSTIFF": "X", "X-STIFF": "X",
              "X STIFF": "X", "EXTRA STIFF": "X", "STIFF REGULAR": "SR"}


def flex_label(raw):
    if raw is None:
        return None
    t = clean(raw)
    return FLEX_SHORT.get(t.upper(), t)


def strip_tail_num(model):
    """'Diamana BB 63' → ('Diamana BB', '63'). 뒤에 붙은 무게/번수 숫자를 떼어낸다."""
    m = re.match(r"^(.*?)[\s]+([0-9]+(?:\.[0-9]+)?)$", (model or "").strip())
    if m:
        return clean(m.group(1)), m.group(2)
    return clean(model), None


def join_family(family, base):
    """섹션(패밀리)명과 표 안 모델명을 겹치지 않게 붙인다. 임의 결합은 하지 않고 겹침만 처리."""
    family, base = clean(family), clean(base)
    if not family:
        return base
    if not base:
        return family
    if base.upper().startswith(family.upper()):
        return base
    fw = base.split()[0].upper()
    if family.upper().endswith(" " + fw) or family.upper() == fw:
        # family 끝 단어 == base 첫 단어 → 겹치는 만큼만 잘라 붙인다
        return family + base[len(base.split()[0]):]
    return f"{family} {base}"


def make_sp(tail, flex_raw):
    """스펙 라벨(demo 의 sp: '6S', '50S' 같은 것)."""
    tail = clean(tail) or ""
    fx = clean(flex_raw) or ""
    if not tail:
        return fx or None
    if not fx:
        return tail
    if fx.upper() in tail.upper().split():
        return tail
    return f"{tail}{fx}" if tail[-1].isdigit() else f"{tail} {fx}"


def nv(row, fields):
    """값이 없는 필드 이름을 nv 배열로 남긴다 (지어내는 대신 '없다'를 기록)."""
    miss = [f for f in fields if row.get(f) is None]
    if miss:
        row["nv"] = miss
    return row


# ───────────────────── clubfit.js 데모 배열 읽기 ─────────────────────

DEMO_NAMES = ["SHAFTS", "HEADS", "IRON_SHAFTS", "IRON_HEADS", "WEDGES", "PUTTERS", "GRIPS"]


def read_demo():
    """clubfit.js 의 const 배열을 그대로 읽는다 (필드 이름·형식의 기준이 되는 원본)."""
    src = CLUBFIT.read_text(encoding="utf-8")
    out = {}
    for name in DEMO_NAMES:
        m = re.search(r"const\s+%s\s*=\s*\[" % name, src)
        if not m:
            raise SystemExit(f"clubfit.js 에서 {name} 배열을 찾지 못했습니다")
        i = m.end() - 1
        depth, j, instr = 0, i, False
        while j < len(src):
            c = src[j]
            if instr:
                if c == "\\":
                    j += 2
                    continue
                if c == '"':
                    instr = False
            elif c == '"':
                instr = True
            elif c == "[":
                depth += 1
            elif c == "]":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        body = src[i:j + 1]
        body = re.sub(r"/\*.*?\*/", "", body, flags=re.S)
        body = re.sub(r"([{,])\s*([A-Za-z_$][\w$]*)\s*:", r'\1"\2":', body)
        body = re.sub(r",\s*([\]}])", r"\1", body)
        out[name] = json.loads(body)
    return out


# ───────────────────── 드라이버/우드 샤프트 ─────────────────────

WOOD_ROWS: list[dict] = []
IRON_ROWS: list[dict] = []
SKIP = {"flex_unmappable": 0, "no_weight": 0}


def add_shaft(bucket, **kw):
    row = {k: kw.get(k) for k in
           ("b", "m", "st", "pr", "sp", "w", "fx", "tq", "k", "mat", "feel")}
    if kw.get("velo"):
        row["velo"] = True
    for extra in ("k_src", "src", "cat"):
        if kw.get(extra) is not None:
            row[extra] = kw[extra]
    bucket.append(row)


def take_fujikura():
    """후지쿠라 — 유일하게 launch(탄도) 컬럼을 직접 게시하는 소스."""
    wood = load("fujikura_wood.json")
    other = load("fujikura_other.json")
    n_w = n_i = 0
    for it in (wood or {}).get("items", []):
        fx = flex_std(flex_label(it.get("flex")))
        w = num(it.get("weight_g"))
        if fx is None:
            SKIP["flex_unmappable"] += 1
            continue
        if w is None:
            SKIP["no_weight"] += 1
            continue
        section = clean(it.get("section")) or ""
        velo = "velocore" in section.lower()
        family = re.sub(r"\s*\(?with velocore\+?\)?", "", section, flags=re.I).strip()
        base, tail = strip_tail_num(it.get("model"))
        add_shaft(WOOD_ROWS, b="후지쿠라", m=join_family(family, base), st="cur", pr=None,
                  sp=make_sp(tail, flex_label(it.get("flex"))), w=w, fx=fx,
                  tq=num(it.get("torque")), k=launch_k(it.get("launch")),
                  velo=velo, k_src="launch", src=(wood or {}).get("source"), cat="wood")
        n_w += 1
    for it in (other or {}).get("items", []):
        if it.get("category") != "iron":
            continue
        fx = flex_std(flex_label(it.get("flex")))
        w = num(it.get("weight_g"))
        if fx is None:
            SKIP["flex_unmappable"] += 1
            continue
        if w is None:
            SKIP["no_weight"] += 1
            continue
        section = clean(it.get("section")) or ""
        family = re.sub(r"\s*>.*$", "", section).strip()
        base, tail = strip_tail_num(it.get("model"))
        add_shaft(IRON_ROWS, b="후지쿠라", m=join_family(family, base), st="cur", pr=None,
                  sp=make_sp(tail, flex_label(it.get("flex"))), w=w, fx=fx,
                  tq=num(it.get("torque")), k=launch_k(it.get("launch")),
                  mat="그라파이트", k_src="launch",
                  src=(other or {}).get("source"), cat="iron")
        n_i += 1
    return n_w, n_i


MITSU_IRON_WORDS = ("iron", "irons")
MITSU_SKIP_WORDS = ("putter", "wedge", "hybrid", "fairway")


def take_mitsubishi():
    d = load("mitsubishi.json")
    n_w = n_i = 0
    for it in (d or {}).get("items", []):
        title = (it.get("product_title") or "").lower()
        model_l = (it.get("model") or "").lower()
        blob = title + " " + model_l
        if any(w in blob for w in MITSU_SKIP_WORDS):
            continue
        is_iron = any(re.search(r"\b%s\b" % w, blob) for w in MITSU_IRON_WORDS)
        fx = flex_std(flex_label(it.get("flex")))
        w = num(it.get("weight_g"))
        if fx is None:
            SKIP["flex_unmappable"] += 1
            continue
        if w is None:
            SKIP["no_weight"] += 1
            continue
        base, tail = strip_tail_num(it.get("model"))
        add_shaft(IRON_ROWS if is_iron else WOOD_ROWS,
                  b="미쓰비시", m=base, st="cur", pr=None,
                  sp=make_sp(tail, flex_label(it.get("flex"))), w=w, fx=fx,
                  tq=num(it.get("torque_deg")), k=kickpos_k(it.get("kick_point")),
                  mat="그라파이트" if is_iron else None,
                  k_src="kick_point(inverted)", src=it.get("source"),
                  cat="iron" if is_iron else "wood")
        n_i += is_iron
        n_w += (not is_iron)
    return n_w, n_i


def take_graphitedesign():
    d = load("graphitedesign_tourad.json")
    n_w = n_i = 0
    for it in (d or {}).get("items", []):
        series = clean(it.get("series")) or ""
        is_iron = "IRON" in series.upper() or it.get("iron_no")
        if any(k in series.upper() for k in ("HYBRID", "HY", "PT", "U")) and not is_iron:
            # TOUR AD U / HY / VFHB 는 유틸리티·하이브리드 전용, PT 는 퍼터형 —
            # 드라이버 후보에 섞으면 안 되므로 REF 로도 넘기지 않고 건너뛴다.
            if re.search(r"\b(HYBRID|HY|VFHB|U|PT)\b", series.upper()):
                continue
        fx = flex_std(flex_label(it.get("flex")))
        w = num(it.get("weight_g"))
        if fx is None:
            SKIP["flex_unmappable"] += 1
            continue
        if w is None:
            SKIP["no_weight"] += 1
            continue
        tail = clean(it.get("model"))
        add_shaft(IRON_ROWS if is_iron else WOOD_ROWS,
                  b="그라파이트디자인", m=series, st="cur", pr=None,
                  sp=make_sp(tail, flex_label(it.get("flex"))), w=w, fx=fx,
                  tq=num(it.get("torque_deg")),
                  k=KICK_JA_MAP.get(clean(it.get("kick_point_ja"))),
                  mat="그라파이트" if is_iron else None,
                  k_src="kick_point_ja(調子)", src=it.get("source"),
                  cat="iron" if is_iron else "wood")
        n_i += bool(is_iron)
        n_w += (not is_iron)
    return n_w, n_i


def take_projectx():
    """Project X — 공식 스펙표에 launch/kick 컬럼이 없다. k 는 null 로 두고 nv 에 남긴다."""
    d = load("projectx.json")
    n_w = n_i = 0
    for it in (d or {}).get("items", []):
        fx = flex_std(flex_label(it.get("flex")))
        w = num(it.get("weight"))
        if fx is None:
            SKIP["flex_unmappable"] += 1
            continue
        if w is None:
            SKIP["no_weight"] += 1
            continue
        is_iron = it.get("category") == "iron"
        grp = clean(it.get("spec_group")) or ""
        gnum = num(grp) if "weight" in grp.lower() else None
        add_shaft(IRON_ROWS if is_iron else WOOD_ROWS,
                  b="프로젝트X", m=clean(it.get("product")), st="cur", pr=None,
                  sp=make_sp(str(gnum) if gnum else "", flex_label(it.get("flex"))), w=w, fx=fx,
                  tq=num(it.get("torque")), k=None,
                  mat="스틸" if is_iron else None,
                  src=it.get("source_url"), cat="iron" if is_iron else "wood")
        n_i += is_iron
        n_w += (not is_iron)
    return n_w, n_i


UST_SUFFIX = re.compile(
    r"\s*(Graphite\s+)?(Wood|Iron|Hybrid)\s+Shaft$|\s*TSPX\s+(Wood|Iron)\s+Shaft$", re.I)


def take_ustmamiya():
    d = load("ustmamiya.json")
    n_w = n_i = 0
    for it in (d or {}).get("items", []):
        cat = it.get("category")
        if cat not in ("wood", "iron"):
            continue
        fx = flex_std(flex_label(it.get("flex")))
        w = num(it.get("weight"))
        if fx is None:
            SKIP["flex_unmappable"] += 1
            continue
        if w is None:
            SKIP["no_weight"] += 1
            continue
        product = UST_SUFFIX.sub("", clean(it.get("product")) or "").strip()
        model = clean(it.get("model")) or ""
        tail = model[len(product):].strip() if model.upper().startswith(product.upper()) else model
        is_iron = cat == "iron"
        add_shaft(IRON_ROWS if is_iron else WOOD_ROWS,
                  b="UST마미야", m=product, st="cur", pr=None,
                  sp=make_sp(tail, flex_label(it.get("flex"))), w=w, fx=fx,
                  tq=num(it.get("torque")), k=launch_k(it.get("launch")),
                  mat="그라파이트" if is_iron else None, k_src="launch",
                  src=it.get("source_url"), cat="iron" if is_iron else "wood")
        n_i += is_iron
        n_w += (not is_iron)
    return n_w, n_i


def take_nippon():
    """니폰 — 모델 안에 flexes[] 가 중첩돼 있다. 스틸 전용 페이지라 mat=스틸."""
    d = load("nippon.json")
    n = 0
    for mo in (d or {}).get("items", []):
        name = clean(mo.get("model"))
        if not name:
            continue
        up = name.upper()
        if any(w in up for w in ("WEDGE", "FW", "HYBRID")):
            continue                                    # 아이언 후보가 아니다
        for f in mo.get("flexes", []):
            fx = flex_std(f.get("flex"))
            w = num(f.get("weight_g"))
            if fx is None:
                SKIP["flex_unmappable"] += 1
                continue
            if w is None:
                SKIP["no_weight"] += 1
                continue
            add_shaft(IRON_ROWS, b="니폰", m=name, st="cur", pr=None,
                      sp=flex_label(f.get("flex")), w=w, fx=fx,
                      tq=num(f.get("torque_deg")), k=kickpos_k(f.get("kick_point")),
                      mat="스틸", k_src="kick_point(inverted)",
                      src=mo.get("source"), cat="iron")
            n += 1
    return n


def take_truetemper():
    """트루템퍼 — 토크를 숫자가 아닌 'Low' 로만 게시하고 킥포인트 컬럼이 없다 → tq·k = null."""
    d = load("truetemper.json")
    n = 0
    for mo in (d or {}).get("items", []):
        name = clean(mo.get("model"))
        if not name or "WEDGE" in name.upper():
            continue
        for v in mo.get("flexes", []):
            fx = flex_std(v.get("flex"))
            w = num(v.get("weight_g"))
            if fx is None:
                SKIP["flex_unmappable"] += 1
                continue
            if w is None:
                SKIP["no_weight"] += 1
                continue
            label = clean(v.get("variant")) or clean(v.get("flex"))
            label = flex_label(re.sub(r"^Flex\s+", "", label or ""))
            add_shaft(IRON_ROWS, b="트루템퍼", m=name, st="cur", pr=None,
                      sp=label, w=w, fx=fx, tq=None, k=None,
                      mat="스틸", src=mo.get("source"), cat="iron")
            n += 1
    return n


def take_kbs():
    """KBS — 공식 제품 페이지에 토크·킥포인트를 아예 게시하지 않는다(수집 검증 완료) → null."""
    d = load("kbs.json")
    n = 0
    for mo in (d or {}).get("items", []):
        if mo.get("page_kind") == "per_club_sku":
            continue                                    # 클럽별 판매 SKU 중복 페이지
        name = clean(mo.get("model"))
        if not name:
            continue
        mat = "그라파이트" if mo.get("collection") == "graphite" else "스틸"
        for grp in mo.get("spec_groups", []):
            for r in grp.get("rows", []):
                fx = flex_std(r.get("flex"))
                w = num(r.get("weight_g"))
                if fx is None:
                    SKIP["flex_unmappable"] += 1
                    continue
                if w is None:
                    SKIP["no_weight"] += 1
                    continue
                sec = clean(grp.get("section")) or ""
                tip = "테이퍼" if "TAPER TIP" in sec.upper() else (
                    "패러렐" if "PARALLEL" in sec.upper() else None)
                sp = f"{flex_label(r.get('flex'))}" + (f" · {tip}" if tip else "")
                add_shaft(IRON_ROWS, b="KBS", m=name, st="cur", pr=None,
                          sp=sp, w=w, fx=fx, tq=None, k=None,
                          mat=mat, src=mo.get("source"), cat="iron")
                n += 1
    return n


# ───────────────────── 웨지 / 퍼터 / 그립 ─────────────────────

def take_wedges():
    """웨지 엔진은 브랜드·모델(+가격대)만 쓴다 — 그건 수집본으로 확정할 수 있다."""
    rows, ref = [], []
    v = load("vokey_wedge.json")
    if v and v.get("items"):
        line = clean(v.get("model_line")) or "SM11"
        rows.append({"br": "타이틀리스트", "m": f"Vokey {line}", "st": "cur", "pr": None,
                     "src": v.get("source")})
        for it in v["items"]:
            ref.append({"br": "타이틀리스트", "m": clean(it.get("model")),
                        "loft": num(it.get("loft_deg")), "bounce": num(it.get("bounce_deg")),
                        "grind": clean(it.get("grind")), "len": num(it.get("length_in")),
                        "sw": clean(it.get("swingweight")), "src": v.get("source")})
    c = load("cleveland_wedge.json")
    if c and c.get("items"):
        seen = []
        for it in c["items"]:
            ln = clean(it.get("model_line"))
            if ln and ln not in seen:
                seen.append(ln)
            ref.append({"br": "클리브랜드", "m": clean(it.get("model")),
                        "loft": num(it.get("loft_deg")), "bounce": num(it.get("bounce_deg")),
                        "grind": clean(it.get("grind")), "lie": num(it.get("lie_deg")),
                        "len": num(it.get("length_in")), "sw": clean(it.get("swingweight")),
                        "gender": it.get("gender"), "src": c.get("source")})
        for ln in seen:
            if ln.lower().startswith("women"):
                continue                                 # 남성 기본 라인만 후보로 올린다
            rows.append({"br": "클리브랜드", "m": ln, "st": "cur", "pr": None,
                         "src": c.get("source")})
    mz = load("mizuno.json")
    if mz:
        lines = []
        for it in mz.get("items", []):
            if it.get("type") != "wedge":
                continue
            ser = clean(it.get("series")) or ""
            ln = ser.split(" ")[0]                        # "T-1 Gap Wedges" → "T-1"
            if ln and ln not in lines:
                lines.append(ln)
            ref.append({"br": "미즈노", "m": clean(it.get("model")), "series": ser,
                        "loft": num(it.get("loft_deg")), "lie": num(it.get("lie_deg")),
                        "len": num(it.get("length_inch")), "src": it.get("spec_url")})
        for ln in lines:
            rows.append({"br": "미즈노", "m": ln, "st": "cur", "pr": None,
                         "src": (mz.get("sources") or [None])[0]})
    return rows, ref


# 오디세이가 공표하는 토우행 각도(°) → 엔진의 bal/arc 라벨.
# 0° = 페이스밸런스는 제조사 표기 그대로이고, 나머지 구간 경계는 이 파일에서 정한 것이라
# bal_src 에 근거를 남긴다. (사람 검토 항목)
def toe_hang_to_bal(raw):
    if raw is None:
        return None, None
    t = str(raw).upper().strip()
    if "UP" in t:                                        # "90° UP" = 토우가 수직 = 최대 토우행
        return "토우행", "arc"
    d = num(t)
    if d is None:
        return None, None
    if d == 0:
        return "페이스밸런스", "straight"
    if d < 30:
        return "약토우행", "slight"
    return "토우행", "arc"


HEAD_TYPE_KO = {"BLADE": "블레이드", "MALLET": "말렛", "MID MALLET": "미드말렛"}


def take_putters():
    rows, ref = [], []
    o = load("odyssey_putter.json")
    seen = set()
    for it in (o or {}).get("items", []):
        shape = HEAD_TYPE_KO.get((clean(it.get("head_type")) or "").upper())
        bal, arc = toe_hang_to_bal(it.get("toe_hang"))
        name = clean(it.get("model"))
        fam = clean(it.get("family"))
        m = f"{fam.replace('-', ' ').title()} {name}" if fam else name
        ref.append({"br": "오디세이", "m": m, "shape": shape,
                    "loft": num(it.get("loft_deg")), "lie": num(it.get("lie_deg")),
                    "lens": it.get("lengths_in"), "toe_hang": clean(it.get("toe_hang")),
                    "head_w": num(it.get("head_weight_g")), "src": it.get("url")})
        if not (shape and bal and arc):
            continue
        key = (m, shape, bal)
        if key in seen:
            continue
        seen.add(key)
        rows.append({"br": "오디세이", "m": m, "st": "cur", "pr": None,
                     "shape": shape, "bal": bal, "arc": arc,
                     "bal_src": "toe_hang(deg)", "src": it.get("url")})
    s = load("scotty_cameron_putter.json")
    for it in (s or {}).get("items", []):
        ref.append({"br": "스카티카메론", "m": clean(it.get("model")),
                    "family": clean(it.get("family")),
                    "loft": num(it.get("loft_deg")), "lie": num(it.get("lie_deg")),
                    "lens": it.get("lengths_in"), "shape": clean(it.get("head_shape")),
                    "src": it.get("url")})
    mz = load("mizuno.json")
    for it in (mz or {}).get("items", []):
        if it.get("type") != "putter":
            continue
        ref.append({"br": "미즈노", "m": clean(it.get("model")),
                    "loft": num(it.get("loft_deg")), "lie": num(it.get("lie_deg")),
                    "lens": it.get("length_options_inch"), "src": it.get("spec_url")})
    return rows, ref


def take_grips():
    """골프프라이드 — 실측은 무게(g)뿐. 재질(tex)·경도(firm)·테이퍼는 스펙표에 없다.

    주의 1: 같은 모델·같은 사이즈라도 코어 지름(58/60)별로 무게가 다르게 실려 있다.
            값이 하나로 안 좁혀지면 **고르지 않는다** — 데모값을 두고 w_options 로 후보만 남긴다.
    주의 2: match_level=='collection' 행은 컬렉션 페이지에서 긁은 것이라
            그 컬렉션의 어느 제품인지 확정되지 않는다(CP2 Pro/Wrap, ZGRIP/Cord 등).
            제품 페이지에서 확정된 'product' 행만 연결한다.
    """
    g = load("golfpride_grip.json")
    ref, byname = [], {}
    for it in (g or {}).get("items", []):
        ref.append({"b": "골프프라이드", "m": clean(it.get("model")),
                    "size": clean(it.get("size")), "core": clean(it.get("core")),
                    "w": num(it.get("weight_g")), "type": it.get("grip_type"),
                    "match": it.get("match_level"), "src": it.get("product_url")})
        if (it.get("grip_type") == "swing"
                and (it.get("size") or "").lower() == "standard"
                and it.get("match_level") == "product"):
            w = num(it.get("weight_g"))
            if w is None:
                continue
            e = byname.setdefault((clean(it.get("model")) or "").upper(),
                                  {"ws": set(), "url": it.get("product_url")})
            e["ws"].add(w)
    return byname, ref


# ───────────────────── 헤드(드라이버/아이언) 실측표 ─────────────────────

def take_head_specs():
    drv, irn = [], []
    td = load("titleist_drivers.json")
    for it in (td or {}).get("items", []):
        drv.append({"br": "타이틀리스트", "m": clean(it.get("model")),
                    "loft": num(it.get("loft_deg")), "lie": num(it.get("lie_deg")),
                    "len": num(it.get("length_in")), "cc": num(it.get("head_size_cc")),
                    "src": it.get("source")})
    ti = load("titleist_irons.json")
    for it in (ti or {}).get("items", []):
        irn.append({"br": "타이틀리스트", "m": clean(it.get("model")), "club": clean(it.get("club")),
                    "loft": num(it.get("loft_deg")), "lie": num(it.get("lie_deg")),
                    "len": num(it.get("length_in")), "src": it.get("source")})
    pd = load("ping_drivers.json")
    for it in (pd or {}).get("items", []):
        drv.append({"br": "핑", "m": clean(it.get("model")),
                    "loft": num(it.get("loft_deg")), "lie": num(it.get("lie_deg")),
                    "len": num(it.get("length_in")), "cc": num(it.get("head_size_cc")),
                    "head_w": num(it.get("head_weight_g")), "sw": clean(it.get("swingweight")),
                    "src": it.get("source")})
    pi = load("ping_irons.json")
    for it in (pi or {}).get("items", []):
        irn.append({"br": "핑", "m": clean(it.get("model")), "club": clean(it.get("club")),
                    "loft": num(it.get("loft_deg")), "lie": num(it.get("lie_deg")),
                    "len": num(it.get("length_in")), "sw": clean(it.get("swingweight")),
                    "offset": num(it.get("offset_in")), "bounce": num(it.get("bounce_deg")),
                    "src": it.get("source")})
    cw = load("callaway.json")
    for it in (cw or {}).get("items", []):
        if it.get("type") == "driver":
            for lo in it.get("loft_options", []):
                drv.append({"br": "캘러웨이", "m": clean(it.get("model")),
                            "loft": num(lo.get("loft_deg")), "lie": num(lo.get("lie_deg")),
                            "len": num(lo.get("length_inch")), "cc": num(lo.get("head_volume_cc")),
                            "src": it.get("source_url")})
        elif it.get("type") == "iron":
            for cl in it.get("clubs", []) or []:
                irn.append({"br": "캘러웨이", "m": clean(it.get("model")),
                            "club": clean(cl.get("club") or cl.get("model")),
                            "loft": num(cl.get("loft_deg")), "lie": num(cl.get("lie_deg")),
                            "len": num(cl.get("length_inch")), "src": it.get("source_url")})
    mz = load("mizuno.json")
    for it in (mz or {}).get("items", []):
        if it.get("type") == "driver":
            drv.append({"br": "미즈노", "m": clean(it.get("model")),
                        "loft": num(it.get("loft_deg")), "loft_range": it.get("loft_range_deg"),
                        "lie": num(it.get("lie_deg")), "lie_range": it.get("lie_range_deg"),
                        "len": num(it.get("length_inch")), "cc": num(it.get("head_volume_cc")),
                        "src": it.get("spec_url")})
        elif it.get("type") in ("iron", "utility_iron"):
            irn.append({"br": "미즈노", "m": clean(it.get("model")), "series": clean(it.get("series")),
                        "loft": num(it.get("loft_deg")), "lie": num(it.get("lie_deg")),
                        "len": num(it.get("length_inch")), "src": it.get("spec_url")})
    return drv, irn


# 데모 헤드 ↔ 수집본 모델 연결 (이름이 사람이 봐도 같은 것만. 유사 추정 금지)
HEAD_LINK = {
    ("타이틀리스트", "GT2"): "GT2 Driver",
    ("타이틀리스트", "GT3"): "GT3 Driver",
    ("타이틀리스트", "GT4"): "GT4 Driver",
    ("핑", "G430 MAX 10K"): "G430 MAX 10K DRIVER",
    ("핑", "G430 SFT"): "G430 SFT DRIVER",
}
IRON_HEAD_LINK = {
    ("타이틀리스트", "T100"): "T100",
    ("타이틀리스트", "T150"): "T150",
    ("타이틀리스트", "T350"): "T350",
    ("핑", "i230"): "i230 IRON",
    ("핑", "G430"): "G430 IRON",
    ("캘러웨이", "에이팩스 프로"): "Apex Pro Irons",
}


# ───────────────────────── 병합 ─────────────────────────

def merge(demo_rows, verified_rows, brand_key):
    """브랜드 단위 교체 — 실측 행이 있는 브랜드의 데모 행은 뺀다."""
    vb = {r.get(brand_key) for r in verified_rows}
    kept = [dict(r, verified=False) for r in demo_rows if r.get(brand_key) not in vb]
    out = [dict(r, verified=True) for r in verified_rows] + kept
    return out, sorted(x for x in vb if x), sorted({r.get(brand_key) for r in kept if r.get(brand_key)})


def carry_pr(verified_rows, demo_rows, brand_key, model_key="m"):
    """가격대는 수집 대상이 아니다 — 데모에 같은 모델이 있을 때만 그 값을 물려받는다."""
    idx = {}
    for d in demo_rows:
        idx[(d.get(brand_key), re.sub(r"[\s·]", "", (d.get(model_key) or "")).upper())] = d.get("pr")
    hit = 0
    for r in verified_rows:
        k = (r.get(brand_key), re.sub(r"[\s·]", "", (r.get(model_key) or "")).upper())
        if k in idx and idx[k] is not None:
            r["pr"] = idx[k]
            hit += 1
    return hit


def dedupe(rows, keys):
    seen, out = set(), []
    for r in rows:
        k = tuple(r.get(x) for x in keys)
        if k in seen:
            continue
        seen.add(k)
        out.append(r)
    return out


# ───────────────────────── 출력 ─────────────────────────

def js_rows(rows, indent="    "):
    body = ",\n".join(indent + json.dumps(r, ensure_ascii=False, separators=(",", ":"))
                      for r in rows)
    return "[\n" + body + "\n" + indent[:-2] + "]" if rows else "[]"


HEADER = """/* =========================================================
 * clubdb.js — 제조사 공식 스펙 실측 통합본
 * ⚠️ 자동 생성 파일입니다. 직접 고치지 마세요.
 *    생성기: tools/build_clubdb.py   원천: coursedata/clubspecs/*.json
 *    생성일: {built}
 *
 * ⚠️ 아직 index.html / sw.js 에 연결하지 않았습니다 (사람 검토 후 연결).
 *
 * 필드는 js/clubfit.js 의 데모 배열과 동일합니다 — 엔진 수정 없이 교체 가능.
 *   b/br 브랜드 · m 모델 · st cur|old · pr 가격대(1|2|3) · sp 스펙명
 *   w 무게(g) · fx 플렉스(R|SR|S|X) · tq 토크(°) · k 킥포인트(=탄도 높이)
 *   mat 스틸|그라파이트 · feel 타감 · shape/bal/arc 퍼터 · tex/firm/taper 그립
 *
 * 항목별 표시:
 *   verified:true  — 제조사 공식 페이지에서 실측 수집한 값
 *   verified:false — 수집하지 못해 clubfit.js 데모값을 그대로 둔 것
 *   nv:[...]       — 제조사가 공개하지 않아 null 로 남긴 필드 이름
 *   src            — 그 값을 가져온 제조사 페이지 URL
 *   k_src          — 킥포인트를 무엇으로부터 만들었는지 (검토 우선순위)
 *
 * 지어낸 값은 없습니다. 없는 값은 전부 null 입니다.
 * ========================================================= */
"""


def main():
    demo = read_demo()

    n = {}
    n["fuji"] = take_fujikura()
    n["mitsu"] = take_mitsubishi()
    n["gd"] = take_graphitedesign()
    n["px"] = take_projectx()
    n["ust"] = take_ustmamiya()
    n["nippon"] = take_nippon()
    n["tt"] = take_truetemper()
    n["kbs"] = take_kbs()

    wood = dedupe(WOOD_ROWS, ("b", "m", "sp", "w", "fx"))
    iron = dedupe(IRON_ROWS, ("b", "m", "sp", "w", "fx"))

    # 아이언 샤프트는 clubfit.js 의 브랜드 선택지(니폰/트루템퍼/KBS/UST마미야/후지쿠라)만
    # 후보로 올린다. 미쓰비시·그라파이트디자인·프로젝트X 아이언 샤프트는 실측치가 있어도
    # UI 선택지에 없어 브랜드 매칭이 안 되므로 REF 로 넘긴다(사람이 판단해 추가).
    IRON_UI_BRANDS = {"니폰", "트루템퍼", "KBS", "UST마미야", "후지쿠라"}
    iron_ref = [r for r in iron if r["b"] not in IRON_UI_BRANDS]
    iron = [r for r in iron if r["b"] in IRON_UI_BRANDS]

    carry_pr(wood, demo["SHAFTS"], "b")
    carry_pr(iron, demo["IRON_SHAFTS"], "b")

    for r in wood:
        nv(r, ("w", "fx", "tq", "k"))
        r.pop("mat", None)
        r.pop("feel", None)
        r.pop("cat", None)
    for r in iron:
        nv(r, ("w", "fx", "mat", "k", "feel"))
        r.pop("tq", None)
        r.pop("cat", None)
    for r in iron_ref:
        r.pop("cat", None)

    SHAFTS, sh_v, sh_d = merge(demo["SHAFTS"], wood, "b")
    IRON_SHAFTS, is_v, is_d = merge(demo["IRON_SHAFTS"], iron, "b")

    wed_rows, wed_ref = take_wedges()
    carry_pr(wed_rows, demo["WEDGES"], "br")
    WEDGES, we_v, we_d = merge(demo["WEDGES"], wed_rows, "br")

    put_rows, put_ref = take_putters()
    carry_pr(put_rows, demo["PUTTERS"], "br")
    PUTTERS, pu_v, pu_d = merge(demo["PUTTERS"], put_rows, "br")

    # ── 그립: 실측은 무게뿐 → 데모 행을 유지하고 무게만 검증값으로 교체
    gp_w, grip_ref = take_grips()
    # 데모 한글명 → 골프프라이드 공식 모델명. 제품 페이지에서 확정된 이름만 연결한다.
    # CP2 프로 / CP2 랩 / Z-그립 코드 는 컬렉션 페이지 행뿐이라 어느 제품인지 확정 불가 → 연결하지 않음.
    GRIP_LINK = {"투어 벨벳": "TOUR VELVET", "MCC": "MCC", "MCC 플러스4": "MCC PLUS4"}
    GRIPS, w_fixed, w_amb, w_chg = [], 0, 0, 0
    for g in demo["GRIPS"]:
        row = dict(g, verified=False)
        key = GRIP_LINK.get(g["m"]) if g["b"] == "골프프라이드" else None
        e = gp_w.get(key) if key else None
        if e:
            ws = sorted(e["ws"])
            row["src"] = e["url"]
            row["nv"] = ["tex", "firm", "taper"]     # 재질·경도·테이퍼는 스펙표에 없음
            if len(ws) == 1:
                if row["w"] != ws[0]:
                    w_chg += 1
                row["w"], row["w_verified"] = ws[0], True
                w_fixed += 1
            else:
                # 코어 지름별로 값이 갈린다 → 임의로 하나를 고르지 않고 후보만 남긴다
                row["w_options"] = ws
                row["nv"].append("w")
                w_amb += 1
        GRIPS.append(row)

    # ── 헤드: 관용성(forg)·드로바이어스·스핀·난이도(fit)는 계측 스펙이 아니라 주관 평가라
    #    제조사 스펙표에 없다. 그래서 데모 행을 유지하고, 실측 로프트·라이·길이·체적만 붙인다.
    drv_ref, irn_ref = take_head_specs()

    def attach(demo_rows, link, ref, keyname):
        out, hit = [], 0
        for h in demo_rows:
            row = dict(h, verified=False)
            tgt = link.get((h["br"], h["m"]))
            if tgt:
                got = [x for x in ref if x["br"] == h["br"] and x["m"] == tgt]
                if got:
                    row["specs"] = got
                    row["specs_verified"] = True
                    row["src"] = got[0].get("src")
                    hit += 1
            out.append(row)
        return out, hit

    HEADS, h_hit = attach(demo["HEADS"], HEAD_LINK, drv_ref, "m")
    IRON_HEADS, ih_hit = attach(demo["IRON_HEADS"], IRON_HEAD_LINK, irn_ref, "m")

    meta = {
        "built": date.today().isoformat(),
        "generator": "tools/build_clubdb.py",
        "wired_in": False,
        "note": "verified:true = 제조사 공식 페이지 실측 / verified:false = clubfit.js 데모값 유지. "
                "지어낸 값 없음, 없는 값은 null 이며 nv 배열에 필드명을 남김.",
        "counts": {
            "SHAFTS": {"verified": len(wood), "demo": len(SHAFTS) - len(wood)},
            "HEADS": {"verified": 0, "demo": len(HEADS), "specs_attached": h_hit},
            "IRON_SHAFTS": {"verified": len(iron), "demo": len(IRON_SHAFTS) - len(iron)},
            "IRON_HEADS": {"verified": 0, "demo": len(IRON_HEADS), "specs_attached": ih_hit},
            "WEDGES": {"verified": len(wed_rows), "demo": len(WEDGES) - len(wed_rows)},
            "PUTTERS": {"verified": len(put_rows), "demo": len(PUTTERS) - len(put_rows)},
            "GRIPS": {"verified": 0, "demo": len(GRIPS), "weight_verified": w_fixed,
                      "weight_changed": w_chg, "weight_ambiguous": w_amb},
        },
        "brands": {
            "SHAFTS": {"verified": sh_v, "demo_kept": sh_d},
            "IRON_SHAFTS": {"verified": is_v, "demo_kept": is_d},
            "WEDGES": {"verified": we_v, "demo_kept": we_d},
            "PUTTERS": {"verified": pu_v, "demo_kept": pu_d},
        },
        "dropped_rows": {
            "flex_unmappable": SKIP["flex_unmappable"],
            "no_weight": SKIP["no_weight"],
            "why": "엔진 FLEX 는 R/SR/S/X 4단계뿐이라 L·A·R2·R3·Lite·SX 등 "
                   "옮길 근거가 없는 표기는 임의 배정하지 않고 제외했다.",
        },
        # 엔진이 화면에 그대로 찍는 필드 중 null 이 몇 개인지 — 연결 전 처리 규모를 바로 볼 수 있게.
        "null_display_fields": {
            "SHAFTS(shaftSpec)": {
                f: sum(1 for r in SHAFTS if r.get(f) is None) for f in ("w", "fx", "tq", "k")},
            "IRON_SHAFTS(2065행)": {
                f: sum(1 for r in IRON_SHAFTS if r.get(f) is None)
                for f in ("w", "fx", "mat", "k", "feel")},
            "_note": "이 값이 0 이 아니면 그 필드가 화면에 'null' 로 찍힌다. "
                     "연결 전에 채우거나 clubfit.js 표시 문구에서 걸러야 한다.",
        },
        "needs_review": [
            "st(cur/old): 제조사 현행 카탈로그만으로는 단종 판정이 불가해 실측 행은 모두 'cur'. "
            "pickTiers 의 2차(단종·중고) 추천이 실측 브랜드에서는 비게 된다.",
            "pr(가격대): 제조사 스펙표에 가격이 없다. 데모에 같은 모델이 있던 것만 물려받고 나머지는 null.",
            "k_src=='kick_point(inverted)' 항목(미쓰비시·니폰): 제조사는 '샤프트상의 킥포인트 위치'를 "
            "게시하고 엔진의 k 는 '탄도 높이'라 뒤집어 매핑했다. 표본 검토 권장.",
            "PUTTERS.bal/arc: 오디세이가 공표한 토우행 각도(0°=페이스밸런스)로 만들었고, "
            "0/30° 구간 경계는 이 생성기에서 정한 값(bal_src='toe_hang(deg)').",
            "IRON_SHAFTS.feel(타감): 어느 제조사도 게시하지 않는 주관 항목 → 전부 null. "
            "clubfit.js 2065·1856 행이 이 값을 그대로 출력하므로 연결 전에 채우거나 표시를 바꿔야 한다.",
            "트루템퍼·KBS: 공식 페이지에 토크(숫자)·킥포인트 컬럼이 없어 tq·k = null.",
            "프로젝트X: 공식 스펙표에 launch/kick 컬럼이 없어 k = null (드라이버 표시 문구에 영향).",
            "HEADS/IRON_HEADS: forg·draw·spin·fit·type·off 는 계측 스펙이 아니라 주관 평가라 "
            "수집본에 없다. 데모 행을 유지하고 실측 로프트·라이·길이·체적만 specs 로 붙였다.",
            "GRIPS: tex(재질)·firm(경도)·taper 는 스펙표에 없다. 골프프라이드 무게(g)만 실측으로 교체하되, "
            "같은 사이즈에서 코어 지름(58/60)별로 무게가 갈리는 모델은 고르지 않고 w_options 로만 남겼다.",
            "테일러메이드: DataDome 캡차로 공식 사이트 접근 불가 → 헤드·웨지·퍼터 모두 데모 유지.",
        ],
        "sources": {},
    }
    for fn in sorted(p.name for p in SPECS.glob("*.json")):
        d = load(fn) or {}
        meta["sources"][fn] = {"url": d.get("source"), "fetched": d.get("fetched"),
                               "brand": d.get("brand")}

    parts = [
        ("meta", json.dumps(meta, ensure_ascii=False, indent=2)),
        ("SHAFTS", js_rows(SHAFTS)),
        ("HEADS", js_rows(HEADS)),
        ("IRON_SHAFTS", js_rows(IRON_SHAFTS)),
        ("IRON_HEADS", js_rows(IRON_HEADS)),
        ("WEDGES", js_rows(WEDGES)),
        ("PUTTERS", js_rows(PUTTERS)),
        ("GRIPS", js_rows(GRIPS)),
        ("REF", "{\n" + ",\n".join([
            '    DRIVER_HEADS: ' + js_rows(drv_ref, "      "),
            '    IRON_HEADS: ' + js_rows(irn_ref, "      "),
            '    WEDGES: ' + js_rows(wed_ref, "      "),
            '    PUTTERS: ' + js_rows(put_ref, "      "),
            '    GRIPS: ' + js_rows(grip_ref, "      "),
            '    IRON_SHAFTS_OFF_UI: ' + js_rows(iron_ref, "      "),
        ]) + "\n  }"),
    ]
    body = ",\n\n  ".join(f"{k}: {v}" for k, v in parts)

    js = (HEADER.format(built=meta["built"]) +
          "(function (root) {\n  \"use strict\";\n  var CLUBDB = {\n  " + body +
          "\n  };\n  root.CLUBDB = CLUBDB;\n"
          "  if (typeof module !== \"undefined\" && module.exports) module.exports = CLUBDB;\n"
          "})(typeof globalThis !== \"undefined\" ? globalThis : this);\n")
    OUT.write_text(js, encoding="utf-8")

    def line(s):
        try:
            print(s)
        except UnicodeEncodeError:
            print(s.encode("ascii", "replace").decode())

    line(f"written: {OUT}  ({OUT.stat().st_size/1024:.0f} KB)")
    for k, v in meta["counts"].items():
        line(f"  {k:<12} {v}")
    line(f"  dropped: {meta['dropped_rows']}")
    line(f"  REF: drivers {len(drv_ref)} / irons {len(irn_ref)} / wedges {len(wed_ref)} / "
         f"putters {len(put_ref)} / grips {len(grip_ref)} / iron_shafts_off_ui {len(iron_ref)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
