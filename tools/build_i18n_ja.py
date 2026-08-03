# -*- coding: utf-8 -*-
"""한국어 사전 → 일본어 사전 (2026-08-03 신설 · 해외진출_설계 Phase 3)

  js/i18n/src/ko.*.json  →  js/i18n/src/ja.*.json

일본어 자료(홀 통계 라벨·한 줄 공략·한국 TIP 296홀)는 이미 다 만들어 뒀는데,
화면 문구 사전이 없어서 **일본어 화면 자체를 열 수가 없었다.** 그 마지막 조각이다.

🔴 UI 문구 번역에서 깨지기 쉬운 것 두 가지 — 둘 다 코드로 막는다
  1. **자리표시자** `{course}` `{n}` `{md}` … 141종.
     하나라도 없어지거나 이름이 바뀌면 화면에 `{course}` 가 그대로 찍히거나 빈칸이 된다.
  2. **HTML 태그** `<br>` `<b>` `<b class="{c10}">` … 20종.
     번역기가 태그를 번역하거나 지우면 레이아웃이 무너진다.
  → 번역 전에 자리표시자·태그를 **§0§ §1§ 같은 표식으로 바꿔** 보내고,
     받아서 되돌린다. 되돌린 뒤 **원문과 표식 개수가 같은지 확인**한다. 다르면 버린다.

⚠️ 번역하면 안 되는 값(서버 검증값·엔진 매칭값 등)은 애초에 사전에 없다.
   사전에 없는 것은 코드에 한국어 그대로 있고, 그건 의도된 것이다(js/i18n.js 머리말).

사용
  python tools/build_i18n_ja.py --sample 20   표본만 번역해 눈으로 확인
  python tools/build_i18n_ja.py               전량 → js/i18n/src/ja.*.json
"""
import argparse, glob, json, os, re, sys, time
import urllib.error, urllib.parse, urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "jp"))
from jp_common import ROOT, batch_key, Budget

SRC = os.path.join(ROOT, "js", "i18n", "src")
CACHE = os.path.join(ROOT, "coursedata", "homepages_jp", "_stats", "i18n_ja_cache.json")
BUDGET_FILE = os.path.join(ROOT, "coursedata", "homepages_jp", "_scan", "gemini_budget.json")

MODEL = "gemini-flash-lite-latest"    # 하루 500회 (Flash 는 20회 — 설계 §2-9-1)
BATCH = 10

# 자리표시자와 HTML 태그를 통째로 잡는다. 순서가 중요하다 —
# 태그 안에 자리표시자가 든 것(<b class="{c10}">)을 먼저 잡아야 쪼개지지 않는다.
#
# 🔴 줄바꿈(\n)도 함께 가린다.
#    이 도구는 "번호|일본어" 를 **한 줄씩** 주고받는다. 원문에 줄바꿈이 있으면
#    한 문구가 여러 줄로 나가면서 번호가 어긋나고, 그 문구는 통째로 버려진다.
#    실제로 app.hole.tip("\n\n💡 코스 공략 포인트: {tip}") 하나가 이렇게 빠져
#    2032/2033 이 됐다(2026-08-03). 가려 두면 줄바꿈이 그대로 살아 돌아온다.
KEEP = re.compile(r"</?[a-zA-Z][^>]*>|\{[a-zA-Z0-9_]+\}|\n")
KO = re.compile(r"[가-힣]")

PROMPT = """다음은 한국 골프 앱의 화면 문구다. 일본인 이용자가 볼 일본어로 옮겨라.

규칙
- 자연스러운 일본어 UI 문구로. ですます調. 버튼·라벨은 짧고 간결하게.
- **§0§ §1§ 같은 표식은 절대 건드리지 마라.** 번역하지도, 지우지도, 순서를 바꾸지도 마라.
  원문에 있는 표식은 전부 그대로 남겨야 한다.
- 골프 용어는 일본 골프계에서 실제로 쓰는 말로
  (드라이버=ドライバー, 페어웨이=フェアウェイ, 파온=パーオン, 티샷=ティーショット).
- 숫자·단위는 그대로 둔다. 없는 말을 지어내지 마라.
- 입력이 여러 줄이면 **같은 번호로 같은 개수만큼** 답한다.
- 각 줄은 "번호|일본어" 형식 한 줄. 그 밖의 말은 절대 붙이지 마라.

원문:
{text}"""

