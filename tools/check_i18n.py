# -*- coding: utf-8 -*-
"""문구 사전 검사 (배포 관문) — 2026-07-31 신설

두 가지를 본다.

① **키가 사전에 있는가**
   `tr("home.title")` 을 불렀는데 사전에 없으면 화면에 `home.title` 이라는 **키가 그대로**
   찍힌다. 눈에 띄긴 하지만 배포된 뒤에 발견하면 늦다.

② **번역하면 안 되는 값이 그대로 남아 있는가** — 이게 더 중요하다.
   이 앱에는 '화면에 보이지만 사실은 값(프로토콜 토큰)'인 한국어가 있다.
   사전으로 옮기는 순간 조용히 깨진다:
     · 베타 의견 분류 "오류/불편/아이디어/칭찬" → 서버가 이 문자열로 검증(Code.gs FB_CATS).
       바꾸면 이용자 의견이 **재시도 없이 사라진다**(stats.js 는 서버가 거절하면 큐에 안 넣는다).
     · 캐디 샷 라벨 "티샷/세컨샷/…" → AI 응답을 이 라벨의 정규식으로 쪼갠다.
     · 프로필·동의 값 "여성"·"60대 이상"·"1년 미만" → 문자열 동치로 분기하고
       localStorage 에도 그대로 저장된다. 바꾸면 **기존 이용자 기록이 끊긴다.**
   그래서 '이 파일에는 이 문자열이 반드시 남아 있어야 한다'를 못 박아 둔다.

사용
  python tools/check_i18n.py            # 위반만, 있으면 종료코드 1
  python tools/check_i18n.py --report   # 통과 항목·고아 키까지
"""
import glob, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# tr() 을 부르는 곳 — 사용자 화면을 그리는 파일 전부
CALLERS = ["index.html", "js/app.js", "js/booking.js", "js/stay.js", "js/clubfit.js",
           "js/loading.js", "js/legal.js", "js/stats.js", "js/spirit.js", "js/weatherfx.js",
           "ops-k58zq.html"]

# ── 절대 사라지면 안 되는 '값' — (파일, 반드시 있어야 할 문자열, 왜) ──────────
KEEP = [
    ("index.html", '"오류"', "베타 의견 분류값(서버 검증)"),
    ("index.html", '"불편"', "베타 의견 분류값(서버 검증)"),
    ("index.html", '"아이디어"', "베타 의견 분류값(서버 검증)"),
    ("index.html", '"칭찬"', "베타 의견 분류값(서버 검증)"),
    ("js/app.js", '"티샷"', "캐디 응답 파싱 라벨"),
    ("js/app.js", '"세컨샷"', "캐디 응답 파싱 라벨"),
    ("js/app.js", '"서드샷"', "캐디 응답 파싱 라벨"),
    ("js/app.js", '"여성"', "프로필 값(문자열 동치 분기 + localStorage)"),
    ("js/app.js", '"60대 이상"', "프로필 값(문자열 동치 분기 + localStorage)"),
    ("js/clubfit.js", "타이틀리스트", "클럽 브랜드 값(피팅 엔진 매칭)"),
    ("js/stats.js", "경기", "통계 지역 집계 키"),
]


def read(rel):
    p = os.path.join(ROOT, rel)
    return open(p, encoding="utf-8").read() if os.path.exists(p) else ""


def dict_keys(lang="ko"):
    keys = {}
    for f in sorted(glob.glob(os.path.join(ROOT, "js", "i18n", "src", f"{lang}.*.json"))):
        try:
            d = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        for k, v in d.items():
            keys[k] = v
    return keys


def used_keys():
    used = {}
    for rel in CALLERS:
        src = read(rel)
        for m in re.finditer(r'tr\(\s*"([^"]+)"', src):
            used.setdefault(m.group(1), []).append(rel)
        for m in re.finditer(r"tr\(\s*'([^']+)'", src):
            used.setdefault(m.group(1), []).append(rel)
    return used


def violations(root=None):
    have = dict_keys("ko")
    used = used_keys()
    bad, note = [], []

    missing = [k for k in used if k not in have]
    if missing:
        for k in sorted(missing)[:20]:
            bad.append(f'사전에 없는 키: "{k}" ({", ".join(sorted(set(used[k])))}) — 화면에 키가 그대로 나옵니다')

    for rel, needle, why in KEEP:
        src = read(rel)
        if not src:
            continue
        if needle not in src:
            bad.append(f'{rel} 에서 {needle} 이(가) 사라졌습니다 — {why}. 사전으로 옮기면 안 되는 값입니다')

    orphan = [k for k in have if k not in used]
    if orphan:
        note.append(f"아무 데서도 안 쓰는 문구 {len(orphan)}개 (지워도 됨) — 예: {', '.join(sorted(orphan)[:3])}")
    note.append(f"문구 {len(have)}개 · 부르는 곳 {len(used)}개 키")
    return bad, note


def main():
    bad, note = violations()
    if bad:
        print(f"✖ 문구 사전 검사 실패 {len(bad)}건")
        for s in bad[:20]:
            print("   -", s)
        if len(bad) > 20:
            print(f"   … 외 {len(bad)-20}건")
        return 1
    if "--report" in sys.argv:
        for s in note:
            print("  ·", s)
    print("문구 사전 검사 OK: 키가 모두 있고, 옮기면 안 되는 값도 그대로입니다")
    return 0


if __name__ == "__main__":
    sys.exit(main())
