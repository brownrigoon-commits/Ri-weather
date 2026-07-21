# -*- coding: utf-8 -*-
"""서서울CC 공식 데이터 기반 홀 재구성
- 위성 px 라인 + 골프존 공식 파/거리(프론트티) → 티 지점을 공식 거리에 맞게 연장/축소
- 공략 팁은 골프존 설명을 참고해 재작성한 문구
출력: seoseoul.holes.json (기존 덮어씀)
"""
import json, math, os, sys
sys.stdout.reconfigure(encoding="utf-8")
base = os.path.dirname(os.path.abspath(__file__))
meta = json.load(open(os.path.join(base, "seoseoul.meta.json")))
Z, tx0, ty0 = meta["z"], meta["tx0"], meta["ty0"]

def px2ll(x, y):
    tx = tx0 + x / 256; ty = ty0 + y / 256
    lon = tx / 2**Z * 360 - 180
    n = math.pi - 2 * math.pi * ty / 2**Z
    lat = math.degrees(math.atan(math.sinh(n)))
    return [round(lat, 6), round(lon, 6)]

def dist(a, b):
    R = 6371000
    la1, lo1, la2, lo2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    x = math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
    return 2 * R * math.asin(math.sqrt(x))

def line_len(line):
    return sum(dist(line[i], line[i+1]) for i in range(len(line)-1))

def fit_to_len(pxline, target):
    """티(첫 점)를 첫 세그먼트 방향으로 연장/축소해 전체 길이를 target에 맞춤"""
    ll = [px2ll(x, y) for x, y in pxline]
    cur = line_len(ll)
    diff = target - cur  # 양수면 티를 뒤로 연장
    (x0, y0), (x1, y1) = pxline[0], pxline[1]
    seg = math.hypot(x1-x0, y1-y0)
    seg_m = dist(px2ll(x0, y0), px2ll(x1, y1))
    scale = diff / seg_m
    nx, ny = x0 - (x1-x0)*scale, y0 - (y1-y0)*scale
    newline = [[nx, ny]] + [list(p) for p in pxline[1:]]
    ll2 = [px2ll(x, y) for x, y in newline]
    return ll2, round(line_len(ll2))

# name, ref, par, official_len(frontTee m), pxline, tip(재작성)
HOLES = [
 ("힐",1,4,326,[[1708,1758],[1730,1600],[1742,1470]],"티샷 조준은 우측 기준이 정석입니다. 세컨샷은 경사 라이가 자주 나옵니다."),
 ("힐",2,5,436,[[1788,1565],[1780,1350],[1768,1162]],"기본은 좌측 잔디벙커 방향, 거리가 자신 있으면 우측 지름길도 열려 있습니다."),
 ("힐",3,4,386,[[1828,1208],[1855,1420],[1885,1640]],"센터 공략이 기본, 장타자는 좌측 카트길 라인까지 사용할 수 있습니다."),
 ("힐",4,3,150,[[1930,1685],[1978,1562]],"중앙 벙커 방향으로 티샷하세요. 우측 그린일 땐 한 클럽 길게."),
 ("힐",5,4,353,[[2000,1555],[2085,1650],[2135,1758]],"중앙 기준으로 공략하고, 비거리가 좋으면 우측 지름길도 가능합니다."),
 ("힐",6,5,435,[[1958,1712],[2025,1860],[2040,2010],[1965,2110]],"좌측 카트길 방향이 기본 라인, 장타자는 좌측 나무 방향까지."),
 ("힐",7,4,316,[[2115,2095],[2140,1930],[2150,1800]],"그린 직접 공략이 가능하고, 좌측 카트길 라인도 안전합니다."),
 ("힐",8,3,167,[[2112,2242],[2090,2065]],"연못을 넘기는 파3. 좌그린은 왼쪽 언덕을 이용하고, 우그린은 두 그린 사이를 보세요."),
 ("힐",9,4,319,[[1905,2210],[1800,2010],[1745,1928]],"클럽하우스 방향이 조준 기준선입니다."),
 ("레이크",1,4,367,[[1650,1740],[1450,1728],[1290,1748]],"IP 벙커 우측이 조준선입니다. 티샷 OB만 피하면 무난한 홀."),
 ("레이크",2,5,440,[[1280,1795],[1265,1990],[1295,2110],[1310,2160]],"티샷·세컨 모두 우측 OB가 위험합니다. 우측만 피하면 무난합니다."),
 ("레이크",3,4,339,[[1330,2270],[1630,2225]],"IP 지점 이후 내리막 — 티샷 230m 이상이면 그린 공략이 쉬워집니다. 좌측 OB 주의."),
 ("레이크",4,3,159,[[1516,1468],[1452,1374]],"맞바람이 자주 부는 파3입니다. 우측 OB 주의, 한 클럽 여유 있게."),
 ("레이크",5,4,287,[[1680,2215],[1955,2150]],"그린 앞 개울이 있습니다. 부담되면 끊어가는 3온 작전이 안전합니다."),
 ("레이크",6,5,441,[[1725,1888],[1450,1985],[1310,2060]],"우측 카트길 방향으로 공략하세요. 2온 욕심은 OB로 이어지기 쉽습니다."),
 ("레이크",7,4,238,[[1590,1625],[1470,1655],[1372,1618]],"그린 직접 공략은 위험 — 끊어가는 2온 작전이 정석입니다."),
 ("레이크",8,3,131,[[1428,1572],[1572,1568]],"큰 워터해저드를 넘기는 파3. 부담만 이기면 온그린은 어렵지 않습니다."),
 ("레이크",9,4,302,[[1620,1470],[1680,1620],[1700,1760]],"페어웨이를 지키는 것이 최우선인 홀입니다."),
]

out = []
for name, ref, par, olen, pxline, tip in HOLES:
    line, fitted = fit_to_len(pxline, olen)
    out.append({"ref": str(ref), "name": name, "par": par, "len": olen, "line": line, "tip": tip})
    print(f"{name}{ref}: 파{par} 공식{olen}m (라인 {fitted}m)")

json.dump({"course": "서서울CC", "holes": out},
          open(os.path.join(base, "seoseoul.holes.json"), "w", encoding="utf-8"), ensure_ascii=False)
print(f"{len(out)}홀 저장")
