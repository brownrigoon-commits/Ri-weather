# -*- coding: utf-8 -*-
"""화면 도달 관문 고장 검증 (2026-08-02 신설)

check_applink_jp.js 는 **실제로 겪은 사고**를 다시 못 겪게 만든 관문이다.
그 사고를 일부러 다시 내서 잡는지 본다.

🔴 무엇을 망가뜨리나 — **앱 코드(js/jppack.js)** 다
   처음엔 자료(golfdb·홀맵)만 망가뜨려 시험했는데, 관문이 1번을 못 잡았다.
   당연했다. 이번 사고는 자료가 아니라 앱 코드에 있었기 때문이다 —
   자료는 완벽했고 앱이 한글 별칭을 못 풀었을 뿐이다.
   그래서 여기서는 앱 코드를 직접 되돌려 놓고, 관문이 그걸 잡는지 본다.

되살려 보는 사고
   1. 별칭을 아예 안 푸는 상태            → 배포 직후 그 상태. 1,911곳이 안 보였다
   2. 별칭 후보를 하나만 보는 상태        → 裾野 구장이 사라졌던 그 상태
   3. 아무도 부르지 않는 자료가 생김      (자료 쪽 사고)

사용: python tools/jp/verify_gates_applink.py
"""
import os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from jp_common import ROOT

GATE = os.path.join(HERE, "check_applink_jp.js")
PACK = os.path.join(ROOT, "js", "jppack.js")
IMGDB = os.path.join(ROOT, "js", "holeimgdb_jp.js")


def run():
    r = subprocess.run(["node", GATE], capture_output=True, cwd=ROOT)
    return r.returncode, (r.stdout + r.stderr).decode("utf-8", "replace")


def hint(out, *words):
    for l in out.splitlines():
        if any(w in l for w in words):
            return l.strip()[:120]
    return out.strip().splitlines()[-1][:120] if out.strip() else ""


def no_alias(src):
    """origNames 가 별칭을 안 푼다 = 배포 직후 그 상태"""
    return src.replace("return [name].concat(cands);",
                       "return [name];")


def first_only(src):
    """후보를 하나만 본다 = 裾野 구장이 사라졌던 상태"""
    return src.replace("(this._alias[g.k] = this._alias[g.k] || []).push(g.n);",
                       "this._alias[g.k] = [g.n];")


def orphan(src):
    """자료 쪽 사고 — 아무도 못 부르는 구장 키"""
    i = src.index('\n  "') + 3
    j = src.index('"', i + 1)
    return src[:i + 1] + "존재하지않는구장XYZ" + src[j:]


CASES = [
    ("앱이 한글 별칭을 아예 안 품", PACK, no_alias, ("한 곳도", "닿지 않")),
    ("별칭 후보를 하나만 봄",       PACK, first_only, ("닿지 않",)),
    ("아무도 부르지 않는 자료",     IMGDB, orphan, ("닿지 않", "붙을 자리")),
]


def main():
    code, out = run()
    if code != 0:
        print("✖ 망가뜨리기 전부터 관문이 실패합니다 — 그것부터 고치세요")
        print(out[-700:])
        return 1

    caught = 0
    for name, path, breaker, words in CASES:
        backup = tempfile.mktemp(suffix=".js")
        shutil.copyfile(path, backup)
        try:
            src = open(path, encoding="utf-8").read()
            broken = breaker(src)
            if broken == src:
                print(f"  ⚠ {name}: 망가뜨릴 자리를 못 찾았습니다 — 코드가 바뀌었나요?"
                      f" (검증 자체를 고쳐야 합니다)")
                continue
            open(path, "w", encoding="utf-8", newline="\n").write(broken)
            c, o = run()
            if c != 0:
                caught += 1
                print(f"  ✅ 잡음 — {name}\n       {hint(o, *words)}")
            else:
                print(f"  🔴 **못 잡음** — {name}")
        finally:
            shutil.copyfile(backup, path)
            os.remove(backup)

    code, _ = run()
    ok = code == 0
    good = caught == len(CASES) and ok
    print(f"\n{'✅' if good else '🔴'} 고장 {caught}/{len(CASES)}건을 잡았습니다 · "
          f"원본 복구 {'정상' if ok else '실패'}")
    return 0 if good else 1


if __name__ == "__main__":
    sys.exit(main())
