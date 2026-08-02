# -*- coding: utf-8 -*-
"""부킹 조립기 고장 검증 (2026-08-02 신설 · 설계 §6-1)

🔴 GORA 열거가 끝나기 **전에** 돌린다 — 끝난 뒤에 조립기가 고장난 걸 알면 늦다.
   진짜 열거 결과 대신 가짜 자료로 조립기를 먼저 시험한다.

이 도구가 지키려는 것 하나: **엉뚱한 구장에 예약 링크가 붙지 않는 것.**
빈 카드는 이용자를 실망시키지만, 옆 구장 예약 페이지는 **돈을 잘못 쓰게 만든다.**

시험하는 고장
  1. 측지 변환을 빼면 大箱根CC 가 箱根CC 에 붙는가  ← 8/2 실측으로 확인한 실제 위험
  2. golfdb 에 없는 구장을 담지 않는가
  3. 이름은 맞는데 좌표가 멀면 담지 않는가
  4. 같은 구장에 GORA ID 가 둘이면 하나만 담는가
  5. 체인 꼬리(【アコーディア・ゴルフ】)를 떼고 매칭하는가

사용: python tools/jp/verify_gates_booking.py
"""
import json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from jp_common import HP_JP, ROOT, load_golfdb_jp

SRC = os.path.join(HP_JP, "_scan", "gora_courses.json")
OUT = os.path.join(ROOT, "js", "bookingids_jp.js")
BUILD = os.path.join(HERE, "build_bookingids_jp.py")


def wgs_to_tokyo(lat, lon):
    """WGS84 → 일본측지계 (역변환) — golfdb 좌표로 '진짜 GORA 처럼 생긴' 가짜를 만든다"""
    return (lat + lat * 0.00010696 - lon * 0.000017467 - 0.0046020,
            lon + lat * 0.000046047 + lon * 0.000083049 - 0.010041)


def run():
    r = subprocess.run([sys.executable, BUILD], capture_output=True, cwd=ROOT)
    return r.returncode, (r.stdout + r.stderr).decode("utf-8", "replace")


