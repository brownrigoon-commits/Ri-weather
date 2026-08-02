# -*- coding: utf-8 -*-
"""숙박 배치 결과 → js/staydb_jp.js (2026-08-02 신설 · 설계 §4-2)

무엇을 굳히고 무엇을 굳히지 않나
  굳힌다 : 구장별 **숙소 번호(hotelNo) + 구장에서의 거리(km)**
           — 이건 변하지 않는 사실이다.
  안 굳힌다: **가격·평점·빈방** — 변하는 값을 저장하면 그 순간부터 틀린 정보가 된다.
           앱이 화면을 열 때 저장된 번호로 1회 호출해 현재 값을 받는다(신뢰 우선 원칙).

입력  coursedata/homepages_jp/_scan/stay_batch.json
      [ { "n": "일본어 원문 구장명", "h": [ {"no": 12345, "km": 4.2}, … ] }, … ]
      (배포 도메인 브라우저에서 돌린 배치의 window.__stay.out 을 그대로 꺼낸 것)

출력  js/staydb_jp.js
      const STAYDB_JP = { "구장명": [[hotelNo, km], …] };   ← 부피를 줄여 배열로

조립하면서 걸러내는 것 (관문 겸함)
  · 홀맵에 없는 구장            → 화면에 붙을 자리가 없다
  · hotelNo 가 양의 정수가 아님 → 호출이 깨진다
  · km 이 0~12 밖              → 링 설계상 나올 수 없는 값 (파싱이 밀린 것)
  · 한 구장 12곳 초과          → 잘라낸다 (화면에 그만큼 안 쓴다)

사용: python tools/jp/build_staydb_jp.py
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import HP_JP, ROOT

SRC = os.path.join(HP_JP, "_scan", "stay_batch.json")
OUT = os.path.join(ROOT, "js", "staydb_jp.js")
MAX_PER_COURSE = 12
KM_MAX = 12.0                 # 9km 링 + 3km 반경 = 이론 최대 12km


def registered():
    """홀맵이 있는 구장 이름 — 여기 없으면 화면에 붙을 자리가 없다."""
    out = set()
    if not os.path.isdir(HP_JP):
        return out
    for d in os.listdir(HP_JP):
        f = os.path.join(HP_JP, d, "parsed.json")
        if os.path.exists(f):
            try:
                out.add(json.load(open(f, encoding="utf-8"))["course"])
            except Exception:
                pass
    return out


def js_str(s):
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"').strip() + '"'


def main():
    if not os.path.exists(SRC):
        print(f"✖ 배치 결과가 없습니다: {SRC}")
        print("   배포 도메인 브라우저에서 window.__stay.out 을 꺼내 이 경로에 저장하세요.")
        return 1
    rows = json.load(open(SRC, encoding="utf-8"))
    reg = registered()

    # 🔴 거리가 통째로 틀리면 한 곳씩 빼는 것으로는 못 막는다 — 아예 조립을 멈춘다.
    #    2026-08-02: 배치가 좌표를 ÷3600 하는 바람에 6,297곳 거리가 전부 틀렸다
    #    (최대 14,339km). 한 곳씩 걸러내면 '값이 이상해 뺀 숙소 6,297곳' 이라 찍고
    #    빈 파일을 만들어 놓고는 '조립 완료' 라고 말했을 것이다.
    all_km = [h.get("km") for r in rows for h in (r.get("h") or [])
              if isinstance(h.get("km"), (int, float))]
    if all_km:
        over = sum(1 for k in all_km if k > KM_MAX)
        if over > len(all_km) * 0.3:
            print(f"✖ 거리가 말이 안 됩니다 — {len(all_km):,}곳 중 {over:,}곳이 {KM_MAX:g}km 를 넘습니다"
                  f" (최대 {max(all_km):,.1f}km)")
            print("   좌표 단위를 잘못 읽었을 가능성이 큽니다(datumType=1 이면 응답은 '도' 입니다).")
            print("   한 곳씩 걸러내지 않고 여기서 멈춥니다 — 빈 파일을 만들어 두면 더 나쁩니다.")
            return 1

    db, drop_course, drop_hotel, empty = {}, 0, 0, 0
    for r in rows:
        name = r.get("n")
        if name not in reg:
            drop_course += 1
            continue
        clean = []
        for h in (r.get("h") or []):
            no, km = h.get("no"), h.get("km")
            if not isinstance(no, int) or no <= 0:
                drop_hotel += 1
                continue
            if not isinstance(km, (int, float)) or km < 0 or km > KM_MAX:
                drop_hotel += 1
                continue
            clean.append([no, round(float(km), 1)])
        clean.sort(key=lambda x: x[1])
        clean = clean[:MAX_PER_COURSE]
        if not clean:
            empty += 1
            continue                     # 숙소가 없는 구장은 담지 않는다 — 앱이 '못 찾음'을 말한다
        db[name] = clean

    with open(OUT, "w", encoding="utf-8", newline="\n") as w:
        w.write("/* 투어리스트 일본 구장 주변 숙소 — 라쿠텐 트래블\n"
                "   ⚠️ 생성물입니다. 직접 고치지 마세요 — tools/jp/build_staydb_jp.py 가 다시 씁니다.\n"
                "   담긴 것: [숙소번호, 구장에서의 거리(km)] — **변하지 않는 사실만**.\n"
                "   가격·평점·빈방은 담지 않습니다. 그건 앱이 화면을 열 때 그때그때 받아옵니다\n"
                "   (변하는 값을 굳혀 두면 그 순간부터 틀린 정보가 됩니다). */\n")
        w.write("const STAYDB_JP = {\n")
        for name in sorted(db):
            items = ", ".join("[%d,%s]" % (no, ("%g" % km)) for no, km in db[name])
            w.write(f"  {js_str(name)}: [{items}],\n")
        w.write("};\n")

    kb = os.path.getsize(OUT) // 1024
    tot = sum(len(v) for v in db.values())
    near = sum(1 for v in db.values() for _, km in v if km <= 3)
    print(f"staydb_jp.js 조립 완료: {len(db)}구장 · 숙소 {tot:,}곳 · {kb}KB")
    print(f"   · 3km 안 숙소 {near:,}곳 / 전체 {tot:,}곳")
    if drop_course:
        print(f"   · 홀맵이 없어 제외한 구장 {drop_course}곳")
    if drop_hotel:
        print(f"   · 값이 이상해 뺀 숙소 {drop_hotel}곳 (번호가 정수가 아니거나 거리가 0~{KM_MAX:g}km 밖)")
    if empty:
        print(f"   · 숙소를 못 찾은 구장 {empty}곳 — 앱이 '주변 숙소를 찾지 못했습니다' 라고 말합니다")
    return 0


if __name__ == "__main__":
    sys.exit(main())
