# -*- coding: utf-8 -*-
"""한국 구장 홀 TIP → 일본어 오버레이 (2026-08-02 신설)

사장님 지시(8/2) ③: "일본 사람이 한국에 왔을 때도 우리 앱을 쓸 수 있어야 한다."

🔴 **한국 원본(js/holeimgdb.js·coursedata)은 1바이트도 건드리지 않는다.**
   따로 만든 오버레이 파일을 ja 화면일 때만 얹는다 — 한국 이용자에게는 아무 변화가 없다
   (해외진출_설계 원칙 1: KR 무변경).

만드는 것: js/holeimgdb_ja.js
    const HOLETIP_JA = { "구장명": { "코스명": { "홀번호": "일본어 문장" } } };

⚠️ 담지 않는 것 (담으면 틀린 정보가 일본어로 퍼진다)
   · 다른 홀 설명이 붙은 TIP — 한국 원본에 22개 있다(2026-08-02 실측).
     원본을 고치는 것은 별건이고, 여기서는 **옮기지 않는 것**으로 막는다.
   · 메뉴 텍스트가 섞인 것, 너무 짧은 것

⚠️ 공개 전 네이티브 검수 필수 (해외진출_설계 D6). 검수 전에는 앱이 이 파일을 읽지 않는다.

사용
  python tools/jp/build_tip_ja.py --extract        옮길 대상만 뽑아 본다(번역 안 함)
  python tools/jp/build_tip_ja.py --translate 10   표본 10개만 번역해 눈으로 확인
  python tools/jp/build_tip_ja.py --translate      전량 번역 → js/holeimgdb_ja.js
"""
import argparse, base64, json, os, re, sys, time
import urllib.error, urllib.parse, urllib.request
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import ROOT

SRC = os.path.join(ROOT, "js", "holeimgdb.js")
CACHE = os.path.join(ROOT, "coursedata", "homepages_jp", "_stats", "tip_ja_cache.json")
OUT = os.path.join(ROOT, "js", "holeimgdb_ja.js")

NAV = re.compile(r"(HOLE\s*\d+\s+HOLE\s*\d+|코스공략\s*HOLE|이전\s*다음|더보기)")
HEAD = re.compile(r"HOLE\s*\d+\s*PAR\s*\d+\s*(HDCP\s*\d+)?")


def load_tips():
    """holeimgdb.js → [(구장, 코스, 홀번호, tip)] · 문제 있는 것은 사유와 함께 걸러낸다"""
    src = open(SRC, encoding="utf-8").read()
    cur = curc = None
    good, bad = [], []
    for line in src.splitlines():
        m = re.match(r'\s{2}"([^"]+)":\s*\{', line)
        if m:
            cur = m.group(1)
            continue
        m = re.search(r'\{\s*name:\s*"([^"]*)",\s*holes:', line)
        if m:
            curc = m.group(1)
            continue
        m = re.search(r"no:\s*(\d+).*?tip:\s*\"((?:[^\"\\]|\\.)*)\"", line)
        if not (m and cur):
            continue
        no, tip = int(m.group(1)), m.group(2)
        why = None
        hm = re.search(r"HOLE\s*(\d+)", tip)
        if hm and int(hm.group(1)) != no:
            why = f"다른 홀 설명(본문 HOLE {hm.group(1)})"
        elif NAV.search(tip):
            why = "메뉴 텍스트 섞임"
        elif len(tip) < 20:
            why = "너무 짧음"
        (bad if why else good).append((cur, curc, no, tip, why))
    return good, bad


def gem_key():
    """앱에 들어 있는 공용 키를 그대로 쓴다 (같은 무료 한도)."""
    app = open(os.path.join(ROOT, "js", "app.js"), encoding="utf-8").read()
    m = re.search(r'EMBED_GEM_B64\s*=\s*"([^"]+)"', app)
    if not m:
        return None
    try:
        return base64.b64decode(m.group(1)).decode()
    except Exception:
        return None


PROMPT = """다음은 한국 골프장의 홀별 공략 안내다. 일본인 골퍼가 한국 골프장에 와서 읽을
일본어로 옮겨라.

규칙
- 자연스러운 일본어 골프 표현을 쓴다(직역 금지). ですます調.
- 거리 단위·숫자는 그대로 둔다. 미터(m)를 야드로 바꾸지 마라.
- 고유명사는 원문 발음을 가타카나로, 한자 지명은 한자 그대로 둔다.
- 없는 정보를 덧붙이지 마라. 원문에 없는 조언을 지어내지 마라.
- 입력이 여러 줄이면 **같은 번호로 같은 개수만큼** 답한다.
- 각 줄은 "번호|일본어" 형식 한 줄. 그 밖의 말은 절대 붙이지 마라.

원문:
{text}"""

# ⚠️ 모델 선택 (2026-08-02 실측)
#   gemini-2.5-flash  → 404 "no longer available to new users"
#   gemini-2.0-flash  → 429 할당량 초과
#   gemini-flash-latest → 정상
# 이 키는 **앱이 캐디에 쓰는 공용 키**다. 배치가 이용자 몫을 먹지 않도록
# 한 번에 10문장씩 묶어 보내 호출 수를 1/10 로 줄인다.
MODEL = "gemini-flash-latest"
BATCH = 10


