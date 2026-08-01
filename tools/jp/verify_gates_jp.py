# -*- coding: utf-8 -*-
"""일본 자료 관문 고장 검증 — 관문이 진짜로 잡는지 확인한다 (2026-08-01 신설)

관문은 만들어 놓고 통과만 보면 아무 의미가 없다. **일부러 망가뜨린 자료**를 넣어
관문이 그걸 잡아내는지 확인해야 비로소 믿을 수 있다(기존 작업 원칙).

여기서 흉내 내는 고장은 전부 **실제로 겪었거나 겪을 뻔한 것**이다:
  · 27홀 구장의 코스 이름이 전부 같아 그림이 서로 덮어써진 사고 (2026-08-01 실제)
  · A그린이라 적고 B그린 거리를 담은 사고 (2026-08-01 실제, 그림 범례와 대조해 잡음)
  · 200 응답인데 내용은 HTML 오류 페이지인 그림 (아코디아 www 호스트 함정)
  · golfdb 에 없는 이름으로 등록 → 앱에서 영원히 안 보임
  · 출처 표기가 내리기 스위치와 어긋남 → 통지 온 날 못 내림

사용: python tools/jp/verify_gates_jp.py
"""
import copy, json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from jp_common import HP_JP, ROOT

CHECK = os.path.join(HERE, "check_sources_jp.py")


def run_check():
    r = subprocess.run([sys.executable, CHECK], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def main():
    files = [os.path.join(HP_JP, d, "parsed.json") for d in sorted(os.listdir(HP_JP))] \
        if os.path.isdir(HP_JP) else []
    files = [f for f in files if os.path.exists(f)]
    if not files:
        print("✖ 검사할 일본 자료가 없습니다 — 먼저 수집하세요")
        return 1

    code, out = run_check()
    if code != 0:
        print("✖ 지금 자료가 이미 관문을 통과하지 못합니다. 고장 검증 전에 이것부터 고치세요.")
        print(out)
        return 1
    print("기준 상태: 관문 통과 ✅  — 이제 하나씩 망가뜨려 봅니다\n")

    target = files[0]
    backup = json.load(open(target, encoding="utf-8"))
    tmpimg = None

    def restore():
        with open(target, "w", encoding="utf-8", newline="\n") as w:
            json.dump(backup, w, ensure_ascii=False, indent=1)

    def sabotage(name, mutate, expect):
        nonlocal tmpimg
        d = copy.deepcopy(backup)
        extra = mutate(d)
        with open(target, "w", encoding="utf-8", newline="\n") as w:
            json.dump(d, w, ensure_ascii=False, indent=1)
        c, o = run_check()
        caught = c != 0 and expect in o
        print(("  ✔ 잡아냄  " if caught else "  ✖ 못 잡음 ") + name)
        if not caught:
            print("       기대한 말: " + expect)
            print("       실제 출력 : " + o.strip().replace("\n", "\n       ")[:400])
        if extra and os.path.exists(extra):
            os.remove(extra)
        restore()
        return caught

    ok = []

    ok.append(sabotage(
        "코스 이름이 겹침 (27홀 구장 그림 덮어쓰기 사고)",
        lambda d: [c.update(name="OUT") for c in d["courses"]] and None,
        "코스 이름이 겹칩니다"))

    ok.append(sabotage(
        "같은 그림이 여러 홀에 붙음",
        lambda d: d["courses"][0]["holes"][1].update(img=d["courses"][0]["holes"][0]["img"]),
        "같은 그림이 여러 홀에 붙어"))

    ok.append(sabotage(
        "golfdb 에 없는 이름으로 등록 (앱에서 안 보임)",
        lambda d: d.update(course="없는골프장ABC"),
        "golfdb(JP)에 없는 이름"))

    ok.append(sabotage(
        "출처 표기가 내리기 스위치와 어긋남",
        lambda d: d.update(source="어디선가 가져옴"),
        "못 내립니다"))

    ok.append(sabotage(
        "출처와 주소가 안 맞음",
        lambda d: d.update(sourceUrl="https://example.com/whatever"),
        "출처(アコーディア)와 주소가 맞지 않습니다"))

    ok.append(sabotage(
        "단위(야드/미터) 표기 누락",
        lambda d: d.pop("unit", None),
        "unit 이 없습니다"))

    ok.append(sabotage(
        "2그린인데 어느 그린인지 안 적힘",
        lambda d: (d.update(greens=2), d.update(green=None))[0],
        "어느 그린 거리인지"))

    ok.append(sabotage(
        "티 거리가 내림차순이 아님 (표를 잘못 읽음)",
        lambda d: d["courses"][0]["holes"][0]["tees"].reverse(),
        "내림차순이 아닙니다"))

    ok.append(sabotage(
        "파 값이 이상함",
        lambda d: d["courses"][0]["holes"][0].update(par=9),
        "par 가 이상합니다"))

    ok.append(sabotage(
        "홀 번호가 뒤죽박죽",
        lambda d: d["courses"][0]["holes"].reverse(),
        "홀 번호가 이상합니다"))

    def html_as_image(d):
        """200 인데 내용은 HTML 오류 페이지 — 아코디아 www 호스트 함정 재현"""
        p = os.path.join(ROOT, d["courses"][0]["holes"][0]["img"])
        shutil.copy(p, p + ".bak")
        with open(p, "wb") as w:
            w.write(b"<!DOCTYPE html><html><body>error page</body></html>" * 40)
        return None

    d = copy.deepcopy(backup)
    imgpath = os.path.join(ROOT, d["courses"][0]["holes"][0]["img"])
    shutil.copy(imgpath, imgpath + ".bak")
    with open(imgpath, "wb") as w:
        w.write(b"<!DOCTYPE html><html><body>error page</body></html>" * 40)
    c, o = run_check()
    caught = c != 0 and "그림이 아닙니다" in o
    print(("  ✔ 잡아냄  " if caught else "  ✖ 못 잡음 ") + "그림 자리에 HTML 오류 페이지가 저장됨")
    if not caught:
        print("       실제 출력: " + o.strip()[:300])
    shutil.move(imgpath + ".bak", imgpath)
    ok.append(caught)

    d = copy.deepcopy(backup)
    d["courses"][0]["holes"][0]["img"] = "holeimg/jp_없는폴더/없는파일.jpg"
    with open(target, "w", encoding="utf-8", newline="\n") as w:
        json.dump(d, w, ensure_ascii=False, indent=1)
    c, o = run_check()
    caught = c != 0 and "그림 파일이 없습니다" in o
    print(("  ✔ 잡아냄  " if caught else "  ✖ 못 잡음 ") + "그림 파일이 실제로 없음")
    ok.append(caught)
    restore()

    c, o = run_check()
    print(f"\n되돌린 뒤 관문: {'통과 ✅' if c == 0 else '✖ 실패 — 되돌리기가 안 됐습니다'}")
    if c != 0:
        print(o)
        return 1

    bad = len([x for x in ok if not x])
    print(f"\n{'✅ 모든 고장을 관문이 잡아냈습니다' if not bad else f'✖ 놓친 고장 {bad}건'} "
          f"({len(ok) - bad}/{len(ok)})")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
