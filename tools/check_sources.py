# -*- coding: utf-8 -*-
"""등록 구장 이름 ↔ 자료 출처가 같은 구장인지 검사 — 배포 전 관문

**왜 필요한가 (2026-07-30 실제 사고)**
`그린골프클럽`(경기 남양주)으로 등록된 홀맵·거리가 `goldgreen.co.kr` =
**`골드그린GC`(울산)** 것이었다. 두 구장은 400km 떨어진 완전히 다른 골프장이다.

원인은 이름 맞추기의 **부분일치 폴백**이다. 등록 도구들이 이름에서 'CC/GC/골프클럽'
같은 꼬리를 떼고 비교하는데,
    norm("그린골프클럽") = "그린"   ⊂   norm("골드그린GC") = "골드그린"
이어서 "그린" 이 "골드그린" 안에 들어간다는 이유로 통과됐다.
`universal_build.resolve_dir()` 과 `golfzon_build` 의 폴백이 같은 규칙을 쓴다.

**검사 방법 — 추측하지 않는다.** `parsed.json` 의 `sourceUrl` 로 자료를 실제로 어디서
가져왔는지 되짚어, 그 출처가 말하는 구장 이름과 등록명을 비교한다.
  · 홈페이지 파싱분 → `coursedata/homepages_auto/*/meta.json` 의 `seed` 가 같은 폴더
  · 골프존분      → `coursedata/golfzon/cc_*.json` 의 `detail.homepageUrl` 이 같은 파일

사용
  python tools/check_sources.py            # 위반만, 있으면 종료코드 1
  python tools/check_sources.py --report   # 전부 나열
"""
import glob, json, os, re, sys, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HP = os.path.join(ROOT, "coursedata", "homepages")
AUTO = os.path.join(ROOT, "coursedata", "homepages_auto")
GZ = os.path.join(ROOT, "coursedata", "golfzon")

TAIL = r"(CC|GC|C\.C|G\.C|컨트리클럽|골프클럽|골프장|골프앤리조트|골프리조트|리조트|컨트리|클럽|\s|·|&|\(.*?\))"


def norm(s):
    return re.sub(TAIL, "", s or "", flags=re.I).lower()


def safe_match(a, b):
    """두 구장 이름이 같은 구장을 가리키는가.

    완전히 같으면 통과. 한쪽이 다른 쪽에 들어가는 경우는 **길이 비율 70% 이상**일 때만
    통과시킨다 — 이게 '그린' ⊂ '골드그린'(50%) 을 막는 선이다.
    ('서산수' ⊂ '서산수골프앤리조트' 처럼 꼬리만 다른 경우는 norm 이 이미 같게 만든다.)
    """
    x, y = norm(a), norm(b)
    if not x or not y:
        return False
    if x == y:
        return True
    if x in y or y in x:
        return min(len(x), len(y)) / max(len(x), len(y)) >= 0.70
    return False


# 앱DB 표기와 골프존 표기가 다르지만 **같은 구장임을 확인한** 쌍.
# (앞말·뒷말이 붙거나 개명된 경우 — 2026-07-30 12건 전수 확인)
# 새 쌍이 여기 없으면 검사가 막는다. 확인 없이 추가하지 말 것.
VERIFIED = {
    "알프스대영CC": "청우 GC",                  # 창원 청우GC → 알프스대영CC 개명
    "테디밸리 골프&리조트": "테디밸리CC",
    "프린세스GC": "포웰CC  프린세스",
    "포웰CC": "포웰CC 김해",
    "휘닉스평창 CC": "휘닉스 CC",
    "밀양에스파크컨트리클럽": "에스파크 CC",
    "베어크리크G.C": "베어크리크 GC-크리크코스",
    "엘리체컨트리클럽": "화순엘리체 CC",
    "루나힐스안성컨트리클럽": "포웰CC 안성",       # 포웰CC 안성 → 루나힐스안성 개명
    "탑스텐리조트 동강시스타CC": "동강시스타 CC",
    "샤인빌파크CC-PALM코스": "샤인빌파크 CC",
    "에이치원클럽": "H1 CLUB",                  # 옛 드림파크CC(dpcc.co.kr) → H1 CLUB
}


