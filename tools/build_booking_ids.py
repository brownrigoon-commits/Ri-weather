# -*- coding: utf-8 -*-
"""골팡 구장 번호표 만들기 — 우리 등록 구장(HOLEIMG_DB)과 이름을 맞춘다.

번호는 골팡 **자기 사이트의 골프장 선택 드롭다운**에서 그대로 읽은 값이다
(2026-07-30, 실제 브라우저). 티타임 목록을 긁는 게 아니라 그들 사이트로
정확히 보내주기 위한 식별자다.

    python tools/build_booking_ids.py           js/bookingids.js 생성
    python tools/build_booking_ids.py --report  매칭 결과만 확인

⚠️ 골팡 이름은 "파주", 우리 이름은 "파주CC" 처럼 업종어가 붙고 안 붙는다.
   그래서 업종어·괄호·공백을 걷어낸 '핵심 이름'으로 맞춘다.
   ⚠️ 애매하면 넣지 않는다 — 틀린 구장으로 보내느니 지역 목록으로 보내는 게 낫다.
      (엉뚱한 구장 티타임을 띄우면 그게 곧 거짓 정보다)
"""
import io, json, os, re, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 골팡 지역 코드 (드롭다운 실측)
SECTORS = {"한강이남": 5, "강북/경춘": 1, "충청": 4, "원주/영동": 8, "영호남/제주": 16}

# 업종어·수식어를 걷어내고 남는 '핵심 이름'으로 비교한다
BIZ = re.compile(
    r"(컨트리클럽|골프앤리조트|골프클럽|골프리조트|골프장|리조트|CC|GC|G\.C|C\.C|골프)", re.I)
PAREN = re.compile(r"\(.*?\)|\[.*?\]")


def core(name):
    s = PAREN.sub(" ", str(name))
    s = BIZ.sub(" ", s)
    s = re.sub(r"[^0-9A-Za-z가-힣]", "", s)
    return s.lower()


# 붙이면 안 되는 것들 — 비공개/가명/패키지 상품은 특정 구장이 아니다
SKIP = re.compile(r"비공개|가명|명문|전체|호텔|박2일|박3일|\+")


# 골팡 지역코드가 실제로 덮는 좌표 범위 (넉넉하게). 이름이 같아도 지역이 다르면 다른 구장이다.
# 예: "신라" 는 경기(한강이남)에도 경주(영호남)에도 있다 — 좌표로 갈라야 엉뚱한 데로 안 보낸다.
# ⚠️ 넉넉하게 잡는다. 목적은 "제주 ↔ 경기" 같은 **큰 오류만** 걸러내는 것이다.
#    좁게 잡았더니 경기 동부(여주·이천 lon 127.7)와 충남 서해안(태안 lon 126.1)까지
#    걸러버렸다 — 정상 매칭을 죽이면 폴백이 늘 뿐 얻는 게 없다. (2026-07-30)
SECTOR_BOX = {
    5:  (36.60, 37.90, 125.80, 128.10),   # 한강이남(경기남부·인천)
    1:  (37.20, 38.50, 126.30, 128.40),   # 강북/경춘(경기북부·춘천)
    4:  (35.70, 37.30, 125.80, 128.60),   # 충청
    8:  (36.70, 38.70, 127.30, 129.60),   # 원주/영동(강원)
    16: (32.90, 36.95, 125.50, 129.80),   # 영호남/제주
}


def load_coords():
    """GOLF_DB 에서 구장 좌표를 읽는다 — 매칭 검산용."""
    src = open(os.path.join(ROOT, "js", "golfdb.js"), encoding="utf-8").read()
    i = src.index("[")
    rows = json.loads(src[i:src.rindex("]") + 1])
    return {core(r["n"]): (r["lat"], r["lon"]) for r in rows if r.get("lat")}


WORK = os.path.join(ROOT, "coursedata", "workfiles", "booking")


def our_courses():
    """등록 구장 이름 — 홀맵 DB 가 곧 '우리가 서비스하는 구장' 목록이다."""
    src = open(os.path.join(ROOT, "js", "holeimgdb.js"), encoding="utf-8").read()
    return re.findall(r'^  "([^"]+)":\s*\{', src, re.M)


