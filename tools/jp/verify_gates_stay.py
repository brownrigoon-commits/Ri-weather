# -*- coding: utf-8 -*-
"""숙박 조립기·관문 고장 검증 (2026-08-02 신설 · 설계 §4-4)

🔴 배치가 끝나기 **전에** 돌린다.
   몇 시간짜리 배치가 끝난 뒤에 조립기가 고장난 걸 알면 그때는 늦다.
   그래서 진짜 배치 결과 대신 **가짜 자료를 만들어** 조립기와 관문을 먼저 시험한다.
   실제 배치 결과가 오면 같은 도구가 그대로 돌면 된다.

시험하는 고장
   1. 홀맵에 없는 구장          → 조립기가 빼야 한다 (화면에 붙을 자리가 없다)
   2. 숙소번호가 문자열         → 조립기가 빼야 한다 (호출이 깨진다)
   3. 거리가 999km             → 조립기가 빼야 한다 (거리 계산이 틀린 것)
   4. 한 구장 20곳             → 12곳으로 잘라야 한다
   5. 앱이 한글 별칭을 못 풀 때 → 도달 관문이 잡아야 한다 (§2-9-2 사고를 숙박에서 재현)
   6. **거리가 통째로 틀림**       → 조립을 멈춰야 한다 (한 곳씩 빼면 빈 파일이 나온다)
      2026-08-02 실제 사고: 좌표를 ÷3600 해서 6,297곳 거리가 전부 틀렸다(최대 14,339km).

⚠️ 진짜 자료(js/staydb_jp.js·_scan/stay_batch.json)가 이미 있으면 백업하고 반드시 되돌린다.

사용: python tools/jp/verify_gates_stay.py
"""
import json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from jp_common import HP_JP, ROOT

SRC = os.path.join(HP_JP, "_scan", "stay_batch.json")
OUT = os.path.join(ROOT, "js", "staydb_jp.js")
BUILD = os.path.join(HERE, "build_staydb_jp.py")
GATE = os.path.join(HERE, "check_applink_jp.js")


def real_courses(n):
    """홀맵에 실제로 있는 구장 이름 n 개 — 가짜 자료도 진짜 이름 위에 얹어야 의미가 있다"""
    out = []
    for d in sorted(os.listdir(HP_JP)):
        f = os.path.join(HP_JP, d, "parsed.json")
        if os.path.exists(f):
            try:
                out.append(json.load(open(f, encoding="utf-8"))["course"])
            except Exception:
                pass
        if len(out) >= n:
            break
    return out


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, cwd=ROOT)
    return r.returncode, (r.stdout + r.stderr).decode("utf-8", "replace")


def main():
    names = real_courses(3)
    if len(names) < 3:
        print("✖ 홀맵 자료가 없어 검증할 수 없습니다")
        return 1

    backups = {}
    for p in (SRC, OUT):
        if os.path.exists(p):
            b = tempfile.mktemp(suffix=".bak")
            shutil.copyfile(p, b)
            backups[p] = b

    ok = 0
    try:
        # ── 가짜 배치 결과: 고장 4가지를 한꺼번에 심는다 ──
        fake = [
            {"n": names[0], "h": [{"no": 1001, "km": 1.2}, {"no": 1002, "km": 4.5}]},   # 정상
            {"n": "존재하지않는구장ZZZ", "h": [{"no": 2001, "km": 1.0}]},                # 고장1
            {"n": names[1], "h": [{"no": "3001", "km": 1.0},                             # 고장2
                                  {"no": 3002, "km": 999.0},                             # 고장3
                                  {"no": 3003, "km": 2.0}]},
            {"n": names[2], "h": [{"no": 4000 + i, "km": i * 0.5} for i in range(20)]},  # 고장4
        ]
        os.makedirs(os.path.dirname(SRC), exist_ok=True)
        json.dump(fake, open(SRC, "w", encoding="utf-8"), ensure_ascii=False)

        code, out = run([sys.executable, BUILD])
        print(out.strip())
        if code:
            print("🔴 조립기가 실패했습니다 — 가짜 자료로도 돌아야 합니다")
            return 1

        db = open(OUT, encoding="utf-8").read()
        checks = [
            ("홀맵에 없는 구장을 뺐나", "존재하지않는구장ZZZ" not in db),
            ("숙소번호가 문자열인 것을 뺐나", '"3001"' not in db and "3001" not in db),
            ("거리 999km 를 뺐나", "999" not in db),
            ("한 구장 12곳으로 잘랐나", max(
                (l.count("["), ) for l in db.splitlines() if l.strip().startswith('"'))[0] <= 13),
        ]
        for label, good in checks:
            print(f"  {'✅' if good else '🔴'} {label}")
            ok += 1 if good else 0

        # ── 고장6: 거리가 통째로 틀리면 조립을 멈추는가 ──
        # (한 곳씩 걸러내면 빈 파일을 만들어 놓고 '조립 완료' 라고 말한다 — 그게 더 나쁘다)
        allbad = [{"n": names[0], "h": [{"no": 5000 + i, "km": 14339.3} for i in range(10)]}]
        json.dump(allbad, open(SRC, "w", encoding="utf-8"), ensure_ascii=False)
        code, out = run([sys.executable, BUILD])
        stopped = code != 0 and "거리가 말이 안" in out
        print(f"  {'✅' if stopped else '🔴'} 거리가 통째로 틀리면 조립을 멈추나")
        ok += 1 if stopped else 0

        # ── 고장5: 앱이 별칭을 못 풀면 도달 관문이 잡는가 ──
        pack = os.path.join(ROOT, "js", "jppack.js")
        pb = tempfile.mktemp(suffix=".js")
        shutil.copyfile(pack, pb)
        try:
            s = open(pack, encoding="utf-8").read()
            broken = s.replace("return [name].concat(cands);", "return [name];")
            open(pack, "w", encoding="utf-8", newline="\n").write(broken)
            code, out = run(["node", GATE])
            caught = code != 0 and "닿지 않" in out
            print(f"  {'✅' if caught else '🔴'} 별칭을 못 풀 때 도달 관문이 잡나")
            ok += 1 if caught else 0
        finally:
            shutil.copyfile(pb, pack)
            os.remove(pb)
    finally:
        for p, b in backups.items():
            shutil.copyfile(b, p)
            os.remove(b)
        if SRC not in backups and os.path.exists(SRC):
            os.remove(SRC)
        if OUT not in backups and os.path.exists(OUT):
            os.remove(OUT)

    print(f"\n{'✅' if ok == 6 else '🔴'} 고장 {ok}/6 건을 잡았습니다 · 원본 복구 완료")
    return 0 if ok == 6 else 1


if __name__ == "__main__":
    sys.exit(main())
