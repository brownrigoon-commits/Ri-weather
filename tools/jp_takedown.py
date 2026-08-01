# -*- coding: utf-8 -*-
"""일본 구장 자료 즉시 내리기 (출처별 리스크 제거 스위치) — 2026-07-31 신설

권리자 통지가 오면 **그 출처에서 수집한 자료 전부**를 한 번에 배포본에서 내린다.
골프존용(`golfzon_takedown.py`)과 같은 사상이되, 일본은 출처가 여럿이라
**출처 하나만 골라서** 내릴 수 있게 했다. 아코디아에서 통지가 와도 東急 자료까지
같이 내릴 이유는 없기 때문이다.

⚠️ **데이터를 넣기 전에 이 스위치부터 만든다.** 통지가 온 날 개발자를 못 찾아도
   사장님 혼자 내릴 수 있어야 한다.

사용법
  python tools/jp_takedown.py --status                  지금 무엇이 올라가 있는지 (안 바꿈)
  python tools/jp_takedown.py --remove accordia --dry   연습: 무엇을 지울지만 (안 바꿈)
  python tools/jp_takedown.py --remove accordia         진짜 내리기 ('내리기' 입력 필요)
  python tools/jp_takedown.py --remove all              일본 자료 전부 내리기
  python tools/jp_takedown.py --restore --from-zip <경로>  백업 zip 에서 되살리기

내린 뒤에도 앱은 깨지지 않는다 — 그 구장은 "코스공략 준비중"으로 자동 강등된다
(홀 하나라도 없으면 등록하지 않는다는 원칙과 같은 자리).

⚠ 이 도구는 스스로 배포하지 않는다. 마지막에 안내하는 두 줄을 사람이 실행한다.
"""
import json, os, shutil, subprocess, sys, zipfile
from datetime import datetime

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HP = os.path.join(ROOT, "coursedata", "homepages_jp")

# 출처 표기(parsed.json 의 source) 로 판별한다.
# 폴더 이름은 사람이 바꿀 수 있지만, 출처 표기는 자료를 만들 때 함께 적히기 때문이다.
SOURCES = {
    "accordia":  {"mark": "アコーディア", "name": "아코디아 골프", "site": "accordiagolf.com"},
    "tokyu":     {"mark": "東急",         "name": "도큐 골프리조트", "site": "tokyu-golf-resort.com"},
    "tatemono":  {"mark": "東京建物",     "name": "도쿄건물 리조트", "site": "tatemono-resort.com"},
    "tama":      {"mark": "多摩興産",     "name": "다마흥산",       "site": "tfn-style.com"},
    "pgm":       {"mark": "PGM",          "name": "PGM(수치 전용)",  "site": "pacificgolf.co.jp"},
    # 2026-08-01 추가 — 홀맵 '등뼈' 층(235px, 사실상 전 구장. docs/일본_6메뉴_데이터_설계.md §2-1).
    # 리크루트 계열이라 통지가 오면 じゃらん분만 내리고 아코디아 등 고화질 층은 남긴다.
    "jalan":     {"mark": "じゃらん",     "name": "쟈란골프(리크루트)", "site": "golf-jalan.net"},
}


def git(*args, check=True):
    r = subprocess.run(["git", "-C", ROOT] + list(args),
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}\n{r.stderr.strip()[:400]}")
    return r


def find_assets(keys):
    """고른 출처에서 온 자료를 찾는다. → (구장목록, 자료폴더, 이미지폴더)"""
    marks = [SOURCES[k]["mark"] for k in keys]
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
        src = str(d.get("source", "")) + " " + str(d.get("sourceUrl", ""))
        if not any(m in src for m in marks):
            continue
        holes = sum(len(c.get("holes", [])) for c in d.get("courses", []))
        courses.append({"course": d.get("course"), "holes": holes, "source": d.get("source")})
        dirs.append(os.path.relpath(os.path.join(HP, name), ROOT).replace("\\", "/"))
        # 이미지 폴더는 자료 안에 적힌 경로에서 읽는다(폴더 이름 규칙에 기대지 않는다)
        for c in d.get("courses", []):
            for h in c.get("holes", []):
                if h.get("img"):
                    imgdirs.add(os.path.dirname(h["img"]).replace("\\", "/"))
    return courses, dirs, sorted(imgdirs)


def human_mb(rels):
    total = 0
    for rel in rels:
        base = os.path.join(ROOT, rel)
        for root, _, files in os.walk(base):
            for x in files:
                try:
                    total += os.path.getsize(os.path.join(root, x))
                except OSError:
                    pass
    return total / 1048576


