# -*- coding: utf-8 -*-
"""GORA 열거 결과 → js/bookingids_jp.js (2026-08-02 신설 · 설계 §6-1)

만드는 것
  const BOOKINGIDS_JP = { "golfdb 원문 구장명": [goraId, "예약캘린더URL"], … };

입력  coursedata/homepages_jp/_scan/gora_courses.json
      [ { "id": 230012, "name": "キャッスルヒルカントリークラブ【アコーディア・ゴルフ】",
          "lat": 34.8649767, "lon": 137.4005425, "cal": "https://gora.golf.rakuten.co.jp/..." }, … ]
      (47현 areaCode 를 훑어 모은 것 — 배포 도메인 브라우저에서 돌린다)

🔴 이 도구의 존재 이유는 **엉뚱한 구장에 예약 링크가 붙는 것을 막는 것**이다.
   빈 카드는 이용자를 실망시키지만, 옆 구장 예약 페이지는 **돈을 잘못 쓰게 만든다.**
   그래서 확신이 없으면 담지 않는다.

매칭 규칙 (2단: 이름이 1차, 좌표는 검산)
  1. 이름   jp_common.NameResolver — 체인 꼬리(【アコーディア・ゴルフ】)를 떼고 3단계 매칭
  2. 좌표   🔴 GORA 좌표는 **일본측지계** 다. WGS84 로 변환한 뒤 golfdb 와 대조.
            변환 없이 대조하면 大箱根CC 가 箱根CC 에 붙는다(8/2 실측).
  3. 둘 다 통과해야 담는다. 한쪽만 맞으면 버린다.

사용: python tools/jp/build_bookingids_jp.py
"""
import json, math, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp_common import HP_JP, ROOT, NameResolver

SRC = os.path.join(HP_JP, "_scan", "gora_courses.json")
OUT = os.path.join(ROOT, "js", "bookingids_jp.js")
# 좌표 검산 임계.
# 🔴 이 검사의 일은 '이름이 **엉뚱한 구장**에 붙은 것' 을 잡는 것이지,
#    좌표가 조금 어긋난 것을 잘라내는 게 아니다. 이름은 NameResolver 가 이미
#    유일하게 확정했고(후보가 둘이면 아예 None 을 준다), 여기는 되짚기다.
#    1.0km 로 뒀더니 이름이 글자까지 똑같은 早来カントリー倶楽部·西武園ゴルフ場 등
#    11곳이 1.1~1.3km 로 잘렸다 — golfdb 는 OSM 좌표(클럽하우스)이고 GORA 는
#    시설 대표점이라 이 정도는 같은 구장에서도 흔하다. 잘못 붙은 구장은 보통 수십 km 다.
MAX_KM = 3.0
WARN_KM = 1.5           # 이보다 멀면 담되 눈에 보이게 적는다


def tokyo_to_wgs84(lat, lon):
    """일본측지계(Tokyo Datum) → WGS84 근사 변환.

    GORA 는 datumType 파라미터가 없고 좌표를 일본측지계로 준다(8/2 실측).
    그대로 쓰면 500~1,000m 어긋나 이름이 비슷한 옆 구장에 붙는다.
    """
    return (lat - lat * 0.00010695 + lon * 0.000017464 + 0.0046017,
            lon - lat * 0.000046038 - lon * 0.000083043 + 0.010040)


