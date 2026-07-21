# -*- coding: utf-8 -*-
"""몽베르 courseOut/courseIn.html 파싱 → parsed.json + 야디지 이미지 복사"""
import json, os, re, shutil, sys
sys.stdout.reconfigure(encoding="utf-8")
SRC = r"C:\Users\디자이너\Desktop\claude\Ri-weather\coursedata\homepages\montvert"
IMG = r"C:\Users\디자이너\Desktop\claude\Ri-weather\holeimg\montvert"
os.makedirs(IMG, exist_ok=True)

def parse(page, prefix):
    html = open(os.path.join(SRC, page), encoding="utf-8", errors="ignore").read()
    holes = []
    blocks = re.split(r'class="holeInfo', html)[1:]
    for b in blocks:
        no = re.search(r'<div class="number">(\d+)</div>', b)
        par = re.search(r'par <span>(\d+)</span>', b)
        hdcp = re.search(r'hdcp <span>(\d+)</span>', b)
        length = re.search(r'<div class="length">(\d+)[mM]</div>', b)
        imgm = re.search(rf'({prefix}-(\d+)-0\.png)', b)
        tip = re.search(r'<p>((?:(?!</p>).)*?)</p>\s*</div>\s*</div>\s*<!--', b, re.S)
        if not tip:
            tips = re.findall(r'<p>(.*?)</p>', b, re.S)
            tips = [t for t in tips if len(re.sub(r"<[^>]+>", "", t).strip()) > 25]
            tiptext = tips[-1] if tips else ""
        else:
            tiptext = tip.group(1)
        tiptext = re.sub(r"<br\s*/?>", " ", tiptext)
        tiptext = re.sub(r"<[^>]+>", "", tiptext).strip()
        tiptext = re.sub(r"\s+", " ", tiptext)
        if no and imgm:
            fn = imgm.group(1)
            shutil.copy(os.path.join(SRC, fn), os.path.join(IMG, fn))
            holes.append({"no": int(no.group(1)), "par": int(par.group(1)) if par else None,
                          "hdcp": int(hdcp.group(1)) if hdcp else None,
                          "len": int(length.group(1)) if length else None,
                          "img": f"holeimg/montvert/{fn}", "tip": tiptext})
    return holes

out_holes = parse("courseOut.html", "course_out")
in_holes = parse("courseIn.html", "course_in")
data = {
    "course": "몽베르CC",
    "source": "몽베르CC 공식 홈페이지",
    "sourceUrl": "https://montvertcc.com/public/swp/courseData",
    "courses": [
        {"name": "망무봉 OUT", "holes": out_holes},
        {"name": "망무봉 IN", "holes": in_holes},
    ],
}
json.dump(data, open(os.path.join(SRC, "parsed.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for c in data["courses"]:
    print(c["name"], len(c["holes"]), "홀, 파합계", sum(h["par"] or 0 for h in c["holes"]))
    for h in c["holes"][:2]:
        print(" ", h["no"], f'파{h["par"]} {h["len"]}m hdcp{h["hdcp"]} | {h["tip"][:40]}')
