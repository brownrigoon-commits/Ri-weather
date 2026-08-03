# -*- coding: utf-8 -*-
"""이미 등록된 골프존 구장의 코스명을 원본의 진짜 이름으로 되돌린다 (2026-08-03 신설)

무엇이 잘못됐나
  `tools/golfzon_build.py` 가 코스명을 만들 때 구장명 문자열에 ' - ' 가 없으면
  무조건 OUT/IN(또는 A·B·C·D)을 붙였다. 그런데 같은 원본 JSON 안
  `holeInfo.courseTypes` 에 **진짜 코스명이 들어 있었다**.
  그래서 앱은 태인CC 를 'OUT/IN' 으로 부르지만 실제 이름은 LAKE·MOUNTAIN 이고,
  포천힐스는 'A/B/C' 지만 실제는 CASTLE·PALACE·GARDEN 이다(2026-08-03 전수 감사).
  이용자는 예약한 코스를 앱에서 못 찾거나, 남의 코스를 누르게 된다.

어떻게 맞추나
  등록본의 홀 영상 주소 `hole3D_<ccMasterSeq>_<ciNum>_<홀>.mp4` 가 원본 좌표를 그대로 담고 있다.
  거기서 (ccMasterSeq, ciNum) 을 읽어 원본의 courseTypes 이름을 붙인다.
  · 지금 이름이 OUT/IN/A~D 처럼 지어낸 것일 때만 바꾼다(사람이 확인해 붙인 이름은 건드리지 않는다)
  · 한 코스의 홀들이 서로 다른 ciNum 을 가리키면 손대지 않고 알린다(그건 더 큰 문제다)
  · 이미지 파일 이름은 그대로 둔다 — 화면에 나오는 것은 코스명이고, 파일명은 내부용이다

사용
  python tools/fix_gz_coursenames.py           무엇이 바뀌는지만 보여 준다
  python tools/fix_gz_coursenames.py --write   parsed.json 을 실제로 고친다
"""
import argparse, glob, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GZ = os.path.join(ROOT, "coursedata", "golfzon")
HP = os.path.join(ROOT, "coursedata", "homepages")

MADE_UP = re.compile(r"^(OUT|IN|OUT2|IN2|[A-D])$", re.I)
VID = re.compile(r"hole3D_(\d+)_(\d+)_\d+")


def name_index():
    """(ccMasterSeq, ciNum) → 진짜 코스명"""
    idx = {}
    for f in glob.glob(os.path.join(GZ, "cc_*.json")):
        try:
            j = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        hi = j.get("holeInfo") or {}
        types = {c.get("ciNum"): (c.get("courseName") or "").strip()
                 for c in (hi.get("courseTypes") or [])}
        if not types:
            continue
        for nine in hi.get("holeInfoList") or []:
            for h in nine:
                seq, ci = h.get("ccMasterSeq"), h.get("ciNum")
                if seq and ci and types.get(ci):
                    idx[(int(seq), int(ci))] = types[ci]
    return idx


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()

    idx = name_index()
    print(f"■ 원본이 알려 주는 코스명 {len(idx)}개 (ccMasterSeq·ciNum 기준)")
    fixed = clubs = skipped = mixed = 0
    for f in sorted(glob.glob(os.path.join(HP, "gz*", "parsed.json"))):
        d = json.load(open(f, encoding="utf-8"))
        notes = []
        for c in d["courses"]:
            keys = set()
            for h in c["holes"]:
                m = VID.search(h.get("video") or "")
                if m:
                    keys.add((int(m.group(1)), int(m.group(2))))
            if len(keys) > 1:
                notes.append(f'  ⚠ {c["name"]}: 홀들이 서로 다른 코스를 가리킵니다 {sorted(keys)}')
                mixed += 1
                continue
            if not keys:
                continue
            real = idx.get(list(keys)[0])
            if not real or real == c["name"]:
                continue
            if not MADE_UP.match(c["name"]):
                notes.append(f'  · {c["name"]} ↔ 원본 {real} — 사람이 붙인 이름이라 두었습니다')
                skipped += 1
                continue
            notes.append(f'  {c["name"]} → {real}')
            c["name"] = real
            fixed += 1
        if notes:
            clubs += 1
            print(f'■ {d["course"]}')
            print("\n".join(notes))
            if a.write:
                json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    print(f"\n바꾼 코스 {fixed}개 / 구장 {clubs}곳 · 사람이 붙인 이름이라 둔 것 {skipped} · "
          f"코스가 섞인 것 {mixed}")
    print("다음: python tools/build_holeimgdb.py" if a.write
          else "(미리보기입니다 — 실제로 고치려면 --write)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