# 홈페이지에서 직접 파싱한 구장은 골프존에 그 도메인이 없어 자동 판정이 안 된다.
# 그래서 **사이트를 직접 열어 하단 주소·상호로 확인한 결과**를 여기 적어 둔다(2026-07-30 전수).
# 이 표에 없는 도메인은 '참고'로만 뜨고, 표에 있는데 이름이 다르면 **배포를 막는다**.
SITE_NAME = {
    "ansung.hanlimgolf.co.kr": "한림안성CC",
    "gamgokcc.com": "감곡CC",
    "goldgreen.co.kr": "골드그린GC",        # 울산·영남알프스. '그린골프클럽'(남양주)이 아니다
    "h1club.co.kr": "에이치원클럽",          # 경기 이천 호법면 장자터로 115. '서서울CC'가 아니다
    "seoseoul.co.kr": "서서울CC",           # 경기 파주 광탄면 혜음로 324 (Lake·Hill 코스)
    "kjcc.co.kr": "광주CC",
    "montvertcc.com": "몽베르CC",
    "tyleisure.co.kr": "파인크리크CC",
    "pinevalley.co.kr": "파인밸리CC",
    "theninegc.co.kr": "더나인골프클럽",
    "thestarhue.com": "더스타휴 골프앤리조트",
    "wellingtoncc.co.kr": "웰링턴CC",
    "elevencc.co.kr": "일레븐CC",
    "shambhalacc.co.kr": "샴발라CC",
    "sunningpoint.com": "써닝포인트CC",
    "tigercc.co.kr": "타이거CC",
}


def host(u):
    try:
        h = urllib.parse.urlparse(u if "//" in (u or "") else "http://" + (u or "")).netloc.lower()
    except Exception:
        return ""
    return re.sub(r"^www\.", "", h)


def source_names(url):
    """sourceUrl 로 되짚은 '출처가 말하는 구장 이름' 후보들"""
    h = host(url)
    if not h:
        return []
    names = []
    # ⚠️ 수집 폴더 이름은 근거로 쓰지 않는다 — 그건 '찾으려던 이름'이지
    #    '그 사이트가 스스로 밝히는 이름'이 아니다. 실제로 `그린골프클럽` 폴더의 seed 가
    #    goldgreen.co.kr(=골드그린GC) 이었고, 폴더 이름을 믿었더니 검사가 통과해버렸다.
    #    골프존 원본의 ccName 은 골프존이 그 홈페이지를 보고 붙인 이름이라 근거로 쓸 수 있다.
    for f in glob.glob(os.path.join(GZ, "cc_*.json")):
        try:
            d = json.load(open(f, encoding="utf-8")).get("detail", {})
        except Exception:
            continue
        if d.get("country") != 1:
            continue
        if host(d.get("homepageUrl") or "") == h:
            names.append(("골프존", (d.get("ccName") or "").split(" - ")[0].strip()))
    return names


def violations(root=ROOT):
    bad, note = [], []
    for f in sorted(glob.glob(os.path.join(HP, "*", "parsed.json"))):
        slug = os.path.basename(os.path.dirname(f))
        try:
            j = json.load(open(f, encoding="utf-8"))
        except Exception as e:
            bad.append(f"{slug}: parsed.json 을 읽지 못함 — {e}")
            continue
        name, url = j.get("course"), j.get("sourceUrl") or ""
        # 사람이 사이트를 열어 확인해 둔 도메인은 이것만으로 판정한다(가장 확실한 근거)
        known = SITE_NAME.get(host(url))
        if known:
            if safe_match(name, known) or VERIFIED.get(name) == known:
                continue
            bad.append(f"{name} [{slug}]: {host(url)} 는 **{known}** 의 홈페이지입니다 — 다른 구장의 자료입니다")
            continue
        cands = source_names(url)
        if not cands:
            note.append(f"{name} [{slug}]: 출처를 되짚을 자료가 없음 ({host(url) or '주소 없음'}) — 수동 수집분")
            continue
        if any(safe_match(name, c[1]) for c in cands):
            continue
        if VERIFIED.get(name) in [c[1] for c in cands]:
            continue
        # 같은 도메인에 여러 지점이 있는 브랜드(골프존카운티·포웰 등)는 이름이 다를 수 있다
        listed = ", ".join(f"{k}:{v}" for k, v in cands[:4])
        if len(cands) > 1:
            note.append(f"{name} [{slug}]: 한 도메인에 여러 구장 — 사람이 확인 ({listed})")
        else:
            bad.append(f"{name} [{slug}]: 자료 출처는 '{cands[0][1]}' 입니다 — 다른 구장의 자료로 보입니다 "
                       f"({host(url)})")
    return bad, note


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    bad, note = violations()
    if "--report" in sys.argv:
        for s in note:
            print("  · 참고:", s)
    if bad:
        print(f"\n✖ 등록명과 자료 출처가 다릅니다 {len(bad)}건")
        for s in bad:
            print("   -", s)
        print("  등록명을 출처에 맞게 고치거나, 그 구장 자료를 따로 수집하세요.")
        return 1
    print(f"출처 검사 통과 — 등록명과 자료 출처가 모두 일치 (사람 확인 권고 {len(note)}건)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
