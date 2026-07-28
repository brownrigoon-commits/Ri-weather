# -*- coding: utf-8 -*-
"""골프프라이드 결과 검증: 파싱값이 원문 줄에 실제로 존재하는지 대조."""
import sys, io, re, json, urllib.request, gzip, zlib, html as H
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
URL = "https://golfpride.com/us/en-us/customer-service-hub/grip-advice/grip-specifications.html"

req = urllib.request.Request(URL, headers={"User-Agent": UA, "Accept": "text/html,*/*",
                                           "Accept-Encoding": "gzip, deflate",
                                           "Accept-Language": "en-US,en;q=0.9"})
with urllib.request.urlopen(req, timeout=45) as r:
    b = r.read()
    e = r.headers.get("Content-Encoding", "")
    if "gzip" in e:
        b = gzip.decompress(b)
    elif "deflate" in e:
        b = zlib.decompress(b, -zlib.MAX_WBITS)
    doc = b.decode("utf-8", "replace")

u = doc.replace("\\n", "\n").replace("\\u003c", "<").replace("\\u003e", ">")


def clean(s):
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", H.unescape(s).replace("\xa0", " ")).strip()


raw_lines = {clean(p) for p in re.findall(r"<p>(.*?)</p>", u, re.S)}

j = json.load(open(r"C:/Users/PC/Desktop/Ri-weather/coursedata/clubspecs/golfpride_grip.json",
                   encoding="utf-8"))
items = j["items"]
print(f"원문 <p> 고유줄={len(raw_lines)}  파싱항목={len(items)}\n")

bad = 0
for it in items:
    # 원문에 model/size/core/weight_raw 가 모두 들어간 줄이 있는지
    ok = any(all(x and x in ln for x in (it["model"], it["size"], it["core"], it["weight_raw"]))
             for ln in raw_lines)
    if not ok:
        bad += 1
        print(f"  [대조실패] {it['model']} | {it['size']} | {it['core']} | {it['weight_raw']}")
print(f"\n원문 대조 실패 = {bad} / {len(items)}")

print("\n=== 모델별 사이즈/코어/무게 ===")
by = {}
for it in items:
    by.setdefault(it["model"], []).append(it)
for m in sorted(by):
    print(f"\n[{m}]  ({by[m][0]['grip_type']}, match={by[m][0]['match_level']})")
    for it in by[m]:
        w = f"{it['weight_g']}g" if it["weight_g"] is not None else f"null({it['weight_raw']})"
        print(f"    {it['size']:<12} core={it['core']:<18} {w:<14} {it['color_note'] or ''}")
