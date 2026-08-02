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
    # 밀떡아재는 잡음이 많아 규격을 건다.
    #   `[전백시]`·`코스설명` 시리즈 + `○○CC / ○○코스` 형식(코스 후기)까지 쓴다.
    #   '코스' 가 든 것을 전부 받으면 "몽베르CC 주말그린피는 얼마?" 같은 게 섞인다.
    {"id": "UC6o2v8AHFCiac76gC5jE90A", "name": "밀떡아재",
     "only": r"전백시|코스\s*설명|(CC|GC)\s*/\s*[^/]{0,10}코스"},
]

# 같은 구장인데 이름이 다르게 불리는 것들 — **사람이 확인한 것만** 적는다.
# 추측으로 적으면 남의 구장 영상이 붙는다. 확인한 날짜와 근거를 함께 남긴다.
ALIAS = {
    "아난티가평": "아난티클럽 서울",     # 사장님 확인 2026-08-02: 아난티 가평 = 아난티클럽 서울
    "아난티코드가평": "아난티클럽 서울",  # 위와 같은 곳의 다른 표기
    "남해아난티": "아난티 남해 골프클럽",  # 제목이 '남해 아난티 CC' 순서라 그냥은 안 잡힌다
}

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


# 시·군·구 이름 — OSM 행정경계(admin_level 4·6)에서 뽑았다(2026-08-02, 219개).
# 구장 이름 뒤에 지역이 붙는 지점 표기("베어크리크 포천CC")를 가려내는 데만 쓴다.
REGION = frozenset([
    "가평", "강남", "강동", "강릉", "강북", "강서", "강원", "강진", "강화", "거제", "거창", "검단", "경기", "경산", "경상남",
    "경상북", "경주", "계룡", "계양", "고령", "고성", "고양", "고창", "고흥", "곡성", "공주", "과천", "관악", "광명", "광산",
    "광양", "광주", "광진", "괴산", "구례", "구로", "구리", "구미", "군산", "군위", "군포", "금산", "금정", "금천", "기장",
    "김제", "김천", "김포", "김해", "나주", "남동", "남양주", "남원", "남해", "노원", "논산", "단양", "달서", "달성", "담양",
    "당진", "대구", "대덕", "대전", "도봉", "동대문", "동두천", "동래", "동작", "동해", "마포", "목포", "무안", "무주", "문경",
    "미추홀", "밀양", "보령", "보성", "보은", "봉화", "부산", "부산진", "부안", "부여", "부천", "부평", "사상", "사천", "사하",
    "산청", "삼척", "상주", "서귀포", "서대문", "서산", "서울", "서천", "서초", "서해", "성남", "성동", "성북", "성주", "세종",
    "속초", "송파", "수성", "수영", "수원", "순창", "순천", "시흥", "신안", "아산", "안동", "안산", "안성", "안양", "양구",
    "양산", "양양", "양주", "양천", "양평", "여수", "여주", "연수", "연제", "연천", "영광", "영덕", "영도", "영동", "영등포",
    "영암", "영양", "영월", "영종", "영주", "영천", "예산", "예천", "오산", "옥천", "옹진", "완도", "완주", "용산", "용인",
    "울릉", "울산", "울주", "울진", "원주", "유성", "은평", "음성", "의령", "의성", "의왕", "의정부", "이천", "익산", "인제",
    "인천", "임실", "장성", "장수", "장흥", "전북", "전주", "정선", "정읍", "제물포", "제주", "제천", "종로", "중랑", "증평",
    "진도", "진안", "진주", "진천", "창녕", "창원", "천안", "철원", "청도", "청송", "청양", "청주", "춘천", "충주", "충청남",
    "충청북", "칠곡", "태백", "태안", "통영", "파주", "평창", "평택", "포천", "포항", "하남", "하동", "함안", "함양", "함평",
    "합천", "해남", "해운대", "홍성", "홍천", "화성", "화순", "화천", "횡성"
])


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
    return _runs(title, max_words)[0]


def _runs(title, max_words=4):
    """(뒤에서 끝나는 묶음, 앞쪽까지 포함한 모든 묶음, 낱말수) 를 돌려준다."""
    s = PAREN.sub(" ", str(title or ""))
    m = TERM.search(s)
    if m:
        s = s[:m.start()]                  # 첫 CC/GC 앞까지가 구장 이름 자리
    s = BIZ.sub(" ", s)
    toks = [w for w in re.split(r"[^0-9A-Za-z가-힣]+", s.lower()) if w]
    every = set()
    for i in range(len(toks)):
        acc = ""
        for j in range(i, min(i + max_words, len(toks))):
            acc += toks[j]
            every.add(acc)
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
    return runs, every, len(toks)


def pick_course(title, index, min_len=2):
    """제목에서 우리 구장을 찾아낸다. 애매하면 **버린다** — 엉뚱한 구장에 붙이면 거짓 정보다.

    G1 필수포함 · G2 타 구장 우선권 · G4 부정 키워드 (G3 지역게이트는 아직 없다)
    """
    if NEG.search(title):
        return None
    runs, every, ntok = _runs(title)
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

    # 이긴 이름이 **지역명 하나뿐**이면 지점 표기일 수 있다.
    #   "베어크리크 포천 CC / 크리크인코스" 가 포천GC 에 붙었다(2026-08-02).
    # 앞쪽에 진짜 구장 이름이 있으면 그쪽이 맞고, 없으면 지역명 그대로 인정한다.
    #   "베어크리크 포천CC" → 앞에 베어크리크 가 있다 → 베어크리크
    #   "원더클럽 파주CC"   → 앞의 '원더클럽' 은 운영사라 사전에 없다 → 파주CC 그대로
    #   "포천GC 밸리코스"   → 앞에 아무것도 없다 → 포천GC 그대로
    if hits[0][0] in REGION and ntok > 1:
        alt = {n for k, n in index.items()
               if len(k) >= 3 and k in every and k not in REGION and n != hits[0][1]}
        if len(alt) == 1:
            return alt.pop()
        if alt:
            return None                   # 후보가 둘 이상 = 판단 불가 → 버린다
    return hits[0][1]


