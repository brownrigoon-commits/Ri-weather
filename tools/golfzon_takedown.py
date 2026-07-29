# -*- coding: utf-8 -*-
"""골프존 자료 즉시 내리기 (리스크 제거 스위치)

권리자 통지가 오면 **골프존에서 수집한 자료 전부**를 한 번에 배포본에서 내린다.
"몰랐다"가 아니라 "알고 감수하되 통지 즉시 내린다"는 리스크 관리의 실행 수단이다.
설계·법적 배경: docs/골프존_리스크제거_설계.md

사용법
  python tools/golfzon_takedown.py --status              지금 무엇이 올라가 있는지 (아무것도 바꾸지 않음)
  python tools/golfzon_takedown.py --check               저장소에 골프존 흔적이 남았는지 검사 (바꾸지 않음)
  python tools/golfzon_takedown.py --remove --dry        연습: 무엇을 지울지만 보여준다 (바꾸지 않음)
  python tools/golfzon_takedown.py --remove              진짜 내리기 ('내리기' 입력 필요)
  python tools/golfzon_takedown.py --restore             복구 (태그에서 되살리기)
  python tools/golfzon_takedown.py --restore --from-zip <경로>   백업 zip 에서 되살리기

내린 뒤에도 앱은 깨지지 않는다 — 해당 구장은 위성 화면 + "캐디 공략 준비중"으로 자동 강등된다.

⚠ 이 도구는 스스로 배포하지 않는다. 마지막에 안내하는 두 줄(release/verify)을 사람이 실행한다.
   배포는 항상 표준 관문을 지난다(홀 수·이미지·티 거리 검사가 거기에 물려 있다).
"""
import io, json, os, re, subprocess, sys, zipfile
from datetime import datetime

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HP = os.path.join(ROOT, "coursedata", "homepages")
LEGAL = os.path.join(ROOT, "js", "legal.js")
HOLEIMGDB = os.path.join(ROOT, "js", "holeimgdb.js")
LEGAL_LINE = "  <li>골프존 — 홀 정보</li>\n"
MARK = "골프존"                       # parsed.json 의 source 표기로 판별한다


def git(*args, check=True):
    r = subprocess.run(["git", "-C", ROOT] + list(args),
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}\n{r.stderr.strip()[:400]}")
    return r


def find_assets():
    """골프존에서 온 자료를 찾는다.

    폴더 이름(gz*)이 아니라 **parsed.json 의 출처 표기**로 판별한다.
    이름 규칙은 사람이 바꿀 수 있지만 출처 표기는 자료를 만들 때 함께 적히기 때문이다.
    돌려주는 값: (구장목록, parsed 폴더들, 이미지 폴더들)
    """
    courses, dirs, imgdirs = [], [], set()
    if not os.path.isdir(HP):
        return courses, dirs, sorted(imgdirs)
    for name in sorted(os.listdir(HP)):
        f = os.path.join(HP, name, "parsed.json")
        if not os.path.exists(f):
            continue
        try:
            d = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        if MARK not in str(d.get("source", "")):
            continue
        holes = sum(len(c.get("holes", [])) for c in d.get("courses", []))
        vids = sum(1 for c in d.get("courses", []) for h in c.get("holes", []) if h.get("video"))
        courses.append({"name": d.get("course", name), "dir": name, "holes": holes, "videos": vids})
        dirs.append(os.path.join("coursedata", "homepages", name))
        # 이미지가 실제로 어느 폴더에 있는지도 자료에서 읽는다 (이름 규칙에 기대지 않는다)
        for c in d.get("courses", []):
            for h in c.get("holes", []):
                for p in [h.get("img"), h.get("green")] + list(h.get("frames") or []):
                    if p:
                        imgdirs.add(os.path.dirname(str(p).replace("\\", "/")))
    return courses, dirs, sorted(imgdirs)


def human_mb(paths):
    total = 0
    for rel in paths:
        p = os.path.join(ROOT, rel)
        for root, _, files in os.walk(p):
            for x in files:
                try:
                    total += os.path.getsize(os.path.join(root, x))
                except OSError:
                    pass
    return total / 1048576


def cmd_status():
    courses, dirs, imgdirs = find_assets()
    if not courses:
        print("골프존에서 온 자료가 없습니다. (이미 내렸거나 처음부터 없음)")
        return 0
    holes = sum(c["holes"] for c in courses)
    vids = sum(c["videos"] for c in courses)
    print(f"■ 골프존 자료 현황")
    print(f"  구장 {len(courses)}곳 · {holes}홀")
    print(f"  자료 폴더 {len(dirs)}개 + 이미지 폴더 {len(imgdirs)}개 (합계 약 {human_mb(dirs + imgdirs):.0f}MB)")
    print(f"  골프존 서버 영상 링크 {vids}개 (우리가 저장한 것이 아니라 링크)")
    line = "있음" if LEGAL_LINE in open(LEGAL, encoding="utf-8").read() else "없음"
    print(f"  약관 출처 표기 줄: {line}")
    print(f"\n  예시 구장: " + ", ".join(c["name"] for c in courses[:5]) + " ...")
    print(f"\n  내리려면: python tools/golfzon_takedown.py --remove")
    print(f"  (먼저 연습해 보려면 --remove --dry)")
    return 0


