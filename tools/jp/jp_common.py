# -*- coding: utf-8 -*-
"""일본 구장 수집 공통 부품 — 예절·차단목록·이름대조 (2026-08-01 신설)

설계: docs/일본_6메뉴_데이터_설계.md §2·§7

여기 모아 둔 이유: 출처가 여럿(아코디아·東急·東京建物·多摩興産)인데
**수집 예절과 이름 대조는 출처마다 달라지면 안 되기 때문**이다.
한 곳에서 고치면 전 수집기가 같이 고쳐진다.

⚠️ 한국 파이프라인(tools/*.py)은 이 파일을 쓰지 않는다. 한 줄도 건드리지 않기 위해서다.
"""
import json, math, os, re, sys, time, unicodedata
import urllib.error, urllib.request

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
GOLFDB = os.path.join(ROOT, "js", "golfdb.js")
HP_JP = os.path.join(ROOT, "coursedata", "homepages_jp")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

# ── 수집 예절 (docs/일본_6메뉴_데이터_설계.md §7) ────────────────────
# 목적: 공식 공개 페이지의 홀 수치·홀맵을 정상 속도로 읽어 온다.
# 지키는 것: 요청 간격 1초 · 재시도 2회 · UA 1종 고정 · robots 준수.
# 하지 않는 것: 헤더/세션 조합을 바꿔가며 반복 시험(= 접근제한 우회와 구분되지 않는다).
GAP = 1.0
RETRY = 2
_last = [0.0]


class Blocked(Exception):
    """차단 의사표시를 만났다 — 우회하지 않고 그 출처를 접는다."""


def fetch(url, binary=False, timeout=30):
    """예절을 지키는 GET. (status, headers, body) 반환. 403/429 는 Blocked."""
    for attempt in range(RETRY + 1):
        wait = GAP - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                body = r.read()
                return r.status, dict(r.headers), (body if binary else body.decode("utf-8", "replace"))
        except urllib.error.HTTPError as e:
            if e.code in (403, 429):
                raise Blocked(f"HTTP {e.code} — 수집을 중단합니다: {url}")
            if e.code == 404:
                return 404, {}, b"" if binary else ""
            if attempt == RETRY:
                return e.code, {}, b"" if binary else ""
        except Exception:
            if attempt == RETRY:
                return 0, {}, b"" if binary else ""
        time.sleep(2)
    return 0, {}, b"" if binary else ""


# ── robots.txt 차단 목록 ─────────────────────────────────────────
# ⚠️ 아코디아 robots 는 차단을 `/*gid=NNN*`(질의문자열)로 적어 두는데
#    우리가 받는 홀맵은 `/images/course/NNN/`(경로)이다. 표준 robotparser 는
#    이 둘을 같은 구장으로 보지 못한다 → **번호를 직접 뽑아 대조해야 한다.**
def robots_blocklist(host):
    """(차단 gid 집합, 차단 golfCourse 경로 집합) — 못 읽으면 전면 차단으로 간주."""
    code, _, body = fetch(host + "/robots.txt")
    if code != 200 or not body:
        raise Blocked(f"robots.txt 를 읽지 못했습니다({code}) — 수집하지 않습니다: {host}")
    gids = set(re.findall(r"Disallow\s*:\s*/\*gid=(\d+)\*", body))
    paths = set(re.findall(r"Disallow\s*:\s*/\*(golfCourse/[^*\s]+)/\*", body))
    return gids, paths


