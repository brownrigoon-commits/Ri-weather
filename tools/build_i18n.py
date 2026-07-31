# -*- coding: utf-8 -*-
"""문구 사전 조립 — js/i18n/src/*.json → js/i18n/ko.js · ja.js

왜 조각 파일인가
  문구를 파일별(booking·stay·app…)로 나눠 두면 여러 사람이 동시에 손대도 안 부딪히고,
  '이 화면 문구가 어디 있나'를 찾기도 쉽다. 앱에는 조립된 한 파일만 실린다
  (홀맵 DB 를 parsed.json 들에서 조립하는 것과 같은 방식).

파일 이름 규칙
  js/i18n/src/ko.booking.json   →  ko 사전의 booking 조각
  js/i18n/src/ja.booking.json   →  ja 사전의 booking 조각 (Phase 3)

사용
  python tools/build_i18n.py
"""
import glob, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "js", "i18n", "src")
OUT = os.path.join(ROOT, "js", "i18n")


def js_str(s):
    """JS 문자열 리터럴로. json.dumps 는 유니코드를 그대로 두므로 한글이 읽히게 남는다."""
    return json.dumps(s, ensure_ascii=False)


def build(lang):
    files = sorted(glob.glob(os.path.join(SRC, f"{lang}.*.json")))
    merged, where, dup = {}, {}, []
    for f in files:
        name = os.path.basename(f)
        try:
            d = json.load(open(f, encoding="utf-8"))
        except Exception as e:
            print(f"✖ {name} 을 읽지 못했습니다: {e}")
            sys.exit(1)
        for k, v in d.items():
            if k in merged and merged[k] != v:
                dup.append(f'"{k}" — {where[k]} 와 {name} 의 내용이 다릅니다')
            merged[k] = v
            where[k] = name
    if dup:
        print(f"✖ 같은 키가 여러 조각에 다르게 들어 있습니다 {len(dup)}건 — 조립을 멈춥니다")
        for s in dup[:15]:
            print("   -", s)
        sys.exit(1)

    out = os.path.join(OUT, f"{lang}.js")
    with open(out, "w", encoding="utf-8", newline="\n") as w:
        w.write(f"/* 문구 사전 ({lang}) — ⚠️ 자동 생성물. 고칠 곳은 js/i18n/src/{lang}.*.json */\n")
        w.write(f'I18N.add("{lang}", {{\n')
        for k in sorted(merged):
            w.write(f"  {js_str(k)}: {js_str(merged[k])},\n")
        w.write("});\n")
    print(f"{lang}.js 조립 완료: {len(merged)}개 문구 ({len(files)}개 조각)")
    return merged


if __name__ == "__main__":
    os.makedirs(SRC, exist_ok=True)
    ko = build("ko")
    # ja 조각이 하나라도 있으면 함께 만든다 (Phase 3 부터)
    if glob.glob(os.path.join(SRC, "ja.*.json")):
        ja = build("ja")
        missing = [k for k in ko if k not in ja]
        if missing:
            print(f"  · 참고: 일본어가 아직 없는 문구 {len(missing)}개 — 한국어로 대신 나옵니다")