def cmd_check():
    """내린 뒤 흔적이 남았는지 — 배포되는 파일만 본다(git 이력은 대상이 아님)."""
    bad = []
    courses, dirs, imgdirs = find_assets()
    if courses:
        bad.append(f"골프존 출처 자료가 아직 {len(courses)}곳 남아 있음")
    for rel in dirs + imgdirs:
        if os.path.isdir(os.path.join(ROOT, rel)):
            bad.append("폴더 남음: " + rel)
    # 앱이 실제로 읽는 산출물에 골프존 링크가 남았는지
    if os.path.exists(HOLEIMGDB):
        txt = open(HOLEIMGDB, encoding="utf-8").read()
        n = txt.count("golfzon.com")
        if n:
            bad.append(f"js/holeimgdb.js 에 골프존 링크 {n}개 남음")
        if txt.count("{") != txt.count("}"):
            bad.append("js/holeimgdb.js 중괄호 불균형 — 조립이 깨졌습니다")
        # 남은 구장 수가 parsed.json 수와 맞는지
        left = len([1 for n2 in os.listdir(HP) if os.path.exists(os.path.join(HP, n2, "parsed.json"))])
        got = len(re.findall(r"^\s{2}\"", txt, re.M))
        if got and left and got < left:
            bad.append(f"조립된 구장 수({got})가 자료 수({left})보다 적음 — 다시 조립하세요")
    if LEGAL_LINE in open(LEGAL, encoding="utf-8").read():
        bad.append("약관에 골프존 출처 표기가 남아 있음")
    if bad:
        print("✖ 아직 남은 것이 있습니다:")
        for b in bad:
            print("   -", b)
        return 1
    print("✔ 배포본에 골프존 흔적이 없습니다.")
    print("  (참고: git 이력에는 과거 파일이 남습니다 — 서빙은 이미 중단됩니다. 설계서 5장)")
    return 0


def backup(dirs, imgdirs):
    """저장소 **밖**에 zip 으로 먼저 백업하고, 무결성까지 확인한다.
    태그(저장소 안)만 믿지 않는 이유: 저장소 자체가 잘못되면 함께 사라진다."""
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    dst = os.path.abspath(os.path.join(ROOT, "..", f"Ri-weather_골프존백업_{stamp}.zip"))
    want = []
    for rel in dirs + imgdirs:
        base = os.path.join(ROOT, rel)
        for root, _, files in os.walk(base):
            for x in files:
                full = os.path.join(root, x)
                want.append((full, os.path.relpath(full, ROOT).replace("\\", "/")))
    if not want:
        raise RuntimeError("백업할 파일을 찾지 못했습니다")
    print(f"· 백업 만드는 중: {dst}  ({len(want)}개 파일)")
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for full, arc in want:
            z.write(full, arc)
    # 무결성 확인 — 개수와 크기를 원본과 대조한다. 하나라도 어긋나면 지우지 않는다.
    with zipfile.ZipFile(dst) as z:
        names = set(z.namelist())
        if z.testzip() is not None:
            raise RuntimeError("백업 zip 이 손상되었습니다")
        missing = [arc for _, arc in want if arc not in names]
        if missing:
            raise RuntimeError(f"백업에 빠진 파일 {len(missing)}개 (예: {missing[:3]})")
        sizes = {i.filename: i.file_size for i in z.infolist()}
        bad = [arc for full, arc in want if sizes.get(arc) != os.path.getsize(full)]
        if bad:
            raise RuntimeError(f"백업 크기가 다른 파일 {len(bad)}개 (예: {bad[:3]})")
    print(f"✔ 백업 확인 완료 — {len(want)}개 파일 전부 일치 ({os.path.getsize(dst)/1048576:.0f}MB)")
    return dst


def rebuild():
    r = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "build_holeimgdb.py")],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise RuntimeError("holeimgdb 재조립 실패: " + (r.stderr or "")[:300])
    last = [l for l in (r.stdout or "").strip().splitlines() if l.strip()]
    print(f"· 홀맵 DB 재조립 완료 (남은 구장 {len(last)}곳)")