BUDGET = None


def mask(s):
    """자리표시자·태그를 표식으로 바꾼다 → (가린 문자열, 원래 조각들)"""
    keep = []

    def rep(m):
        keep.append(m.group(0))
        return f"§{len(keep) - 1}§"

    return KEEP.sub(rep, s), keep


def keep_edges(src, ja):
    """원문의 **앞뒤 빈칸**을 되살린다.

       문장 조각을 이어 붙여 쓰는 문구가 많다(app.hs.* 는 15조각을 잇는다).
       번역기는 앞뒤 빈칸을 늘 떼어 내는데, 그러면 "約330m· 直線ホール" 처럼
       조각이 서로 달라붙는다(2026-08-03 화면에서 확인). 빈칸도 뜻이 있다.
       — 단, 원문에 없던 빈칸을 만들지는 않는다(원문 기준으로만 되돌린다). """
    head = src[:len(src) - len(src.lstrip())]
    tail = src[len(src.rstrip()):]
    return head + ja.strip() + tail


def unmask(s, keep):
    """표식을 원래 조각으로 되돌린다. 표식이 하나라도 빠지면 None(버린다)."""
    for i, orig in enumerate(keep):
        tag = f"§{i}§"
        # 번역기가 표식 주위에 공백을 넣거나 전각으로 바꾸는 일이 있다 — 느슨하게 찾는다
        m = re.search(r"§\s*" + str(i) + r"\s*§", s)
        if not m:
            return None
        s = s[:m.start()] + orig + s[m.end():]
    # 🔴 되돌리고도 표식이 남아 있으면 **모델이 없던 것을 지어낸 것**이다 — 버린다.
    #    아는 표식만 되돌리고 끝냈더니 지어낸 §1§ 이 그대로 화면에 나갔다:
    #      "{n}호"                  → "{n}サイズ§1§"        (원문엔 표식이 하나뿐)
    #      "※ 룰 엔진이 후보를 …"      → "※ §0§ §1§"          (문장이 통째로 사라졌다)
    #    2026-08-03 사장님 폰 화면에서 「19サイズ§1§」 로 발견. 5개가 이렇게 배포돼 있었다.
    if "§" in s:
        return None
    return s


def _call(prompt, key, tries=4):
    if BUDGET is not None and not BUDGET.take():
        return "__BUDGET__"
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"
           f"?key={urllib.parse.quote(key)}")
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}],
                       "generationConfig": {"temperature": 0.2, "maxOutputTokens": 4000}}).encode()
    wait = 8
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, data=body,
                                         headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                j = json.loads(r.read().decode())
            return j["candidates"][0]["content"]["parts"][0]["text"]
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < tries - 1:
                time.sleep(wait); wait *= 2; continue
            print(f"    ✖ HTTP {e.code}")
            return None
        except Exception:
            if attempt < tries - 1:
                time.sleep(wait); wait *= 2; continue
            return None
    return None


def translate(texts, key):
    """→ 입력과 같은 길이 (못 옮긴 자리는 None)"""
    masked, keeps = [], []
    for t in texts:
        m, k = mask(t)
        masked.append(m); keeps.append(k)
    joined = "\n".join(f"{i+1}|{t}" for i, t in enumerate(masked))
    raw = _call(PROMPT.format(text=joined), key)
    if raw == "__BUDGET__":
        return None
    got = {}
    if raw:
        for line in raw.splitlines():
            m = re.match(r"\s*(\d+)\s*[|｜]\s*(.+)", line)
            if m:
                got[int(m.group(1))] = m.group(2).strip()
    out = []
    for i, t in enumerate(texts):
        v = got.get(i + 1)
        if v:
            v = unmask(v, keeps[i])          # 표식이 빠졌으면 None 이 온다
        if v and KO.search(v):
            v = None                          # 한국어가 남아 있으면 버린다
        out.append(v)
    return out


