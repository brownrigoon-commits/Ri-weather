# -*- coding: utf-8 -*-
"""통계 전송 주소 검사 — 앱이 '우리 배포 주소'를 정확히 알고 있는지 (배포 전 관문)

2026-08-02 부터 `js/stats.js` 는 **우리 배포 주소일 때만** 통계를 보낸다(허용목록).
localhost 만 막던 예전 방식은 file:// · 192.168.x.x · 터널 주소가 전부 통과해서,
7/28 하루에 우리 검사 흔적으로만 새 기기 120대가 쌓였다.

허용목록은 잡음을 확실히 막는 대신 **틀리면 통계가 조용히 멎는다**. 아무 오류도 안 나고
그냥 0건이 되므로 며칠을 모르고 지날 수 있다 — 이 저장소가 이미 두 번 겪은 종류의 사고다
(2026-07-22 `.nojekyll` 누락으로 배포 5번이 사용자에게 도달하지 않음).

그래서 배포 주소의 정본인 `tools/verify_deploy.py` 의 BASE 와 대조한다.
주소를 옮기면서 `js/stats.js` 를 안 고치면 여기서 배포가 멈춘다.

사용
  python tools/check_stats_host.py            # 위반만, 있으면 종료코드 1
  python tools/check_stats_host.py --report   # 통과 항목까지
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _read(p):
    with io.open(p, encoding="utf-8") as f:
        return f.read()


def violations(root=ROOT):
    bad, note = [], []
    vd = os.path.join(root, "tools", "verify_deploy.py")
    st = os.path.join(root, "js", "stats.js")
    for p in (vd, st):
        if not os.path.exists(p):
            bad.append("파일이 없습니다: %s" % os.path.relpath(p, root))
    if bad:
        return bad, note

    m = re.search(r'BASE\s*=\s*"https://([^/"]+)(/[^"]*)?"', _read(vd))
    if not m:
        bad.append("tools/verify_deploy.py 에서 배포 주소(BASE)를 읽지 못했습니다")
        return bad, note
    host, path = m.group(1), (m.group(2) or "/").rstrip("/") + "/"

    src = _read(st)
    hosts = re.search(r"const PROD_HOSTS = \[([^\]]*)\]", src)
    if not hosts:
        bad.append("js/stats.js 에 PROD_HOSTS 가 없습니다 — 통계 전송 조건이 사라졌습니다")
        return bad, note

    if '"%s"' % host not in hosts.group(1):
        bad.append(
            "js/stats.js 의 PROD_HOSTS 에 배포 호스트(%s)가 없습니다 — "
            "이대로 올리면 통계가 한 건도 쌓이지 않습니다" % host
        )
    else:
        note.append("전송 호스트 일치: %s" % host)

    if 'indexOf("%s")' % path not in src:
        bad.append(
            "js/stats.js 의 경로 조건이 배포 경로(%s)와 다릅니다 — "
            "이대로 올리면 통계가 한 건도 쌓이지 않습니다" % path
        )
    else:
        note.append("전송 경로 일치: %s" % path)

    # 오판을 부르는 흔한 실수 — 이 속성이 없는 옛 브라우저를 통째로 잃는다
    if re.search(r"navigator\.webdriver\s*!==\s*false", src):
        bad.append(
            "js/stats.js 가 navigator.webdriver !== false 로 판정합니다 — "
            "이 속성이 없는 옛 사파리·안드로이드 웹뷰·카톡 인앱 브라우저가 통째로 빠집니다"
        )

    return bad, note


if __name__ == "__main__":
    bad, note = violations()
    if "--report" in sys.argv:
        for n in note:
            print("  OK", n)
    for b in bad:
        print("  ✖", b)
    print("통계 전송 주소 검사: %s" % ("위반 %d건" % len(bad) if bad else "이상 없음"))
    sys.exit(1 if bad else 0)
