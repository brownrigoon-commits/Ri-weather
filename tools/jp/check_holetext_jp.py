# -*- coding: utf-8 -*-
"""홀별 한 줄 공략 관문 (2026-08-02 신설)

gen_hole_text.py 가 만든 js/holetext_jp.js 를 **다시 읽어서**, 문장이 하는 말이
실제 자료와 맞는지 되짚는다. 만든 코드를 믿지 않고 결과물을 본다 —
만든 사람이 만든 것을 검사하면 같은 착각을 두 번 한다.

무엇을 되짚나
  1. "가장 어렵습니다"        → 난이도 순위가 정말 1위인가
  2. "N번째로 어렵습니다"     → 정말 N위인가
  3. "가장 쉽습니다"          → 정말 꼴찌(=가장 쉬움)인가
  4. "이 코스에서 가장 높/낮/많/잦" → 그 코스 안에서 정말 유일한 최대·최소인가
  5. 문장 속 숫자             → 그 홀 통계에 실제로 있는 값인가 (지어낸 숫자 색출)
  6. 우/좌도그렉·워터해저드 등 → 그 홀의 사실 토큰에 정말 있는가
  7. 한국어·일본어            → 한쪽만 있는 홀이 없는가
  8. 홀 수                    → 홀맵 홀 수와 같은가 (어긋나면 엉뚱한 홀에 붙는다)

사용
  python tools/jp/check_holetext_jp.py
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import ROOT, load_aligned

SRC = os.path.join(ROOT, "js", "holetext_jp.js")
RANK, AVG, PUTT, BIRDIE, GIR, FW, BUNKER, OB = range(8)

# 문장에 나오는 말 → 확인할 지표와 방향
SUPERLATIVE = [
    ("OB {v}% — 이 코스에서 가장 잦습니다", OB, "max"),
    ("페어웨이 안착 {v}% — 이 코스에서 가장 낮습니다", FW, "min"),
    ("파온율 {v}% — 이 코스에서 가장 낮습니다", GIR, "min"),
    ("벙커에 빠지는 비율 {v}% — 이 코스에서 가장 높습니다", BUNKER, "max"),
    ("평균 퍼트 {v}개 — 이 코스에서 가장 많습니다", PUTT, "max"),
    ("버디율 {v}% — 이 코스에서 가장 높습니다", BIRDIE, "max"),
]
TOKEN_WORD = {                     # 문장에 이 말이 있으면 그 토큰이 있어야 한다
    "우도그렉": "dogleg_r", "좌도그렉": "dogleg_l", "오르막": "uphill",
    "내리막": "downhill", "포대 그린": "elevated_green", "시그니처": "signature",
    "워터해저드": "water", "계곡": "valley", "벙커가 있습니다": "bunker",
    "OB 구역": "ob",
}


def parse_js(path):
    """생성물을 읽는다. {k:"…",j:"…"} 는 JSON 이 아니므로 키에 따옴표를 붙여 읽는다."""
    src = open(path, encoding="utf-8").read()
    body = src[src.index("{", src.index("HOLETEXT_JP")):src.rindex("}") + 1]
    body = re.sub(r"([{,])(k|j):", r'\1"\2":', body)
    body = re.sub(r",(\s*[}\]])", r"\1", body)
    return json.loads(body)


def main():
    if not os.path.exists(SRC):
        print("✖ js/holetext_jp.js 가 없습니다 — 먼저 gen_hole_text.py 를 돌리세요")
        return 1
    made = parse_js(SRC)
    rows, _ = load_aligned()
    data = {d["course"]: d for d in rows}

    problems, checked = [], 0
    for name, items in made.items():
        d = data.get(name)
        if not d:
            problems.append(f"{name}: 자료에 없는 구장인데 문장이 있습니다")
            continue
        n = len(d["holes"])
        if len(items) != n:
            problems.append(f"{name}: 문장 {len(items)}개 / 홀 {n}개 — 엉뚱한 홀에 붙습니다")
            continue
        vals = [(h.get("b") or [None])[0] for h in d["holes"]]
        vals = [v if v and any(x is not None for x in v) else None for v in vals]
        facts = d.get("facts") or [[] for _ in range(n)]

        for i, it in enumerate(items):
            ko, ja = it.get("k", ""), it.get("j", "")
            where = f"{name} {i+1}번째홀"
            if bool(ko) != bool(ja):
                problems.append(f"{where}: 한쪽 언어만 있습니다")
            if not ko:
                continue
            checked += 1
            v = vals[i]

            # 1~3. 난이도 자리매김
            if "가장 어렵습니다" in ko and (not v or v[RANK] != 1):
                problems.append(f"{where}: '가장 어렵다'는데 순위가 {v and v[RANK]} 입니다")
            m = re.search(r"중 (\d+)번째로 어렵습니다", ko)
            if m and (not v or v[RANK] != int(m.group(1))):
                problems.append(f"{where}: '{m.group(1)}번째'인데 순위가 {v and v[RANK]} 입니다")
            if "가장 쉽습니다" in ko and (not v or v[RANK] != n):
                problems.append(f"{where}: '가장 쉽다'는데 순위가 {v and v[RANK]}/{n} 입니다")

            # 4~5. '이 코스에서 가장 ~' + 그 숫자가 진짜인가
            for tmpl, idx, way in SUPERLATIVE:
                head = tmpl.split("{v}")[0]
                tail = tmpl.split("{v}")[1]
                mm = re.search(re.escape(head) + r"([\d.]+)" + re.escape(tail), ko)
                if not mm:
                    continue
                said = float(mm.group(1))
                if not v or v[idx] is None:
                    problems.append(f"{where}: 자료에 없는 값을 말합니다 ({head.strip()})")
                    continue
                if abs(float(v[idx]) - said) > 1e-9:
                    problems.append(f"{where}: {head.strip()} {said} 인데 자료는 {v[idx]} 입니다")
                others = [x[idx] for x in vals if x is not None and x[idx] is not None]
                best = max(others) if way == "max" else min(others)
                if float(v[idx]) != float(best) or others.count(best) > 1:
                    problems.append(f"{where}: '가장' 이라는데 실제 최{'대' if way=='max' else '소'}는 "
                                    f"{best} (같은 값 {others.count(best)}홀)")

            # 6. 사실 토큰
            for word, tok in TOKEN_WORD.items():
                if word in ko and tok not in (facts[i] if i < len(facts) else []):
                    problems.append(f"{where}: '{word}' 라는데 사실 토큰에 {tok} 이 없습니다")

    if problems:
        print(f"✖ 홀 공략 문장 관문 — 문제 {len(problems)}건")
        for p in problems[:30]:
            print("  -", p)
        if len(problems) > 30:
            print(f"  … 그 밖에 {len(problems) - 30}건")
        return 1
    print(f"✅ 홀 공략 문장 관문 통과 — 구장 {len(made)}곳 · 문장 {checked:,}개를 자료로 되짚었습니다")
    return 0


if __name__ == "__main__":
    sys.exit(main())
