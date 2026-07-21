# -*- coding: utf-8 -*-
import json, io, re
BASE = r"C:\Users\디자이너\AppData\Local\Temp\claude\C--Users------Desktop---AI\4560011b-9c43-4f94-9eec-f28d556e2d5a\scratchpad\\"
MOJIBAKE = re.compile(r"[ÃÂãâäåæçèéêëìíîïðñòóôõöø]")

def fix(s):
    for _ in range(3):
        if not MOJIBAKE.search(s): break
        try: t = s.encode("latin-1").decode("utf-8")
        except: break
        if t == s: break
        s = t
    return s

# 최종 파일에서 깨진 항목 찾기
db = io.open(r"C:\Users\디자이너\Desktop\claude\Ri-weather\js\golfdb.js", encoding="utf-8").read()
names = re.findall(r'"n":"(.*?)"', db)
bad = [n for n in names if MOJIBAKE.search(n)]
out = ["FILE bad count=%d" % len(bad)]
for n in bad:
    # 원본 raw에서 대응 찾기 시도: 여러 번 인코딩
    tries = [n]
    cur = n
    for _ in range(4):
        try:
            cur = cur.encode("latin-1").decode("utf-8")
            tries.append(cur)
        except Exception as e:
            tries.append("ERR:" + str(e))
            break
    out.append("  %r -> %s" % (n, " | ".join(repr(t) for t in tries[1:])))
io.open(BASE + "trace_out.txt", "w", encoding="utf-8").write("\n".join(out))
print("done")