# ── 설명문으로 찾기 (제목이 안 될 때) ──────────────────────────
# 맵가이더는 설명문에 **구장 주소**를 적어 둔다. 이게 제목보다 확실한 단서다.
#     아도니스 cc : 경기 포천시 신북면 포천로 2499
#     덕유산 CC   : 전북 무주군 …
# 주소의 시·군 이름을 이름 앞에 붙여 다시 맞춰 보면 등록명과 짝이 맞는다.
#     '덕유산 CC' + '무주'   → 무주덕유산CC
#     '에스파크 CC' + '밀양' → 밀양에스파크컨트리클럽
SIDO = r"(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)"
DESC_ADDR = re.compile(r"^(.{2,30}?)\s*[:：]\s*(" + SIDO + r"[^\n]{4,60})$", re.M)


def pick_by_desc(desc, index):
    """설명문의 '<이름> : <주소>' 줄로 구장을 특정한다. 애매하면 역시 버린다."""
    m = DESC_ADDR.search(desc or "")
    if not m:
        return None
    nm, addr = m.group(1).strip(), m.group(2)
    regions = re.findall(r"([가-힣]{2,6})(?:특별자치도|특별시|광역시|시|군|구)\b", addr)
    tries = [nm] + [f"{r} {nm}" for r in regions] + [f"{nm} {r}" for r in regions]
    # ① 제목과 똑같은 규칙으로 한 번
    found = {c for c in (pick_course(t, index) for t in tries) if c}
    # ② 설명문의 그 줄은 '제목' 이 아니라 **구장 이름 그 자체**다.
    #    그러니 등록명과 통째로 같은지도 본다 — '소노펠리체CC 델피노' 처럼
    #    코스 이름까지 붙은 등록명은 이 경로로만 맞는다.
    for t in tries:
        n = index.get(core(t))
        if n:
            found.add(n)
    if len(found) != 1:
        return None
    got = found.pop()
    # 마지막 확인 — 찾아낸 등록명이 설명문의 이름과 실제로 겹치는가?
    #   "골프클럽Q CC : 경기 안성시…" 가 안성CC 로 갈 뻔했다(2026-08-01).
    #   '골프클럽' 이 사업자 표시로 잘려 나가면서 지역명 '안성' 만 남은 탓이다.
    a, b = core(nm), core(got)
    return got if (a and b and (a in b or b in a)) else None


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
                # 설명문은 저장물에 넣지 않는다(용량). 매칭에만 쓰고 버린다.
                "_desc": sn.get("description", ""),
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
    # 사람이 확인한 다른 이름들 — 등록명이 실제로 있을 때만 넣는다
    added = 0
    nameset = set(names)
    for alias, real in ALIAS.items():
        if real not in nameset:
            print(f"  ⚠️ 별칭 '{alias}' 의 등록명 '{real}' 이 구장DB에 없습니다 — 건너뜁니다")
            continue
        k = core(alias)
        if k and k not in index:
            index[k] = real
            added += 1
    print(f"구장 이름 사전: {len(index)}개 (등록 홀맵 {len(our_courses())}곳 · 확인된 별칭 {added}개 포함)")

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

    by_course, dropped, by_desc = {}, 0, 0
    for v in vids:
        c = pick_course(v["title"], index)
        if not c:                          # 제목이 안 되면 설명문의 주소로 한 번 더
            c = pick_by_desc(v.pop("_desc", ""), index)
            if c:
                by_desc += 1
        v.pop("_desc", None)               # 저장물에는 설명문을 남기지 않는다
        if not c:
            dropped += 1
            continue
        by_course.setdefault(c, []).append(v)

    # 영향력 순 — 조회수를 그대로 쓴다(설계 §4: 파생 점수를 화면에 노출하지 않는다)
    for c in by_course:
        by_course[c].sort(key=lambda v: (-v["views"], -v["likes"]))

    total = sum(len(v) for v in by_course.values())
    print(f"매칭: {len(by_course)}개 구장 · 영상 {total}편 "
          f"(그중 설명문 주소로 찾은 것 {by_desc}편 · 구장 못 찾아 버림 {dropped}편)")
    for c in sorted(by_course, key=lambda c: -len(by_course[c]))[:8]:
        print(f"   {c}: {len(by_course[c])}편 (최다 {by_course[c][0]['views']:,}회)")

    if a.report:
        return
    body = json.dumps(by_course, ensure_ascii=False, indent=1, sort_keys=True)
    js = ("/* 구장별 유튜브 공략 영상 — tools/build_coursevideos.py 산출물. 손으로 고치지 말 것.\n"
          " * ⓒ TOURLIST — 구장·영상 매칭 색인은 데이터베이스제작자 권리 보호 대상.\n"
          " *   무단 수집·복제·재배포 금지(이용약관 제5조·제7조).\n"
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