# ── 이름 대조 (golfdb 와 붙이기) ─────────────────────────────────
# 홀 데이터는 **golfdb 의 구장 이름을 키로** 저장된다. 이름이 한 글자라도 다르면
# 수집해도 화면에 영원히 안 뜬다(조용한 실패). 그래서 대조를 코드로 강제한다.
#
# 🔴 부분일치는 절대 쓰지 않는다 — 2026-07-30 '그린골프클럽 ← 골드그린GC' 사고가
#    바로 부분일치 폴백 때문이었다. 일본은 セントラル·エクセレント 처럼 같은 앞말을
#    쓰는 계열 구장이 많아 더 위험하다(실측: セントラルゴルフクラブ 가
#    セントラル福岡GC 에 부분일치로 붙었다 — 서로 다른 현의 다른 구장).
#
# 🔴 '종류 표기'를 그냥 지우면 안 된다 (2026-08-01 실측으로 알게 된 것).
#    지웠더니 `小名浜カントリー倶楽部` 가 `小名浜ゴルフ場` 에 붙었다 —
#    같은 지역의 **서로 다른 시설**일 수 있는데도 이름이 같아져 버린다.
#    그래서 지우는 대신 **같은 뜻끼리 묶는다**:
#      ゴルフクラブ = ゴルフ倶楽部 = GC   (클럽)      → "G"
#      カントリークラブ = カンツリー倶楽部 = CC (컨트리) → "C"
#      ゴルフ場 = ゴルフコース = ゴルフリンクス (코스)  → "L"
#    글자만 다른 같은 말(クラブ↔倶楽部)은 붙고, 종류가 다르면 안 붙는다.
TYPE_CLASSES = [
    ("G", (r"ゴルフ倶楽部", r"ゴルフクラブ", r"ｺﾞﾙﾌｸﾗﾌﾞ", r"ＧＣ", r"GC", r"golfclub")),
    ("C", (r"カントリークラブ", r"カンツリークラブ", r"カントリー倶楽部", r"カンツリー倶楽部",
           r"カントリー", r"カンツリー", r"ＣＣ", r"CC", r"countryclub")),
    ("L", (r"ゴルフコース", r"ゴルフリンクス", r"ゴルフ場", r"golfcourse", r"golflinks")),
]


def norm_name(s, fold_type=False):
    """비교용 정규화. fold_type=True 면 종류 표기를 '같은 뜻끼리' 한 글자로 묶는다."""
    s = unicodedata.normalize("NFKC", s or "")
    s = re.sub(r"[\s　・･\-‐‑‒–—―~〜（）\(\)&＆]+", "", s)
    if fold_type:
        for tag, words in TYPE_CLASSES:
            for w in words:
                s = re.sub(w, "\x00" + tag, s, flags=re.I)
    return s.lower()


# 일본 도도부현 대략 중심 좌표 — 이름이 붙은 뒤 **엉뚱한 지방인지** 되짚는 용도.
# (정밀 판정용이 아니다. 600km 떨어진 동명 구장을 걸러내는 그물이다.)
PREF_CENTER = {
    "hokkaido": (43.2, 142.5), "aomori": (40.7, 140.7), "iwate": (39.6, 141.3),
    "miyagi": (38.4, 140.9), "akita": (39.7, 140.4), "yamagata": (38.4, 140.2),
    "fukushima": (37.5, 140.3), "ibaraki": (36.3, 140.3), "tochigi": (36.7, 139.8),
    "gunma": (36.5, 139.0), "saitama": (36.0, 139.4), "chiba": (35.5, 140.2),
    "tokyo": (35.7, 139.5), "kanagawa": (35.4, 139.4), "niigata": (37.5, 138.9),
    "toyama": (36.6, 137.2), "ishikawa": (36.8, 136.8), "fukui": (35.9, 136.3),
    "yamanashi": (35.6, 138.6), "nagano": (36.2, 138.1), "gifu": (35.7, 137.0),
    "shizuoka": (35.0, 138.4), "aichi": (35.0, 137.1), "mie": (34.6, 136.4),
    "shiga": (35.2, 136.1), "kyoto": (35.2, 135.6), "osaka": (34.6, 135.5),
    "hyogo": (34.9, 135.0), "nara": (34.4, 135.9), "wakayama": (34.0, 135.4),
    "tottori": (35.4, 133.8), "shimane": (35.1, 132.6), "okayama": (34.9, 133.8),
    "hiroshima": (34.5, 132.8), "yamaguchi": (34.2, 131.5), "tokushima": (33.9, 134.3),
    "kagawa": (34.2, 134.0), "ehime": (33.7, 132.9), "kochi": (33.5, 133.4),
    "fukuoka": (33.5, 130.6), "saga": (33.3, 130.1), "nagasaki": (33.0, 129.8),
    "kumamoto": (32.7, 130.8), "oita": (33.2, 131.4), "miyazaki": (32.1, 131.3),
    "kagoshima": (31.6, 130.6), "okinawa": (26.4, 127.8),
}
PREF_RADIUS_KM = 160.0


