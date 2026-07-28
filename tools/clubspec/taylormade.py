# -*- coding: utf-8 -*-
"""테일러메이드 스펙 수집 — 접근성 점검 전용.

현재 상태: 수집 불가(차단). 데이터를 만들어 내지 않는다.

  python tools/clubspec/taylormade.py          # 공식 도메인 접근 가능여부 점검 + JSON 기록
  python tools/clubspec/taylormade.py --dry    # 저장 없이 점검만

왜 스크래퍼가 아니라 점검 스크립트인가
  taylormadegolf.com 및 모든 지역 공식 도메인(.co.uk/.eu/.jp/.co.kr/.ca/.com.au)이
  DataDome 봇차단 뒤에 있다. 응답 본문에 geo.captcha-delivery.com iframe 과
  title="DataDome CAPTCHA" 가 그대로 들어온다. requests 도, 셀레늄 헤드리스도
  전부 DDUser-Challenge 로 리다이렉트된다.

  캡차/봇차단을 우회하는 코드는 쓰지 않는다. 따라서 이 파일은 우회 시도 대신
  '차단 상태를 확인해서 기록'만 한다. 차단이 풀리면(또는 공식 스펙 API/PDF 경로가
  확인되면) 그때 callaway.py 와 같은 방식의 파서를 여기에 붙이면 된다.

  robots.txt 는 /on/demandware.store/* 와 /search* 를 Disallow 하고 제품 상세는
  Allow 한다. 즉 정책상 막힌 게 아니라 봇탐지에 막힌 것이다.

저장: coursedata/clubspecs/taylormade.json  (items 는 빈 배열 — 지어낸 값 없음)
"""
import json, os, sys
from datetime import date

import requests

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(ROOT, "coursedata", "clubspecs")
OUT = os.path.join(OUT_DIR, "taylormade.json")

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
S = requests.Session()
S.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9",
                  "Accept": "text/html,application/xhtml+xml,*/*;q=0.8"})

# 점검 대상: 공식 도메인만
TARGETS = [
    "https://www.taylormadegolf.com/drivers/",
    "https://www.taylormadegolf.com/irons/",
    "https://www.taylormadegolf.com/Qi35-Driver/DW-TC370.html?lang=en_US",
    "https://www.taylormadegolf.com/Qi35-LS-Driver/DW-TC366.html?lang=en_US",
    "https://www.taylormadegolf.com/Qi35-Max-Driver/DW-TC375.html?lang=en_US",
    "https://www.taylormadegolf.co.uk/drivers/",
    "https://www.taylormadegolf.eu/drivers/",
    "https://www.taylormadegolf.jp/",
    "https://www.taylormadegolf.co.kr/",
    "https://www.taylormadegolf.ca/drivers/",
    "https://www.taylormadegolf.com.au/drivers/",
]


def check(url):
    """접근 가능여부만 판정. (차단 우회 시도 없음)"""
    try:
        r = S.get(url, timeout=45, allow_redirects=True)
    except Exception as e:
        return {"url": url, "status": None, "blocked": None,
                "reason": f"{type(e).__name__}", "final_url": None}
    body = r.text
    blocked = ("captcha-delivery.com" in body
               or "DataDome" in body
               or "DDUser-Challenge" in r.url)
    return {"url": url, "status": r.status_code, "blocked": blocked,
            "reason": "DataDome CAPTCHA" if blocked else "ok",
            "final_url": r.url, "bytes": len(body),
            "has_table": "<table" in body}


def main():
    dry = "--dry" in sys.argv
    results = [check(u) for u in TARGETS]
    for c in results:
        mark = "차단" if c["blocked"] else ("에러" if c["status"] is None else "열림")
        print(f"  [{mark}] {str(c['status']):>4}  {c['reason']:<18} {c['url']}")

    openable = [c for c in results if c["blocked"] is False and c["has_table"]]
    print(f"\n점검 {len(results)}건 · 스펙표 읽을 수 있는 URL {len(openable)}건")

    rec = {
        "source": "https://www.taylormadegolf.com/",
        "sources": [],
        "fetched": date.today().isoformat(),
        "brand": "TaylorMade",
        "brand_ko": "테일러메이드",
        "category": "head",
        "official_domain": "taylormadegolf.com",
        "blocked": True,
        "blocked_reason": (
            "공식 도메인 전체가 DataDome 봇차단(CAPTCHA) 뒤에 있어 자동수집 불가. "
            "캡차 우회는 하지 않음. 리뷰/쇼핑몰 등 비공식 출처는 원칙상 사용 금지라 "
            "값을 비워 둔다(지어낸 숫자 없음)."
        ),
        "access_check": results,
        "note": "items 가 빈 배열인 것은 '스펙이 없다'가 아니라 '아직 못 읽었다'는 뜻이다.",
        "skipped": [{"url": c["url"], "reason": c["reason"]}
                    for c in results if c["blocked"] is not False],
        "items": [],
    }
    if not dry:
        os.makedirs(OUT_DIR, exist_ok=True)
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump(rec, f, ensure_ascii=False, indent=1)
        print("저장:", OUT)


if __name__ == "__main__":
    main()
