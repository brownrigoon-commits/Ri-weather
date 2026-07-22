# -*- coding: utf-8 -*-
"""골프존 DB → 홀별 공략 등록 (플랜 C)
사용 데이터
  · 사실 정보(저작권 무관): 홀번호 · 파 · 티별 거리 · 티-그린 고도차
  · 홀별 3D 영상: 골프존 CDN 스트리밍 (출처 표기, 지연 로딩)
  · 야디지맵 이미지는 사용하지 않음 → 공식 홈페이지에서 확보한 구장만 이미지 표시

이미 등록된 구장(수작업·홈페이지 파싱)은 건드리지 않는다.
사용: python tools/golfzon_build.py [--limit N] [--write]
"""
import argparse, glob, json, os, re, shutil, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from crop_map_only import crop_map
GZ = os.path.join(ROOT, "coursedata", "golfzon")
YARDAGE = os.path.join(GZ, "yardage")
VIDEO_BASE = "https://mediathumbnail.golfzon.com/media/cc/hole3d/"

TEE_LABEL = [("champTee", "챔피언"), ("backTee", "백"), ("regularTee", "레귤러"),
             ("frontTee", "프론트"), ("seniorTee", "시니어"), ("ladyTee", "레이디")]

def norm(s):
    return re.sub(r"(CC|GC|C\.C|G\.C|컨트리클럽|골프클럽|골프장|골프앤리조트|골프리조트|리조트|컨트리|클럽|\s|·|&|\(.*?\))", "", s or "", flags=re.I).lower()

def load_golfdb():
    t = open(os.path.join(ROOT, "js", "golfdb.js"), encoding="utf-8").read()
    db = json.loads(re.search(r"const GOLF_DB = (\[.*\]);", t, re.S).group(1))
    out = {}
    for g in db:
        if g.get("c") == "KR":
            out.setdefault(norm(g["n"]), g["n"])
    return out

def registered_names():
    s = set()
    for f in glob.glob(os.path.join(ROOT, "coursedata", "homepages", "*", "parsed.json")):
        try:
            s.add(norm(json.load(open(f, encoding="utf-8"))["course"]))
        except Exception:
            pass
    return s

def course_names_from(ccname, n):
    """'자유로 CC - 대한/민국' → ['대한','민국']; 없으면 OUT/IN/A·B·C"""
    if " - " in ccname:
        part = ccname.split(" - ", 1)[1]
        names = [x.strip() for x in re.split(r"[/·]", part) if x.strip()]
        if len(names) == n:
            return names
    if n == 1:
        return ["OUT"]
    if n == 2:
        return ["OUT", "IN"]
    return [chr(ord("A") + i) for i in range(n)]

