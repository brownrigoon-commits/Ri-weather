# -*- coding: utf-8 -*-
"""홀별 한 줄 공략 만들기 — 한국어·일본어 동시 (2026-08-02 신설)

설계문서 §2-9 5번. 만드는 것: js/holetext_jp.js

🔴 왜 AI 에게 문장을 시키지 않는가
   이 앱의 첫째 원칙은 **"틀릴 수 있는 정보는 표시하지 않는다"** 이다.
   숫자 몇 개를 주고 문장을 지으라고 하면 모델은 반드시 **없는 것을 덧붙인다** —
   "좌측 언덕이 시야를 가린다" 같은 문장은 그럴듯하고, 검사할 방법이 없고, 틀린다.
   골퍼는 그 말을 믿고 클럽을 고른다.

   그래서 여기서는 **눈앞의 숫자와 토큰에서 곧장 끌어낼 수 있는 말만** 한다.
   문장은 우리가 쓴 틀에 값을 끼운 것이라, 한 문장 한 문장이 자료로 되짚어진다
   (관문 check_holetext_jp.py 가 실제로 되짚어 확인한다).
   부수적으로 공짜고, 즉시 끝나고, 한·일 두 언어가 같은 뜻이 된다.

   ⚠️ じゃらん 의 코멘트 문장은 복제하지 않는다. 거기서 뽑은 것은
      dogleg_r·water 같은 **사실 토큰**뿐이고, 문장은 우리가 만든다(설계 §2-6).

무엇을 말하나 — 홀마다 최대 세 마디
   1) 생김새   사실 토큰      "우도그렉 오르막"
   2) 자리매김 난이도 순위     "18홀 중 3번째로 어렵습니다"
   3) 눈여겨볼 것 + 조언  **그 코스 안에서 가장 두드러진 지표 하나**
                         "OB 8.4% — 이 코스에서 가장 잦습니다. 거리보다 방향입니다"

   두드러진 게 없으면 3)을 말하지 않는다. **할 말이 없으면 하지 않는다.**

사용
  python tools/jp/gen_hole_text.py --sample 30    표본만 보고 끝낸다(파일 안 씀)
  python tools/jp/gen_hole_text.py                전량 → js/holetext_jp.js
"""
import argparse, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import ROOT, load_aligned

OUT = os.path.join(ROOT, "js", "holetext_jp.js")

# 지표 자리 (fields 순서와 같다)
RANK, AVG, PUTT, BIRDIE, GIR, FW, BUNKER, OB = range(8)

# ── 1) 생김새 — 사실 토큰을 우리 말로. 토큰이 없으면 이 마디는 통째로 뺀다 ──
#
# ⚠️ 토큰을 한 통에 담으면 "시그니처 홀 홀", "워터해저드 홀" 같은 말이 나온다(첫 판에서 그랬다).
#    꾸미는 말(모양)과 있는 것(해저드)은 문장에서 자리가 다르므로 표를 나눈다.
#    해저드에 조사를 함께 적어 둔 이유: 받침에 따라 이/가 가 달라진다
#    (계곡'이' · 벙커'가'). 코드로 받침을 따지느니 표에 적는 편이 안 틀린다.
MOD = {                              # 홀의 모양 — "우도그렉 오르막 홀"
    "dogleg_r":       ("우도그렉",      "右ドッグレッグ"),
    "dogleg_l":       ("좌도그렉",      "左ドッグレッグ"),
    "straight":       ("직선",          "ストレート"),
    "uphill":         ("오르막",        "打ち上げ"),
    "downhill":       ("내리막",        "打ち下ろし"),
    "elevated_green": ("포대 그린",     "砲台グリーンの"),
    "narrow":         ("좁은",          "狭い"),
    "wide":           ("넓은",          "広い"),
}
MOD_ORDER = ["dogleg_r", "dogleg_l", "straight", "uphill", "downhill",
             "elevated_green", "narrow", "wide"]

HAZ = {                              # 홀에 있는 것 — "워터해저드가 있습니다"
    "water":  ("워터해저드", "가", "池"),
    "bunker": ("벙커",       "가", "バンカー"),
    "valley": ("계곡",       "이", "谷"),
    "ob":     ("OB 구역",    "이", "OB"),
}
HAZ_ORDER = ["water", "valley", "bunker", "ob"]

