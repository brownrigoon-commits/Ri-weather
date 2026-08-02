# -*- coding: utf-8 -*-
"""index.html 에서 **표시가 안 붙은 한국어**에 사전 표시를 달아 준다 — 2026-08-03

apply_i18n_html.py 는 '사전에 이미 같은 문구가 있고, 자식 태그가 없는' 요소에만 표시를 단다.
그래서 아래 두 부류가 통째로 남았다(실측 111덩이 / 74줄):

  ① 사전에 없는 문구      <option>남성</option>
  ② 자식 태그 사이에 낀 글자
     <div class="card-title"><span class="ic">🛰️</span> 강수 지도 <small id="radar-updated"></small></div>

②는 data-i18n(textContent) 을 달면 자식이 사라지고, <span> 으로 감싸면 부모가 flex 일 때
배치가 어긋난다. 그래서 js/i18n.js 에 data-i18n-node 를 새로 만들었다 — 글자 마디만 바꾼다.

이 도구가 하는 일
  · 자식 태그가 **없고** 글자가 전부인 요소  → data-i18n="키"
  · 그 밖(자식과 섞인 글자)                → data-i18n-node="키1|키2|…"
  · 사전에 똑같은 문구가 이미 있으면 그 키를 **다시 쓴다**(중복 번역 방지)
  · 없으면 ko.ui.json 에 새 키를 만든다

⚠️ 고칠 자리는 **뒤에서 앞으로** 넣는다. 앞에서부터 끼우면 뒤쪽 위치가 밀려
   엉뚱한 자리에 들어간다(2026-07-31 실제로 index.html 을 깨뜨린 적이 있다).

사용
  python tools/wrap_i18n_nodes.py --dry   무엇이 붙는지만 보여준다(파일 안 고침)
  python tools/wrap_i18n_nodes.py         실제로 붙인다
"""
import html.parser, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, "index.html")
SRCD = os.path.join(ROOT, "js", "i18n", "src")
DRY = "--dry" in sys.argv

KO = re.compile(r"[가-힣]")
VOID = {"br", "img", "input", "meta", "link", "hr", "source", "area", "col"}
SKIP = {"script", "style"}   # <title> 도 이용자에게 보이는 글자다


class Scan(html.parser.HTMLParser):
    """요소마다 (여는 태그 위치, 자식 태그 유무, 맨 글자 마디들) 을 모은다."""

    def __init__(self, src):
        super().__init__(convert_charrefs=True)
        self.src = src
        # 줄·칸 → 절대 위치
        self.line_off = [0]
        for ln in src.split("\n")[:-1]:
            self.line_off.append(self.line_off[-1] + len(ln) + 1)
        self.stack = []      # [dict(tag, start, end_of_starttag, marked, kids, texts)]
        self.done = []

    def pos(self):
        ln, col = self.getpos()
        return self.line_off[ln - 1] + col

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if self.stack:
            self.stack[-1]["kids"] = True
        if tag in VOID:
            return
        self.stack.append({
            "tag": tag,
            "start": self.pos(),
            "open_end": self.pos() + len(self.get_starttag_text()),
            "marked": any(k.startswith("data-i18n") for k in a),
            "kids": False,
            "texts": [],           # [(절대위치, 원문)]
            "attrs": a,
        })

    def handle_startendtag(self, tag, attrs):
        if self.stack:
            self.stack[-1]["kids"] = True

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]["tag"] == tag:
                for j, e in enumerate(self.stack[i:]):
                    # 제대로 닫힌 것만 안쪽 위치를 안다(중간 것들은 안 닫힌 채 버려진 것)
                    e["close"] = self.pos() if j == 0 else None
                    e["depth"] = i + j
                    self.done.append(e)
                del self.stack[i:]
                return

    def handle_data(self, data):
        if not self.stack or not data.strip():
            return
        if any(e["tag"] in SKIP for e in self.stack):
            return
        self.stack[-1]["texts"].append((self.pos(), data))


