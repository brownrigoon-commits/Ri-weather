# -*- coding: utf-8 -*-
"""화면을 그리는 코드에 **박혀 있는 한국어**를 찾는다 (배포 관문) — 2026-08-03

왜 필요한가.
  check_i18n.py 는 index.html 의 정적 마크업만 본다. 그런데 이 앱은 화면 대부분을
  자바스크립트가 그린다. 코드 안에 한국어를 그대로 써 두면 일본어 화면에서도
  한국어가 나오는데, 지금까지 그걸 잡는 것이 없었다.

  브라우저로 훑는 방법도 써 봤지만 **그때 화면에 떠 있는 것만** 보인다.
  '매일 한 문장 받아보시겠어요?' 권유 카드는 아직 대답 안 한 사람에게만 뜨는데,
  검사할 때 이미 대답한 상태여서 못 보고 배포했다(2026-08-03 사장님이 발견).
  화면에 언제 뜨는지와 무관하게 **소스에서** 찾아야 한다.

무엇을 문제로 보나 — '화면에 나갈 한국어'
  · 문자열 안에 한글이 있고
  · 그 문자열이 화면을 만드는 자리에 있다 (innerHTML/textContent 조립, HTML 조각,
    button/div 태그 문자열 등)
무엇을 봐주나
  · 주석
  · KEEP 로 못 박아 둔 '값'(프로토콜 토큰) — check_i18n.py 와 같은 목록
  · ALLOW 에 적어 둔 자리 (이유를 함께 적는다)

🔴 이 검사가 못 잡는 것 — 알고 쓰라고 적어 둔다
  '한 줄 안에 화면을 만드는 신호(innerHTML·태그 등)가 같이 있어야' 잡는다.
  그래서 **표(배열)로만 적힌 한국어**는 지나친다. 실제로 놓친 적이 있다:
      const CITY_LABELS = [ ["서울", 37.566, 126.978], ["도쿄", 35.690, 139.692], … ]
  이 줄에는 태그도 innerHTML 도 없어 그냥 값 표처럼 보이는데, 저 글자가 지도 위에 그대로 찍혔다
  (2026-08-03 사장님이 일본어 화면 지도에서 「도쿄」를 보고 알려 주셨다).
  표를 조건 없이 잡으면 프로토콜 값 표까지 전부 걸려 쓸모가 없어진다 —
  그래서 **표에 한국어를 담을 때는 사람이 스스로 물어야 한다: 이 글자가 화면에 나가는가.**
  화면에 나간다면 나라별 표기를 함께 담아라(CITY_LABELS 가 그 예다).

사용
  python tools/check_ko_literal.py            위반만, 있으면 종료코드 1
  python tools/check_ko_literal.py --report   전부 나열
"""
import os, re, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 사용자 화면을 그리는 파일
FILES = ["js/app.js", "js/spirit.js", "js/stay.js", "js/booking.js",
         "js/clubfit.js", "js/loading.js", "js/legal.js", "js/stats.js",
         "js/weatherfx.js", "js/i18n.js", "js/jppack.js"]

KO = re.compile(r"[가-힣]")

# 한글이 들어 있어도 **값**이라 그대로 둬야 하는 것들.
# (번역하면 저장된 기록·서버 검증·정규식 판정이 조용히 깨진다 — check_i18n.py 머리말 참조)
ALLOW_SUBSTR = [
    # 프로필·티·구질 값
    "여성", "남성", "선택 안 함", "60대 이상", "1년 미만", "화이트", "레이디",
    "스트레이트", "슬라이스", "페이드", "드로우", "훅",
    # 캐디 응답 파싱 라벨
    "티샷", "세컨샷", "서드샷",
    # 부킹 프로토콜 값
    "조인", "1인", "2인", "3인", "부부커플", "컨트리클럽",
    # 방향·위험물 판정값 (app.hs.w.* 로 화면 글자는 따로 뽑는다)
    "좌측", "우측", "리·마을", "읍·면", "동네",
    # 사전 키 이름 자체
    "app.pf.", "app.hs.w.", "app.addr.",
    # 지역·업종 정규화 표 (검색 대조용 값)
    "골프장", "골프", "컨트리",
]