# ── 3) 눈여겨볼 것 — (자리, 방향, 최소 조건, 한국어틀, 일본어틀) ──
#    "이 코스에서 가장 ~" 은 **그 코스 안에서 실제로 최대/최소일 때만** 쓴다.
#    최소 조건을 둔 이유: 코스 안에서 제일 높아도 OB 0.4% 면 굳이 겁줄 일이 아니다.
NOTES = [
    (OB, "max", 4.0,
     "OB {v}% — 이 코스에서 가장 잦습니다. 거리보다 방향입니다",
     "OB率{v}% — このコースで最も高いホールです。飛距離より方向を"),
    (FW, "min", None,
     "페어웨이 안착 {v}% — 이 코스에서 가장 낮습니다. 티샷 클럽을 한 단계 줄여 보세요",
     "フェアウェイキープ率{v}% — このコースで最も低いホールです。ティーショットは1番手落としても"),
    (GIR, "min", None,
     "파온율 {v}% — 이 코스에서 가장 낮습니다. 그린을 놓친다고 보고 어프로치 자리를 남기세요",
     "パーオン率{v}% — このコースで最も低いホールです。外す前提で寄せやすい位置に"),
    (BUNKER, "max", 3.0,
     "벙커에 빠지는 비율 {v}% — 이 코스에서 가장 높습니다. 벙커를 피할 자리를 먼저 정하세요",
     "バンカー率{v}% — このコースで最も高いホールです。避ける落としどころを先に決めて"),
    (PUTT, "max", 2.2,
     "평균 퍼트 {v}개 — 이 코스에서 가장 많습니다. 핀 아래쪽에 붙이세요",
     "平均パット{v} — このコースで最も多いホールです。ピンの手前側に"),
    (BIRDIE, "max", 3.0,
     "버디율 {v}% — 이 코스에서 가장 높습니다. 노려볼 만합니다",
     "バーディ率{v}% — このコースで最も高いホールです。狙う価値があります"),
]


def band0(h):
    """전체 스코어대(모든 골퍼) 값. 없으면 None."""
    b = (h.get("b") or [None])[0]
    return b if b and any(x is not None for x in b) else None


def shape_text(facts):
    """→ ([한국어 마디…], [일본어 마디…])  — 없으면 빈 목록"""
    f = facts or []
    ko, ja = [], []
    mods = [t for t in MOD_ORDER if t in f][:2]
    sig = "signature" in f
    if mods:
        head_ko = " ".join(MOD[t][0] for t in mods) + " 홀"
        head_ja = "".join(MOD[t][1] for t in mods) + "ホール"
        if sig:
            head_ko += "이자 시그니처 홀"
            head_ja += "でシグネチャーホール"
        ko.append(head_ko)
        ja.append(head_ja)
    elif sig:
        ko.append("이 코스의 시그니처 홀")
        ja.append("このコースのシグネチャーホール")
    haz = [t for t in HAZ_ORDER if t in f][:2]
    if haz:
        names = "·".join(HAZ[t][0] for t in haz)
        ko.append(names + HAZ[haz[-1]][1] + " 있습니다")
        ja.append("・".join(HAZ[t][2] for t in haz) + "あり")
    return ko, ja


def rank_text(rank, n):
    """난이도 순위 → 자리매김. 가운데(4~n-3)는 굳이 말하지 않는다.
       ⚠️ 1등을 '1번째로 쉽습니다' 라고 쓰면 한국어가 아니다 — '가장' 을 따로 쓴다."""
    if rank is None or n < 9:
        return None, None
    if rank == 1:
        return f"{n}홀 중 가장 어렵습니다", f"{n}ホール中最も難しいホールです"
    if rank <= 3:
        return (f"{n}홀 중 {rank}번째로 어렵습니다",
                f"{n}ホール中{rank}番目に難しいホールです")
    if rank == n:
        return f"{n}홀 중 가장 쉽습니다", f"{n}ホール中最もやさしいホールです"
    if rank >= n - 2:
        return (f"{n}홀 중 쉬운 쪽에서 {n - rank + 1}번째입니다",
                f"{n}ホール中やさしい方から{n - rank + 1}番目です")
    return None, None


def fmt(v):
    return str(int(v)) if float(v) == int(v) else str(v)