def backup(dirs, imgdirs, tag):
    """저장소 **밖**에 zip 으로 먼저 백업하고 개수·크기까지 대조한다.
    하나라도 어긋나면 아무것도 지우지 않는다. 백업이 이상한 채로 지우면 되돌릴 수 없다."""
    stamp = datetime.now().strftime("%Y%m%d_%H%M")
    dst = os.path.abspath(os.path.join(ROOT, "..", f"Ri-weather_일본{tag}백업_{stamp}.zip"))
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
    with zipfile.ZipFile(dst) as z:
        if z.testzip() is not None:
            raise RuntimeError("백업 zip 이 손상되었습니다")
        names = set(z.namelist())
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
    """일본 홀맵 DB 재조립. 아직 조립기가 없으면(수집 전) 조용히 넘어간다."""
    b = os.path.join(ROOT, "tools", "jp", "build_holeimgdb_jp.py")
    if not os.path.exists(b):
        print("· (일본 홀맵 조립기가 아직 없습니다 — 수집 전 단계)")
        return
    r = subprocess.run([sys.executable, b], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise RuntimeError("일본 홀맵 재조립 실패: " + (r.stderr or "")[:300])
    print("· 일본 홀맵 DB 재조립 완료")


def cmd_status():
    print("■ 일본 구장 자료 현황 (출처별)")
    any_found = False
    for k, s in SOURCES.items():
        courses, dirs, imgdirs = find_assets([k])
        if not courses:
            print(f"   {k:10s} {s['name']:16s} —")
            continue
        any_found = True
        holes = sum(c["holes"] for c in courses)
        print(f"   {k:10s} {s['name']:16s} 구장 {len(courses)}곳 · {holes}홀 · 약 {human_mb(dirs+imgdirs):.0f}MB")
    if not any_found:
        print("   (아직 수집된 일본 자료가 없습니다 — 스위치를 먼저 만들어 둔 상태)")
    print("\n내리려면:  python tools/jp_takedown.py --remove <출처> --dry   (연습)")
    return 0


def cmd_remove(keys, dry, tag):
    courses, dirs, imgdirs = find_assets(keys)
    if not courses:
        print(f"내릴 자료가 없습니다 ({tag}).")
        return 0
    holes = sum(c["holes"] for c in courses)
    print(f"■ 내릴 대상: 구장 {len(courses)}곳 · {holes}홀 · 약 {human_mb(dirs + imgdirs):.0f}MB")
    for c in courses[:8]:
        print(f"   - {c['course']} ({c['holes']}홀) ← {c['source']}")
    if len(courses) > 8:
        print(f"   … 외 {len(courses)-8}곳")
    if dry:
        print("\n[연습 모드] 실제로는 아무것도 바꾸지 않습니다.")
        print(f"   자료 폴더 {len(dirs)}개 · 이미지 폴더 {len(imgdirs)}개")
        print("\n실제로 내리려면 --dry 를 빼고 다시 실행하세요.")
        return 0

    # 다른 작업과 섞인 채로 지우면 되돌리기가 어려워진다
    if git("status", "--porcelain").stdout.strip():
        print("✖ 저장소에 저장 안 된 변경이 있습니다. 먼저 정리(커밋)한 뒤 실행하세요.")
        return 1
    print(f"\n정말 내리시겠습니까? 되돌릴 수 있도록 백업을 먼저 만듭니다.")
    if input("   계속하려면 '내리기' 를 입력하세요: ").strip() != "내리기":
        print("취소했습니다.")
        return 1

    zip_path = backup(dirs, imgdirs, tag)
    for rel in dirs + imgdirs:
        p = os.path.join(ROOT, rel)
        if os.path.isdir(p):
            shutil.rmtree(p)
    print(f"· 삭제 완료: 자료 {len(dirs)}개 · 이미지 {len(imgdirs)}개 폴더")
    rebuild()
    print("\n✅ 내리기 끝났습니다. 이제 배포해야 사용자에게 반영됩니다:")
    print(f'   python tools/release_courses.py "일본 {tag} 자료 내림 (권리자 통지 대응)"')
    print("   python tools/verify_deploy.py --wait")
    print(f"\n되살리려면:  python tools/jp_takedown.py --restore --from-zip \"{zip_path}\"")
    return 0


def cmd_restore(from_zip):
    if not from_zip or not os.path.exists(from_zip):
        print("✖ 백업 zip 경로를 --from-zip 으로 주세요.")
        return 1
    with zipfile.ZipFile(from_zip) as z:
        if z.testzip() is not None:
            print("✖ 백업 zip 이 손상되었습니다."); return 1
        names = z.namelist()
        z.extractall(ROOT)
    print(f"· 되살림: {len(names)}개 파일")
    rebuild()
    print("\n✅ 복구했습니다. 배포해야 사용자에게 반영됩니다:")
    print('   python tools/release_courses.py "일본 자료 복구"')
    return 0


def main():
    a = sys.argv[1:]
    if "--status" in a or not a:
        return cmd_status()
    if "--restore" in a:
        i = a.index("--from-zip") if "--from-zip" in a else -1
        return cmd_restore(a[i + 1] if i >= 0 and i + 1 < len(a) else None)
    if "--remove" in a:
        i = a.index("--remove")
        which = a[i + 1] if i + 1 < len(a) and not a[i + 1].startswith("--") else ""
        if which == "all":
            keys, tag = list(SOURCES), "전체"
        elif which in SOURCES:
            keys, tag = [which], which
        else:
            print("✖ 출처를 지정하세요:", ", ".join(SOURCES), "또는 all")
            return 1
        return cmd_remove(keys, "--dry" in a, tag)
    print(__doc__)
    return 0


if __name__ == "__main__":
    sys.exit(main())
