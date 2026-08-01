# -*- coding: utf-8 -*-
"""구장별 유튜브 공략 영상 수집 → js/coursevideos.js (생성물)

설계: docs/구장영상_설계.md
사장님 지시(2026-08-01): "홀맵이 있건 없건 그 구장 공략 영상을 골프존처럼 깔끔하게,
영향력 있는 순서로 아래에 나열해 달라. 한국 구장부터."

두 가지 방식을 쓴다.
  ① RSS (키 없음)  — 채널 최신 15편만. 공개 피드라 제한 없이 쓸 수 있고 **조회수·좋아요가 들어 있다**.
  ② API (키 있음)  — 채널 업로드 전량. 진짜 전량 수집은 이쪽이어야 한다.

    python tools/build_coursevideos.py            키가 있으면 전량, 없으면 RSS 로
    python tools/build_coursevideos.py --rss      키가 있어도 RSS 로만
    python tools/build_coursevideos.py --report   결과만 다시 보기

키 두는 곳: **`.secrets/youtube_key.txt`** 에 키만 한 줄로 붙여넣는다.
  · `.secrets/` 는 .gitignore 에 있어 저장소에 절대 올라가지 않는다.
  · 환경변수 `YOUTUBE_API_KEY` 도 읽는다.
  · 키를 대화창·커밋 메시지에 붙여넣지 말 것 — 파일에만 둔다.

⚠️ **API 키를 앱에 넣지 말 것.** 정적 사이트라 즉시 유출된다. 수집은 로컬에서만 한다.
⚠️ 조회수는 유튜브 정책상 **30일 이상 보관 금지**(Non-Authorized Data).
   그래서 파일에 fetchedAt 을 박고, 화면에 기준일을 함께 찍는다. 2주마다 다시 돌릴 것.
"""
import argparse, io, json, os, re, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone, timedelta

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0"}
KST = timezone(timedelta(hours=9))

# 한국 공략 채널 — 제목 규격이 일정해서 구장명 역매칭이 된다(설계 §2)
#
# only 를 적으면 **그 규격에 맞는 영상만** 쓴다.
#   채널 전체를 그냥 넣으면 스키장·쇼츠·레슨까지 딸려 와서 '구장 공략 영상' 자리에
#   엉뚱한 게 걸린다. 실제로 "휘닉스파크 스키장 슬로프 리뷰" 가 휘닉스평창CC 에,
#   "#골프스타" 해시태그가 스타CC 에 붙는 것을 확인했다(2026-08-01).
#
# 후보를 실측한 결과(업로드 → 공략 규격 → 새로 붙는 구장):
#   리보플TV   289 → 285 → 41곳   ← 사실상 두 번째 맵가이더, 전량 사용
#   밀떡아재   737 → 103 → 13곳   ← [전백시] 캐디 코스설명 시리즈만
#   유추레저   168 →  18 →  2곳   ← 스키·워터파크가 섞여 있어 뺀다
#   한빛탑골프 218 →  22 →  1곳   ← 드론 전경이라 공략이 아니다
#   잔디/승파리/골프왕 이도진      0~1곳  ← 넣을 이유가 없다
CHANNELS = [
    {"id": "UC83hXsDcu-xtFbn3xMrnd4g", "name": "맵가이더"},
    {"id": "UC6y4ayKLqOcBCO7u9PHC9rQ", "name": "리보플TV"},
    {"id": "UC6o2v8AHFCiac76gC5jE90A", "name": "밀떡아재",
     "only": r"전백시|코스\s*설명"},
]

# ── 구장명 정규화 ─────────────────────────────────────────────
BIZ = re.compile(r"(컨트리클럽|골프앤리조트|골프클럽|골프리조트|골프장|리조트|CC|GC|G\.C|C\.C|골프)", re.I)
PAREN = re.compile(r"\(.*?\)|\[.*?\]")


def core(name):
    s = PAREN.sub(" ", str(name or ""))
    s = BIZ.sub(" ", s)
    return re.sub(r"[^0-9A-Za-z가-힣]", "", s).lower()


def our_courses():
    """등록 구장 = 홀맵 DB. 영상은 홀맵이 없어도 붙이지만, 이름 사전은 여기서 만든다."""
    src = open(os.path.join(ROOT, "js", "holeimgdb.js"), encoding="utf-8").read()
    return re.findall(r'^  "([^"]+)":\s*\{', src, re.M)


