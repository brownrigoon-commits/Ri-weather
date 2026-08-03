# -*- coding: utf-8 -*-
"""문구 사전 검사 (배포 관문) — 2026-07-31 신설

두 가지를 본다.

① **키가 사전에 있는가**
   `tr("home.title")` 을 불렀는데 사전에 없으면 화면에 `home.title` 이라는 **키가 그대로**
   찍힌다. 눈에 띄긴 하지만 배포된 뒤에 발견하면 늦다.

② **번역하면 안 되는 값이 그대로 남아 있는가** — 이게 더 중요하다.
   이 앱에는 '화면에 보이지만 사실은 값(프로토콜 토큰)'인 한국어가 있다.
   사전으로 옮기는 순간 조용히 깨진다:
     · 베타 의견 분류 "오류/불편/아이디어/칭찬" → 서버가 이 문자열로 검증(Code.gs FB_CATS).
       바꾸면 이용자 의견이 **재시도 없이 사라진다**(stats.js 는 서버가 거절하면 큐에 안 넣는다).
     · 캐디 샷 라벨 "티샷/세컨샷/…" → AI 응답을 이 라벨의 정규식으로 쪼갠다.
     · 프로필·동의 값 "여성"·"60대 이상"·"1년 미만" → 문자열 동치로 분기하고
       localStorage 에도 그대로 저장된다. 바꾸면 **기존 이용자 기록이 끊긴다.**
   그래서 '이 파일에는 이 문자열이 반드시 남아 있어야 한다'를 못 박아 둔다.

사용
  python tools/check_i18n.py            # 위반만, 있으면 종료코드 1
  python tools/check_i18n.py --report   # 통과 항목·고아 키까지
"""
import glob, html.parser, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# tr() 을 부르는 곳 — 사용자 화면을 그리는 파일 전부
CALLERS = ["index.html", "js/app.js", "js/booking.js", "js/stay.js", "js/clubfit.js",
           "js/loading.js", "js/legal.js", "js/stats.js", "js/spirit.js", "js/weatherfx.js",
           "ops-k58zq.html"]

# ── 절대 사라지면 안 되는 '값' — (파일, 반드시 있어야 할 문자열, 왜) ──────────
KEEP = [
    ("index.html", '"오류"', "베타 의견 분류값(서버 검증)"),
    ("index.html", '"불편"', "베타 의견 분류값(서버 검증)"),
    ("index.html", '"아이디어"', "베타 의견 분류값(서버 검증)"),
    ("index.html", '"칭찬"', "베타 의견 분류값(서버 검증)"),
    ("js/app.js", '"티샷"', "캐디 응답 파싱 라벨"),
    ("js/app.js", '"세컨샷"', "캐디 응답 파싱 라벨"),
    ("js/app.js", '"서드샷"', "캐디 응답 파싱 라벨"),
    ("js/app.js", '"여성"', "프로필 값(문자열 동치 분기 + localStorage)"),
    ("js/app.js", '"60대 이상"', "프로필 값(문자열 동치 분기 + localStorage)"),
    ("js/clubfit.js", "타이틀리스트", "클럽 브랜드 값(피팅 엔진 매칭)"),
    ("js/stats.js", "경기", "통계 지역 집계 키"),
    ('js/booking.js', 'p.set("tab", "조인")', "골프몬에 보내는 URL 파라미터 값 — 번역하면 조인 목록이 안 열린다"),
    ("js/booking.js", '"1인"', "골프몬 인원 필터 값"),
    ("js/booking.js", "컨트리클럽", "구장명 정규화 값(build_booking_ids.py 와 같은 규칙)"),
]


def read(rel):
    p = os.path.join(ROOT, rel)
    return open(p, encoding="utf-8").read() if os.path.exists(p) else ""


def dict_keys(lang="ko"):
    keys = {}
    for f in sorted(glob.glob(os.path.join(ROOT, "js", "i18n", "src", f"{lang}.*.json"))):
        try:
            d = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        for k, v in d.items():
            keys[k] = v
    return keys


