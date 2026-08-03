# -*- coding: utf-8 -*-
"""공략 문구 청소 — 공략이 아닌 것을 비운다 (2026-08-03 신설)

왜 필요한가 (2026-08-03 전수 감사에서 확인)
  · 파인밸리CC 18홀: 공략 자리에 "[좌측 O.B구역 · 우측 O.B구역]" 같은 라벨 4종만 돌려쓴다.
    18홀을 구분하는 정보가 0 이다 — 공략이 아니다.
  · 신라CC 남/1번: 동/9번 본문이 통째로 복제됐다. 남코스 첫 홀인데 "마지막 홀" 이라고 말한다.
  · 신라CC 서/3번: "그린피 4인 면제" 같은 이벤트·요금 약속이 섞여 있다.
    화면뿐 아니라 AI 캐디 프롬프트에도 '공식 공략 TIP' 으로 들어간다(app.js) —
    끝난 이벤트면 우리와 구장 양쪽에 문제가 된다.
  · 타이거CC 18홀: 문장 뒤에 홈페이지 표 항목 "특징 : 좌측 OB / …" 이 붙어 있다.

원칙: 틀릴 수 있는 정보는 표시하지 않는다. 앱은 공략이 없으면 조용히 생략한다.

사용
  python tools/clean_tips.py           무엇이 바뀌는지만 보여 준다
  python tools/clean_tips.py --write   parsed.json 을 실제로 고친다
"""
import argparse, glob, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HP = os.path.join(ROOT, "coursedata", "homepages")

LABEL_ONLY = re.compile(r"^\s*\[[^\]]{1,40}\]\s*$")
PROMO = re.compile(r"면제|무료|증정|사은품|경품|이벤트홀|인증샷")
FEATURE = re.compile(r"\s*특징\s*:\s*.*$", re.S)


# 이만큼 연속으로 겹치면 남의 글을 옮겨 온 것으로 본다.
# 40자로 잡았더니 웰링턴CC 7·8번처럼 **상투구가 겹칠 뿐인 다른 글**이 걸렸다
# ("TEE SHOT의 BEST는 FAIRWAY 좌측이며, LONG IRON…"). 실제 복제였던 신라CC 는 136자였다.
WIN = 80


def overlaps(t, prev):
    """t 와 prev 가 WIN 자 이상 연속으로 겹치는가(중간이어도 잡는다)."""
    if len(t) < WIN or len(prev) < WIN:
        return False
    windows = {prev[i:i + WIN] for i in range(0, len(prev) - WIN + 1, 8)}
    return any(w in t for w in windows)


def clean(course, cname, no, tip, tips_seen):
    """(새 tip, 이유). 새 tip 이 None 이면 비운다. 바뀐 게 없으면 이유가 None."""
    t0 = re.sub(r"\s+", " ", tip or "").strip()
    if not t0:
        return None, None
    # ① 라벨뿐 — 홀을 구분하지 못한다
    if LABEL_ONLY.match(t0) or len(t0) < 25:
        return None, "공략이 아니라 라벨·조각"
    # ② 같은 구장 안에서 40자 이상 연속으로 겹치면 복제다 — 뒤에 나온 쪽을 비운다
    for (prev_c, prev_no), prev in tips_seen.items():
        if overlaps(t0, prev):
            return None, f"{prev_c} {prev_no}번 공략과 겹침"
    reasons = []
    t = t0
    # ③ 표 항목이 문장 뒤에 붙은 것은 잘라 낸다(내용 자체는 그 홀 것이다)
    cut = FEATURE.sub("", t).strip()
    if cut != t and len(cut) >= 25:
        t = cut
        reasons.append("표 항목 '특징 :' 잘라냄")
    # ④ 이벤트·요금 약속 문장만 덜어 낸다
    parts = re.split(r"(?<=[.!?])\s+|(?=\[)", t)
    keep = [p for p in parts if not PROMO.search(p)]
    if len(keep) != len(parts):
        t2 = " ".join(x.strip() for x in keep if x.strip())
        if len(t2) < 25:
            return None, "이벤트·요금 약속뿐"
        t = t2
        reasons.append("이벤트·요금 약속 문장 제거")
    return t, ("·".join(reasons) if reasons else None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    changed = blanked = 0
    for f in sorted(glob.glob(os.path.join(HP, "*", "parsed.json"))):
        d = json.load(open(f, encoding="utf-8"))
        seen, notes = {}, []
        for c in d["courses"]:
            for h in c["holes"]:
                if not h.get("tip"):
                    continue
                new, why = clean(d["course"], c["name"], h["no"], h["tip"], seen)
                if new is None:
                    notes.append(f'  {c["name"]} {h["no"]}번 — 비움 ({why}) ← "{h["tip"][:40]}…"')
                    h.pop("tip")
                    blanked += 1
                    continue
                if why:
                    notes.append(f'  {c["name"]} {h["no"]}번 — {why}')
                    changed += 1
                if new != h["tip"]:
                    h["tip"] = new
                seen[(c["name"], h["no"])] = new
        if notes:
            print(f'■ {d["course"]}')
            print("\n".join(notes))
            if a.write:
                json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\n비운 홀 {blanked} · 다듬은 홀 {changed}")
    if a.write:
        print("다음: python tools/build_holeimgdb.py")
    else:
        print("(미리보기입니다 — 실제로 고치려면 --write)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
