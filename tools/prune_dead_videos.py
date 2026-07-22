# -*- coding: utf-8 -*-
"""재생되지 않는 골프존 3D 영상 링크 제거

골프존 영상 URL은 홀 정보에서 조합해 만드는데, 일부 코스(주로 3·4번째 코스)는
CDN에 파일이 없어 403이 뜬다. 그대로 두면 앱에서 빈 플레이어가 떠 신뢰를 잃는다.

프레임 추출에 성공한 홀은 영상이 살아 있다는 뜻이므로 검사를 건너뛰고,
'영상은 있는데 프레임이 없는' 홀만 실제 요청해 확인한다.

사용: python tools/prune_dead_videos.py [--write]
"""
import glob, json, os, sys, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WRITE = "--write" in sys.argv


def alive(url):
    try:
        req = urllib.request.Request(url, headers={"Range": "bytes=0-100", "User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status in (200, 206)
    except Exception:
        return False


removed = 0
for f in sorted(glob.glob(os.path.join(ROOT, "coursedata", "homepages", "*", "parsed.json"))):
    d = json.load(open(f, encoding="utf-8"))
    changed = False
    for c in d.get("courses", []):
        for h in c["holes"]:
            if h.get("video") and not h.get("frames") and not alive(h["video"]):
                print(f'끊김: {d["course"]} {c["name"]} {h["no"]}홀')
                removed += 1
                if WRITE:
                    del h["video"]
                    changed = True
    if changed:
        json.dump(d, open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print(f"\n끊긴 영상 {removed}홀" + (" 제거 완료" if WRITE else " (--write 로 제거)"))