def km(a, b, c, d):
    R, p = 6371.0, math.pi / 180
    x = (math.sin((c - a) * p / 2) ** 2
         + math.cos(a * p) * math.cos(c * p) * math.sin((d - b) * p / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(x))


def load_golfdb_jp():
    raw = open(GOLFDB, encoding="utf-8").read()
    arr = json.loads(raw[raw.index("["):raw.rindex("]") + 1])
    return [g for g in arr if g.get("c") == "JP"]


class NameResolver:
    """수집한 구장명 → golfdb 구장명. 확실할 때만 답하고, 아니면 이유를 준다."""

    def __init__(self):
        self.jp = load_golfdb_jp()
        self.exact = {}
        self.by_norm, self.by_core = {}, {}
        for g in self.jp:
            self.exact.setdefault(g["n"], g)
            self.by_norm.setdefault(norm_name(g["n"]), []).append(g)
            self.by_core.setdefault(norm_name(g["n"], True), []).append(g)

    def resolve(self, name, pref=None):
        """→ (golfdb명 or None, 사유, 판정단계)"""
        for level, table, key in (
            ("이름 그대로", self.exact, name),
            ("공백·기호만 다름", self.by_norm, norm_name(name)),
            ("클럽↔倶楽部 표기차", self.by_core, norm_name(name, True)),
        ):
            hit = table.get(key)
            if not hit:
                continue
            cands = [hit] if isinstance(hit, dict) else hit
            if len(cands) > 1:
                return None, f"후보가 {len(cands)}곳이라 확정 못 함: " + " / ".join(c["n"] for c in cands), level
            g = cands[0]
            # 되짚기 — 이름이 붙었어도 엉뚱한 지방이면 사람이 확인해야 한다
            if pref and pref in PREF_CENTER:
                d = km(PREF_CENTER[pref][0], PREF_CENTER[pref][1], g["lat"], g["lon"])
                if d > PREF_RADIUS_KM:
                    return None, f"{pref} 인데 golfdb 좌표가 {d:.0f}km 떨어짐 ({g['n']}) — 사람 확인 필요", level
            return g["n"], "", level
        return None, "golfdb 에 없는 구장 (앱에서 검색이 안 되므로 등록해도 안 보임)", "-"


# ── 이미지 검증 ──────────────────────────────────────────────────
# 🔴 아코디아는 호스트를 틀리면 **HTTP 200 인데 내용이 HTML 오류 페이지**다(1,465B).
#    그대로 저장하면 '홀맵이 있는 구장'으로 등록돼 화면에 깨진 그림이 뜬다.
#    그래서 Content-Type 과 실제 바이트(매직넘버)를 둘 다 본다.
MAGIC = {b"\xff\xd8\xff": "jpg", b"\x89PNG": "png", b"GIF8": "gif", b"RIFF": "webp"}
MIN_IMAGE_BYTES = 10_000


# ── 홀 통계를 홀맵 순서에 맞추기 ──────────────────────────────────
def align_stats(map_pars, stat_pars):
    """홀맵의 홀 순서에 맞도록 통계의 자리를 바꾼다 → 자리표(index 목록) or None

    왜 필요한가 (2026-08-02 실측):
      · 여러 코스를 가진 구장은 **출처마다 코스 순서가 다르다**
        (水戸: 홀맵 南西北東 / じゃらん 다른 순서)
      · 18홀 구장인데 じゃらん 이 IN 을 먼저 싣는 곳이 있다
        (船戸山GC 통계 홀번호가 10~18 로 시작)
      순서를 안 맞추고 붙이면 **다른 홀의 통계가 표시된다** — 홀맵이 뒤바뀌는 것과 같은 사고다.

    맞추는 방법: 9홀 단위로 잘라 **파 배열이 같은 덩어리끼리** 짝짓는다.
    짝이 하나로 정해지지 않으면(같은 파 배열이 둘 이상) **포기한다** — 추측하지 않는다.
    """
    if not map_pars or not stat_pars or len(map_pars) != len(stat_pars):
        return None
    if map_pars == stat_pars:
        return list(range(len(map_pars)))
    n = len(map_pars)
    if n % 9:
        return None
    blocks = n // 9
    mb = [tuple(map_pars[i * 9:(i + 1) * 9]) for i in range(blocks)]
    sb = [tuple(stat_pars[i * 9:(i + 1) * 9]) for i in range(blocks)]
    used, order = set(), []
    for want in mb:
        cand = [j for j in range(blocks) if j not in used and sb[j] == want]
        if len(cand) != 1:
            return None                    # 없거나 여럿 — 어느 것인지 확정 못 한다
        used.add(cand[0])
        order.append(cand[0])
    idx = []
    for b in order:
        idx.extend(range(b * 9, b * 9 + 9))
    return idx


def looks_like_image(headers, body):
    """→ (참/거짓, 사유)

    판정 기준은 **실제 바이트(매직넘버)** 다. Content-Type 은 참고만 한다 —
    아코디아 일부 구장 서버가 정상 JPEG 를 application/octet-stream 으로 보내는 바람에
    Content-Type 만 보고 1,026홀을 통째로 거절한 일이 있었다(2026-08-01 본수집).
    반대로 www 호스트 함정(200 인데 HTML)은 매직넘버 검사가 그대로 잡는다.
    """
    ct = (headers.get("Content-Type") or "").lower()
    if "text/html" in ct:
        return False, f"HTML 페이지가 옴({ct}) — 오류 페이지 함정"
    if not any(body.startswith(m) for m in MAGIC):
        return False, f"이미지 형식이 아님(첫 바이트 {body[:4].hex()}, Content-Type {ct or '없음'})"
    if len(body) < MIN_IMAGE_BYTES:
        return False, f"너무 작음({len(body)}B) — 배지 아이콘이나 빈 그림일 수 있음"
    return True, ""


# ────────────────────────────────────────────────────────────────────────────
# 배치용 Gemini 키·요청 예산 (2026-08-02 사고 이후 신설)
# ────────────────────────────────────────────────────────────────────────────

KEY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".gemini_key")


