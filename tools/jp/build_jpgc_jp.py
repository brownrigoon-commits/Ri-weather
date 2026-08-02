# -*- coding: utf-8 -*-
"""じゃらんゴルフ 구장 번호 → js/jpgc_jp.js (2026-08-03 신설 · 설계 §6-1)

만드는 것
  const JPGC_JP = { "golfdb 원문 구장명": "00001", … };   ← gc00001 의 숫자 부분

입력  coursedata/homepages_jp/_scan/jalan_gc_index.json   { "gc00001": "구장명", … }
      (홀맵·통계 수집 때 이미 만들어 둔 색인이다 — 재수집이 없다)

쓰는 곳: 부킹 화면의 두 번째 카드 — https://golf-jalan.net/gc{번호}/

🔴 매칭은 이름만 쓴다. じゃらん 색인에는 좌표가 없기 때문이다.
   그래서 **NameResolver 가 확신한 것만** 담는다(후보가 둘이면 버린다).
   엉뚱한 구장 예약 페이지가 뜨는 것은 빈 카드보다 나쁘다.

사용: python tools/jp/build_jpgc_jp.py
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import HP_JP, ROOT, NameResolver

SRC = os.path.join(HP_JP, "_scan", "jalan_gc_index.json")
OUT = os.path.join(ROOT, "js", "jpgc_jp.js")
CHAIN = re.compile(r"【[^】]*】|［.*?］|\[.*?\]")


def js_str(s):
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"').strip() + '"'


def main():
    if not os.path.exists(SRC):
        print(f"✖ gc 색인이 없습니다: {SRC}")
        return 1
    idx = json.load(open(SRC, encoding="utf-8"))
    res = NameResolver()

    db, miss, dup = {}, 0, 0
    for gc, raw in idx.items():
        m = re.match(r"gc0*(\d+)$", gc)
        if not m:
            continue
        name, why, lv = res.resolve(CHAIN.sub("", raw or "").strip())
        if not name:
            miss += 1
            continue
        if name in db:
            dup += 1
            continue
        db[name] = gc[2:]                  # "gc00001" → "00001" (주소에 그대로 들어간다)

    with open(OUT, "w", encoding="utf-8", newline="\n") as w:
        w.write("/* 투어리스트 — じゃらんゴルフ 구장 번호\n"
                "   ⚠️ 생성물입니다. 직접 고치지 마세요 — tools/jp/build_jpgc_jp.py 가 다시 씁니다.\n"
                "   부킹 화면의 두 번째 카드용: https://golf-jalan.net/gc{번호}/\n"
                "   ⚠️ 이름으로만 맞췄습니다(じゃらん 색인에 좌표가 없습니다).\n"
                "      NameResolver 가 확신한 것만 담았습니다 — 후보가 둘이면 버렸습니다. */\n")
        w.write("const JPGC_JP = {\n")
        for n in sorted(db):
            w.write(f"  {js_str(n)}: {js_str(db[n])},\n")
        w.write("};\n")

    kb = os.path.getsize(OUT) // 1024
    print(f"jpgc_jp.js 조립 완료: {len(db)}구장 · {kb}KB  (색인 {len(idx)}곳)")
    if miss:
        print(f"   · golfdb 에서 이름을 못 찾거나 확신이 안 서 제외 {miss}곳")
    if dup:
        print(f"   · 같은 구장에 gc 번호가 둘 이상 {dup}곳 — 먼저 것을 씀")
    return 0


if __name__ == "__main__":
    sys.exit(main())
