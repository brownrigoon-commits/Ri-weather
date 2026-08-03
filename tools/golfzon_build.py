# -*- coding: utf-8 -*-
"""골프존 DB → 홀별 공략 등록 (플랜 C)
사용 데이터
  · 사실 정보(저작권 무관): 홀번호 · 파 · 티별 거리 · 티-그린 고도차
  · 홀별 3D 영상: 골프존 CDN 스트리밍 (출처 표기, 지연 로딩)
  · 야디지맵 이미지는 사용하지 않음 → 공식 홈페이지에서 확보한 구장만 이미지 표시

이미 등록된 구장(수작업·홈페이지 파싱)은 건드리지 않는다.
사용: python tools/golfzon_build.py [--limit N] [--write]
"""
import argparse, hashlib, glob, json, os, re, shutil, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from crop_map_only import crop_map
GZ = os.path.join(ROOT, "coursedata", "golfzon")
YARDAGE = os.path.join(GZ, "yardage")
VIDEO_BASE = "https://mediathumbnail.golfzon.com/media/cc/hole3d/"

# 골프존 필드명은 한국 골프장의 티 호칭과 어긋난다.
# 전수 검증(9,054홀 / 1,006코스): backTee 가 champTee 보다 긴 코스 961개,
# 같은 코스 45개, 짧은 코스 0개. 즉 골프존의 backTee 가 실제 최장(챔피언) 티다.
# front/senior/lady 는 순서가 정상이므로 그대로 둔다.
# 목록은 거리 내림차순이 되도록 이 순서로 나열한다.
TEE_LABEL = [("backTee", "챔피언"), ("champTee", "백"),
             ("frontTee", "프론트"), ("seniorTee", "시니어"), ("ladyTee", "레이디")]

def trim_ladder(tees):
    """라벨 순서와 거리 순서가 어긋나면 그 지점부터 잘라낸다. (신뢰 우선 원칙)

    맨 앞 두 티가 뒤집혀 있으면 어느 것이 주 티인지 알 수 없으므로 전부 버린다.
    아래쪽 티만 어긋나면 확실한 앞부분만 남긴다.
    """
    for i in range(len(tees) - 1):
        if tees[i]["m"] < tees[i + 1]["m"]:
            return [] if i == 0 else tees[:i + 1]
    return tees


def norm(s):
    return re.sub(r"(CC|GC|C\.C|G\.C|컨트리클럽|골프클럽|골프장|골프앤리조트|골프리조트|리조트|컨트리|클럽|\s|·|&|\(.*?\))", "", s or "", flags=re.I).lower()

def load_golfdb():
    t = open(os.path.join(ROOT, "js", "golfdb.js"), encoding="utf-8").read()
    db = json.loads(re.search(r"const GOLF_DB = (\[.*\]);", t, re.S).group(1))
    out = {}
    for g in db:
        if g.get("c") == "KR":
            out.setdefault(norm(g["n"]), g["n"])
    # tools/gz_link_kakao.py 가 카카오 주소·POI로 검증해 둔 골프존명 → 앱DB명 매핑
    p = os.path.join(ROOT, "coursedata", "gz_alias.json")
    if os.path.exists(p):
        for gzname, dbname in json.load(open(p, encoding="utf-8")).items():
            out[norm(gzname)] = dbname
    return out

def registered_index():
    """이미 등록된 구장 → (폴더, 지금 담긴 홀 수).

       폴더까지 아는 이유: 갱신할 때 **그 폴더에 덮어써야** 하기 때문이다.
       슬러그를 다시 계산해서 찾으면 안 된다 — 아래 stable_id() 주석 참조."""
    idx = {}
    for f in glob.glob(os.path.join(ROOT, "coursedata", "homepages", "*", "parsed.json")):
        try:
            j = json.load(open(f, encoding="utf-8"))
            n = sum(len(c.get("holes") or []) for c in (j.get("courses") or []))
            idx[norm(j["course"])] = (os.path.dirname(f), n)
        except Exception:
            pass
    return idx


