# -*- coding: utf-8 -*-
"""골프존 클럽 ↔ 앱 검색DB(golfdb.js) 연결 — 카카오 주소/키워드 API 기반

Nominatim은 한국 지번주소('산 39-1')를 자주 못 찾아 17곳이 탈락했었다.
카카오 로컬 API는 지번·도로명 모두 처리하므로 훨씬 정확하다.

판정 규칙 (오연결 방지)
  · 좌표 2.5km 이내 + 이름 유사   → 별칭 연결 (gz_alias.json)
  · 2.5km 이내에 후보 없음        → 신규 항목 (golfdb.js 추가)
  · 이름 유사 후보가 2곳 이상     → 건너뜀 (사람이 확인)

사용: python tools/gz_link_kakao.py [--write]
"""
import glob, json, math, os, re, sys, time, urllib.parse, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WRITE = "--write" in sys.argv
KEY = "9847ec5e9a4d1127c5765065b3e71ff2"
ALIAS_PATH = os.path.join(ROOT, "coursedata", "gz_alias.json")


def norm(s):
    s = re.sub(r"\(.*?\)", "", s or "")
    return re.sub(r"(CC|GC|C\.C|G\.C|컨트리클럽|골프클럽|골프장|골프앤리조트|골프&리조트|골프리조트"
                  r"|리조트|컨트리|클럽|\s|·|&|-|\.)", "", s, flags=re.I).lower()


def kakao(path, **params):
    url = f"https://dapi.kakao.com/v2/local/{path}?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Authorization": "KakaoAK " + KEY})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read()).get("documents") or []
    except Exception:
        return []
    finally:
        time.sleep(0.06)


# 카카오 주소 대조로 '동일 주소 = 이름만 바뀐 구장'임을 확인한 건들
CONFIRMED = {
    "H1 CLUB": "에이치원클럽",                    # 이천 호법면 장자터로 115 동일
    "한림용인 CC": "레이크힐스용인CC",              # 용인 남사읍 경기동로 628 동일
    "포웰CC 안성": "루나힐스안성컨트리클럽",          # 안성 양성면 약산길 67-6 동일
    "청우 GC": "알프스대영CC",                     # 횡성 우천면 한우로 1295 동일
    "화순엘리체 CC": "엘리체컨트리클럽",             # 화순 춘양면 장곡길 55 동일 (화순CC는 별개)
    "뉴스프링빌 CC": "뉴스프링빌CC 이천",            # 이천 모가면, 0.45km
    "플라자 CC 용인": "용인플라자CC",
    "샤인빌파크 CC": "샤인빌파크CC-PALM코스",        # PALM·RIVER 두 항목이 같은 구장
    "자유로 CC": "자유로CC",                        # app.js EXTRA_CLUBS 등재명
}
# 앱DB에 대응 항목이 없어 새로 추가 (근처 다른 구장과 혼동 방지용 강제 지정)
#   골프존카운티 구미 ≠ 구미CC(장천면), 골프존카운티 순천 ≠ 순천CC(별량면) — 카카오 주소로 확인
FORCE_NEW = {"골프존카운티 안성H", "골프존카운티 안성W", "더 시에나 서울 CC",
             "세레니티 강촌 CC", "해비치 제주", "골프존카운티 구미", "골프존카운티 순천"}


def geocode(addr, club):
    """좌표 조회. 골프장은 카카오 POI가 정확하므로 구장명 키워드를 먼저 쓴다."""
    for q in (club, club + " 골프장", club + " CC"):
        d = kakao("search/keyword.json", query=q, size=1, category_group_code="AT4")
        d = d or kakao("search/keyword.json", query=q, size=1)
        if d and any(w in (d[0].get("category_name") or "") for w in ("골프", "스포츠", "레저")):
            return float(d[0]["y"]), float(d[0]["x"]), "POI:" + d[0]["place_name"]
    cands = [addr, re.sub(r"\s*산?\s*[\d\-]+번?지?.*$", "", addr), " ".join(addr.split()[:3])]
    for q in cands:
        if q and q.strip():
            d = kakao("search/address.json", query=q.strip(), size=1)
            if d:
                return float(d[0]["y"]), float(d[0]["x"]), "주소"
    return None


