# -*- coding: utf-8 -*-
"""골프장 DB의 **한국 항목이 한 글자도 안 변했는지** 검사한다 (배포 관문).

왜 필요한가 — 이름과 좌표가 조인 키다.
  · 저장 구장(riweather.courses.v1)의 옛 기록은 좌표 **완전일치**로 다시 찾는다
    (js/app.js `isKRCourse()` — GOLF_DB 를 훑어 lat/lon 이 똑같은 항목을 찾음).
  · 날씨 캐시 키가 좌표 문자열이다 (`riweather.fc.{lat},{lon}` 등).
  · 홀맵 연결은 이름 완전일치다 (HOLEIMG_DB[course.name]).
좌표를 반올림하거나 이름을 다듬는 '개선'을 하는 순간, 기존 이용자의 즐겨찾기가
레이더 판정에서 빠지고 캐시가 어긋난다. **화면에는 아무 오류도 안 뜬다.**
그래서 자동으로 막는다.

일본·중국 항목은 보지 않는다(확장 대상이므로 자유롭게 바뀔 수 있다).
한국 항목도 **추가는 허용**한다 — 금지하는 것은 기존 항목의 변경과 삭제뿐이다.

사용
  python tools/check_golfdb_kr.py            # 검사만, 어긋나면 종료코드 1
  python tools/check_golfdb_kr.py --report   # 통과해도 요약 출력
  python tools/check_golfdb_kr.py --update   # 기준표 갱신 (의도적으로 바꿨을 때만!)
"""
import json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "js", "golfdb.js")
BASE = os.path.join(ROOT, "tools", "golfdb_kr_baseline.json")


def load_kr(path=DB):
    """golfdb.js 에서 한국 항목을 `이름\\t위도\\t경도` 목록으로 뽑는다.

    ⚠️ 이름을 키로 하는 사전으로 만들면 안 된다 — **한국 항목에도 동명이 10건 있어서**
    (635행 / 이름 625개) 조용히 뭉개진다. 있는 그대로의 목록으로 비교한다.
    좌표는 `repr` 로 '적힌 그대로' 비교한다. float 로 바꾸면 37.60 과 37.6 이 같아져서,
    실제로 캐시 키(`riweather.fc.{lat},{lon}`)를 바꾸는 변경을 놓친다.
    """
    src = open(path, encoding="utf-8").read()
    m = re.search(r"const GOLF_DB = (\[.*?\]);", src, re.S)
    if not m:
        raise RuntimeError("golfdb.js 에서 GOLF_DB 배열을 찾지 못했습니다")
    rows = json.loads(m.group(1))
    return sorted(f'{r["n"]}\t{r["lat"]!r}\t{r["lon"]!r}' for r in rows if r.get("c") == "KR")


def violations(root=ROOT):
    from collections import Counter
    cur = load_kr(os.path.join(root, "js", "golfdb.js"))
    base_path = os.path.join(root, "tools", "golfdb_kr_baseline.json")
    if not os.path.exists(base_path):
        return [], ["기준표가 없습니다 — `python tools/check_golfdb_kr.py --update` 로 먼저 만드세요"]
    base = json.load(open(base_path, encoding="utf-8"))
    bad, note = [], []
    cb, cc = Counter(base), Counter(cur)
    for row, n in (cb - cc).items():                       # 없어졌거나 내용이 바뀐 것
        name, lat, lon = row.split("\t")
        same_name = [r for r in cur if r.split("\t")[0] == name]
        if same_name:
            _, la, lo = same_name[0].split("\t")
            bad.append(f'좌표 바뀜: "{name}" {lat},{lon} → {la},{lo}')
        else:
            bad.append(f'없어짐: "{name}" ({lat},{lon}) — 기존 이용자의 즐겨찾기·캐시가 끊깁니다')
    added = list((cc - cb).elements())
    if added:
        note.append(f"새 한국 항목 {len(added)}건 추가됨 (허용) — 예: "
                    + ", ".join(a.split("\t")[0] for a in added[:3]))
    dup = [n for n, c in Counter(r.split("\t")[0] for r in cur).items() if c > 1]
    if dup:
        note.append(f"동명 구장 {len(dup)}건 — 홀맵 연결(이름 완전일치)에 주의: {', '.join(dup[:5])}")
    note.append(f"한국 항목 기준 {len(base)}건 / 현재 {len(cur)}건")
    return bad, note


def main():
    if "--update" in sys.argv:
        cur = load_kr()
        json.dump(cur, open(BASE, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
        print(f"기준표 갱신: 한국 {len(cur)}건 → tools/golfdb_kr_baseline.json")
        print("⚠️ 기존 항목을 의도적으로 고친 게 맞는지 다시 확인하세요. "
              "고친 이유를 커밋 메시지에 남기면 다음 사람이 압니다.")
        return 0
    bad, note = violations()
    if bad:
        print(f"✖ 골프장DB 한국 항목이 바뀌었습니다 {len(bad)}건")
        for s in bad[:20]:
            print("   -", s)
        if len(bad) > 20:
            print(f"   … 외 {len(bad)-20}건")
        print("  이름·좌표는 저장 구장·캐시·홀맵의 조인 키입니다. 되돌리세요.")
        print("  정말 의도한 변경이면 `python tools/check_golfdb_kr.py --update` 로 기준표를 갱신하세요.")
        return 1
    if "--report" in sys.argv:
        for s in note:
            print("  ·", s)
    print("골프장DB 한국 항목 검사 OK: 기존 항목 그대로")
    return 0


if __name__ == "__main__":
    sys.exit(main())