def stable_id(k):
    """구장키 → 늘 같은 짧은 식별자.

       🔴 예전엔 abs(hash(k)) 를 썼다. 파이썬 3 의 문자열 hash 는 **실행마다 값이 달라진다**
          (해시 무작위화). 그래서 조립기를 다시 돌리면 같은 구장이 **다른 폴더**로 또 생긴다.
          지금까지 안 터진 건 '이미 등록된 이름은 건너뛴다' 가 가려 주고 있었을 뿐이다.
          md5 는 어느 실행에서나 같다."""
    return hashlib.md5(k.encode("utf-8")).hexdigest()[:6]

def course_names_from(ccname, n):
    """'자유로 CC - 대한/민국' → ['대한','민국']; 없으면 OUT/IN/A·B·C

    ⚠️ 이 폴백은 **마지막 수단**이다. 같은 JSON 안 holeInfo.courseTypes 에 진짜 코스명이
    들어 있는데도 이 함수만 쓰는 바람에 107구장 1,953홀이 'OUT/IN' 으로 등록됐다
    (2026-08-03 감사: 태인CC 는 LAKE·MOUNTAIN, 마론CC 는 DREAM·VISION 이 실제 이름이다).
    build_club() 은 courseTypes 를 먼저 본다.
    """
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
    # 원본이 알려 주는 진짜 코스명이 있으면 그것을 쓴다(ciNum → courseName)
    ctypes = {c.get("ciNum"): (c.get("courseName") or "").strip()
              for c in (j.get("holeInfo", {}).get("courseTypes") or [])}
    if ctypes:
        real = []
        for idx, nine in enumerate(nines):
            cis = {h.get("ciNum") for h in nine if h.get("ciNum")}
            nm = ctypes.get(list(cis)[0]) if len(cis) == 1 else ""
            real.append(nm or (names[idx] if idx < len(names) else chr(ord("A") + idx)))
        if len(set(real)) == len(real):        # 이름이 겹치면 폴백을 쓴다
            names = real
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
            uniq = trim_ladder(uniq)
            e = {"no": no, "par": par, "_map": os.path.basename(h.get("mapUrl") or "")}
            if uniq:
                e["tees"] = uniq
                e["len"] = uniq[0]["m"]  # 홀 길이는 최장(챔피언) 티 기준
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
    ap.add_argument("--update", action="store_true",
                    help="이미 등록된 구장도 홀이 늘어날 때만 다시 쓴다(기존 폴더에 덮어씀)")
    a = ap.parse_args()
    gdb = load_golfdb()
    done = registered_index()
    files = sorted(glob.glob(os.path.join(GZ, "cc_*.json")))
    # ── 구장별로 **파일을 전부 합친다** ──────────────────────────────
    # 🔴 예전에는 홀 수가 가장 많은 파일 **하나만** 골랐다(total > best[k][0]).
    #    골프존은 27홀 이상 구장을 18홀 조합으로 쪼개 판다 —
    #      리더스CC-HILL_LAKE · 리더스CC-LAKE_PINE · 리더스CC-PINE_HILL
    #    세 파일이 각각 18홀이라 하나만 고르면 27홀 중 18홀만 남았다.
    #    비에이비스타CC 는 54홀인데 18홀만 등록돼 있었다(2026-08-03 감사).
    #    실측: 84구장에서 972홀을 잃고 있었다.
    #
    # 합쳐도 되는지 먼저 확인했다 — 같은 코스명이 여러 파일에 나오지만
    # **홀 번호·파·거리가 완전히 같다.** 다른 것은 video·_map 주소뿐인데
    # 골프존이 18홀 조합마다 영상을 따로 만들어서다(같은 나인의 다른 렌더링).
    # 그래서 코스명을 열쇠로 합치고, 먼저 만난 것의 매체 주소를 쓴다(파일명 순이라 결정적).
    merged = {}          # 구장키 → {club, courses{코스명:코스}, url, best}
    for f in files:
        try:
            r = build_club(f)
        except Exception:
            r = None
        if not r:
            continue
        club, courses, url = r
        k = norm(club)
        m = merged.setdefault(k, {"club": club, "courses": {}, "url": url, "best": 0})
        for c in courses:
            m["courses"].setdefault(c["name"], c)      # 먼저 만난 것을 남긴다
        total = sum(len(c["holes"]) for c in courses)
        if total > m["best"]:                          # 대표 주소는 가장 큰 파일 것으로
            m["best"], m["url"] = total, url

    best = {k: (sum(len(c["holes"]) for c in m["courses"].values()),
                m["club"], list(m["courses"].values()), m["url"])
            for k, m in merged.items()}

    made = skipped = nodb = 0
    grown = []
    for k, (total, club, courses, url) in sorted(best.items(), key=lambda x: -x[1][0]):
        # 🔴 등록 여부는 **앱DB 이름**으로 판정한다. 골프존 이름으로 보면 안 된다.
        #    골프존과 앱DB 는 같은 구장을 다르게 부른다:
        #      테디밸리CC ↔ 테디밸리 골프&리조트 · 청우GC ↔ 알프스대영CC · 한림용인CC ↔ 레이크힐스용인CC
        #    골프존 이름으로만 보면 "새 구장" 으로 착각해 **같은 구장이 두 폴더로 생긴다.**
        #    실측(2026-08-03): 이대로 두면 신규 30곳 중 29곳이 중복 등록될 뻔했다.
        dbname = gdb.get(k)
        if not dbname:
            cand = [v for kk, v in gdb.items() if k and (k in kk or kk in k)]
            dbname = cand[0] if len(cand) == 1 else None
        if not dbname:
            nodb += 1; continue

        # 이미 등록된 구장 — 평소엔 건드리지 않는다(손으로 만든 것도 섞여 있다).
        # --update 일 때만, 그리고 **홀이 실제로 늘어날 때만** 그 폴더에 덮어쓴다.
        outdir = None
        seen = done.get(norm(dbname)) or done.get(k)
        if seen:
            olddir, oldn = seen
            if not (a.update and total > oldn):
                skipped += 1; continue
            outdir = olddir
            grown.append((dbname, oldn, total))
        if a.limit and made >= a.limit:
            break
        # 슬러그: 영문/숫자만 남기고, 한글 구장명은 코드포인트 해시로 고유화
        ascii_part = re.sub(r"[^0-9a-z]", "", norm(club))[:14]
        uniq = stable_id(k)
        slug = os.path.basename(outdir) if outdir else \
               "gz" + (ascii_part + "_" if ascii_part else "") + uniq

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
            dst = outdir or os.path.join(ROOT, "coursedata", "homepages", slug)
            os.makedirs(dst, exist_ok=True)
            json.dump(data, open(os.path.join(dst, "parsed.json"), "w", encoding="utf-8"),
                      ensure_ascii=False, indent=1)
        made += 1
        if made <= 12:
            vids = sum(1 for c in courses for h in c["holes"] if h.get("video"))
            print(f"  {dbname}: {total}홀 ({', '.join(c['name'] for c in courses)}) 영상 {vids}")
    if grown:
        print(f"\n■ 홀이 늘어난 구장 {len(grown)}곳 · {sum(t-o for _,o,t in grown)}홀 추가")
        for club, o, t in sorted(grown, key=lambda x: -(x[2]-x[1]))[:12]:
            print(f"   {club[:24]:26s} {o:3d}홀 → {t:3d}홀")
    print(f"\n새로 만든 구장 {made - len(grown)}곳 / 갱신 {len(grown)}곳 / 기등록 건너뜀 {skipped} / 앱DB 미매칭 {nodb} (전체 {len(best)})")
    if not a.write:
        print("※ --write 를 붙이면 실제 등록합니다.")

if __name__ == "__main__":
    main()
