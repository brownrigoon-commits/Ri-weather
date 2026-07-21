# -*- coding: utf-8 -*-
"""골프존 전체 코스 DB 풀 수집기
1) 전체 코스 목록 페이징 수집 → all_courses_index.json
2) 코스별 상세 + 홀정보 JSON (이미 있으면 스킵)
3) 야디지맵 이미지 전체 (중복 제거, 이미 있으면 스킵)
"""
import json, time, os, sys, glob, urllib.request, urllib.parse
sys.stdout.reconfigure(encoding="utf-8")

GZ = r"C:\Users\디자이너\Desktop\claude\Ri-weather\coursedata\golfzon"
IMG = os.path.join(GZ, "yardage")
os.makedirs(IMG, exist_ok=True)
BASE = "https://lobby.golfzon.com/v1/dotcom"

def get(url, binary=False):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "*/*", "Referer": "https://www.golfzon.com/"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return data if binary else json.loads(data.decode("utf-8"))

# 1) 전체 목록
print("=== 1단계: 전체 코스 목록", flush=True)
all_cc = {}
page = 1
while page < 100:
    try:
        lst = get(f"{BASE}/courses/course/search/list?page={page}&size=100")
    except Exception as e:
        print(f"목록 p{page} 실패: {e}", flush=True)
        time.sleep(3)
        continue
    if not lst:
        break
    for c in lst:
        all_cc[c["ciCode"]] = c
    print(f"p{page}: +{len(lst)} (누적 {len(all_cc)})", flush=True)
    if len(lst) < 100:
        break
    page += 1
    time.sleep(1.0)

json.dump(list(all_cc.values()), open(os.path.join(GZ, "all_courses_index.json"), "w", encoding="utf-8"), ensure_ascii=False)
print(f"전체 코스: {len(all_cc)}개", flush=True)

# 2) 상세 + 홀정보
print("=== 2단계: 상세+홀정보", flush=True)
have = set()
for f in glob.glob(os.path.join(GZ, "cc_*.json")):
    try:
        have.add(int(os.path.basename(f).split("_")[1]))
    except Exception:
        pass

done = fail = 0
for ci, c in all_cc.items():
    if ci in have:
        continue
    name = (c.get("ccName") or str(ci)).replace(" ", "").replace("/", "_").replace("\\", "_")
    try:
        detail = get(f"{BASE}/courses/course/{ci}/details")
        time.sleep(0.5)
        holes = get(f"{BASE}/courses/course/{ci}/details/hole-info")
        json.dump({"ciCode": ci, "ccName": c.get("ccName"), "detail": detail, "holeInfo": holes},
                  open(os.path.join(GZ, f"cc_{ci}_{name}.json"), "w", encoding="utf-8"), ensure_ascii=False)
        done += 1
        if done % 20 == 0:
            print(f"상세 {done}건 완료", flush=True)
    except Exception as e:
        print(f"상세 실패 {c.get('ccName')} ({ci}): {e}", flush=True)
        fail += 1
    time.sleep(0.9)
print(f"상세: 신규 {done}, 실패 {fail}, 기존 {len(have)}", flush=True)

# 3) 야디지맵
print("=== 3단계: 야디지맵", flush=True)
urls = {}
for f in glob.glob(os.path.join(GZ, "cc_*.json")):
    try:
        j = json.load(open(f, encoding="utf-8"))
    except Exception:
        continue
    for nine in j.get("holeInfo", {}).get("holeInfoList", []):
        for h in nine:
            mu = h.get("mapUrl")
            if mu:
                urls[os.path.basename(mu)] = "https://o.gzcdn.net/images/cc" + mu

ok = skip = fail = 0
for i, (fn, url) in enumerate(sorted(urls.items())):
    path = os.path.join(IMG, fn)
    if os.path.exists(path) and os.path.getsize(path) > 5000:
        skip += 1
        continue
    try:
        open(path, "wb").write(get(url, binary=True))
        ok += 1
        if ok % 100 == 0:
            print(f"이미지 {ok}장 (전체 {len(urls)})", flush=True)
    except Exception as e:
        fail += 1
        if fail < 10:
            print(f"이미지 실패 {fn}: {e}", flush=True)
    time.sleep(0.2)

print(f"이미지: 신규 {ok}, 스킵 {skip}, 실패 {fail} / 고유 {len(urls)}", flush=True)
print("=== 전체 수집 완료", flush=True)