def km(a, b, c, d):
    R, p = 6371, math.pi / 180
    x = math.sin((c - a) * p / 2) ** 2 + math.cos(a * p) * math.cos(c * p) * math.sin((d - b) * p / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


# ── 대상 수집: 홀데이터 있고 아직 미등록인 골프존 클럽 ──────────────────────
reg = set()
for f in glob.glob(os.path.join(ROOT, "coursedata", "homepages", "*", "parsed.json")):
    reg.add(norm(json.load(open(f, encoding="utf-8"))["course"]))

alias_map = {}
if os.path.exists(ALIAS_PATH):
    alias_map = json.load(open(ALIAS_PATH, encoding="utf-8"))

targets = {}
for f in glob.glob(os.path.join(ROOT, "coursedata", "golfzon", "cc_*.json")):
    j = json.load(open(f, encoding="utf-8"))
    if j.get("detail", {}).get("country") != 1:
        continue
    name = (j.get("ccName") or "").split(" - ")[0].strip()
    holes = sum(len(c) for c in ((j.get("holeInfo") or {}).get("holeInfoList") or []) if isinstance(c, list))
    if holes < 9 or not name:
        continue
    if norm(name) in reg or norm(alias_map.get(name, "")) in reg:
        continue
    targets.setdefault(name, j["detail"].get("address", ""))

path = os.path.join(ROOT, "js", "golfdb.js")
txt = open(path, encoding="utf-8").read()
DB = json.loads(re.search(r"const GOLF_DB = (\[.*\]);", txt, re.S).group(1))
kr = [(i, g) for i, g in enumerate(DB) if g.get("c") == "KR"]

# app.js 런타임 추가 구장(EXTRA_CLUBS)과 중복 방지
try:
    extra = re.findall(r'\{\s*n:\s*"([^"]+)"', open(os.path.join(ROOT, "js", "app.js"), encoding="utf-8").read())
except Exception:
    extra = []

bynorm = {}
for i, g in kr:
    bynorm.setdefault(norm(g["n"]), (i, g))

linked, added, ambiguous, failed = [], [], [], []
for club, addr in sorted(targets.items()):
    # 1) 사람이 주소로 확인한 개명 구장
    if club in CONFIRMED:
        linked.append((club, CONFIRMED[club], 0.0, "주소확인"))
        alias_map[club] = CONFIRMED[club]
        continue
    # 2) 정규화 이름이 정확히 일치하면 지오코딩 없이 연결 (오지오코딩 방지)
    if club not in FORCE_NEW and norm(club) in bynorm:
        nm = bynorm[norm(club)][1]["n"]
        linked.append((club, nm, 0.0, "이름일치"))
        alias_map[club] = nm
        continue
    g = geocode(addr, club)
    if not g:
        failed.append((club, addr[:26]))
        continue
    lat, lon, how = g
    ck = norm(club)
    near = sorted((km(lat, lon, x["lat"], x["lon"]), i, x) for i, x in kr)
    near = [n for n in near if n[0] <= 2.5]

    def similar(x):
        xk = norm(x["n"])
        if not ck or not xk:
            return False
        return ck == xk or ck in xk or xk in ck or (len(ck) >= 2 and ck[:2] == xk[:2])

    named = [] if club in FORCE_NEW else [n for n in near if similar(n[2])]
    if club in FORCE_NEW:
        added.append((club, lat, lon))
        if WRITE:
            DB.append({"n": club, "lat": round(lat, 5), "lon": round(lon, 5), "c": "KR"})
    elif len(named) == 1:
        d, i, x = named[0]
        linked.append((club, x["n"], round(d, 2), how))
        alias_map[club] = x["n"]
    elif len(named) > 1:
        ambiguous.append((club, [n[2]["n"] for n in named[:3]]))
    elif near:
        ambiguous.append((club, ["이름 불일치: " + n[2]["n"] for n in near[:2]]))
    else:
        if any(norm(club) and (norm(club) in norm(e) or norm(e) in norm(club)) for e in extra):
            ambiguous.append((club, ["앱 내장 목록에 이미 있음"]))
            continue
        added.append((club, lat, lon))
        if WRITE:
            DB.append({"n": club, "lat": round(lat, 5), "lon": round(lon, 5), "c": "KR"})

print(f"대상 {len(targets)}곳 → 별칭연결 {len(linked)} / 신규추가 {len(added)} / 보류 {len(ambiguous)} / 실패 {len(failed)}\n")
for c, n, d, how in linked:
    print(f"  연결: '{c}' → '{n}' ({d}km, {how})")
for c, la, lo in added:
    print(f"  신규: '{c}' ({la:.4f},{lo:.4f})")
for c, why in ambiguous:
    print(f"  보류: '{c}' ↔ {why}")
for c, a in failed:
    print(f"  실패: '{c}' — {a}")

if WRITE:
    json.dump(alias_map, open(ALIAS_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
    new = "const GOLF_DB = " + json.dumps(DB, ensure_ascii=False, separators=(",", ":")) + ";"
    open(path, "w", encoding="utf-8", newline="\n").write(
        re.sub(r"const GOLF_DB = \[.*\];", lambda m: new, txt, flags=re.S))
    print(f"\ngz_alias.json {len(alias_map)}건 · golfdb.js 반영 완료")