def cmd_remove(dry):
    courses, dirs, imgdirs = find_assets()
    if not courses:
        print("내릴 골프존 자료가 없습니다.")
        return 0
    holes = sum(c["holes"] for c in courses)
    print(f"■ 내릴 대상: 구장 {len(courses)}곳 · {holes}홀 · 약 {human_mb(dirs + imgdirs):.0f}MB")
    if dry:
        print("\n[연습 모드] 실제로는 아무것도 바꾸지 않습니다. 지울 폴더 예시:")
        for rel in (dirs[:3] + imgdirs[:3]):
            print("   -", rel)
        print(f"   ... 자료 폴더 {len(dirs)}개 · 이미지 폴더 {len(imgdirs)}개")
        print("\n실제로 내리려면 --dry 를 빼고 다시 실행하세요.")
        return 0

    # 다른 작업과 섞인 채로 지우면 되돌리기가 어려워진다
    if git("status", "--porcelain").stdout.strip():
        print("✖ 저장하지 않은 변경이 있습니다. 먼저 정리하세요:")
        print("   python tools/sync.py \"작업 내용\"")
        return 1
    print("\n" + "=" * 58)
    print(" 골프존 자료를 배포본에서 내립니다.")
    print(f" 구장 {len(courses)}곳의 홀맵·영상이 앱에서 사라지고,")
    print(" 해당 구장은 위성 화면 + '캐디 공략 준비중'으로 바뀝니다.")
    print(" 되돌릴 수 있습니다(백업 zip + 복구 태그).")
    print("=" * 58)
    if input(" 계속하려면 '내리기' 를 입력하세요: ").strip() != "내리기":
        print("취소했습니다. 아무것도 바꾸지 않았습니다.")
        return 1

    # 1) 저장소 밖 백업 먼저 — 실패하면 여기서 멈춘다(사장님 확정 절차)
    zip_path = backup(dirs, imgdirs)
    # 2) 복구 태그
    ver = ""
    try:
        ver = re.search(r'APP_VER = "(v\d+)"', open(os.path.join(ROOT, "js", "app.js"), encoding="utf-8").read()).group(1)
    except Exception:
        ver = "v0"
    tag = f"golfzon-assets-{ver}-{datetime.now().strftime('%Y%m%d')}"
    if git("tag", "-l", tag).stdout.strip():
        tag += "-" + datetime.now().strftime("%H%M")
    git("tag", tag)
    print(f"· 복구 지점 표시: {tag}")
    # 3) 삭제
    for rel in dirs + imgdirs:
        git("rm", "-r", "-q", "--", rel, check=False)
    print(f"· 폴더 {len(dirs) + len(imgdirs)}개 삭제")
    # 4) 재조립
    rebuild()
    # 5) 약관 출처 표기 (문자열이 정확히 일치할 때만 — 다르면 사람이 본다)
    txt = open(LEGAL, encoding="utf-8").read()
    if LEGAL_LINE in txt:
        open(LEGAL, "w", encoding="utf-8", newline="\n").write(txt.replace(LEGAL_LINE, "", 1))
        print("· 약관에서 골프존 출처 표기 줄 제거")
    else:
        print("⚠ 약관의 골프존 줄을 찾지 못했습니다 — js/legal.js 를 직접 확인하세요")
    # 6) 자체 검사
    print()
    rc = cmd_check()
    print("\n" + "=" * 58)
    if rc == 0:
        print(" 내리기 준비가 끝났습니다. 이제 배포하세요:")
    else:
        print(" ⚠ 검사에서 남은 것이 있습니다. 위 목록을 확인한 뒤 배포하세요:")
    print("   python tools/release_courses.py \"코스 자료 정리\"")
    print("   python tools/verify_deploy.py --wait")
    print(f"\n 백업: {zip_path}")
    print(f" 복구: python tools/golfzon_takedown.py --restore   (태그 {tag})")
    print("=" * 58)
    return rc


def cmd_restore(from_zip):
    if from_zip:
        if not os.path.exists(from_zip):
            print("✖ 백업 파일을 찾을 수 없습니다:", from_zip)
            return 1
        with zipfile.ZipFile(from_zip) as z:
            z.extractall(ROOT)
            n = len(z.namelist())
        print(f"· 백업에서 {n}개 파일 복원: {from_zip}")
    else:
        tags = [t for t in git("tag", "-l", "golfzon-assets-*").stdout.split() if t]
        if not tags:
            print("✖ 복구 태그가 없습니다. 백업 zip 으로 복구하세요:")
            print("   python tools/golfzon_takedown.py --restore --from-zip <경로>")
            return 1
        tag = sorted(tags)[-1]
        git("checkout", tag, "--", "coursedata/homepages", "holeimg")
        print(f"· 태그에서 복원: {tag}")
    txt = open(LEGAL, encoding="utf-8").read()
    if LEGAL_LINE not in txt and "<li>Google — AI 캐디" in txt:
        open(LEGAL, "w", encoding="utf-8", newline="\n").write(
            txt.replace("  <li>Google — AI 캐디", LEGAL_LINE + "  <li>Google — AI 캐디", 1))
        print("· 약관 출처 표기 줄 복원")
    rebuild()
    courses, _, _ = find_assets()
    print(f"\n✔ 골프존 구장 {len(courses)}곳 복원. 배포하세요:")
    print("   python tools/release_courses.py \"코스 자료 복원\"")
    print("   python tools/verify_deploy.py --wait")
    return 0


def main():
    a = sys.argv[1:]
    if "--status" in a or not a:
        return cmd_status()
    if "--check" in a:
        return cmd_check()
    if "--remove" in a:
        return cmd_remove("--dry" in a)
    if "--restore" in a:
        z = None
        if "--from-zip" in a:
            i = a.index("--from-zip")
            z = a[i + 1] if len(a) > i + 1 else None
            if not z:
                print("✖ --from-zip 뒤에 백업 파일 경로를 적어주세요")
                return 1
        return cmd_restore(z)
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main())
