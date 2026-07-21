# -*- coding: utf-8 -*-
import json, io

def fix(s):
    try: return s.encode("latin-1").decode("utf-8")
    except: return s

for cc, path in [("JP", "golf_jp.json"), ("CN", "golf_cn.json")]:
    full = r"C:\Users\디자이너\AppData\Local\Temp\claude\C--Users------Desktop---AI\4560011b-9c43-4f94-9eec-f28d556e2d5a\scratchpad\\" + path
    data = json.load(io.open(full, encoding="utf-8-sig"))
    named = [e for e in data["elements"] if (e.get("tags") or {}).get("name")]
    out = [cc + " named=" + str(len(named))]
    for e in named[:6]:
        t = e["tags"]
        raw = t["name"]
        out.append("  raw=%r | fixed=%r | en=%r" % (raw, fix(raw), t.get("name:en")))
    io.open(r"C:\Users\디자이너\AppData\Local\Temp\claude\C--Users------Desktop---AI\4560011b-9c43-4f94-9eec-f28d556e2d5a\scratchpad\intl_%s.txt" % cc, "w", encoding="utf-8").write("\n".join(out))
print("done")
