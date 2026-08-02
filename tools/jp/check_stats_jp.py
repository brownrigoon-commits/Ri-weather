# -*- coding: utf-8 -*-
"""홀별 통계 배포 관문 (2026-08-02 신설)

통계는 화면에 **숫자로** 뜬다. 틀린 숫자는 없는 것보다 나쁘다(신뢰 우선 원칙).
그래서 배포 전에 값 자체가 말이 되는지, 홀맵과 짝이 맞는지 확인한다.

무엇을 막나
  1. 밴드가 5벌이 아님          → 스코어대 선택이 깨진다
  2. 난이도 순위 > 홀 수        → 파싱이 밀린 것
  3. 평균 스코어가 말이 안 됨    → 파3에 평균 12타 같은 값
  4. 율이 0~100 밖              → 퍼센트 자리를 잘못 읽음
  5. 등록 홀맵과 파 배열 불일치  → **엉뚱한 홀에 통계가 붙는다**(가장 위험)
  6. 출처 표기 누락             → 내리기 스위치가 못 내린다

사용
  python tools/jp/check_stats_jp.py            문제만 (있으면 종료코드 1)
  python tools/jp/check_stats_jp.py --report   전부
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import HP_JP

STATS = os.path.join(HP_JP, "_stats")
SOURCE_MARK = "じゃらん"
N_BANDS = 5
FIELDS = ["rank", "avg", "putt", "birdie", "gir", "fw", "bunker", "ob"]
RATE_IDX = [3, 4, 5, 6, 7]        # 퍼센트 지표 자리
AVG_RANGE = (2.0, 12.0)
PUTT_RANGE = (1.0, 4.5)


def registered_pars():
    out = {}
    if not os.path.isdir(HP_JP):
        return out
    for d in os.listdir(HP_JP):
        f = os.path.join(HP_JP, d, "parsed.json")
        if os.path.exists(f):
            try:
                j = json.load(open(f, encoding="utf-8"))
                out[j["course"]] = [h.get("par") for c in j["courses"] for h in c["holes"]]
            except Exception:
                pass
    return out


def check():
    problems, notes = [], []
    if not os.path.isdir(STATS):
        return [], ["통계 자료가 아직 없습니다"], 0
    files = sorted(f for f in os.listdir(STATS) if f.endswith(".json"))
    reg = registered_pars()

    for fn in files:
        who = fn[:-5]
        try:
            d = json.load(open(os.path.join(STATS, fn), encoding="utf-8"))
        except Exception as e:
            problems.append(f"{who}: 읽을 수 없습니다 ({type(e).__name__})")
            continue

        if SOURCE_MARK not in d.get("source", ""):
            problems.append(f"{who}: 출처 표기가 없습니다 — 내리기 스위치가 못 내립니다")
        holes = d.get("holes") or []
        n = len(holes)
        if not n or n % 9:
            problems.append(f"{who}: 홀 수가 이상합니다 ({n}홀)")
            continue

        for i, h in enumerate(holes):
            bands = h.get("b") or []
            if len(bands) != N_BANDS:
                problems.append(f"{who} {i+1}번째홀: 스코어대가 {len(bands)}벌입니다 (5벌이어야 함)")
                continue
            for bi, vals in enumerate(bands):
                if vals is None:
                    notes.append(f"{who} {i+1}번째홀: {bi+1}번 스코어대 값 없음")
                    continue
                if len(vals) != len(FIELDS):
                    problems.append(f"{who} {i+1}번째홀: 지표가 {len(vals)}개입니다")
                    continue
                rank = vals[0]
                if rank is not None and not (1 <= rank <= n):
                    problems.append(f"{who} {i+1}번째홀: 난이도 순위 {rank} 가 홀 수({n})를 넘습니다")
                avg = vals[1]
                if avg is not None and not (AVG_RANGE[0] <= avg <= AVG_RANGE[1]):
                    problems.append(f"{who} {i+1}번째홀: 평균 스코어 {avg} 가 말이 되지 않습니다")
                putt = vals[2]
                if putt is not None and not (PUTT_RANGE[0] <= putt <= PUTT_RANGE[1]):
                    problems.append(f"{who} {i+1}번째홀: 평균 퍼트 {putt} 가 말이 되지 않습니다")
                for ri in RATE_IDX:
                    v = vals[ri]
                    if v is not None and not (0 <= v <= 100):
                        problems.append(f"{who} {i+1}번째홀: {FIELDS[ri]} 가 {v}% 입니다 (0~100)")

        # 🔴 가장 위험한 것 — 홀맵과 순서가 어긋나면 엉뚱한 홀에 통계가 붙는다
        course = d.get("course")
        if course in reg:
            if reg[course] != d.get("pars"):
                if len(reg[course]) == len(d.get("pars") or []):
                    problems.append(f"{who}: 등록 홀맵과 파 배열이 다릅니다 — "
                                    f"통계가 엉뚱한 홀에 붙습니다")
                else:
                    problems.append(f"{who}: 홀 수가 등록 홀맵과 다릅니다 "
                                    f"(홀맵 {len(reg[course])} / 통계 {len(d.get('pars') or [])})")
        else:
            notes.append(f"{who}: 홀맵이 아직 없는 구장 (통계만 보유)")
    return problems, notes, len(files)


def main():
    problems, notes, n = check()
    report = "--report" in sys.argv
    if report:
        for x in notes:
            print("  ※", x)
    elif notes:
        for x in notes[:10]:
            print("  ※", x)
        if len(notes) > 10:
            print(f"  ※ … 그 밖에 {len(notes) - 10}건")
    if problems:
        print(f"✖ 홀 통계 관문 — 문제 {len(problems)}건")
        for p in problems[:40]:
            print("  -", p)
        if len(problems) > 40:
            print(f"  … 그 밖에 {len(problems) - 40}건")
        return 1
    print(f"✅ 홀 통계 관문 통과 — 구장 {n}곳")
    return 0


if __name__ == "__main__":
    sys.exit(main())