def batch_key():
    """배치 전용 Gemini 키를 읽는다. 없으면 None.

    🔴 앱에 심어둔 키(js/app.js 의 EMBED_GEM_B64)로는 **절대 폴백하지 않는다.**
       2026-08-02: 번역 배치가 앱 캐디와 같은 키를 썼다. 무료 등급 Flash 는
       **하루 20회**라서 배치가 그걸 다 먹었고, 그동안 이용자들의 AI 캐디가
       같이 막혔다. 배치는 사용자 기능을 굶긴다.
       키가 없으면 차라리 아무것도 하지 않는 편이 낫다.

    순서: tools/jp/.gemini_key 파일 → 환경변수 GEMINI_BATCH_KEY
    (.gemini_key 는 .gitignore 에 있다 — 공개 저장소다)
    """
    if os.path.exists(KEY_FILE):
        k = open(KEY_FILE, encoding="utf-8").read().strip()
        if k:
            return k
    return os.environ.get("GEMINI_BATCH_KEY") or None


class Budget:
    """하루 요청 수를 스스로 지킨다.

    429 를 맞고 나서 멈추는 건 이미 늦다 — 429 는 남의 몫까지 축내며 실패한 요청이다.
    그래서 **보내기 전에** 센다. 세어 둔 값은 파일에 남겨 프로그램을 다시 켜도 이어진다.

    무료 등급 실측 한도 (2026-08-02, 사장님 계정에서 직접 읽음):
        Flash 계열      분당 5회  · 하루 **20회**
        Flash Lite 계열 분당 15회 · 하루 **500회**   ← 배치는 이쪽을 쓴다
    """

    def __init__(self, path, rpd=500, rpm=15):
        self.path, self.rpd, self.rpm = path, rpd, rpm
        self.day, self.used = self._load()
        self.stamps = []

    def _today(self):
        # 구글의 하루는 태평양 시간 자정에 바뀐다. 우리 시간대로 세면 경계에서 어긋난다.
        return time.strftime("%Y-%m-%d", time.gmtime(time.time() - 8 * 3600))

    def _load(self):
        try:
            j = json.load(open(self.path, encoding="utf-8"))
            if j.get("day") == self._today():
                return j["day"], int(j["used"])
        except Exception:
            pass
        return self._today(), 0

    def _save(self):
        try:
            os.makedirs(os.path.dirname(self.path), exist_ok=True)
            json.dump({"day": self.day, "used": self.used},
                      open(self.path, "w", encoding="utf-8"))
        except Exception:
            pass

    def left(self):
        if self.day != self._today():          # 자정을 넘겼다
            self.day, self.used = self._today(), 0
        return self.rpd - self.used

    def take(self):
        """한 번 보낼 자리를 받는다. 하루치를 다 썼으면 False — 그러면 멈춘다."""
        if self.left() <= 0:
            return False
        now = time.time()
        self.stamps = [t for t in self.stamps if now - t < 60]
        if len(self.stamps) >= self.rpm:       # 분당 한도는 기다리면 풀린다
            time.sleep(60 - (now - self.stamps[0]) + 0.5)
            self.stamps = [t for t in self.stamps if time.time() - t < 60]
        self.stamps.append(time.time())
        self.used += 1
        self._save()
        return True


