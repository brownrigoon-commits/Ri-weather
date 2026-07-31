# -*- coding: utf-8 -*-
"""index.html 의 한국어에 사전 표시(data-i18n)를 달아 준다 — 2026-07-31

HTML 안에서는 tr() 을 부를 수 없어서, 요소에 표시만 달아 두고
js/i18n.js 의 I18N.applyDom() 이 화면이 뜬 뒤 채운다.
한국어에서는 **원래 있던 글자와 똑같은 글자로 다시 채워지므로 화면은 변하지 않는다.**

  <h2>코스공략</h2>                    →  <h2 data-i18n="ui.hub.title">코스공략</h2>
  <input placeholder="구장 검색">        →  <input data-i18n-attr="placeholder:ui.search.ph" placeholder="구장 검색">

⚠️ 다는 기준
  · 사전(js/i18n/src/ko.ui.json)에 **정확히 같은 문자열**이 있는 곳에만 단다. 짐작하지 않는다.
  · 자식 태그가 있는 요소에는 달지 않는다 — textContent 로 덮으면 자식이 통째로 사라진다.
  · data-cat 같은 **값** 속성은 절대 건드리지 않는다(번역 대상이 아니다).

사용
  python tools/apply_i18n_html.py --dry     무엇이 붙는지만 보여준다(파일 안 고침)
  python tools/apply_i18n_html.py           실제로 붙인다
"""
import json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, "index.html")
DICT = os.path.join(ROOT, "js", "i18n", "src", "ko.ui.json")
DRY = "--dry" in sys.argv

# 문구를 채워 넣을 속성 (값 속성인 data-* 는 일부러 뺐다)
ATTRS = ["placeholder", "aria-label", "alt", "title"]


def main():
    d = json.load(open(DICT, encoding="utf-8"))
    by_text = {}
    for k, v in d.items():
        by_text.setdefault(v.strip(), k)     # 같은 문구가 여러 키면 먼저 것 하나만
    src = open(HTML, encoding="utf-8").read()
    out = src
    hit_txt, hit_attr, skipped = [], [], []

    # ── 1) 속성 ────────────────────────────────────────────────
    # ⚠️ 뒤에서 앞으로 처리한다. 앞에서부터 끼워 넣으면 **뒤쪽 위치가 밀려**
    #    엉뚱한 자리(태그 이름 한가운데)에 들어간다 — 2026-07-31 실제로 index.html 을 깨뜨렸다.
    spots = []
    for attr in ATTRS:
        for m in re.finditer(rf'{attr}="([^"]*[가-힣][^"]*)"', out):
            val = m.group(1).strip()
            key = by_text.get(val)
            if not key:
                skipped.append(f"{attr}={val[:30]}")
                continue
            spots.append((m.start(), attr, key))
    # 한 요소에 placeholder 와 aria-label 이 함께 있을 수 있다 → 한 표시에 세미콜론으로 묶는다
    by_tag = {}
    for pos, attr, key in spots:
        tag_start = out.rfind("<", 0, pos)
        by_tag.setdefault(tag_start, []).append((pos, attr, key))
    for tag_start in sorted(by_tag, reverse=True):
        items = by_tag[tag_start]
        pos = min(p for p, _, _ in items)               # 그 태그에서 가장 앞 속성 자리에 넣는다
        if "data-i18n-attr" in out[tag_start:pos]:
            continue
        pairs = ";".join(f"{a}:{k}" for _, a, k in items)
        out = out[:pos] + f'data-i18n-attr="{pairs}" ' + out[pos:]
        hit_attr.extend(f"{a} → {k}" for _, a, k in items)

    # ── 2) 텍스트 (자식 태그가 없는 요소만) ──────────────────────
    #    <tag ...>한국어</tag> 한 덩어리만 본다. 안에 < 가 있으면 자식이 있는 것이라 건드리지 않는다.
    def sub_text(m):
        whole, name, inner = m.group(0), m.group(1), m.group(2)
        val = inner.strip()
        key = by_text.get(val)
        if not key or "data-i18n" in whole:
            return whole
        cut = whole.index(">")
        hit_txt.append(f"{name}: {val[:26]} → {key}")
        return f'{whole[:cut]} data-i18n="{key}"{whole[cut:]}'

    out = re.sub(r'<(h1|h2|h3|h4|p|span|button|small|b|strong|label|li|a|div|td|th)\b[^>]*>([^<>]*[가-힣][^<>]*)</\1>',
                 sub_text, out)

    print(f"속성 {len(hit_attr)}곳 · 텍스트 {len(hit_txt)}곳에 표시를 달았습니다")
    for s in hit_txt[:8]:
        print("   ·", s)
    if skipped:
        print(f"  ※ 사전에 없어 그냥 둔 속성 {len(skipped)}곳 — 예: {skipped[0][:40]}")
    if DRY:
        print("  (--dry 라 파일은 고치지 않았습니다)")
        return 0
    open(HTML, "w", encoding="utf-8", newline="\n").write(out)
    print("index.html 에 반영했습니다 — 반드시 `node tools/i18n_snapshot.js` 로 화면이 그대로인지 확인하세요")
    return 0


if __name__ == "__main__":
    sys.exit(main())