def main():
    jp = load_golfdb_jp()
    by = {g["n"]: g for g in jp}
    # 8/2 실측에서 실제로 헷갈린 짝
    pair = [n for n in ("大箱根CC", "箱根CC") if n in by]
    if len(pair) < 2:
        print("⚠️ 大箱根CC/箱根CC 를 golfdb 에서 못 찾아 1번 검증을 건너뜁니다")
    others = [g for g in jp if g["n"] not in pair][:3]

    backups = {}
    for p in (SRC, OUT):
        if os.path.exists(p):
            b = tempfile.mktemp(suffix=".bak")
            shutil.copyfile(p, b)
            backups[p] = b

    ok, total = 0, 0
    try:
        fake = []
        if len(pair) == 2:
            g = by["大箱根CC"]
            la, lo = wgs_to_tokyo(g["lat"], g["lon"])
            fake.append({"id": 140026, "name": "大箱根カントリークラブ",
                         "lat": la, "lon": lo, "cal": "https://gora/大箱根"})
        # 고장2: golfdb 에 없는 구장
        fake.append({"id": 999001, "name": "存在しないゴルフ倶楽部ZZZ",
                     "lat": 35.0, "lon": 139.0, "cal": "x"})
        # 고장3: 이름은 맞는데 좌표가 100km 밖
        g1 = others[0]
        fake.append({"id": 999002, "name": g1["n"], "lat": g1["lat"] + 1.0,
                     "lon": g1["lon"], "cal": "x"})
        # 고장4: 같은 구장 ID 둘
        g2 = others[1]
        la2, lo2 = wgs_to_tokyo(g2["lat"], g2["lon"])
        fake.append({"id": 999003, "name": g2["n"], "lat": la2, "lon": lo2, "cal": "a"})
        fake.append({"id": 999004, "name": g2["n"], "lat": la2, "lon": lo2, "cal": "b"})
        # 고장5: 체인 꼬리가 붙은 이름
        g3 = others[2]
        la3, lo3 = wgs_to_tokyo(g3["lat"], g3["lon"])
        fake.append({"id": 999005, "name": g3["n"] + "【アコーディア・ゴルフ】",
                     "lat": la3, "lon": lo3, "cal": "c"})

        os.makedirs(os.path.dirname(SRC), exist_ok=True)
        json.dump(fake, open(SRC, "w", encoding="utf-8"), ensure_ascii=False)
        code, out = run()
        print(out.strip())
        if code:
            print("🔴 조립기가 실패했습니다 — 가짜 자료로도 돌아야 합니다")
            return 1
        db = open(OUT, encoding="utf-8").read()

        checks = []
        if len(pair) == 2:
            checks.append(("측지 변환 후 大箱根CC 로 붙나 (箱根CC 아니고)",
                           '"大箱根CC"' in db and '"箱根CC"' not in db))
        checks += [
            ("golfdb 에 없는 구장을 뺐나", "999001" not in db and "ZZZ" not in db),
            ("좌표가 먼 것을 뺐나", "999002" not in db),
            ("중복 ID 를 하나만 담았나", db.count("999003") + db.count("999004") <= 1),
            ("체인 꼬리를 떼고 매칭했나", "999005" in db and "アコーディア" not in db),
        ]
        for label, good in checks:
            total += 1
            ok += 1 if good else 0
            print(f"  {'✅' if good else '🔴'} {label}")

        # ── 측지 변환이 실제로 일을 하는가 ──
        #
        # ⚠️ 처음엔 "변환을 빼면 大箱根CC 가 箱根CC 에 붙는다" 를 시험했는데 **안 붙었다.**
        #    당연했다 — 그 오매칭은 '가장 가까운 구장 찾기' 방식에서 나오는 것이고,
        #    이 조립기는 **이름으로 먼저 정하고 좌표는 검산만** 하기 때문에 구조적으로 안 생긴다.
        #    (설계할 때 이 순서를 고른 이유가 바로 그것이다.)
        #
        # 그러면 변환은 왜 필요한가: **멀쩡한 구장이 억울하게 잘려나가는 것**을 막는다.
        # 변환을 안 하면 모든 구장이 500~900m 씩 어긋난 것처럼 보여, 검산 임계를 조금만
        # 좁혀도 무더기로 탈락한다. 그걸 시험한다 — 임계를 0.3km 로 조인 상태에서
        # 변환이 있으면 담기고, 없으면 잘려나가야 한다.
        total += 1
        src0 = open(BUILD, encoding="utf-8").read()
        bb = tempfile.mktemp(suffix=".py")
        shutil.copyfile(BUILD, bb)
        try:
            tight = src0.replace("MAX_KM = 1.0", "MAX_KM = 0.3")
            open(BUILD, "w", encoding="utf-8", newline="\n").write(tight)
            run()
            with_conv = open(OUT, encoding="utf-8").read().count(":")
            open(BUILD, "w", encoding="utf-8", newline="\n").write(
                tight.replace('wla, wlo = tokyo_to_wgs84(r["lat"], r["lon"])',
                              'wla, wlo = r["lat"], r["lon"]'))
            run()
            without = open(OUT, encoding="utf-8").read().count(":")
            good = with_conv > without
            ok += 1 if good else 0
            print(f"  {'✅' if good else '🔴'} 변환이 억울한 탈락을 막나 "
                  f"(임계 0.3km: 변환 {with_conv}곳 vs 변환없이 {without}곳)")
        finally:
            shutil.copyfile(bb, BUILD)
            os.remove(bb)
    finally:
        for p, b in backups.items():
            shutil.copyfile(b, p)
            os.remove(b)
        for p in (SRC, OUT):
            if p not in backups and os.path.exists(p):
                os.remove(p)

    print(f"\n{'✅' if ok == total else '🔴'} 고장 {ok}/{total} 건을 잡았습니다 · 원본 복구 완료")
    return 0 if ok == total else 1


if __name__ == "__main__":
    sys.exit(main())