# 구장 이름이 아닌 것들 — OSM 유래 골프장DB 에 섞여 있는 찌꺼기.
# ⚠️ 이걸 안 거르면 **남의 구장 영상을 가로챈다.**
#    실제로 "솔모로CC 파인코스공략" 영상이 '파인코스' 라는 이름에 붙었다(2026-08-01).
CLUB_MARK = re.compile(r"(CC|GC|G\.C|C\.C|클럽|컨트리|골프|리조트|밸리|힐|파크)", re.I)
JUNK_NAME = re.compile(r"^(골프장|골프연습장|론볼장|시작|주차장|클럽하우스)$")


def is_club_name(n):
    """코스(구역) 이름만 있고 구장 정체성이 없으면 사전에서 뺀다.
    · '파인코스'·'메이플코스'·'오동도코스' → 뺀다 (어느 구장인지 알 수 없다)
    · '클럽72 바다코스'·'샤인빌파크CC-PALM코스' → 남긴다 (구장 표시가 있다)
    """
    if JUNK_NAME.match(n.strip()):
        return False
    if n.strip().endswith("코스") and not CLUB_MARK.search(n.replace("코스", "")):
        return False
    return True


def all_course_names():
    """골프장 DB(한국)까지 포함 — 홀맵이 없는 구장에도 영상을 붙이기 위해서다."""
    names = set(our_courses())
    dropped = []
    try:
        src = open(os.path.join(ROOT, "js", "golfdb.js"), encoding="utf-8").read()
        rows = json.loads(src[src.index("["):src.rindex("]") + 1])
        for r in rows:
            if r.get("c") == "KR" and r.get("n"):
                if is_club_name(r["n"]):
                    names.add(r["n"])
                else:
                    dropped.append(r["n"])
    except Exception as e:
        print("  골프장DB 읽기 실패(무시):", str(e)[:60])
    if dropped:
        print(f"  구장명이 아니라서 뺀 것 {len(set(dropped))}종: "
              + ", ".join(sorted(set(dropped))[:8]))
    return sorted(names)


# ── 오탐 필터 (설계 §6) ───────────────────────────────────────
# 공략 영상이 아닌 것. 아래 말들은 실제로 걸려 나온 것들이라 하나씩 늘려 왔다.
#   스키·슬로프·워터파크 — 리조트 이름이 골프장과 같아서 붙는다(휘닉스평창·곤지암·하이원)
#   쇼츠·레슨 — 구장과 상관없는 내용인데 해시태그에 구장 이름이 들어간다
NEG = re.compile(r"연습장|파3장|스크린|시타|맛집|회원권|분양|먹방|브이로그|vlog"
                 r"|스키|슬로프|워터파크|눈꽃|썰매|쇼츠|shorts|레슨|스윙연습|퍼팅연습", re.I)


# 구장 이름이 끝나는 자리 — "○○CC" 의 CC 뒤는 코스 이름·지점 이름이지 구장 이름이 아니다.
# (골프·골프장 은 여기 넣지 않는다. "골프존카운티" 처럼 이름 안에 들어가는 말이라서다.)
TERM = re.compile(r"(CC|GC|C\.C|G\.C|컨트리클럽|골프클럽|골프앤리조트|골프리조트)", re.I)


def name_runs(title, max_words=4):
    """제목에서 **구장 이름이 놓일 자리**를 낱말 단위로 뽑는다.

    글자만 이어 붙여 비교하면 남의 이름 속에 우리 이름이 들어 있을 때 걸려든다.
    실제로 이렇게 잘못 붙었다(2026-08-01, 전부 실측):
        "타이거힐 CC"      → 타이거CC     "마이다스구미 CC" → 구미CC
        "한림용인"          → 용인CC       "동강시스타cc"    → 스타CC
        "유니아일랜드 CC"  → 아일랜드CC   "힐마루CC포천"    → 포천GC
    그래서 ① 낱말 경계를 지키고 ② 첫 CC/GC 앞까지만 본다.
    "군위 칼레이트CC"(지역+구장)는 살고, "힐마루CC포천"(구장+지점)은 걸러진다.
    """
    s = PAREN.sub(" ", str(title or ""))
    m = TERM.search(s)
    if m:
        s = s[:m.start()]                  # 첫 CC/GC 앞까지가 구장 이름 자리
    s = BIZ.sub(" ", s)
    toks = [w for w in re.split(r"[^0-9A-Za-z가-힣]+", s.lower()) if w]
    runs = set()
    if m and toks:
        # CC/GC 가 있으면 **구장 이름은 그 바로 앞**이고, 앞쪽 낱말은 지역명이다.
        #   "강원도 고성 소노펠리체CC" 의 '고성' 을 고성CC 로 붙일 뻔했다(2026-08-01).
        # 그래서 마지막 낱말에서 끝나는 묶음만 본다. "충북 음성 감곡CC" → 감곡 ○, 음성 ✕
        for i in range(max(0, len(toks) - max_words), len(toks)):
            runs.add("".join(toks[i:]))
    else:
        # CC/GC 가 없는 해시태그형 제목("#골프존카운티 순천 #골프장 …")은 통째로 훑는다
        for i in range(len(toks)):         # "김포 씨사이드" 처럼 여러 낱말짜리 이름도 잡는다
            acc = ""
            for j in range(i, min(i + max_words, len(toks))):
                acc += toks[j]
                runs.add(acc)
    return runs