def used_keys():
    """문구를 부르는 곳 — 두 가지 방식이 있다.
       ① 자바스크립트: tr("키")
       ② 정적 마크업: data-i18n="키" / data-i18n-attr="placeholder:키;aria-label:키2"
          (HTML 안에서는 tr() 을 못 부르므로 표시만 달고 I18N.applyDom() 이 채운다)
       ②를 세지 않으면 index.html 문구 200개가 통째로 '아무도 안 쓰는 키'로 잡힌다. """
    used = {}
    for rel in CALLERS:
        src = read(rel)
        for m in re.finditer(r'tr\(\s*"([^"]+)"', src):
            used.setdefault(m.group(1), []).append(rel)
        for m in re.finditer(r"tr\(\s*'([^']+)'", src):
            used.setdefault(m.group(1), []).append(rel)
        for m in re.finditer(r'data-i18n="([^"]+)"', src):
            used.setdefault(m.group(1), []).append(rel)
        for m in re.finditer(r'data-i18n-attr="([^"]+)"', src):
            for pair in m.group(1).split(";"):
                if ":" in pair:
                    used.setdefault(pair.split(":", 1)[1].strip(), []).append(rel)
    return used


class _KoScan(html.parser.HTMLParser):
    """마크업을 훑어 '표시가 안 붙은 한국어 글자'를 찾는다.

       I18N.applyDom() 은 `data-i18n` 이 달린 요소의 textContent 만 바꾼다.
       표시가 없으면 그 글자는 **일본어 화면에서도 한국어로 남는다.**
       사전 키가 다 있어도 이건 못 잡는다 — 애초에 키를 안 만든 글자이기 때문이다.
       (2026-08-03 실측: '위 검색창에서…' 등 2곳이 이 구멍으로 새어 일본어 화면에 남아 있었다.
        기존 ①②만으로는 검사가 'OK' 라고 답했다.) """

    # <title> 은 뺐다 — 탭 제목도 이용자에게 보이는 글자다(홈 화면 추가 때 뜬다)

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # [(태그, 표시있음, 안쪽까지덮음)]
        self.hits = []
        self.bad_option = []     # 값이 안 박힌 채 번역되는 <option>

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        # data-i18n / -node / -html / -skip 중 무엇이든 있으면 '표시된' 것으로 본다
        marked = any(k.startswith("data-i18n") for k in a)
        # data-i18n-html 은 **안쪽을 통째로** 갈아 끼우므로 그 아래도 모두 덮인다
        deep = "data-i18n-html" in a
        # 🔴 <option> 은 value 가 없으면 **글자가 곧 값**이다.
        #    글자를 일본어로 옮기는 순간 .value 도 일본어가 되어
        #    저장된 기록("화이트")과 어긋나고, $("#sf-tee").value = "화이트" 도 실패한다.
        #    번역되는 option 에는 한국어를 value 로 못 박아 두어야 한다.
        if tag == "option" and marked and "value" not in a:
            self.bad_option.append(self.getpos()[0])
        # void 요소는 닫는 태그가 없어 쌓으면 안 된다
        if tag not in ("br", "img", "input", "meta", "link", "hr", "source"):
            self.stack.append((tag, marked, deep))

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        if not KO_CH.search(data) or not data.strip():
            return
        if any(t in ("script", "style") for t, _, _ in self.stack):
            return
        # 글자를 채워 주는 것은 **바로 위 요소**다 — data-i18n/-node 는 조상에 달 수 없다
        # (textContent 로 덮으면 자식이 통째로 사라진다).
        # 다만 data-i18n-html 은 안쪽을 통째로 바꾸므로 조상에 있어도 덮인다.
        if self.stack and self.stack[-1][1]:
            return
        if any(deep for _, _, deep in self.stack):
            return
        where = " > ".join(t for t, _, _ in self.stack[-3:])
        self.hits.append((where, " ".join(data.split())[:46], self.getpos()[0]))