def _call(prompt, key, model=MODEL, tries=4):
    """한 번 호출. 429(할당량)·503(혼잡)은 기다렸다 다시 — 한 묶음이 통째로 날아가지 않게.
       (2026-08-02 1차 실행에서 8묶음 80문장이 이렇게 날아갔다)"""
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
           f"?key={urllib.parse.quote(key)}")
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 4000},
    }).encode()
    wait = 8
    for attempt in range(tries):
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                j = json.loads(r.read().decode())
            return j["candidates"][0]["content"]["parts"][0]["text"]
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < tries - 1:
                print(f"      HTTP {e.code} — {wait}초 쉬고 다시")
                time.sleep(wait)
                wait *= 2
                continue
            print(f"    ✖ HTTP {e.code}")
            return None
        except Exception as e:
            if attempt < tries - 1:
                time.sleep(wait)
                wait *= 2
                continue
            print(f"    ✖ {type(e).__name__}")
            return None
    return None


def translate(texts, key, model=MODEL):
    """묶음 번역 → 입력과 같은 길이의 리스트 (실패한 자리는 None)

    묶음으로 보내면 모델이 가끔 게을러져 **한국어를 일부 남긴다**(1차 실행에서 10건).
    그런 자리는 하나씩 다시 번역한다 — 혼자 보내면 훨씬 꼼꼼하다.
    """
    joined = "\n".join(f"{i+1}|{t}" for i, t in enumerate(texts))
    raw = _call(PROMPT.format(text=joined), key, model)
    got = {}
    if raw:
        for line in raw.splitlines():
            m = re.match(r"\s*(\d+)\s*[|｜]\s*(.+)", line)
            if m:
                got[int(m.group(1))] = re.sub(r"\s+", " ", m.group(2)).strip(' "\'')
    out = [got.get(i + 1) for i in range(len(texts))]

    for i, (t, ja) in enumerate(zip(texts, out)):
        if ja and not KO.search(ja):
            continue
        one = _call(PROMPT.format(text=f"1|{t}"), key, model)
        if not one:
            out[i] = None
            continue
        m = re.search(r"\s*1\s*[|｜]\s*(.+)", one)
        cand = re.sub(r"\s+", " ", (m.group(1) if m else one)).strip(' "\'')
        out[i] = cand if not KO.search(cand) else None
        time.sleep(1.5)
    return out


KO = re.compile(r"[가-힣]")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--extract", action="store_true")
    ap.add_argument("--translate", nargs="?", const=0, type=int)
    a = ap.parse_args()

    good, bad = load_tips()
    print(f"■ 한국 홀 TIP {len(good) + len(bad)}개 · 옮길 것 {len(good)}개 · 제외 {len(bad)}개")
    if bad:
        for k, v in Counter(b[4] for b in bad).most_common(6):
            print(f"    제외: {v:3d}건  {k}")
    courses = sorted({g[0] for g in good})
    print(f"■ 대상 구장 {len(courses)}곳")

    if a.extract or a.translate is None:
        for c in courses:
            n = sum(1 for g in good if g[0] == c)
            print(f"   {c[:26]:28s} {n}홀")
        print("\n번역하려면 --translate [개수]")
        return 0

    key = gem_key()
    if not key:
        print("✖ 번역 키를 찾지 못했습니다")
        return 1

    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    todo = [g for g in good if g[3] not in cache]
    if a.translate:
        todo = todo[:a.translate]
    print(f"■ 번역할 문장 {len(todo)}개 (이미 번역 {len(cache)}개)")

    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        res = translate([c[3] for c in chunk], key)
        for (cc, cs, no, tip, _), ja in zip(chunk, res):
            if ja and not KO.search(ja):
                cache[tip] = ja
            elif ja:
                print(f"    ⚠ 한국어가 남아 담지 않음: {ja[:40]}")
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"   [{min(i+BATCH, len(todo))}/{len(todo)}] 저장 (누적 {len(cache)}개)")
        time.sleep(2.0)          # 공용 키를 배려한 간격

    # 표본 확인용 출력
    print("\n── 번역 표본 3개 ──")
    shown = 0
    for cc, cs, no, tip, _ in good:
        if tip in cache and shown < 3:
            print(f"  [{cc} {cs} {no}번]\n    한국어: {tip[:80]}\n    일본어: {cache[tip][:80]}")
            shown += 1

    # 오버레이 파일
    tree = defaultdict(lambda: defaultdict(dict))
    n = 0
    for cc, cs, no, tip, _ in good:
        if tip in cache:
            tree[cc][cs or ""][str(no)] = cache[tip]
            n += 1
    if a.translate and n < len(good):
        print(f"\n(표본 실행이라 오버레이 파일은 아직 쓰지 않습니다 — {n}/{len(good)})")
        return 0

    def js(s):
        return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ") + '"'

    with open(OUT, "w", encoding="utf-8", newline="\n") as w:
        w.write("/* 투어리스트 — 한국 구장 홀 공략의 일본어 오버레이 (일본인 방한 골퍼용)\n"
                "   ⚠️ 생성물입니다. tools/jp/build_tip_ja.py 가 다시 씁니다.\n"
                "   ⚠️ 한국 원본(holeimgdb.js)은 손대지 않습니다 — 이 파일은 ja 화면에서만 얹습니다.\n"
                "   ⚠️ 네이티브 검수 전에는 앱에서 읽지 않습니다. */\n")
        w.write("const HOLETIP_JA = {\n")
        for cc in sorted(tree):
            w.write(f"  {js(cc)}: {{\n")
            for cs in sorted(tree[cc]):
                items = ", ".join(f"{js(k)}: {js(v)}" for k, v in sorted(tree[cc][cs].items(),
                                                                        key=lambda x: int(x[0])))
                w.write(f"    {js(cs)}: {{ {items} }},\n")
            w.write("  },\n")
        w.write("};\n")
    print(f"\nholeimgdb_ja.js 조립 완료: 구장 {len(tree)}곳 · 홀 {n}개 · "
          f"{os.path.getsize(OUT)//1024}KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
