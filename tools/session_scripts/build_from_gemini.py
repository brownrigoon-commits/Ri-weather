# -*- coding: utf-8 -*-
"""Gemini가 찾은 홀 라인(seoseoul_gemini.json) + 공식 파/거리/팁 → seoseoul.holes.json
Gemini 라인이 없거나 신뢰도가 낮으면 기존 수동 라인 유지.
"""
import json, math, os, sys, importlib.util
sys.stdout.reconfigure(encoding="utf-8")
base = os.path.dirname(os.path.abspath(__file__))

spec = importlib.util.spec_from_file_location("bs", os.path.join(base, "build_seoseoul.py"))
bs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bs)          # 기존 HOLES(수동 라인+공식 데이터+팁) + fit_to_len 재사용

gem = {(g["name"], g["ref"]): g for g in json.load(open(os.path.join(base, "seoseoul_gemini.json"), encoding="utf-8"))}

out = []
for name, ref, par, olen, pxline, tip in bs.HOLES:
    g = gem.get((name, ref))
    src = "수동"
    if g and g.get("line") and len(g["line"]) >= 2 and (g.get("conf2") or 0) >= 0.5:
        pxline = g["line"]
        src = f"Gemini(conf {g.get('conf2')})"
    line, fitted = bs.fit_to_len(pxline, olen)
    out.append({"ref": str(ref), "name": name, "par": par, "len": olen, "line": line, "tip": tip})
    print(f"{name}{ref}: {src} → 파{par} {olen}m (라인 {fitted}m)")

json.dump({"course": "서서울CC", "holes": out},
          open(os.path.join(base, "seoseoul.holes.json"), "w", encoding="utf-8"), ensure_ascii=False)
print(f"{len(out)}홀 저장")
