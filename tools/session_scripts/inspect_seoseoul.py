# -*- coding: utf-8 -*-
import json, sys, glob
sys.stdout.reconfigure(encoding="utf-8")
f = glob.glob(r"C:\Users\디자이너\Desktop\claude\Ri-weather\coursedata\golfzon\cc_102949121_*.json")[0]
j = json.load(open(f, encoding="utf-8"))
d = j["detail"]
print("detail keys:", list(d.keys()))
nines = j["holeInfo"]["holeInfoList"]
for i, nine in enumerate(nines):
    h0 = nine[0]
    print(f"--- 코스그룹 {i+1} ciNum={h0['ciNum']} order={h0['courseTypeOrder']} ccMasterSeq={h0['ccMasterSeq']}")
    for h in nine:
        print(f"  {h['holeNo']}번 파{h['basicPar']} 프론트{h['frontTee']}m 백{h['backTee']}m | {h['description'][:45]}")
