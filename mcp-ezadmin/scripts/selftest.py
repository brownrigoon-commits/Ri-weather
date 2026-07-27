"""도구 로직 전수 검증 (design/08).

MCP 없이 service 함수를 직접 호출한다. 샘플 데이터가 없으면 먼저 만든다.
전부 PASS 해야 하며, 하나라도 실패하면 종료코드 1.

사용법:
    python scripts/selftest.py
    python scripts/selftest.py --source api   # 소스 모드를 바꿔 검증 (P1.5)
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

RESULTS: list[tuple[bool, str, str]] = []


def check(name: str, ok: bool, detail: str = "") -> bool:
    RESULTS.append((bool(ok), name, detail))
    return bool(ok)


def _reload_service():
    """환경변수를 바꾼 뒤 설정을 다시 읽는다."""
    from ezmcp import config

    config.reset_cache()
    from ezmcp import service

    return service


def ensure_sample_data(service) -> None:
    status = service.data_status()
    orders = status.get("데이터", {}).get("주문", {})
    if orders.get("파일수"):
        return
    print("샘플 데이터가 없어 먼저 생성합니다...")
    import make_sample_data

    make_sample_data.main()
    from ezmcp.sources import excel_source

    excel_source.clear_cache()


# ---------------------------------------------------------------------------
# 검증 항목
# ---------------------------------------------------------------------------


def test_data_status(service) -> dict:
    status = service.data_status()
    data = status.get("데이터", {})

    check("data_status: 주문 파일 인식", data.get("주문", {}).get("파일수", 0) >= 2,
          str(data.get("주문")))
    check("data_status: 주문 행수 > 0", data.get("주문", {}).get("행수", 0) > 0)
    check("data_status: 재고 파일 인식", data.get("재고", {}).get("파일수", 0) >= 1)
    check("data_status: 반품 파일 인식", data.get("반품", {}).get("파일수", 0) >= 1)
    check(
        "data_status: 미매핑 상태값 노출(발주대기)",
        any("발주대기" in s for s in status.get("기타상태값", [])),
        str(status.get("기타상태값")),
    )
    check("data_status: 브랜드 목록", len(status.get("브랜드", [])) >= 2)
    check("data_status: meta 데이터기준 존재", bool(status.get("meta", {}).get("데이터기준")))
    return status


def test_inventory(service, cfg) -> None:
    result = service.inventory_lookup(brand="루미네", limit=100)
    rows = result.get("목록", [])
    check("재고: 브랜드 조회 결과 있음", len(rows) > 0)
    check(
        "재고: 브랜드 필터 정확성(전 행 루미네)",
        all(r.get("브랜드") == "루미네" for r in rows),
        str({r.get("브랜드") for r in rows}),
    )
    check(
        "재고: 합계 품목수 = 총건수",
        result.get("합계", {}).get("품목수") == result.get("총건수"),
    )
    check(
        "재고: 합계 현재고 정합",
        result.get("합계", {}).get("현재고") == sum(r.get("현재고", 0) for r in rows),
    )
    check("재고: 위치 값 존재", all(r.get("위치") for r in rows), "빈 위치 있음")

    low = service.inventory_lookup(low_stock_only=True, limit=100)
    low_rows = low.get("목록", [])
    check("재고: 재고부족 3건 이상", len(low_rows) >= 3, "%d건" % len(low_rows))
    check(
        "재고: 재고부족 판정 일관성",
        all(r.get("재고부족") is True for r in low_rows),
    )

    query = service.inventory_lookup(query="LM-", limit=100)
    q_rows = query.get("목록", [])
    check("재고: SKU 부분검색", len(q_rows) > 0)
    check(
        "재고: SKU 검색 결과 정확성",
        all("LM-" in r.get("상품코드", "") for r in q_rows),
    )

    unknown = service.inventory_lookup(brand="없는브랜드")
    check(
        "재고: 미등록 브랜드는 오류가 아닌 안내",
        "안내" in unknown and "등록되지 않은" in unknown["안내"],
        str(unknown.get("안내"))[:60],
    )


def test_orders(service, status) -> None:
    listed = service.order_lookup(period="최근7일", limit=100)
    rows = listed.get("목록", [])
    total = listed.get("집계", {}).get("총건수", 0)
    check("주문: 최근7일 조회 결과 있음", len(rows) > 0)
    check("주문: 집계 총건수 = 표시 건수(limit 100)", total == len(rows), "%s vs %s" % (total, len(rows)))
    check(
        "주문: 집계 총수량 정합",
        listed.get("집계", {}).get("총수량") == sum(r.get("수량", 0) for r in rows),
    )
    check("주문: 상태별 집계 존재", bool(listed.get("집계", {}).get("상태별")))

    check(
        "주문: 수취인 마스킹",
        all("*" in r.get("수취인", "") for r in rows if r.get("수취인")),
        str([r.get("수취인") for r in rows[:3]]),
    )

    # 병합·중복제거: xlsx 60행 + csv 10행 - 중복 3행 = 67행
    check(
        "주문: 엑셀+CSV 병합 및 중복제거(67행)",
        status.get("데이터", {}).get("주문", {}).get("행수") == 67,
        "행수=%s" % status.get("데이터", {}).get("주문", {}).get("행수"),
    )

    # 단건 상세
    target = rows[0].get("주문번호") if rows else ""
    detail = service.order_lookup(order_no=target)
    check("주문: 단건 상세 조회", detail.get("주문번호") == target, str(detail.get("안내", ""))[:60])
    check("주문: 상세에 품목 목록", len(detail.get("품목", [])) >= 1)
    check(
        "주문: 상세 연락처 마스킹",
        "*" in str(detail.get("연락처", "")) if detail.get("연락처") else True,
        str(detail.get("연락처")),
    )
    check(
        "주문: 상세 주소 마스킹",
        str(detail.get("주소", "")).endswith("***") if detail.get("주소") else True,
        str(detail.get("주소")),
    )
    check(
        "주문: 미매핑 PII 컬럼(배송메시지) 마스킹",
        all(
            v == "(마스킹됨)"
            for k, v in (detail.get("기타정보") or {}).items()
            if "배송메시지" in k
        ),
        str(detail.get("기타정보")),
    )

    missing = service.order_lookup(order_no="존재하지-않는-주문")
    check(
        "주문: 없는 주문번호는 한국어 안내",
        "안내" in missing and "찾지 못했습니다" in missing["안내"],
        str(missing.get("안내"))[:60],
    )

    # 기간 경계
    today = service.order_lookup(period="오늘", limit=100)
    nos = {r.get("주문번호") for r in today.get("목록", [])}
    check("기간: 오늘 00:00 주문 포함", "BOUNDARY-TODAY-0000" in nos)
    check("기간: 어제 23:59 주문 미포함", "BOUNDARY-YDAY-2359" not in nos)

    yesterday = service.order_lookup(period="어제", limit=100)
    y_nos = {r.get("주문번호") for r in yesterday.get("목록", [])}
    check("기간: 어제 조회에는 어제 23:59 포함", "BOUNDARY-YDAY-2359" in y_nos)


def test_unshipped(service) -> None:
    from ezmcp.config import get_config
    from ezmcp.sources import router

    raw = router.fetch(get_config(), "orders")
    tracking_by_order: dict[str, str] = {}
    bucket_by_order: dict[str, str] = {}
    for rec in raw.records:
        no = str(rec.get("order_no") or "")
        tracking_by_order.setdefault(no, str(rec.get("tracking_no") or ""))
        bucket_by_order.setdefault(no, str(rec.get("bucket") or ""))

    result = service.unshipped_list(limit=100)
    rows = result.get("목록", [])
    check("미출고: 결과 있음", len(rows) > 0, "%d건" % len(rows))
    check(
        "미출고: 전 행 송장번호 없음",
        all(not tracking_by_order.get(r.get("주문번호", ""), "") for r in rows),
    )
    check(
        "미출고: 제외 버킷(배송중/완료/취소/반품/교환) 없음",
        all(
            bucket_by_order.get(r.get("주문번호", ""), "")
            not in ("배송중", "배송완료", "취소", "반품", "교환")
            for r in rows
        ),
    )
    elapsed = [r.get("경과일") for r in rows if isinstance(r.get("경과일"), int)]
    check("미출고: 오래된 순 정렬", elapsed == sorted(elapsed, reverse=True), str(elapsed[:6]))
    check(
        "미출고: 경과일 2일 이상은 지연 표시",
        all(r.get("지연") is True for r in rows if isinstance(r.get("경과일"), int) and r["경과일"] >= 2),
    )
    check("미출고: 지연건수 집계", result.get("집계", {}).get("지연건수", 0) >= 3,
          str(result.get("집계")))
    check("미출고: 기본 기간은 전체", "전체" in str(result.get("조회조건", {}).get("조회기간")))


def test_shipping(service) -> None:
    out = service.shipping_lookup(direction="출고", period="최근7일", limit=100)
    rows = out.get("목록", [])
    check("배송: 출고 조회 결과 있음", len(rows) > 0, str(out.get("안내", ""))[:60])
    check("배송: 출고 전 행 송장 있음", all(r.get("송장번호") for r in rows))
    check("배송: 출고 전 행 조회링크 있음", all(r.get("조회링크") for r in rows))

    domain_map = {
        "CJ대한통운": "cjlogistics.com",
        "한진택배": "hanjin.com",
        "롯데택배": "lotteglogis.com",
    }
    link_ok = True
    bad = ""
    for row in rows:
        expected = domain_map.get(row.get("택배사", ""))
        if expected and expected not in row.get("조회링크", ""):
            link_ok = False
            bad = "%s → %s" % (row.get("택배사"), row.get("조회링크"))
            break
    check("배송: 택배사별 조회링크 도메인 정확", link_ok, bad)

    ret = service.shipping_lookup(direction="반품", period="최근7일", limit=100)
    ret_rows = ret.get("목록", [])
    check("배송: 반품 조회 결과 있음", len(ret_rows) > 0, str(ret.get("안내", ""))[:60])
    check(
        "배송: 반품에 수거송장 행 포함",
        any(r.get("구분") == "반품수거" and r.get("송장번호") for r in ret_rows),
        str([(r.get("구분"), r.get("송장번호")) for r in ret_rows[:4]]),
    )

    target = rows[0].get("송장번호") if rows else ""
    single = service.shipping_lookup(tracking_no=target)
    single_rows = single.get("목록", [])
    check(
        "배송: 송장번호 단건 검색",
        len(single_rows) >= 1 and single_rows[0].get("송장번호") == target,
        str(single.get("안내", ""))[:60],
    )

    order_no = rows[0].get("주문번호") if rows else ""
    by_order = service.shipping_lookup(order_no=order_no)
    check("배송: 주문번호 단건 검색", len(by_order.get("목록", [])) >= 1)


def test_pii_modes() -> None:
    original = os.environ.get("EZMCP_PII_MODE", "")

    os.environ["EZMCP_PII_MODE"] = "summary"
    service = _reload_service()
    rows = service.order_lookup(period="최근7일", limit=20).get("목록", [])
    check("개인정보: summary 모드는 수취인 키 제거", all("수취인" not in r for r in rows))
    detail_no = rows[0].get("주문번호") if rows else ""
    detail = service.order_lookup(order_no=detail_no)
    check(
        "개인정보: summary 모드는 연락처·주소 제거",
        "연락처" not in detail and "주소" not in detail,
    )

    os.environ["EZMCP_PII_MODE"] = "full"
    service = _reload_service()
    rows = service.order_lookup(period="최근7일", limit=20).get("목록", [])
    check(
        "개인정보: full 모드는 원본 표시",
        any(r.get("수취인") and "*" not in r["수취인"] for r in rows),
        str([r.get("수취인") for r in rows[:3]]),
    )

    if original:
        os.environ["EZMCP_PII_MODE"] = original
    else:
        os.environ.pop("EZMCP_PII_MODE", None)
    service = _reload_service()
    check("개인정보: 기본값 masked 복귀", service.get_config().pii_mode == "masked")


def test_masking_rules() -> None:
    from ezmcp.masking import mask_address, mask_email, mask_name, mask_phone

    check("마스킹: 홍길동 → 홍*동", mask_name("홍길동") == "홍*동", mask_name("홍길동"))
    check("마스킹: 남궁민수 → 남**수", mask_name("남궁민수") == "남**수", mask_name("남궁민수"))
    check("마스킹: 2자 이름", mask_name("김민") == "김*", mask_name("김민"))
    check(
        "마스킹: 전화번호",
        mask_phone("010-1234-5678") == "010-****-5678",
        mask_phone("010-1234-5678"),
    )
    check(
        "마스킹: 주소",
        mask_address("서울 강남구 역삼동 123-4 5층") == "서울 강남구 역삼동 ***",
        mask_address("서울 강남구 역삼동 123-4 5층"),
    )
    check(
        "마스킹: 이메일",
        mask_email("brown.rigoon@example.com") == "br***@example.com",
        mask_email("brown.rigoon@example.com"),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="ezadmin-mcp 셀프테스트")
    parser.add_argument("--source", default="", help="소스 모드 강제 (excel|api|auto)")
    args = parser.parse_args()

    if args.source:
        os.environ["EZMCP_SOURCE_MODE"] = args.source

    service = _reload_service()
    from ezmcp.config import get_config

    cfg = get_config()

    print("=" * 68)
    print("ezadmin-mcp 셀프테스트  (소스 모드: %s / 개인정보: %s)" % (cfg.source_mode, cfg.pii_mode))
    print("데이터 폴더: %s" % cfg.data_dir)
    print("=" * 68)

    ensure_sample_data(service)
    service = _reload_service()

    test_masking_rules()
    status = test_data_status(service)
    test_inventory(service, cfg)
    test_orders(service, status)
    test_unshipped(service)
    test_shipping(service)
    test_pii_modes()

    print("")
    failed = 0
    for ok, name, detail in RESULTS:
        mark = "PASS" if ok else "FAIL"
        line = "  [%s] %s" % (mark, name)
        if not ok:
            failed += 1
            line += "  → %s" % (detail or "조건 불만족")
        print(line)

    print("")
    print("-" * 68)
    print("총 %d개 검증 · 통과 %d · 실패 %d" % (len(RESULTS), len(RESULTS) - failed, failed))
    print("-" * 68)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
