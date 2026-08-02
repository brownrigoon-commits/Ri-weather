# -*- coding: utf-8 -*-
"""골프 정신 내용(js/spiritdb.js) → 일본어판 js/spiritdb_ja.js — 2026-08-03

이 화면은 **UI 문구가 아니라 내용**이다(룰 요약·매너·명언 305덩이, 약 1만 자).
i18n 사전에 넣으면 사전이 두 배로 부풀고, 한국 이용자가 쓰지도 않을 일본어를
늘 함께 받게 된다. 그래서 홀맵 꾸러미와 같은 방식을 쓴다 —
**따로 만든 파일을 일본어 화면일 때만 싣는다.**

  js/spiritdb.js     SPIRIT_DB    · QUOTES_DB     (손으로 관리 · 원본)
  js/spiritdb_ja.js  SPIRIT_DB_JA · QUOTES_DB_JA  (이 도구가 만드는 생성물)

⚠️ 손대지 않는 값
  · key / sections[].key — 탭 판정에 쓴다. 옮기면 탭이 안 열린다.
  · rulesLink 같은 주소.
  · 숫자·규칙 번호("규칙 16.1")는 문장 안에 있으므로 번역기가 지키도록 두되,
    아래 check 로 **원문과 같은 숫자가 남아 있는지** 확인한다.

사용
  python tools/build_spiritdb_ja.py --dry   무엇을 옮길지만 보여준다
  python tools/build_spiritdb_ja.py         실제로 만든다
"""
import json, os, re, subprocess, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8")

import build_i18n_ja as B                      # 번역·예산·표식 처리를 그대로 쓴다

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "js", "spiritdb.js")
OUT = os.path.join(ROOT, "js", "spiritdb_ja.js")
DRY = "--dry" in sys.argv

KO = re.compile(r"[가-힣]")
# 옮기면 안 되는 열쇠 — 값이 코드 판정에 쓰인다
SKIP_KEYS = {"key", "rulesLink", "id", "href", "url"}
NUM = re.compile(r"\d+(?:\.\d+)*")


def load():
    """node 로 실제 파일을 실행해 객체를 그대로 받아온다(정규식 파싱은 반드시 어긋난다)."""
    js = ("const fs=require('fs');"
          "const f=new Function(fs.readFileSync(%r,'utf8')+';return {SPIRIT_DB,QUOTES_DB};');"
          "process.stdout.write(JSON.stringify(f()));" % SRC.replace("\\", "/"))
    out = subprocess.run(["node", "-e", js], capture_output=True, check=True)
    return json.loads(out.stdout.decode("utf-8"))


def collect(o, key=None, bag=None):
    bag = bag if bag is not None else []
    if isinstance(o, str):
        if key not in SKIP_KEYS and KO.search(o):
            bag.append(o)
    elif isinstance(o, list):
        for v in o:
            collect(v, key, bag)
    elif isinstance(o, dict):
        for k, v in o.items():
            collect(v, k, bag)
    return bag


def apply(o, m, key=None):
    if isinstance(o, str):
        return m.get(o, o) if key not in SKIP_KEYS else o
    if isinstance(o, list):
        return [apply(v, m, key) for v in o]
    if isinstance(o, dict):
        return {k: apply(v, m, k) for k, v in o.items()}
    return o


def main():
    db = load()
    todo = sorted(set(collect(db)))
    print(f"■ 옮길 문장 {len(todo)}개 · {sum(len(t) for t in todo)}자")
    if DRY:
        for t in todo[:12]:
            print("   ", t[:64])
        return 0

    m = B.translate_all(todo)
    lost = [t for t in todo if t not in m]
    if lost:
        print(f"⚠️ 못 옮긴 문장 {len(lost)}개 — 그 자리는 한국어가 그대로 남습니다")

    # 🔴 원문에 있던 숫자가 **사라지면** 룰 번호가 틀린 것이다 — 그런 번역은 버린다.
    #    반대로 일본어에 숫자가 늘어나는 것은 정상이다:
    #    한국어는 "네 시간"·"두 클럽"·"세 번" 처럼 말로 적고 일본어는 "4時間"·"2クラブ" 로 적는다.
    #    (처음엔 개수가 같은지를 봤다가 멀쩡한 번역 24개를 버렸다 — 2026-08-03)
    dropped = 0
    for ko, ja in list(m.items()):
        if not set(NUM.findall(ko)) <= set(NUM.findall(ja)):
            print(f"   버림(숫자 사라짐): {ko[:40]} → {ja[:40]}")
            del m[ko]; dropped += 1
    if dropped:
        print(f"⚠️ 숫자가 사라져 버린 번역 {dropped}개 (규칙 번호가 바뀌면 안 된다)")

    ja = {k: apply(v, m) for k, v in db.items()}
    # 공식 규칙 주소는 나라마다 다르다. 한국판은 대한골프협회(KGA)를 가리키는데,
    # 일본 이용자를 한국 협회로 보내면 읽지도 못하는 페이지가 열린다.
    # 일본골프협회(JGA) 규칙 안내 — 2026-08-03 브라우저로 열어 「ゴルフ規則 | JGA」 확인.
    ja["SPIRIT_DB"]["rulesLink"] = "https://www.jga.or.jp/rules/rule/"
    body = (
        "/* 골프 정신 내용 — 일본어판. **생성물이다.**\n"
        " * 고칠 일이 있으면 js/spiritdb.js 를 고친 뒤\n"
        " * `python tools/build_spiritdb_ja.py` 로 다시 만든다.\n"
        " * 일본어 화면일 때만 실린다(index.html 참조). */\n"
        "const SPIRIT_DB_JA = " + json.dumps(ja["SPIRIT_DB"], ensure_ascii=False, indent=1) + ";\n"
        "const QUOTES_DB_JA = " + json.dumps(ja["QUOTES_DB"], ensure_ascii=False, indent=1) + ";\n"
    )
    open(OUT, "w", encoding="utf-8", newline="\n").write(body)
    got = len(todo) - len(lost) - dropped
    print(f"✅ js/spiritdb_ja.js 완성 — {got}/{len(todo)}개 일본어")
    return 0


if __name__ == "__main__":
    sys.exit(main())
