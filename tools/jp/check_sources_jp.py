# -*- coding: utf-8 -*-
"""일본 구장 자료 배포 관문 (G9) — 2026-08-01 신설

한국의 `check_sources.py`·`check_tees.py` 가 하는 일을 일본 자료에 대해 한다.
**한국 관문과 완전히 분리**돼 있다 — 일본 자료가 잘못돼도 한국 배포를 막지 않는다
(그 반대도 마찬가지). release_courses.py 에는 별도 블록으로 붙인다.

무엇을 막나 (전부 '조용한 실패'라 사람 눈으로는 못 잡는 것들)
  1. 출처 표기가 내리기 스위치(jp_takedown.py)와 어긋남 → 통지 온 날 못 내린다
  2. 구장 이름이 golfdb 에 없음            → 앱에서 검색이 안 돼 **영원히 안 보인다**
  3. 구장 이름 중복                        → 뒤 항목이 앞을 덮어써 한 구장이 사라진다
  4. 홀 수·번호가 이상함                    → 코스공략이 중간에 끊긴다
  5. 티 거리가 뒤죽박죽                     → 캐디가 틀린 거리로 조언한다
  6. 그림 파일이 실은 HTML(오류 페이지)      → 화면에 깨진 그림
  7. 야드/미터 표기 누락                     → 미터로 읽으면 캐디가 100야드씩 틀린다

사용
  python tools/jp/check_sources_jp.py            문제만 (있으면 종료코드 1)
  python tools/jp/check_sources_jp.py --report   전부 나열
"""
import glob, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import HP_JP, ROOT, MAGIC, MIN_IMAGE_BYTES, load_golfdb_jp

# 내리기 스위치와 **같은 표기**여야 한다 (tools/jp_takedown.py 의 SOURCES)
SOURCE_SITES = {
    "アコーディア": "accordiagolf.com",
    "東急": "tokyu-golf-resort.com",
    "東京建物": "tatemono-resort.com",
    "多摩興産": "tfn-style.com",
    "PGM": "pacificgolf.co.jp",
    "じゃらん": "golf-jalan.net",       # 등뼈 층 (2026-08-01, 설계 §2-1)
    # 구장 공식 홈페이지 — 주소가 구장마다 달라 도메인을 고정할 수 없다.
    # 대신 '애그리게이터 주소가 아닐 것'을 확인한다(공식이라 적고 남의 사이트를 담는 것 방지).
    # ⚠️ 표기가 '公式ホームページ' 인 이유는 jp_takedown.py 주석 참고 (아코디아와 겹치면 안 된다)
    "公式ホームページ": None,
}
AGGREGATORS = ("accordiagolf.com", "golf-jalan.net", "gora.golf.rakuten", "pacificgolf.co.jp",
               "golfdigest.co.jp", "alba.co.jp", "shotnavi")
PAR_RANGE = (3, 5)


