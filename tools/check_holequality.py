# -*- coding: utf-8 -*-
"""홀 자료 품질 관문 (2026-08-03 신설) — 배포 전에 두 가지를 막는다.

왜 이 관문이 생겼나 (실제 사고 두 건)

  ① 남의 홀 공략이 붙어 있었다 — 광주CC·한림안성CC 23홀.
     `universal_build.py` 가 홀 이미지 앞뒤 ±2200자에서 '가장 긴 문장'을 공략으로
     삼는데, 그 창이 옆 홀까지 덮으면 옆 홀 문장이 뽑힌다. 화면에도 나오고
     **AI 캐디 프롬프트에도 사실로 들어간다**(app.js: 골프장 공식 공략 TIP).
     공략 본문에 'HOLE n' 머리글이 남아 있고 그 n 이 홀 번호와 다르면 남의 글이다.

  ② 홀맵이 백지였다 — 한림안성CC 9홀 전부.
     그린 모양만 그린 투명 PNG(hole_green_0n.png)를 흰 배경에 합성해 넣는 바람에
     사실상 흰 종이가 됐다. 사장님이 폰에서 보기 전까지 아무도 몰랐다.

판정
  · 공략: tip 안 첫 'HOLE n' 이 홀 번호와 다르면 실패
  · 이미지: 64x64 회색조로 줄여 표준편차 < 18 이면서 평균 밝기 > 215 이면 실패
    (정상 홀맵은 편차 70 언저리다. 한림안성 백지는 1~6 이었다)

사용
  python tools/check_holequality.py            js/holeimgdb.js 검사 (배포 관문)
  python tools/check_holequality.py --list     실패 항목 전부 나열
"""
import argparse, json, os, re, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(ROOT, "js", "holeimgdb.js")

SD_MIN, MEAN_MAX = 18.0, 215.0


def holes_from_db():
    """holeimgdb.js 를 훑어 (구장, 코스, 홀번호, tip, img) 를 뽑는다."""
    src = open(DB, encoding="utf-8").read()
    out = []
    course = sub = None
    for line in src.splitlines():
        m = re.match(r'\s{2}"(.+?)":\s*\{', line)
        if m:
            course, sub = m.group(1), None
            continue
        m = re.match(r'\s{6}\{ name: "(.+?)", holes:', line)
        if m:
            sub = m.group(1)
            continue
        m = re.search(r"\{ no: (\d+), par: (\d+)", line)
        if m and course:
            tip = re.search(r'tip: "((?:[^"\\]|\\.)*)"', line)
            img = re.search(r'img: "([^"]+)"', line)
            out.append({"course": course, "sub": sub or "", "no": int(m.group(1)),
                        "par": int(m.group(2)),
                        "tip": (tip.group(1) if tip else ""),
                        "img": (img.group(1) if img else "")})
    return out


HOLE_MARK = re.compile(r"HOLE\s*(\d+)|(\d+)\s*Hole", re.I)
PAR_MARK = re.compile(r"PAR\s*(\d)|파\s*(\d)홀", re.I)


def check_tip(rows):
    """공략 문구가 이 홀 것인지 — 두 가지 흔적으로 본다.

    · 홀 번호 표기(HOLE 3 / 3Hole)가 홀 번호와 다르다
    · 파 표기(PAR 5 / 파 5홀)가 이 홀의 파와 다르다
      — 번호 머리글이 안 남은 조각글도 이걸로 잡힌다(써닝포인트CC 실측).
    """
    bad = []
    for r in rows:
        t = r["tip"]
        if not t:
            continue
        m = HOLE_MARK.search(t)
        if m and int(m.group(1) or m.group(2)) != r["no"]:
            bad.append((r, f'공략 본문이 {m.group(0).strip()} 입니다'))
            continue
        p = PAR_MARK.search(t)
        if p and r.get("par") and int(p.group(1) or p.group(2)) != r["par"]:
            bad.append((r, f'공략 본문은 {p.group(0).strip()} 인데 이 홀은 파 {r["par"]} 입니다'))
    return bad


# 홈페이지 상단 메뉴가 공략 자리에 통째로 들어간 흔적 (웰링턴CC 8홀, 2026-08-03 감사)
MENU_WORDS = re.compile(
    r"LOGIN|LANGUAGE|SITEMAP|로그인|회원가입|마이페이지|예약하기|예약확인|오시는[ ]?길|"
    r"코스소개|클럽소개|이용안내|공지사항|편의시설|프로샵|멤버쉽|고객센터|전체메뉴", re.I)


def check_menu(rows):
    bad = []
    for r in rows:
        t = r["tip"]
        if not t:
            continue
        hits = set(m.group(0) for m in MENU_WORDS.finditer(t))
        # 한두 단어는 본문에도 나올 수 있다(예: '클럽소개'). 셋 이상이면 메뉴다.
        if len(hits) >= 3:
            bad.append((r, f"공략 자리에 메뉴 글이 들어 있습니다({'·'.join(sorted(hits))[:40]})"))
    return bad


def check_img(rows):
    from PIL import Image, ImageStat
    bad, seen = [], {}
    for r in rows:
        rel = r["img"]
        if not rel:
            continue
        if rel not in seen:
            p = os.path.join(ROOT, rel.replace("/", os.sep))
            if not os.path.exists(p):
                seen[rel] = ("파일이 없습니다", 0, 0)
            else:
                try:
                    st = ImageStat.Stat(Image.open(p).convert("L").resize((64, 64)))
                    sd, mean = st.stddev[0], st.mean[0]
                    seen[rel] = (None if not (sd < SD_MIN and mean > MEAN_MAX)
                                 else f"백지에 가깝습니다(편차 {sd:.0f}·밝기 {mean:.0f})", sd, mean)
                except Exception as e:
                    seen[rel] = (f"열 수 없습니다({e})", 0, 0)
        why = seen[rel][0]
        if why:
            bad.append((r, why))
    return bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()

    rows = holes_from_db()
    tips = check_tip(rows)
    menus = check_menu(rows)
    imgs = check_img(rows)
    print(f"■ 홀 {len(rows)}개 검사 (공략 있는 홀 {sum(1 for r in rows if r['tip'])} · "
          f"이미지 있는 홀 {sum(1 for r in rows if r['img'])})")

    for title, bad in (("남의 홀 공략", tips), ("메뉴 글이 공략 자리에", menus), ("백지 홀맵", imgs)):
        if not bad:
            print(f"  ✅ {title} 0건")
            continue
        print(f"  ✖ {title} {len(bad)}건")
        for r, why in (bad if a.list else bad[:12]):
            print(f'     {r["course"]} {r["sub"]} {r["no"]}번 — {why}')
        if not a.list and len(bad) > 12:
            print(f"     … 그 외 {len(bad) - 12}건 (--list 로 전부)")
    if tips or menus or imgs:
        print("\n고치는 길")
        print("  · 공략: coursedata/homepages/<slug>/parsed.json 의 tip 을 바로잡거나 비운다")
        print("    (같은 템플릿 구장은 python tools/reparse_holetitle.py --write)")
        print("  · 이미지: 원본에서 다시 만들거나(reparse_holetitle.py --images),")
        print("    쓸 수 없으면 img 를 빼서 위성 뷰로 넘긴다")
        print("  · 고친 뒤 python tools/build_holeimgdb.py 로 재조립")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
