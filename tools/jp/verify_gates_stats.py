# -*- coding: utf-8 -*-
"""통계 관문 고장 검증 — 일부러 망가뜨려 잡는지 확인 (2026-08-02)

관문은 통과만 봐서는 아무 의미가 없다. 여기서 흉내 내는 고장은
**실제로 겪었거나 겪을 뻔한 것**들이다.

사용: python tools/jp/verify_gates_stats.py
"""
import copy, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from jp_common import HP_JP

CHECK = os.path.join(HERE, "check_stats_jp.py")
STATS = os.path.join(HP_JP, "_stats")


def run():
    r = subprocess.run([sys.executable, CHECK], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def main():
    files = sorted(f for f in os.listdir(STATS) if f.endswith(".json")) if os.path.isdir(STATS) else []
    if not files:
        print("✖ 통계 자료가 없습니다 — 먼저 수집하세요")
        return 1
    code, out = run()
    if code != 0:
        print("✖ 지금 자료가 이미 관문을 통과하지 못합니다. 이것부터 고치세요.\n" + out)
        return 1
    print("기준 상태: 관문 통과 ✅ — 이제 하나씩 망가뜨려 봅니다\n")

    target = os.path.join(STATS, files[0])
    backup = json.load(open(target, encoding="utf-8"))

    def restore():
        json.dump(backup, open(target, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    ok = []

    def sab(name, mutate, expect):
        d = copy.deepcopy(backup)
        mutate(d)
        json.dump(d, open(target, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        c, o = run()
        caught = c != 0 and expect in o
        print(("  ✔ 잡아냄  " if caught else "  ✖ 못 잡음 ") + name)
        if not caught:
            print("       기대: " + expect)
            print("       실제: " + o.strip().replace("\n", "\n       ")[:300])
        restore()
        ok.append(caught)

    sab("스코어대가 4벌뿐 (탭 하나를 놓침)",
        lambda d: d["holes"][0].__setitem__("b", d["holes"][0]["b"][:4]),
        "스코어대가 4벌입니다")

    sab("난이도 순위가 홀 수를 넘음 (파싱이 밀림)",
        lambda d: d["holes"][0]["b"][0].__setitem__(0, 99),
        "홀 수(")

    sab("평균 스코어가 말이 안 됨",
        lambda d: d["holes"][0]["b"][0].__setitem__(1, 25.0),
        "평균 스코어 25.0 가 말이 되지 않습니다")

    sab("평균 퍼트가 말이 안 됨",
        lambda d: d["holes"][0]["b"][0].__setitem__(2, 9.0),
        "평균 퍼트 9.0")

    sab("율이 100%를 넘음 (퍼센트 자리 오독)",
        lambda d: d["holes"][0]["b"][0].__setitem__(4, 850.0),
        "gir 가 850.0% 입니다")

    # ── 아래 두 가지는 '관문이 막는' 것이 아니라 '조립기가 담지 않는' 것이다.
    #    (파가 어긋나면 배포를 멈추는 게 아니라 그 구장만 빼는 것이 맞다 —
    #     다른 596곳은 멀쩡하기 때문이다). 그래서 **조립 결과로** 확인한다.
    BUILD = os.path.join(HERE, "build_holestats_jp.py")
    OUTJS = os.path.join(os.path.dirname(os.path.dirname(HERE)), "js", "holestats_jp.js")

    def sab_build(name, mutate, course):
        d = copy.deepcopy(backup)
        mutate(d)
        json.dump(d, open(target, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        before = open(OUTJS, encoding="utf-8").read() if os.path.exists(OUTJS) else ""
        r = subprocess.run([sys.executable, BUILD], capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
        after = open(OUTJS, encoding="utf-8").read() if os.path.exists(OUTJS) else ""
        gone = f'"{course}"' not in after
        print(("  ✔ 담지 않음  " if gone else "  ✖ 담아버림 ") + name)
        if not gone:
            print("       조립 로그: " + (r.stdout or "").strip().replace("\n", " ")[:200])
        restore()
        subprocess.run([sys.executable, BUILD], capture_output=True)   # 원상 복구
        ok.append(gone)

    course = backup["course"]
    sab_build("파가 어긋나 자리를 못 맞추는 구장 (엉뚱한 홀에 붙는 것 방지)",
              lambda d: d.__setitem__("pars", [3] * len(d["pars"])), course)
    sab_build("홀 수가 홀맵과 다른 구장 (9의 배수지만 짝이 안 맞음)",
              lambda d: (d.__setitem__("pars", d["pars"][:9]),
                         d.__setitem__("holes", d["holes"][:9]))[0], course)

    sab("출처 표기 누락 (내리기 스위치가 못 내림)",
        lambda d: d.__setitem__("source", "어디선가"),
        "출처 표기가 없습니다")

    sab("지표 개수가 모자람",
        lambda d: d["holes"][0]["b"].__setitem__(0, [1, 4.5]),
        "지표가 2개입니다")

    c, o = run()
    print(f"\n되돌린 뒤 관문: {'통과 ✅' if c == 0 else '✖ 되돌리기 실패'}")
    if c != 0:
        print(o)
        return 1
    bad = len([x for x in ok if not x])
    print(f"\n{'✅ 모든 고장을 관문이 잡아냈습니다' if not bad else f'✖ 놓친 고장 {bad}건'} "
          f"({len(ok) - bad}/{len(ok)})")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