KO_CH = re.compile(r"[가-힣]")


def scan_html(rel="index.html"):
    p = _KoScan()
    p.feed(read(rel))
    return p


def unmarked_korean(rel="index.html"):
    return scan_html(rel).hits


def violations(root=None):
    have = dict_keys("ko")
    used = used_keys()
    bad, note = [], []

    scan = scan_html("index.html")
    for where, text, line in scan.hits:
        bad.append(f'index.html:{line} 표시가 없는 한국어: "{text}" (<{where}>) '
                   f'— 일본어 화면에서도 한국어로 남습니다. data-i18n 을 달거나, '
                   f'일부러 두는 것이면 data-i18n-skip 을 다세요')
    # 🔴 번역기 내부 표식(§0§)이 문구에 남아 있으면 그대로 화면에 찍힌다.
    #    "19サイズ§1§" 처럼 나간 적이 있다(2026-08-03 사장님 발견, 5개).
    #    원인은 build_i18n_ja.py 가 **모델이 지어낸** 표식을 확인하지 않은 것.
    #    거기서도 막았지만, 손으로 사전을 고칠 수도 있으니 관문에서도 본다.
    for f in sorted(glob.glob(os.path.join(ROOT, "js", "i18n", "src", "*.json"))):
        try:
            d = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        for k, v in d.items():
            if isinstance(v, str) and "§" in v:
                bad.append(f'{os.path.basename(f)} "{k}" 에 번역기 표식이 남았습니다: '
                           f'{v[:40]} — 화면에 그대로 찍힙니다')

    for line in scan.bad_option:
        bad.append(f'index.html:{line} 번역되는 <option> 에 value 가 없습니다 '
                   f'— 글자가 곧 저장값이라 옮기는 순간 기존 이용자 기록과 어긋납니다. '
                   f'value="한국어원문" 을 박으세요')

    # tr("app.pf." + t) 처럼 **이어 붙여 만드는 키**는 정적으로 확인할 수 없다.
    # 점으로 끝나면 그건 온전한 키가 아니라 앞머리다 — 없는 키라고 하면 거짓 경보다.
    # (이런 자리는 코드가 tr() 결과가 키 그대로면 원문을 쓰도록 되받침을 두고 있다)
    prefixes = sorted(k for k in used if k.endswith("."))
    if prefixes:
        note.append(f"이어 붙여 만드는 키 {len(prefixes)}종 (정적 확인 불가): {', '.join(prefixes)}")
    missing = [k for k in used if k not in have and not k.endswith(".")]
    if missing:
        for k in sorted(missing)[:20]:
            bad.append(f'사전에 없는 키: "{k}" ({", ".join(sorted(set(used[k])))}) — 화면에 키가 그대로 나옵니다')

    for rel, needle, why in KEEP:
        src = read(rel)
        if not src:
            continue
        if needle not in src:
            bad.append(f'{rel} 에서 {needle} 이(가) 사라졌습니다 — {why}. 사전으로 옮기면 안 되는 값입니다')

    orphan = [k for k in have if k not in used]
    if orphan:
        note.append(f"아무 데서도 안 쓰는 문구 {len(orphan)}개 (지워도 됨) — 예: {', '.join(sorted(orphan)[:3])}")
    note.append(f"문구 {len(have)}개 · 부르는 곳 {len(used)}개 키")
    return bad, note


def main():
    bad, note = violations()
    if bad:
        print(f"✖ 문구 사전 검사 실패 {len(bad)}건")
        for s in bad[:20]:
            print("   -", s)
        if len(bad) > 20:
            print(f"   … 외 {len(bad)-20}건")
        return 1
    if "--report" in sys.argv:
        for s in note:
            print("  ·", s)
    print("문구 사전 검사 OK: 키가 모두 있고, 옮기면 안 되는 값도 그대로입니다")
    return 0


if __name__ == "__main__":
    sys.exit(main())