# ────────────────────────────────────────────────────────────────────────────
# 통계 ↔ 홀맵 자리 맞추기 — **한 곳에서만 한다**
# ────────────────────────────────────────────────────────────────────────────

def load_aligned():
    """홀맵과 통계를 짝지어, 홀맵 순서에 맞춰 정렬된 구장 목록을 돌려준다.

    → (rows, info)
       rows[i] = {course, source, sourceUrl, collectedAt, pars, holes, facts, map}
                 map = 홀맵 쪽 홀 배열(파·티·hdcp·그림) — 같은 순서
       info    = {"skipped":n, "reordered":n, "unaligned":n}

    🔴 왜 함수로 뽑았나
       조립기와 문장 생성기가 **각자** 자리를 맞추면, 한쪽 규칙만 바뀌었을 때
       같은 홀에 다른 자료가 붙는다. 2026-08-02 에 이름 다듬는 규칙이 도구마다 달라
       44곳의 통계가 조용히 빠진 일이 있었다 — 자리 맞추기는 그보다 더 조용히 틀린다
       (숫자는 보이는데 **엉뚱한 홀의 숫자**다). 그래서 한 곳에서만 한다.
    """
    reg, maps = {}, {}
    for d in os.listdir(HP_JP):
        f = os.path.join(HP_JP, d, "parsed.json")
        if not os.path.exists(f):
            continue
        try:
            j = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        flat = [dict(h, cname=c.get("name", "")) for c in j["courses"] for h in c["holes"]]
        reg[j["course"]] = [h.get("par") for h in flat]
        maps[j["course"]] = flat

    stats_dir = os.path.join(HP_JP, "_stats")
    rows = {"skipped": 0, "reordered": 0, "unaligned": 0}
    out = []
    if not os.path.isdir(stats_dir):
        return out, rows
    for fn in sorted(f for f in os.listdir(stats_dir) if f.endswith(".json")):
        try:
            d = json.load(open(os.path.join(stats_dir, fn), encoding="utf-8"))
        except Exception:
            continue
        # 같은 폴더에 도구가 쓰는 파일이 섞인다 — **이름이 아니라 형태**로 가른다
        if not (isinstance(d, dict) and "course" in d and "holes" in d):
            continue
        if d["course"] not in reg:
            rows["skipped"] += 1
            continue
        theirs = reg[d["course"]]
        if any(a is not None for a in theirs) and theirs != d["pars"]:
            idx = align_stats(theirs, d["pars"])
            if idx is None:
                rows["unaligned"] += 1
                continue          # 엉뚱한 홀에 붙느니 없는 게 낫다
            d["pars"] = [d["pars"][i] for i in idx]
            d["holes"] = [d["holes"][i] for i in idx]
            if d.get("facts"):
                d["facts"] = [d["facts"][i] for i in idx]
            rows["reordered"] += 1
        d["map"] = maps[d["course"]]
        out.append(d)
    return out, rows
