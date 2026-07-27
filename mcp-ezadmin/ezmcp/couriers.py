"""택배사 송장 조회 링크 생성 (design/04).

URL은 바뀔 수 있으므로 config.json 의 `courier_urls` 로 덮어쓸 수 있다.
"""

from __future__ import annotations

import re
from urllib.parse import quote

DEFAULT_COURIER_URLS: dict[str, str] = {
    "cj": "https://trace.cjlogistics.com/next/tracking.html?wblNo={t}",
    "대한통운": "https://trace.cjlogistics.com/next/tracking.html?wblNo={t}",
    "한진": (
        "https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do"
        "?mCode=MN038&schLang=KR&wblnumText2={t}"
    ),
    "롯데": "https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo={t}",
    "로젠": "https://www.ilogen.com/web/personal/trace/{t}",
    "우체국": "https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1={t}",
    "epost": "https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1={t}",
    "cu": "https://www.cupost.co.kr/postbox/delivery/localResult.cupost?invoice_no={t}",
    "gs": "https://www.cvsnet.co.kr/invoice/tracking.do?invoice_no={t}",
    "편의점": "https://www.cvsnet.co.kr/invoice/tracking.do?invoice_no={t}",
    "경동": "https://kdexp.com/service/delivery/etc/delivery.do?barcode={t}",
}

_NON_ALNUM = re.compile(r"[^0-9a-zA-Z]")
# 택배사명은 한글을 남겨야 한다 ("롯데택배" → "롯데택배"). 공백·기호만 제거.
_NAME_NOISE = re.compile(r"[^0-9a-zA-Z가-힣ㄱ-ㅎㅏ-ㅣ]")


def tracking_digits(tracking_no) -> str:
    """송장번호에서 조회에 쓸 영숫자만 추출."""
    return _NON_ALNUM.sub("", str(tracking_no or ""))


def tracking_url(courier, tracking_no, overrides: dict | None = None) -> str:
    """택배사명 부분 일치로 조회 URL 생성. 못 찾으면 네이버 검색 링크."""
    number = tracking_digits(tracking_no)
    if not number:
        return ""

    name = str(courier or "").strip()
    key = _NAME_NOISE.sub("", name).lower()

    tables = [(overrides or {}), DEFAULT_COURIER_URLS]
    for table in tables:
        for keyword, template in table.items():
            token = _NAME_NOISE.sub("", str(keyword)).lower()
            if token and token in key:
                return str(template).replace("{t}", number)

    query = quote("%s 송장조회 %s" % (name or "택배", number))
    return "https://search.naver.com/search.naver?query=%s" % query