def build(golfpang):
    ours = our_courses()
    coords = load_coords()
    # 골팡 쪽 핵심이름 → (표시명, sector, clubname, sector3)
    table = {}
    dup = set()
    for region, items in golfpang.items():
        sec = SECTORS[region]
        for it in items:
            parts = it.split("|")
            label = parts[0]
            if SKIP.search(label):
                continue
            if sec == 16:                      # 영호남/제주는 세부지역까지 필요
                if len(parts) < 3:
                    continue
                sec3, club = int(parts[1]), int(parts[2])
            else:
                sec3, club = None, int(parts[1])
            k = core(label)
            if not k:
                continue
            if k in table and table[k][2] != club:
                dup.add(k)                     # 같은 이름이 둘 이상 → 못 고른다
                continue
            table[k] = (label, sec, club, sec3)
    for k in dup:
        table.pop(k, None)

    out, miss, rejected = {}, [], []
    for name in ours:
        k = core(name)
        hit = table.get(k)
        if not hit:
            miss.append(name)
            continue
        label, sec, club, sec3 = hit
        # 좌표 검산 — 이름은 같은데 지역이 안 맞으면 다른 구장이다. 버린다.
        xy = coords.get(k)
        if xy:
            lo_a, hi_a, lo_o, hi_o = SECTOR_BOX[sec]
            if not (lo_a <= xy[0] <= hi_a and lo_o <= xy[1] <= hi_o):
                rejected.append("%s(우리 %.2f,%.2f ↔ 골팡 %s)" % (name, xy[0], xy[1], label))
                continue
        rec = {"pang": club, "sector": sec, "pangName": label}
        if sec3:
            rec["sector3"] = sec3
        out[name] = rec

    # 골프몬 번호 — 골팡에서 좌표까지 확인된 구장에만 붙인다.
    # 골프몬 쪽은 좌표를 안 주므로 혼자서는 검산이 안 된다.
    # 두 사이트가 같은 이름을 가리키고 그게 좌표와도 맞을 때만 믿는다.
    monp = os.path.join(WORK, "golfmon_clubs.json")
    mon_used = 0
    if os.path.exists(monp):
        mon = json.load(open(monp, encoding="utf-8"))
        for name, rec in out.items():
            mid = mon.get(core(name))
            if mid:
                rec["mon"] = mid
                mon_used += 1
    return out, miss, len(dup), rejected, mon_used


def main():
    raw = json.load(open(os.path.join(WORK, "golfpang_clubs.json"), encoding="utf-8"))
    out, miss, dupn, rej, monn = build(raw)
    print("우리 구장 중 골팡 번호를 찾은 곳: %d (그중 골프몬 번호까지 있는 곳 %d)" % (len(out), monn))
    print("동명이인이라 버린 이름: %d" % dupn)
    print("좌표가 안 맞아 버린 곳 %d: %s" % (len(rej), " / ".join(rej) if rej else "없음"))
    print("못 찾은 곳 %d (지역 목록으로 폴백): %s ..." % (len(miss), ", ".join(miss[:8])))
    if "--report" in sys.argv:
        return
    body = json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True)
    js = ('/* 부킹 연결용 구장 번호표 — tools/build_booking_ids.py 산출물. 손으로 고치지 말 것.\n'
          ' *\n'
          ' * pang/sector/sector3 : 골팡(golfpang.com) 자기 사이트의 골프장 선택 드롭다운 값.\n'
          ' * mon                 : 골프몬(golfmon.net) golfFk. 그쪽 검색 UI 로 하나씩 확인해 넣는다.\n'
          ' *\n'
          ' * 번호가 없으면 앱은 지역 목록·검색 화면으로 보낸다(폴백). 비어 있어도 동작한다.\n'
          ' * ⚠️ 애매한 이름은 넣지 않는다 — 엉뚱한 구장 티타임을 띄우는 것이 곧 거짓 정보다. */\n'
          'const BOOKING_IDS = %s;\n' % body)
    p = os.path.join(ROOT, "js", "bookingids.js")
    open(p, "w", encoding="utf-8", newline="\n").write(js)
    print("생성:", p)


if __name__ == "__main__":
    main()
