# -*- coding: utf-8 -*-
"""티별 거리 사다리 검사 — 배포 전 관문

앱은 `tees` 배열을 **적힌 순서 그대로** 화면에 뿌린다(js/app.js 의 renderImgCourse).
그래서 배열 순서가 거리 내림차순이 아니면 사용자 눈에는
"챔피언 340 · 백 360" 처럼 짧은 티가 위에 오는 상태로 보인다.

실제로 그런 일이 있었다 — 골프존 원본의 `champTee` 가 최장 티가 아닌데
필드명대로 "챔피언" 라벨을 붙여 2,515홀 전부가 뒤집혀 나갔다(v130 에서 교정).
같은 사고를 두 번 겪지 않도록 **배포 스크립트가 매번 이 검사를 통과해야** 한다.

사용
  python tools/check_tees.py            # 위반만 출력, 있으면 종료코드 1
  python tools/check_tees.py --report   # 전체 통계까지 출력
"""
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 화면에 쓰는 티 라벨(긴 티 → 짧은 티). 이 어휘에 없는 라벨이 나오면 알린다.
LADDER = ["챔피언", "백", "블랙", "블루", "레귤러", "화이트", "골드",
          "프론트", "시니어", "옐로", "레드", "핑크", "레이디"]

# 좌/우 그린까지의 거리는 '사다리'가 아니다(같은 홀의 서로 다른 그린).
# 순서에 의미가 없으므로 내림차순 검사에서 뺀다.
GREEN_PAIR = {"L그린", "R그린"}

# 공식 자료 원문을 직접 대조해 "원문이 그렇다"고 확인한 예외만 여기 적는다.
# 새 위반은 반드시 배포를 막는다 — 확인 없이 여기 추가하지 말 것.
ALLOW = {
    ("감곡CC", "GLEN", 3):
        "공식 홈페이지(gamgokcc.com/html/course.asp) 원문이 WHITE 312 · GOLD 316. "
        "2026-07-29 HTML 직접 대조함. 도그렉이라 골드 티가 더 길 수 있어 원문대로 둔다.",
}


def violations(root=ROOT):
    """(치명 위반 목록, 참고 목록) 반환"""
    bad, note = [], []
    for f in sorted(glob.glob(os.path.join(root, "coursedata", "homepages", "*", "parsed.json"))):
        slug = os.path.basename(os.path.dirname(f))
        try:
            j = json.load(open(f, encoding="utf-8"))
        except Exception as e:
            bad.append(f"{slug}: parsed.json 을 읽지 못함 — {e}")
            continue
        cname = j.get("course") or slug
        for c in j.get("courses", []):
            for h in c.get("holes", []):
                tees = h.get("tees") or []
                if not tees:
                    continue
                names = [t.get("name") for t in tees]
                ms = [t.get("m") for t in tees]
                where = f"{cname} {c.get('name')} {h.get('no')}번홀"
                key = (cname, c.get("name"), h.get("no"))

                unknown = [n for n in names if n not in LADDER and n not in GREEN_PAIR]
                if unknown:
                    note.append(f"{where}: 처음 보는 티 라벨 {unknown} (표시 순서를 확인하세요)")

                # 좌/우 그린 거리는 사다리가 아니므로 건너뛴다
                if set(names) <= GREEN_PAIR:
                    continue

                # ① 챔피언 < 백 — v130 에서 고친 그 사고. 예외 없이 막는다.
                d = {t["name"]: t["m"] for t in tees if "name" in t and "m" in t}
                if "챔피언" in d and "백" in d and d["챔피언"] < d["백"]:
                    bad.append(f"{where}: 챔피언 {d['챔피언']}m 이 백 {d['백']}m 보다 짧습니다 "
                               f"(골프존 backTee/champTee 라벨 뒤집힘 재발)")
                    continue

                # ② 배열 순서가 거리 내림차순인가 (화면에 적히는 순서 그대로)
                rev = [i for i in range(len(ms) - 1)
                       if isinstance(ms[i], int) and isinstance(ms[i+1], int) and ms[i] < ms[i+1]]
                if rev:
                    detail = " · ".join(f"{n} {m}" for n, m in zip(names, ms))
                    if key in ALLOW:
                        note.append(f"{where}: 역전이지만 확인된 예외 — {detail}\n     ↳ {ALLOW[key]}")
                    else:
                        bad.append(f"{where}: 티 거리가 내림차순이 아닙니다 — {detail}")
                    continue

                # ③ 홀 길이는 최장 티 기준이어야 한다
                if isinstance(h.get("len"), int) and isinstance(ms[0], int) and h["len"] != ms[0]:
                    bad.append(f"{where}: 홀 길이 {h['len']}m 가 최장 티 {ms[0]}m 와 다릅니다")
    return bad, note


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    report = "--report" in sys.argv
    bad, note = violations()
    if report:
        n = tot = 0
        for f in glob.glob(os.path.join(ROOT, "coursedata", "homepages", "*", "parsed.json")):
            j = json.load(open(f, encoding="utf-8"))
            for c in j.get("courses", []):
                for h in c.get("holes", []):
                    tot += 1
                    if h.get("tees"):
                        n += 1
        print(f"검사 대상: {tot}홀 중 티 정보가 있는 홀 {n}개")
    for s in note:
        print("  · 참고:", s)
    if bad:
        print(f"\n✖ 티 거리 검사 실패 {len(bad)}건")
        for s in bad[:30]:
            print("   -", s)
        if len(bad) > 30:
            print(f"   … 외 {len(bad)-30}건")
        return 1
    print("티 거리 검사 통과 — 모든 홀이 거리 내림차순")
    return 0


if __name__ == "__main__":
    sys.exit(main())