def build_club(f):
    j = json.load(open(f, encoding="utf-8"))
    d = j.get("detail", {})
    if d.get("country") != 1:
        return None
    club = (j.get("ccName") or "").split(" - ")[0].strip()
    nines = j.get("holeInfo", {}).get("holeInfoList", [])
    if not nines:
        return None
    names = course_names_from(j.get("ccName", ""), len(nines))
    courses = []
    for idx, nine in enumerate(nines):
        holes = []
        for h in sorted(nine, key=lambda x: x.get("holeNo") or 0):
            no, par = h.get("holeNo"), h.get("basicPar")
            if not no or par not in (3, 4, 5, 6):
                return None
            tees = []
            for key, label in TEE_LABEL:
                v = h.get(key)
                if isinstance(v, int) and 60 <= v <= 700:
                    tees.append({"name": label, "m": v})
            # 중복 거리 제거(같은 값이 여러 티에 들어간 경우 앞쪽만)
            seen, uniq = set(), []
            for t in tees:
                if t["m"] not in seen:
                    seen.add(t["m"]); uniq.append(t)
            e = {"no": no, "par": par, "_map": os.path.basename(h.get("mapUrl") or "")}
            if uniq:
                e["tees"] = uniq
                e["len"] = uniq[0]["m"]
            hb = h.get("heightBackTee")
            if isinstance(hb, (int, float)) and abs(hb) >= 3:
                e["elev"] = round(hb)
            v = (h.get("videoMapUrl") or "").strip()
            if v:
                e["video"] = VIDEO_BASE + v + ".mp4"
            holes.append(e)
        if len(holes) != 9:
            return None
        s = sum(x["par"] for x in holes)
        if not (33 <= s <= 39) and holes.count == 0:
            return None
        courses.append({"name": names[idx] if idx < len(names) else chr(ord("A") + idx),
                        "holes": holes})
    return club, courses, d.get("homepageUrl") or ""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--write", action="store_true")
    a = ap.parse_args()
    gdb = load_golfdb()
    done = registered_names()
    files = sorted(glob.glob(os.path.join(GZ, "cc_*.json")))
    best = {}                     # 구장명 → (홀수, courses, url)
    for f in files:
        try:
            r = build_club(f)
        except Exception:
            r = None
        if not r:
            continue
        club, courses, url = r
        k = norm(club)
        total = sum(len(c["holes"]) for c in courses)
        if k not in best or total > best[k][0]:
            best[k] = (total, club, courses, url)

    made = skipped = nodb = 0
    for k, (total, club, courses, url) in sorted(best.items(), key=lambda x: -x[1][0]):
        if k in done:
            skipped += 1; continue
        dbname = gdb.get(k)
        if not dbname:
            cand = [v for kk, v in gdb.items() if k and (k in kk or kk in k)]
            dbname = cand[0] if len(cand) == 1 else None
        if not dbname:
            nodb += 1; continue
        if a.limit and made >= a.limit:
            break
        # 슬러그: 영문/숫자만 남기고, 한글 구장명은 코드포인트 해시로 고유화
        ascii_part = re.sub(r"[^0-9a-z]", "", norm(club))[:14]
        uniq = format(abs(hash(k)) % 0xFFFFFF, "x")
        slug = "gz" + (ascii_part + "_" if ascii_part else "") + uniq

        # 홀맵 이미지: 야디지맵을 서서울 규격으로 표준화해 배치
        imgdir = os.path.join(ROOT, "holeimg", slug)
        if a.write:
            os.makedirs(imgdir, exist_ok=True)
        missing_img = 0
        for ci, c in enumerate(courses):
            cslug = f"{ci+1}{re.sub(r'[^0-9A-Za-z가-힣]', '', c['name']).lower() or 'c'}"
            for h in c["holes"]:
                src = os.path.join(YARDAGE, h.pop("_map", "") or "")
                if not os.path.exists(src):
                    missing_img += 1
                    continue
                rel = f"holeimg/{slug}/{cslug}{h['no']}.jpg"
                if a.write:
                    try:
                        crop_map(src, os.path.join(ROOT, rel), 0, keep="all")
                    except Exception:
                        shutil.copy2(src, os.path.join(ROOT, rel))
                h["img"] = rel
        if missing_img:
            print(f"    ⚠ {dbname}: 홀맵 {missing_img}개 없음")

        data = {"course": dbname,
                "source": "골프존 코스 데이터 (홀맵·파·거리·고도차·홀 영상)",
                "sourceUrl": url or "https://www.golfzon.com/course/main",
                "courses": courses}
        if a.write:
            dst = os.path.join(ROOT, "coursedata", "homepages", slug)
            os.makedirs(dst, exist_ok=True)
            json.dump(data, open(os.path.join(dst, "parsed.json"), "w", encoding="utf-8"),
                      ensure_ascii=False, indent=1)
        made += 1
        if made <= 12:
            vids = sum(1 for c in courses for h in c["holes"] if h.get("video"))
            print(f"  {dbname}: {total}홀 ({', '.join(c['name'] for c in courses)}) 영상 {vids}")
    print(f"\n생성 {made}곳 / 기등록 건너뜀 {skipped} / 앱DB 미매칭 {nodb} (전체 {len(best)})")
    if not a.write:
        print("※ --write 를 붙이면 실제 등록합니다.")

if __name__ == "__main__":
    main()