def pick_course(title, index, min_len=2):
    """제목에서 우리 구장을 찾아낸다. 애매하면 **버린다** — 엉뚱한 구장에 붙이면 거짓 정보다.

    G1 필수포함 · G2 타 구장 우선권 · G4 부정 키워드 (G3 지역게이트는 아직 없다)
    """
    if NEG.search(title):
        return None
    runs = name_runs(title)
    # CC/GC 표시가 없는 제목(해시태그형)은 근거가 약하니 두 글자 이름은 안 받는다.
    #   "#골프스타" 가 '골프' 를 떼고 나면 '스타' 가 되어 스타CC 에 붙었다(2026-08-01).
    if not TERM.search(PAREN.sub(" ", str(title or ""))):
        min_len = max(min_len, 3)
    hits = [(k, n) for k, n in index.items() if len(k) >= min_len and k in runs]
    if not hits:
        return None
    # 가장 긴 이름이 이긴다 — "신라" 와 "경주신라" 가 함께 걸리면 후자가 맞다
    hits.sort(key=lambda x: -len(x[0]))
    if len(hits) > 1 and len(hits[0][0]) == len(hits[1][0]):
        return None                       # 같은 길이로 둘 이상 = 판단 불가 → 버린다
    return hits[0][1]


# ── RSS 수집 ─────────────────────────────────────────────────
def fetch(url, timeout=25):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read()


def from_rss(ch):
    """공개 RSS — 최신 15편. 조회수·좋아요가 함께 온다(2026-08-01 실측)."""
    url = "https://www.youtube.com/feeds/videos.xml?channel_id=" + ch["id"]
    xml = fetch(url).decode("utf-8", "replace")
    out = []
    for e in xml.split("<entry>")[1:]:
        vid = re.search(r"<yt:videoId>([^<]+)</yt:videoId>", e)
        title = re.search(r"<media:title>([^<]*)</media:title>", e) or re.search(r"<title>([^<]*)</title>", e)
        pub = re.search(r"<published>([^<]+)</published>", e)
        views = re.search(r'<media:statistics views="(\d+)"', e)
        likes = re.search(r'<media:starRating[^>]*count="(\d+)"', e)
        if not (vid and title):
            continue
        out.append({
            "videoId": vid.group(1),
            "title": unescape(title.group(1)),
            "channel": ch["name"],
            "views": int(views.group(1)) if views else 0,
            "likes": int(likes.group(1)) if likes else 0,
            "publishedAt": (pub.group(1)[:10] if pub else ""),
        })
    return out


def unescape(s):
    return (s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
             .replace("&quot;", '"').replace("&#39;", "'"))


# ── API 수집 (키가 있을 때) ───────────────────────────────────
def from_api(ch, key):
    """채널 업로드 전량 — playlistItems 는 '검색 100회/일' 버킷을 안 쓴다(설계 §1)."""
    uploads = "UU" + ch["id"][2:]
    ids, page = [], ""
    while True:
        u = ("https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails"
             f"&playlistId={uploads}&maxResults=50&key={key}" + (f"&pageToken={page}" if page else ""))
        j = json.loads(fetch(u))
        ids += [i["contentDetails"]["videoId"] for i in j.get("items", [])]
        page = j.get("nextPageToken")
        if not page:
            break
    out = []
    for i in range(0, len(ids), 50):
        u = ("https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,status"
             f"&id={','.join(ids[i:i+50])}&key={key}")
        for v in json.loads(fetch(u)).get("items", []):
            if not v.get("status", {}).get("embeddable", True):
                continue                     # 임베드 불가는 애초에 뺀다
            st, sn = v.get("statistics", {}), v.get("snippet", {})
            out.append({
                "videoId": v["id"], "title": sn.get("title", ""), "channel": ch["name"],
                "views": int(st.get("viewCount", 0)), "likes": int(st.get("likeCount", 0)),
                "publishedAt": sn.get("publishedAt", "")[:10],
            })
    return out