def note_text(vals, holes_vals):
    """이 코스 안에서 가장 두드러진 지표 하나 → 한마디 + 조언.
       두드러진 게 없으면 (None, None) — 할 말이 없으면 하지 않는다."""
    for idx, way, floor, ko, ja in NOTES:
        v = vals[idx]
        if v is None:
            continue
        others = [x[idx] for x in holes_vals if x is not None and x[idx] is not None]
        if len(others) < 6:                    # 비교할 상대가 적으면 '가장' 이라 말하지 않는다
            continue
        best = max(others) if way == "max" else min(others)
        if v != best:
            continue
        if others.count(best) > 1:             # 공동 1위면 '가장' 이 거짓말이 된다
            continue
        if floor is not None and ((way == "max" and v < floor) or (way == "min" and v > floor)):
            continue
        return ko.format(v=fmt(v)), ja.format(v=fmt(v))
    return None, None


def gen_course(d):
    """한 구장 → [{k, j}, …] 홀맵 순서"""
    holes_vals = [band0(h) for h in d["holes"]]
    n = len(d["holes"])
    facts = d.get("facts") or [[] for _ in range(n)]
    out = []
    for i, h in enumerate(d["holes"]):
        vals = holes_vals[i]
        s_ko, s_ja = shape_text(facts[i] if i < len(facts) else [])
        ko, ja = list(s_ko), list(s_ja)
        if vals:
            r_ko, r_ja = rank_text(vals[RANK], n)
            if r_ko:
                ko.append(r_ko)
                ja.append(r_ja)
            n_ko, n_ja = note_text(vals, holes_vals)
            if n_ko:
                ko.append(n_ko)
                ja.append(n_ja)
        out.append({"k": ". ".join(ko), "j": "。".join(ja)} if ko else {"k": "", "j": ""})
    return out


def js_str(s):
    s = str(s).replace("\\", "\\\\").replace('"', '\\"')
    return '"' + s.replace("\r", " ").replace("\n", " ").strip() + '"'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", type=int, default=0, help="표본 N홀만 보여주고 끝낸다")
    a = ap.parse_args()

    rows, info = load_aligned()
    print(f"■ 자료: 구장 {len(rows)}곳 (홀맵없음 제외 {info['skipped']} · "
          f"재배치 {info['reordered']} · 자리못맞춤 제외 {info['unaligned']})")

    made = {}
    n_hole = n_text = 0
    for d in rows:
        t = gen_course(d)
        made[d["course"]] = t
        n_hole += len(t)
        n_text += sum(1 for x in t if x["k"])

    if a.sample:
        print(f"\n── 표본 {a.sample}홀 ──")
        shown = 0
        for d in rows:
            for i, x in enumerate(made[d["course"]]):
                if not x["k"]:
                    continue
                v = band0(d["holes"][i])
                print(f"\n[{d['course']} {i+1}번째홀 파{d['pars'][i]}]")
                print(f"  근거: 순위{v[RANK]} FW{v[FW]} 파온{v[GIR]} OB{v[OB]} 벙커{v[BUNKER]}"
                      f" 퍼트{v[PUTT]} 버디{v[BIRDIE]} · 토큰 {(d.get('facts') or [[]]*99)[i]}")
                print(f"  한국어: {x['k']}")
                print(f"  일본어: {x['j']}")
                shown += 1
                if shown >= a.sample:
                    break
            if shown >= a.sample:
                break
        print(f"\n(표본 실행이라 파일은 쓰지 않습니다 — 전체 {n_text:,}/{n_hole:,}홀에 문장이 붙습니다)")
        return 0

    with open(OUT, "w", encoding="utf-8", newline="\n") as w:
        w.write("/* 투어리스트 일본 홀별 한 줄 공략 — 한국어·일본어\n"
                "   ⚠️ 생성물입니다. 직접 고치지 마세요 — tools/jp/gen_hole_text.py 가 다시 씁니다.\n"
                "   ⚠️ 지어낸 문장이 아닙니다. 홀별 통계와 사실 토큰에서 곧장 끌어낸 말만 담습니다\n"
                "      (관문 tools/jp/check_holetext_jp.py 가 문장을 자료로 되짚어 확인합니다).\n"
                "   k = 한국어, j = 日本語. 빈 문자열이면 '할 말이 없는 홀' 입니다. */\n")
        w.write("const HOLETEXT_JP = {\n")
        for name in sorted(made):
            items = ", ".join("{k:" + js_str(x["k"]) + ",j:" + js_str(x["j"]) + "}"
                              for x in made[name])
            w.write(f"  {js_str(name)}: [{items}],\n")
        w.write("};\n")
    kb = os.path.getsize(OUT) // 1024
    print(f"holetext_jp.js 조립 완료: {len(made)}구장 · {n_text:,}/{n_hole:,}홀 · {kb}KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