def km(a, b, c, d):
    R = 6371.0
    r = math.radians
    h = (math.sin(r(c - a) / 2) ** 2 +
         math.cos(r(a)) * math.cos(r(c)) * math.sin(r(d - b) / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(h))


CHAIN = re.compile(r"【[^】]*】")          # 【アコーディア・ゴルフ】 같은 체인 표시
OLDNAME = re.compile(r"[（(]\s*旧[^）)]*[）)]")   # （旧：大札幌カントリークラブ）
NINE = re.compile(r"[\s　][^\s　]{1,8}コース$")   # 「…　愛別コース」 처럼 뒤에 붙은 코스명


def variants(raw):
    """GORA 이름 → golfdb 와 맞춰 볼 후보들 (넓은 것부터 좁은 것 순)

    🔴 GORA 는 **홀 묶음(코스) 단위로** 등록돼 있고 golfdb 는 **골프장 단위**다.
       '旭川国際カントリークラブ　愛別コース' 는 golfdb 에 '旭川国際カントリークラブ' 로만 있다.
       코스명을 떼지 않으면 이런 곳이 전부 안 붙는다(1차 조립에서 885곳이 그랬다).
       코스명을 뗀 뒤 붙는 것은 **같은 골프장**이므로, 그 골프장의 예약 페이지로 보내면 맞다.
    """
    a = CHAIN.sub("", raw or "").strip()
    out = [a]
    b = OLDNAME.sub("", a).strip()          # 옛 이름 병기 제거
    if b and b != a:
        out.append(b)
    c = NINE.sub("", b).strip()             # 뒤에 붙은 코스명 제거
    if c and c not in out:
        out.append(c)
    return out


def js_str(s):
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"').strip() + '"'


def main():
    if not os.path.exists(SRC):
        print(f"✖ GORA 열거 결과가 없습니다: {SRC}")
        print("   배포 도메인 브라우저에서 47현 areaCode 를 훑어 이 경로에 저장하세요.")
        return 1
    rows = json.load(open(SRC, encoding="utf-8"))
    res = NameResolver()

    db, stat = {}, {"이름못찾음": 0, "좌표어긋남": 0, "중복": 0, "담음": 0}
    far_samples, dup_samples, warn_samples = [], [], []
    for r in rows:
        name = None
        for v in variants(r.get("name")):
            if not v:
                continue
            name, why, lv = res.resolve(v)
            if name:
                break
        if not name:
            stat["이름못찾음"] += 1
            continue
        # 🔴 측지 변환 후 대조 — 이 한 줄이 大箱根/箱根 오매칭을 막는다
        wla, wlo = tokyo_to_wgs84(r["lat"], r["lon"])
        g = res.exact.get(name)
        if g is None:
            stat["이름못찾음"] += 1
            continue
        d = km(wla, wlo, g["lat"], g["lon"])
        if d > MAX_KM:
            stat["좌표어긋남"] += 1
            if len(far_samples) < 5:
                far_samples.append(f"{(r.get('name') or '')[:20]} → {name[:20]} ({d:.1f}km)")
            continue
        if d > WARN_KM:
            stat["멀지만담음"] = stat.get("멀지만담음", 0) + 1
            if len(warn_samples) < 5:
                warn_samples.append(f"{name[:24]} ({d:.1f}km)")
        if name in db:
            stat["중복"] += 1
            if len(dup_samples) < 5:
                dup_samples.append(f"{name[:24]} (id {db[name][0]} vs {r['id']})")
            continue
        db[name] = [int(r["id"]), r.get("cal") or ""]
        stat["담음"] += 1

    with open(OUT, "w", encoding="utf-8", newline="\n") as w:
        w.write("/* 투어리스트 일본 구장 예약 ID — 라쿠텐 GORA\n"
                "   ⚠️ 생성물입니다. 직접 고치지 마세요 — tools/jp/build_bookingids_jp.py 가 다시 씁니다.\n"
                "   [GORA 골프장ID, 예약캘린더 URL(제휴 링크 포함)]\n"
                "   ⚠️ 이름과 좌표가 **둘 다** 맞은 구장만 담았습니다. 확신이 없으면 담지 않습니다 —\n"
                "      옆 구장 예약 페이지가 뜨는 것은 빈 카드보다 나쁩니다. */\n")
        w.write("const BOOKINGIDS_JP = {\n")
        for n in sorted(db):
            w.write(f"  {js_str(n)}: [{db[n][0]}, {js_str(db[n][1])}],\n")
        w.write("};\n")

    kb = os.path.getsize(OUT) // 1024
    print(f"bookingids_jp.js 조립 완료: {stat['담음']}구장 · {kb}KB  (GORA 열거 {len(rows)}곳)")
    if stat["이름못찾음"]:
        print(f"   · golfdb 에서 이름을 못 찾음 {stat['이름못찾음']}곳")
    if stat["좌표어긋남"]:
        print(f"   · 이름은 맞는데 좌표가 {MAX_KM}km 넘게 어긋남 {stat['좌표어긋남']}곳 — 담지 않음")
        for s in far_samples:
            print(f"       {s}")
    if stat.get("멀지만담음"):
        print(f"   · 좌표가 {WARN_KM}~{MAX_KM:g}km 떨어졌지만 이름이 맞아 담음 {stat['멀지만담음']}곳")
        for s2 in warn_samples:
            print(f"       {s2}")
    if stat["중복"]:
        print(f"   · 같은 구장에 GORA ID 가 둘 이상 {stat['중복']}곳 — 먼저 것을 씀")
        for s in dup_samples:
            print(f"       {s}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