# ── 메인 ─────────────────────────────────────────────────────
def read_key():
    """키는 파일이나 환경변수에서만 읽는다 — 명령줄에 적으면 셸 기록에 남는다."""
    k = os.environ.get("YOUTUBE_API_KEY", "").strip()
    if k:
        return k
    p = os.path.join(ROOT, ".secrets", "youtube_key.txt")
    if os.path.exists(p):
        return open(p, encoding="utf-8").read().strip()
    return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rss", action="store_true", help="키가 있어도 RSS 로만 수집")
    ap.add_argument("--report", action="store_true")
    a = ap.parse_args()
    a.api = "" if a.rss else read_key()
    if a.api:
        print("YouTube API 키 확인됨 — 채널 업로드 전량 수집합니다")
    else:
        print("키 없음 → RSS(채널 최신 15편)로 수집합니다. "
              ".secrets/youtube_key.txt 에 키를 넣으면 전량 수집됩니다.")

    names = all_course_names()
    index = {}
    for n in names:
        k = core(n)
        if len(k) < 2:
            continue
        index[k] = index.get(k) or n          # 먼저 등록된 이름을 대표로
    print(f"구장 이름 사전: {len(index)}개 (등록 홀맵 {len(our_courses())}곳 포함)")

    vids = []
    for ch in CHANNELS:
        try:
            got = from_api(ch, a.api) if a.api else from_rss(ch)
            raw = len(got)
            if ch.get("only"):              # 채널에 규격을 정해 뒀으면 그것만 쓴다
                pat = re.compile(ch["only"], re.I)
                got = [v for v in got if pat.search(v["title"])]
            note = f"{raw}편 → 규격 {len(got)}편" if ch.get("only") else f"{raw}편"
            print(f"  {ch['name']}: {note} ({'API 전량' if a.api else 'RSS 최신'})")
            vids += got
            time.sleep(0.3)
        except Exception as e:
            print(f"  {ch['name']}: 실패 — {str(e)[:80]}")

    by_course, dropped = {}, 0
    for v in vids:
        c = pick_course(v["title"], index)
        if not c:
            dropped += 1
            continue
        by_course.setdefault(c, []).append(v)

    # 영향력 순 — 조회수를 그대로 쓴다(설계 §4: 파생 점수를 화면에 노출하지 않는다)
    for c in by_course:
        by_course[c].sort(key=lambda v: (-v["views"], -v["likes"]))

    total = sum(len(v) for v in by_course.values())
    print(f"매칭: {len(by_course)}개 구장 · 영상 {total}편 (구장 못 찾아 버림 {dropped}편)")
    for c in sorted(by_course, key=lambda c: -len(by_course[c]))[:8]:
        print(f"   {c}: {len(by_course[c])}편 (최다 {by_course[c][0]['views']:,}회)")

    if a.report:
        return
    body = json.dumps(by_course, ensure_ascii=False, indent=1, sort_keys=True)
    js = ("/* 구장별 유튜브 공략 영상 — tools/build_coursevideos.py 산출물. 손으로 고치지 말 것.\n"
          " *\n"
          " * ⚠️ 조회수는 유튜브 정책상 30일 이상 보관하면 안 된다(Non-Authorized Data).\n"
          " *    화면에 FETCHED_AT 을 기준일로 함께 찍고, 2주마다 다시 수집할 것.\n"
          " * ⚠️ 정렬은 조회수 그대로 — 조회수·좋아요를 섞은 자체 점수를 화면에 쓰지 않는다.\n"
          " */\n"
          f'const COURSE_VIDEOS_AT = "{datetime.now(KST).strftime("%Y-%m-%d")}";\n'
          f"const COURSE_VIDEOS = {body};\n")
    p = os.path.join(ROOT, "js", "coursevideos.js")
    open(p, "w", encoding="utf-8", newline="\n").write(js)
    print("생성:", p)


if __name__ == "__main__":
    main()
