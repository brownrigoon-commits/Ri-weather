# -*- coding: utf-8 -*-
"""홀 공략 문장 관문 고장 검증 (2026-08-02 신설)

관문을 믿으려면 **일부러 망가뜨려서 잡는지** 봐야 한다.
한 번도 무엇을 잡아 본 적 없는 검사는 '통과' 라는 글자만 찍는 장식이다
(2026-08-02, '홀맵은 있는데 통계가 없는 구장' 을 통계 관문이 놓친 일이 그랬다).

여기서는 생성물을 한 군데씩 거짓말로 바꾼 뒤, 관문이 그걸 짚어내는지 확인한다.
원본은 반드시 되돌린다.

사용: python tools/jp/verify_gates_holetext.py
"""
import os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from jp_common import ROOT

SRC = os.path.join(ROOT, "js", "holetext_jp.js")
GATE = os.path.join(HERE, "check_holetext_jp.py")

# (이름, 바꿀 것, 바뀔 것) — 하나만 바꿔도 관문이 짚어야 한다
BREAKS = [
    ("난이도 1위가 아닌데 '가장 어렵다'", r"홀 중 2번째로 어렵습니다", "홀 중 가장 어렵습니다"),
    ("순위를 엉뚱한 숫자로",              r"중 2번째로 어렵습니다",     "중 7번째로 어렵습니다"),
    ("통계에 없는 숫자를 지어냄",          r"페어웨이 안착 ([\d.]+)%",   "페어웨이 안착 99.9%"),
    # ⚠️ '우도그렉' 을 '포대 그린' 으로 바꾼다 — 두 언어가 다 있는 자리를 골라야
    #    '한쪽 언어만 있다' 가 아니라 **토큰 검사가** 잡는 것을 확인할 수 있다
    #    (첫 판에서는 빈 홀에 글자를 넣는 바람에 엉뚱한 검사가 잡았다).
    ("사실 토큰에 없는 지형을 말함",       r"k:\"우도그렉 홀",           'k:"포대 그린 홀'),
    ("한국어만 있고 일본어가 빔",          r"j:\"[^\"]{6,}?\"\}\]",      'j:""}]'),
]


def run_gate():
    r = subprocess.run([sys.executable, GATE], capture_output=True)
    return r.returncode, (r.stdout + r.stderr).decode("utf-8", "replace")


def main():
    if not os.path.exists(SRC):
        print("✖ 먼저 gen_hole_text.py 로 생성물을 만드세요")
        return 1
    code, out = run_gate()
    if code != 0:
        print("✖ 망가뜨리기 전부터 관문이 실패합니다 — 먼저 그것부터 고치세요")
        print(out[:600])
        return 1

    backup = tempfile.mktemp(suffix=".js")
    shutil.copyfile(SRC, backup)
    caught = 0
    try:
        for name, pat, rep in BREAKS:
            src = open(backup, encoding="utf-8").read()
            broken, n = re.subn(pat, rep, src, count=1, flags=re.M)
            if not n:
                print(f"  ⚠ {name}: 바꿀 자리를 못 찾았습니다 (검사 자체를 점검하세요)")
                continue
            open(SRC, "w", encoding="utf-8", newline="\n").write(broken)
            code, out = run_gate()
            if code != 0:
                caught += 1
                first = next((l for l in out.splitlines() if l.strip().startswith("-")), "")
                print(f"  ✅ 잡음 — {name}\n       {first.strip()[:110]}")
            else:
                print(f"  🔴 **못 잡음** — {name}")
    finally:
        shutil.copyfile(backup, SRC)
        os.remove(backup)

    code, _ = run_gate()
    ok = code == 0
    print(f"\n{'✅' if caught == len(BREAKS) and ok else '🔴'} "
          f"고장 {caught}/{len(BREAKS)}건을 잡았습니다 · 원본 복구 {'정상' if ok else '실패'}")
    return 0 if (caught == len(BREAKS) and ok) else 1


if __name__ == "__main__":
    sys.exit(main())