def check():
    problems, notes = [], []
    files = sorted(glob.glob(os.path.join(HP_JP, "*", "parsed.json")))
    if not files:
        return [], ["일본 자료가 아직 없습니다 (수집 전)"], 0

    golfdb = {g["n"] for g in load_golfdb_jp()}
    seen = {}

    for f in files:
        who = os.path.basename(os.path.dirname(f))
        try:
            d = json.load(open(f, encoding="utf-8"))
        except Exception as e:
            problems.append(f"{who}: parsed.json 을 읽을 수 없습니다 ({type(e).__name__})")
            continue

        name = d.get("course", "")
        src = d.get("source", "")
        url = d.get("sourceUrl", "")

        # 1. 출처 표기 — 내리기 스위치가 이걸로 찾는다
        mark = next((m for m in SOURCE_SITES if m in src), None)
        if not mark:
            problems.append(f"{who}: 출처 표기에 아는 이름이 없습니다 (source={src!r}) — "
                            f"tools/jp_takedown.py 가 이 자료를 못 내립니다")
        elif SOURCE_SITES[mark] is None:
            # 공식 홈페이지분 — 도메인이 구장마다 달라 고정 검사가 불가능하다.
            # '공식이라 적고 실제로는 애그리게이터에서 가져온 것'만 막는다.
            bad = next((a for a in AGGREGATORS if a in url), None)
            if bad:
                problems.append(f"{who}: 공식 홈페이지라고 적혀 있는데 주소는 {bad} 입니다 — {url}")
            elif not url.startswith("http"):
                problems.append(f"{who}: 출처 주소가 없습니다")
        elif SOURCE_SITES[mark] not in url:
            problems.append(f"{who}: 출처({mark})와 주소가 맞지 않습니다 — {url}")

        # 2. golfdb 에 있는 이름인가 (없으면 앱에서 영원히 안 보인다)
        if not name:
            problems.append(f"{who}: course 이름이 비어 있습니다")
        elif name not in golfdb:
            problems.append(f"{who}: '{name}' 은 golfdb(JP)에 없는 이름입니다 — "
                            f"앱에서 검색이 안 되므로 화면에 나오지 않습니다")

        # 3. 중복
        if name in seen:
            problems.append(f"{who}: 구장 이름 '{name}' 이 {seen[name]} 와 겹칩니다 — "
                            f"조립 때 한쪽이 사라집니다")
        else:
            seen[name] = who

        # 7. 단위
        if d.get("unit") not in ("yd", "m"):
            problems.append(f"{who}: unit 이 없습니다 (일본은 'yd') — 미터로 읽히면 거리가 전부 틀립니다")

        # 7-2. 그린 표기 — '2그린인데 어느 쪽인지 안 적힘'을 막는다.
        #      A라고 써놓고 B거리를 담으면 캐디가 통째로 틀린다(2026-08-01 土浦 실사고).
        g, gn = d.get("green"), d.get("greens")
        if gn and gn >= 2 and not g:
            problems.append(f"{who}: 그린이 {gn}개인데 어느 그린 거리인지 적혀 있지 않습니다")
        if g and (not gn or gn < 2):
            problems.append(f"{who}: green={g!r} 인데 greens={gn!r} 입니다 — 표기가 서로 안 맞습니다")

        # 3-2. 코스 이름 중복 + 같은 그림이 여러 홀에 붙었는가
        #      🔴 2026-08-01 실제로 겪은 사고: 27홀 구장의 세 코스가 전부 'OUT' 으로
        #      이름 붙어 그림이 서로를 덮어썼다. 홀 수는 27홀로 멀쩡해 보이는데
        #      실제로는 9장뿐이라 **다른 코스의 홀맵이 표시된다.** 눈으로는 못 잡는다.
        cnames = [c.get("name") for c in d.get("courses", [])]
        if len(set(cnames)) != len(cnames):
            problems.append(f"{who}: 코스 이름이 겹칩니다 {cnames} — 그림이 서로 덮어써집니다")
        imgs = [h.get("img") for c in d.get("courses", []) for h in c.get("holes", []) if h.get("img")]
        if len(set(imgs)) != len(imgs):
            from collections import Counter
            dup = [k for k, v in Counter(imgs).items() if v > 1]
            problems.append(f"{who}: 같은 그림이 여러 홀에 붙어 있습니다 {len(dup)}건 — "
                            f"다른 홀의 홀맵이 표시됩니다 (예: {dup[0]})")

        # 4·5·6. 홀·티·그림
        total = 0
        for c in d.get("courses", []):
            holes = c.get("holes", [])
            total += len(holes)
            if len(holes) != 9:
                notes.append(f"{who}/{c.get('name')}: 9홀이 아닙니다 ({len(holes)}홀)")
            nos = [h.get("no") for h in holes]
            if nos != sorted(nos) or len(set(nos)) != len(nos):
                problems.append(f"{who}/{c.get('name')}: 홀 번호가 이상합니다 {nos}")
            for h in holes:
                par = h.get("par")
                # 파가 없는 것은 '틀린 것'이 아니라 '아직 모르는 것'이다.
                # 홀맵만 있어도 화면은 성립하므로 막지 않고, 숫자는 나중에 다른 출처로 채운다.
                if par is None:
                    notes.append(f"{who}/{c.get('name')} {h.get('no')}번홀: 파 없음(그림만)")
                elif not isinstance(par, int) or not (PAR_RANGE[0] <= par <= PAR_RANGE[1]):
                    problems.append(f"{who}/{c.get('name')} {h.get('no')}번홀: par 가 이상합니다 ({par})")
                tees = h.get("tees") or []
                vals = [t.get("y") or t.get("m") for t in tees]
                if vals and any(v is None for v in vals):
                    problems.append(f"{who} {h.get('no')}번홀: 티 거리가 비었습니다")
                elif len(vals) >= 2 and vals != sorted(vals, reverse=True):
                    # 🔴 차단이 아니라 '주의'다 (2026-08-01 실측으로 강등).
                    #    広陵CC 는 공식 사이트 자체가 Green 295 < Red 355 로 적는다 —
                    #    Green 티가 최전방(시니어) 티인 구장이 실존한다. 티 색과 길이의
                    #    순서는 보편 규칙이 아니었다. 다만 파싱 오류의 냄새일 수도 있으니
                    #    본수집 뒤 표본 대조는 계속한다(원문 카드와 글자 대조로 확인).
                    notes.append(f"{who} {h.get('no')}번홀: 티 순서가 내림차순 아님(실데이터일 수 있음) "
                                 f"{[(t['name'], t.get('y') or t.get('m')) for t in tees]}")
                img = h.get("img")
                if not img:
                    notes.append(f"{who} {h.get('no')}번홀: 그림 없음")
                    continue
                p = os.path.join(ROOT, img)
                if not os.path.exists(p):
                    problems.append(f"{who} {h.get('no')}번홀: 그림 파일이 없습니다 — {img}")
                    continue
                head = open(p, "rb").read(8)
                size = os.path.getsize(p)
                if not any(head.startswith(m) for m in MAGIC):
                    problems.append(f"{who} {h.get('no')}번홀: 그림이 아닙니다(첫 바이트 {head[:4].hex()}) — "
                                    f"오류 페이지를 받아 저장했을 수 있습니다: {img}")
                elif size < MIN_IMAGE_BYTES // 4:
                    problems.append(f"{who} {h.get('no')}번홀: 그림이 너무 작습니다({size}B) — {img}")
        if total and total % 9:
            problems.append(f"{who}: 전체 홀 수가 9의 배수가 아닙니다 ({total}홀)")

    return problems, notes, len(files)


def main():
    problems, notes, n = check()
    report = "--report" in sys.argv
    if report or notes:
        for x in notes[:40] if not report else notes:
            print("  ※", x)
        if not report and len(notes) > 40:
            print(f"  ※ … 그 밖에 {len(notes) - 40}건")
    if problems:
        print(f"✖ 일본 자료 관문 — 문제 {len(problems)}건")
        for p in problems:
            print("  -", p)
        return 1
    print(f"✅ 일본 자료 관문 통과 — 구장 {n}곳")
    return 0


if __name__ == "__main__":
    sys.exit(main())
