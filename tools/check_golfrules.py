# -*- coding: utf-8 -*-
"""골프 규칙 월간 점검 — 공식 규칙이 바뀌었는지 매달 확인한다

설계: docs/골프정신_설계.md 7장

왜 필요한가: 앱의 '세계 골프 룰' 코너는 R&A·USGA 2023년판 기준이다.
분기마다 Clarifications(유권해석)가 나오고 4년마다 본문이 개정되는데,
그걸 놓치면 앱이 **옛 규칙을 자신 있게** 말하게 된다. 그게 최악이다.

무엇을 하는가 (감지·기록까지가 이 스크립트의 몫):
  · R&A 자료 허브에서 Clarifications 최신 일자를 읽는다
  · KGA 골프규칙소식에서 최신 글 제목을 읽는다
  · coursedata/workfiles/golfrules_snapshot.json 과 비교한다
      변경 없음 → lastChecked 만 갱신 (앱 화면의 '최근 점검' 근거)
      변경 감지 → docs/골프룰_점검리포트.md 를 쓰고 **종료코드 1**
      접속 실패 → 마찬가지로 **종료코드 1**

⚠️ 종료코드 1 로 끝내는 이유: GitHub Actions 가 실패해야 소유자에게 메일이 간다.
   조용히 성공한 척하면 점검이 죽어도 아무도 모른다. **침묵은 성공이 아니다.**

⚠️ 규칙 문장을 앱에 반영하는 것은 이 스크립트가 하지 않는다.
   Clarifications 는 미묘한 해석이라 기계 치환이 불가능하다. 리포트를 보고
   사람(클로드)이 KGA 한글본과 대조해 js/spiritdb.js 를 고친다(설계서 7장).

사용
  python tools/check_golfrules.py            # 점검 (스냅샷 갱신)
  python tools/check_golfrules.py --dry      # 파일을 쓰지 않고 결과만 본다
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNAP = os.path.join(ROOT, "coursedata", "workfiles", "golfrules_snapshot.json")
REPORT = os.path.join(ROOT, "docs", "골프룰_점검리포트.md")

# 파싱 대상 — 설계서 부록 C 에서 실제로 열어 확인한 주소다.
# USGA 는 일반 요청을 403 으로 막아서 R&A 를 1순위로 둔다.
RA_URL = "https://www.randa.org/en/rules/rules-resources"
KGA_URL = "https://www.kgagolf.or.kr/web/golfRule/news"

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

KST = timezone(timedelta(hours=9))


def today():
    return datetime.now(KST).strftime("%Y-%m-%d")


def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ko,en;q=0.8",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
    for enc in ("utf-8", "euc-kr", "cp949"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


def strip_tags(html):
    html = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", html)
    html = re.sub(r"(?s)<[^>]+>", " ", html)
    html = html.replace("&nbsp;", " ").replace("&amp;", "&")
    return re.sub(r"\s+", " ", html).strip()


def ra_state(html):
    """R&A 자료 허브에서 Clarifications 최신 일자와 규칙 판 연도를 뽑는다.

    페이지에 "Additional Clarifications ... (updated 1 July 2026)" 형태로 일자가 박혀 있다.
    판 연도는 "2023 Rules of Golf" 같은 표기에서 읽는다 — 이 값이 바뀌면 대개정이다.
    """
    text = strip_tags(html)
    dates = re.findall(
        r"(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|"
        r"September|October|November|December)\s+20\d{2})", text)
    years = re.findall(r"(20\d{2})\s+Rules of Golf", text)
    return {
        "clarifications": dates[0] if dates else "",
        "edition": max(years) if years else "",
        "found": bool(dates or years),
    }


def kga_state(html):
    """KGA 골프규칙소식 목록에서 최신 글 제목 하나를 뽑는다.

    한글 반영이 언제 올라왔는지를 보는 보조 신호다. 목록 구조가 바뀌면
    빈 값이 되는데, 그것만으로 변경 감지를 띄우지는 않는다(R&A 가 1순위).
    """
    text = strip_tags(html)
    m = re.search(r"(20\d{2}년[^|]{0,60}?골프\s*규칙[^|]{0,60})", text)
    return {"latest": m.group(1).strip()[:120] if m else ""}


def load_snapshot():
    if not os.path.exists(SNAP):
        return {}
    try:
        with open(SNAP, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_snapshot(data):
    os.makedirs(os.path.dirname(SNAP), exist_ok=True)
    with open(SNAP, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")


def write_report(changes, old, new, big):
    lines = [
        "# 골프 규칙 점검 리포트 — %s" % today(),
        "",
        "`tools/check_golfrules.py` 가 자동으로 만든 문서입니다.",
        "**공식 규칙 쪽에 변화가 감지되어** 사람이 확인할 차례입니다.",
        "",
    ]
    if big:
        lines += [
            "## 🔴 대개정으로 보입니다",
            "",
            "규칙 판 연도 표기가 바뀌었습니다(4년 주기 대개정). 할 일:",
            "",
            "1. `js/spiritdb.js` 의 **정식 규칙 카드 전량 재검증**",
            "2. 아마추어 필드 룰 카드의 \"정식 규칙에서는\" 병기도 함께 재확인",
            "3. `SPIRIT_DB.rulesEdition` · `updated` 동시 교체",
            "4. KGA 한글판이 나오기 전까지 `SPIRIT_DB.rulesNotice` 에",
            "   \"○○○○년 개정 반영 중입니다\" 를 넣어 룰 탭 상단에 띄운다",
            "",
        ]
    lines += ["## 무엇이 달라졌나", "", "| 항목 | 이전 | 지금 |", "|---|---|---|"]
    for k in changes:
        lines.append("| %s | %s | %s |" % (k, old.get(k) or "(없음)", new.get(k) or "(없음)"))
    lines += [
        "",
        "## 다음에 할 일",
        "",
        "1. KGA 골프규칙소식에서 한글 자료를 확인합니다 — %s" % KGA_URL,
        "2. 바뀐 내용이 앱의 룰 카드에 영향을 주는지 판단합니다",
        "   (`js/spiritdb.js` 의 `sections` → `key: \"rules\"`)",
        "3. ⚠️ **KGA 번역문을 그대로 옮기지 않습니다.** 규칙의 내용을 확인한 뒤",
        "   우리말로 새로 씁니다(저작권 — 설계서 8장)",
        "4. 고쳤다면 `SPIRIT_DB.updated` 를 오늘 날짜로 바꿉니다",
        "5. sweep 통과 후 배포하고, HANDOFF 에 무엇을 반영/무시했는지 적습니다",
        "",
        "영향이 없다고 판단했다면 이 파일을 지우고 스냅샷만 갱신하면 됩니다",
        "(`python tools/check_golfrules.py`).",
        "",
        "참고: R&A %s" % RA_URL,
    ]
    with open(REPORT, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")


def main():
    dry = "--dry" in sys.argv
    old = load_snapshot()

    # ── 자료 받기 — 실패는 감춘다고 없어지지 않는다
    errors = []
    ra, kga = {}, {}
    try:
        ra = ra_state(fetch(RA_URL))
        if not ra.get("found"):
            errors.append("R&A 페이지에서 일자·판 연도를 찾지 못했습니다 (구조가 바뀌었을 수 있습니다)")
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
        errors.append("R&A 접속 실패: %s" % e)

    try:
        kga = kga_state(fetch(KGA_URL))
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
        # KGA 는 보조 신호라 실패해도 점검 자체는 이어간다(경고만 남긴다)
        print("· 참고: KGA 접속 실패 —", e)

    if errors:
        print("✖ 점검하지 못했습니다:")
        for e in errors:
            print("   -", e)
        print("  조용히 넘어가지 않습니다 — 워크플로를 실패로 끝내 알림이 가게 합니다.")
        return 1

    new = {
        "clarifications": ra.get("clarifications", ""),
        "edition": ra.get("edition", ""),
        "kgaLatest": kga.get("latest", ""),
    }

    watch = ["clarifications", "edition"]
    if new["kgaLatest"] and old.get("kgaLatest"):
        watch.append("kgaLatest")          # 처음 채워지는 것은 변경이 아니다
    changes = [k for k in watch if old.get(k, "") and old.get(k, "") != new[k]]
    first_run = not old.get("clarifications")
    big = bool(old.get("edition")) and old.get("edition") != new["edition"]

    snap = dict(new)
    snap["lastChecked"] = today()
    snap["source"] = RA_URL
    snap["note"] = "tools/check_golfrules.py 가 매월 갱신합니다. 손으로 고치지 마세요."

    if not dry:
        save_snapshot(snap)

    if first_run:
        print("· 첫 점검 — 기준값을 기록했습니다:", json.dumps(new, ensure_ascii=False))
        return 0

    if not changes:
        print("골프 규칙 점검 OK — 바뀐 것 없음 (%s)" % today())
        print("  Clarifications: %s · 판: %s년" % (new["clarifications"] or "-", new["edition"] or "-"))
        return 0

    print("⚠ 공식 규칙 쪽에 변화가 감지되었습니다:", ", ".join(changes))
    for k in changes:
        print("   %s: %s → %s" % (k, old.get(k) or "(없음)", new[k] or "(없음)"))
    if not dry:
        write_report(changes, old, new, big)
        print("  리포트를 만들었습니다: docs/골프룰_점검리포트.md")
    print("  사람이 확인할 차례라 워크플로를 실패로 끝냅니다(알림 목적).")
    return 1


if __name__ == "__main__":
    sys.exit(main())