def translate_all(texts, cache_file=None):
    """문장 여러 개를 한국어→일본어로 옮겨 {한국어: 일본어} 로 돌려준다.

       사전 말고 **다른 내용**(골프 정신 룰·매너 등)도 같은 절차를 쓰도록 떼어냈다.
       · 이미 옮긴 것은 저장해 둔 것을 다시 쓴다(같은 문장에 두 번 돈을 쓰지 않는다)
       · 하루 몫을 다 쓰면 거기까지만 돌려준다 — 빈 채로 만들지 않는다
       · 옮기지 못한 문장은 **아예 담기지 않는다**(부르는 쪽이 한국어를 그대로 쓰게) """
    key = batch_key()
    if not key:
        raise SystemExit("✖ 배치 전용 키가 없습니다 (tools/jp/.gemini_key)")
    global BUDGET
    if BUDGET is None:
        BUDGET = Budget(BUDGET_FILE, rpd=500, rpm=15)

    cf = cache_file or CACHE
    cache = json.load(open(cf, encoding="utf-8")) if os.path.exists(cf) else {}
    todo = [t for t in dict.fromkeys(texts) if t.strip() and t not in cache]
    print(f"   옮길 것 {len(todo)}개 (이미 {len(cache)}개) · 오늘 남은 요청 {BUDGET.left()}회")
    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        res = translate(chunk, key)
        if res is None:
            print(f"   오늘 몫을 다 썼습니다 — 내일 같은 명령으로 이어집니다")
            break
        for src, ja in zip(chunk, res):
            if ja:
                cache[src] = keep_edges(src, ja)
        os.makedirs(os.path.dirname(cf), exist_ok=True)
        json.dump(cache, open(cf, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"   [{min(i+BATCH, len(todo))}/{len(todo)}]")
        time.sleep(1.0)
    return {t: cache[t] for t in texts if t in cache}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", type=int, default=0)
    a = ap.parse_args()

    key = batch_key()
    if not key:
        print("✖ 배치 전용 키가 없습니다 (tools/jp/.gemini_key)")
        return 1
    global BUDGET
    BUDGET = Budget(BUDGET_FILE, rpd=500, rpm=15)

    files = sorted(glob.glob(os.path.join(SRC, "ko.*.json")))
    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    todo = []
    for f in files:
        for k, v in json.load(open(f, encoding="utf-8")).items():
            if isinstance(v, str) and v.strip() and v not in cache:
                todo.append(v)
    todo = list(dict.fromkeys(todo))          # 같은 문구는 한 번만
    if a.sample:
        todo = todo[:a.sample]
    print(f"■ 문구 {sum(len(json.load(open(f, encoding='utf-8'))) for f in files)}개 "
          f"· 옮길 것 {len(todo)}개 (이미 {len(cache)}개) · 오늘 남은 요청 {BUDGET.left()}회")

    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        res = translate(chunk, key)
        if res is None:
            print(f"   오늘 몫을 다 썼습니다 (누적 {len(cache)}개) — 내일 같은 명령으로 이어집니다")
            break
        for src, ja in zip(chunk, res):
            if ja:
                cache[src] = keep_edges(src, ja)
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"   [{min(i+BATCH, len(todo))}/{len(todo)}] 누적 {len(cache)}개")
        time.sleep(1.0)

    if a.sample:
        print("\n── 표본 ──")
        for s in todo[:12]:
            print(f"  {s[:44]:46s} → {cache.get(s, '(못 옮김)')[:44]}")
        print("\n(표본 실행이라 ja.*.json 은 쓰지 않습니다)")
        return 0

    # ja.*.json 조각 쓰기 — 옮긴 것만 담는다(빠진 키는 i18n 이 한국어로 되돌린다)
    made = 0
    for f in files:
        d = json.load(open(f, encoding="utf-8"))
        out = {k: cache[v] for k, v in d.items() if isinstance(v, str) and v in cache}
        p = os.path.join(SRC, os.path.basename(f).replace("ko.", "ja.", 1))
        json.dump(out, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
        made += len(out)
        print(f"   {os.path.basename(p):22s} {len(out):5d}/{len(d)}개")
    print(f"\n✅ ja 조각 완성 — 문구 {made}개. 이어서 `python tools/build_i18n.py` 로 조립하세요.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