# 자리별 예외 — (파일, 한 줄 안에 들어 있는 표식, 이유)
ALLOW_LINE = [
    ("js/app.js", "ADDR_TYPE_KO", "주소 종류 '값' 표 — 화면 글자는 addrTypeLabel() 이 사전에서 뽑는다"),
    ("js/app.js", "shapeBend", "구질→방향 판정표(값)"),
    ("js/app.js", "sideOfPlay", "좌/우 판정(값)"),
    ("js/app.js", "josaI", "한국어 조사 처리 — 한국어에서만 쓴다"),
    ("js/spirit.js", "josaIGa", "한국어 조사 처리 — 한국어에서만 쓴다"),
    ("js/booking.js", "BK_BIZ", "구장명 정규화 정규식(값)"),
]

# 화면을 만드는 자리로 보는 신호
SCREEN = re.compile(
    r"innerHTML|textContent|insertAdjacentHTML|createTextNode|"
    r"\.title\s*=|alert\(|confirm\(|placeholder|aria-label|"
    r"<\s*(div|span|button|p|b|small|a|li|h[1-6]|strong|em|td|th)\b", re.I)

STR = re.compile(r"""(['"`])((?:\\.|(?!\1)[^\\])*)\1""")

# 이미 언어로 갈라 놓은 줄 — `ja ? "電話" : "전화"` 처럼 일본어를 따로 준 곳
LANG_BRANCH = re.compile(r"\bja\s*\?|I18N\.lang\s*===\s*[\"']ja[\"']")
# 값과 견주는 자리 — 표시가 아니라 판정이다 (`y === "전체"`)
COMPARE = re.compile(r"[=!]==?\s*[\"'][^\"']*[가-힣]|[\"'][^\"']*[가-힣][^\"']*[\"']\s*[=!]==?")


def strip_comments(line):
    """줄 주석만 걷어낸다(문자열 안의 // 는 건드리지 않는다)."""
    out, i, q = [], 0, None
    while i < len(line):
        c = line[i]
        if q:
            if c == "\\":
                out.append(line[i:i + 2]); i += 2; continue
            if c == q:
                q = None
            out.append(c)
        else:
            if c in "'\"`":
                q = c; out.append(c)
            elif c == "/" and i + 1 < len(line) and line[i + 1] == "/":
                break
            else:
                out.append(c)
        i += 1
    return "".join(out)


def scan(rel):
    p = os.path.join(ROOT, rel)
    if not os.path.exists(p):
        return []
    hits, block = [], False
    for no, raw in enumerate(open(p, encoding="utf-8"), 1):
        line = raw
        # 블록 주석 건너뛰기
        if block:
            if "*/" in line:
                block = False
                line = line.split("*/", 1)[1]
            else:
                continue
        while "/*" in line:
            before, rest = line.split("/*", 1)
            if "*/" in rest:
                line = before + rest.split("*/", 1)[1]
            else:
                line = before; block = True; break
        line = strip_comments(line)
        if not KO.search(line):
            continue
        if any(rel == f and k in raw for f, k, _ in ALLOW_LINE):
            continue
        # 이미 언어로 갈라 놓은 줄은 봐준다 — `ja ? "電話" : "전화"` 는 옳은 코드다.
        # (사전을 안 거쳐도 일본어 화면에 한국어가 나가지 않는다)
        if LANG_BRANCH.search(line):
            continue
        # 값과 견주는 자리(`y === "전체"`)는 표시가 아니라 판정이다
        if COMPARE.search(line):
            continue
        if not SCREEN.search(line):
            continue
        for m in STR.finditer(line):
            s = m.group(2)
            if not KO.search(s):
                continue
            if any(a in s for a in ALLOW_SUBSTR):
                continue
            hits.append((no, s.strip()[:60]))
    return hits


def main():
    bad = []
    for rel in FILES:
        for no, s in scan(rel):
            bad.append(f'{rel}:{no} 코드에 박힌 한국어: "{s}" '
                       f'— 일본어 화면에서도 이대로 나옵니다. tr("키") 로 바꾸세요')
    if bad:
        print(f"✖ 코드에 박힌 한국어 {len(bad)}건")
        for s in bad[:40]:
            print("   -", s)
        if len(bad) > 40:
            print(f"   … 외 {len(bad)-40}건")
        return 1
    print("코드 한국어 검사 OK: 화면을 그리는 코드에 박힌 한국어 없음")
    return 0


if __name__ == "__main__":
    sys.exit(main())