def slug(text, used):
    """문구에서 키를 만든다. 한국어는 자모라 로마자로 못 옮긴다 —
       번호를 붙여 **한 번 정하면 변하지 않는** 이름을 쓴다."""
    n = 1
    while f"ui.auto.{n:03d}" in used:
        n += 1
    return f"ui.auto.{n:03d}"


def main():
    src = open(HTML, encoding="utf-8").read()
    s = Scan(src)
    s.feed(src)
    s.done.extend(s.stack)

    # 사전 전체 — 같은 문구가 있으면 그 키를 다시 쓴다
    by_text, all_keys = {}, set()
    for fn in sorted(os.listdir(SRCD)):
        if not fn.startswith("ko.") or not fn.endswith(".json"):
            continue
        for k, v in json.load(open(os.path.join(SRCD, fn), encoding="utf-8")).items():
            all_keys.add(k)
            by_text.setdefault(v.strip(), k)

    ui_path = os.path.join(SRCD, "ko.ui.json")
    ui = json.load(open(ui_path, encoding="utf-8"))

    def key_for(t, new_keys):
        k = by_text.get(t)
        if not k:
            k = slug(t, all_keys | set(new_keys))
            new_keys[k] = t
            all_keys.add(k)
            by_text[t] = k
        return k

    # 바깥부터 처리한다 — 문장 하나가 통째로 data-i18n-html 이 되면
    # 그 안쪽(<b> 등)에는 표시를 달면 안 된다. 달아 봐야 innerHTML 로 덮여 사라진다.
    cand = [e for e in s.done
            if not e["marked"] and any(KO.search(t) for _, t in e["texts"])]
    cand.sort(key=lambda e: (e["start"], -(e.get("close") or 0)))

    edits, new_keys, report, warn = [], {}, [], []
    covered = []                      # data-i18n-html 로 덮인 구간
    for e in cand:
        if any(a <= e["start"] < b for a, b in covered):
            continue

        if not e["kids"] and len(e["texts"]) == 1:
            attr, val = "data-i18n", key_for(e["texts"][0][1].strip(), new_keys)
        elif len(e["texts"]) == 1:
            attr, val = "data-i18n-node", key_for(e["texts"][0][1].strip(), new_keys)
        elif e.get("close"):
            # 태그로 끊긴 한 문장 → 안쪽을 통째로 한 문구로
            inner = src[e["open_end"]:e["close"]]
            attr, val = "data-i18n-html", key_for(" ".join(inner.split()), new_keys)
            covered.append((e["start"], e["close"]))
            if re.search(r'\sid\s*=', inner):
                warn.append((e["tag"], val, inner[:70]))
        else:
            attr, val = "data-i18n-node", "|".join(
                key_for(t.strip(), new_keys) for _, t in e["texts"])

        cut = e["open_end"] - (2 if src[e["open_end"] - 2] == "/" else 1)
        edits.append((cut, f' {attr}="{val}"'))
        report.append((e["tag"], attr, val, " / ".join(t.strip()[:24] for _, t in e["texts"])))

    print(f"■ 표시를 달 곳 {len(edits)}곳 · 새로 만들 문구 {len(new_keys)}개")
    for tag, attr, val, txt in report[:200]:
        print(f"   <{tag:8s} {attr:15s} {val:34s} {txt}")
    if warn:
        print(f"\n⚠️ 안쪽에 id 가 있어 통째로 바꾸면 위험한 곳 {len(warn)}개 — 손으로 확인하세요")
        for tag, val, inner in warn:
            print(f"   <{tag}> {val}  {inner}")

    if DRY:
        print("\n(--dry 라 파일은 그대로입니다)")
        return 0

    for cut, ins in sorted(edits, reverse=True):     # 뒤에서 앞으로
        src = src[:cut] + ins + src[cut:]
    open(HTML, "w", encoding="utf-8", newline="").write(src)

    ui.update(new_keys)
    json.dump(ui, open(ui_path, "w", encoding="utf-8"),
              ensure_ascii=False, indent=1, sort_keys=True)
    print(f"\n✅ index.html 에 표시 {len(edits)}개 · ko.ui.json 에 문구 {len(new_keys)}개 추가")
    print("   이어서: python tools/build_i18n_ja.py → python tools/build_i18n.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
