"""조회 로직 (design/04) — MCP와 무관하게 단독 호출 가능.

selftest.py 가 이 함수들을 직접 호출해 검증한다.
모든 함수는 JSON 직렬화 가능한 dict 를 돌려주며, 예외는 안에서 잡아
`{"오류": "...", "meta": {...}}` 형태로 반환한다.
"""

from __future__ import annotations

import functools
import logging
from collections import Counter
from typing import Any

from . import brands as brand_utils
from . import normalize as nz
from .config import get_config
from .couriers import tracking_url
from .dates import days_since, fmt_dt, resolve_period
from .masking import Masker
from .sources import router
from .sources.api_source import ApiSource
from .sources.base import SourceResult

log = logging.getLogger(__name__)

MAX_LIMIT = 100
SERVER_NAME = "ezadmin-mcp"

MODE_LABEL = {
    "excel": "excel(엑셀 파일만)",
    "api": "api(이지어드민 API만)",
    "auto": "auto(API 우선, 실패 시 엑셀)",
}


# ---------------------------------------------------------------------------
# 공통 도우미
# ---------------------------------------------------------------------------


def _guard(fn):
    """어떤 예외도 도구 밖으로 새지 않게 한다 — 예외가 나가면 Claude 쪽 연결이 끊긴 것처럼 보인다."""

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:  # noqa: BLE001
            log.exception("%s 실행 중 예외", fn.__name__)
            try:
                meta = _meta(get_config(), [])
            except Exception:  # noqa: BLE001
                meta = {
                    "source": "없음",
                    "files": [],
                    "데이터기준": "(확인 불가)",
                    "pii_mode": "masked",
                    "warnings": [],
                }
            return {
                "오류": "조회 중 예기치 못한 오류가 발생했습니다 (%s). "
                "python scripts/selftest.py 를 실행하면 원인을 알 수 있습니다."
                % type(exc).__name__,
                "meta": meta,
            }

    return wrapper


def _clamp(limit: Any, default: int) -> int:
    try:
        value = int(limit)
    except (TypeError, ValueError):
        return default
    return max(1, min(value, MAX_LIMIT))


def _meta(cfg, results: list[SourceResult], extra_warnings: list[str] | None = None) -> dict:
    files: list[dict] = []
    warnings: list[str] = list(extra_warnings or [])
    latest = None
    sources: list[str] = []

    for result in results:
        files.extend(result.files)
        warnings.extend(result.warnings)
        if result.source:
            sources.append(result.source)
        if result.latest is not None and (latest is None or result.latest > latest):
            latest = result.latest

    seen: set[str] = set()
    unique_warnings = [w for w in warnings if not (w in seen or seen.add(w))]

    return {
        "source": "+".join(dict.fromkeys(sources)) or "없음",
        "files": files,
        "데이터기준": fmt_dt(latest) if latest else "(파일 없음)",
        "pii_mode": cfg.pii_mode,
        "warnings": unique_warnings,
    }


def _error(cfg, message: str, results: list[SourceResult] | None = None) -> dict:
    return {"오류": message, "meta": _meta(cfg, results or [])}


def _notice(cfg, message: str, results: list[SourceResult] | None = None) -> dict:
    return {"안내": message, "meta": _meta(cfg, results or [])}


def _source_failed(result: SourceResult) -> bool:
    return not result.ok


def _brand_of(rec: dict, cfg) -> str:
    return brand_utils.detect(rec, cfg.brands)


def _contains(needle: str, *values) -> bool:
    token = str(needle or "").strip().lower()
    if not token:
        return True
    return any(token in str(v or "").lower() for v in values)


def _available(rec: dict) -> int:
    """가용재고. 가용 컬럼이 없거나 0이면 현재고로 대체 (design/04)."""
    available = int(rec.get("available_qty") or 0)
    return available if available else int(rec.get("stock_qty") or 0)


def _low_stock_threshold(rec: dict, cfg) -> int:
    safety = int(rec.get("safety_stock") or 0)
    return safety if safety > 0 else cfg.low_stock_threshold


def _is_low_stock(rec: dict, cfg) -> bool:
    return _available(rec) <= _low_stock_threshold(rec, cfg)


def _status_matches(rec: dict, wanted: str) -> bool:
    token = str(wanted or "").strip()
    if not token:
        return True
    if rec.get("bucket") == token:
        return True
    return _contains(token, rec.get("status"), rec.get("ship_status"), rec.get("bucket"))


def _is_unshipped(rec: dict) -> bool:
    if str(rec.get("tracking_no") or "").strip():
        return False
    return rec.get("bucket") not in nz.UNSHIPPED_EXCLUDE_BUCKETS


def _sort_by_date(records: list[dict], field: str, reverse: bool = True) -> list[dict]:
    with_date = [r for r in records if r.get(field)]
    without = [r for r in records if not r.get(field)]
    with_date.sort(key=lambda r: r[field], reverse=reverse)
    return with_date + without


# ---------------------------------------------------------------------------
# 1) data_status
# ---------------------------------------------------------------------------


@_guard
def data_status() -> dict:
    """연결·데이터 상태 진단."""
    cfg = get_config()
    try:
        orders = router.fetch(cfg, "orders")
        inventory = router.fetch(cfg, "inventory")
        returns = router.fetch(cfg, "returns")
    except Exception as exc:  # noqa: BLE001
        log.exception("data_status 실패")
        return _error(cfg, "데이터를 읽는 중 오류가 발생했습니다 (%s)." % type(exc).__name__)

    def summarize(result: SourceResult, kind: str, date_field: str) -> dict:
        if not result.ok:
            return {"오류": result.error}
        if not result.files:
            folder = cfg.data_subdir(kind)
            return {
                "파일수": 0,
                "안내": "%s 폴더에 파일이 없습니다. 이지어드민에서 내려받은 엑셀을 넣어 주세요."
                % folder,
            }
        newest = max(result.files, key=lambda f: str(f.get("수정시각") or ""))
        info: dict[str, Any] = {
            "파일수": len(result.files),
            "최신파일": newest.get("파일", ""),
            "수정시각": newest.get("수정시각", ""),
            "행수": len(result.records),
        }
        if date_field:
            dates = [r[date_field] for r in result.records if r.get(date_field)]
            if dates:
                info["기간"] = "%s ~ %s" % (
                    fmt_dt(min(dates), with_time=False),
                    fmt_dt(max(dates), with_time=False),
                )
        return info

    others = Counter(
        str(r.get("status") or r.get("ship_status") or "(빈 값)")
        for r in orders.records
        if r.get("bucket") == nz.BUCKET_OTHER
    )

    api_status = ApiSource(cfg).status_text()

    return {
        "서버": SERVER_NAME,
        "소스모드": MODE_LABEL.get(cfg.source_mode, cfg.source_mode),
        "활성소스": "+".join(
            dict.fromkeys(r.source for r in (orders, inventory, returns) if r.source)
        )
        or "없음",
        "데이터폴더": str(cfg.data_dir),
        "데이터": {
            "주문": summarize(orders, "orders", "order_date"),
            "재고": summarize(inventory, "inventory", ""),
            "반품": summarize(returns, "returns", "receive_date"),
        },
        "기타상태값": ["%s(%d건)" % (name, count) for name, count in others.most_common()],
        "API": api_status,
        "브랜드": list(cfg.brands.keys()),
        "pii_mode": cfg.pii_mode,
        "meta": _meta(cfg, [orders, inventory, returns]),
    }


# ---------------------------------------------------------------------------
# 2) inventory_lookup
# ---------------------------------------------------------------------------


@_guard
def inventory_lookup(
    query: str = "",
    brand: str = "",
    low_stock_only: bool = False,
    limit: int = 50,
) -> dict:
    """SKU·상품명·브랜드로 현재 재고 수량과 위치 조회."""
    cfg = get_config()
    try:
        result = router.fetch(cfg, "inventory")
    except Exception as exc:  # noqa: BLE001
        log.exception("inventory_lookup 실패")
        return _error(cfg, "재고 데이터를 읽는 중 오류가 발생했습니다 (%s)." % type(exc).__name__)

    if _source_failed(result):
        return _error(cfg, result.error, [result])

    records, _, notice = brand_utils.filter_records(result.records, brand, cfg.brands)
    if notice:
        return _notice(cfg, notice, [result])

    if query:
        records = [
            r
            for r in records
            if _contains(query, r.get("product_code"), r.get("product_name"), r.get("option"))
        ]
    if low_stock_only:
        records = [r for r in records if _is_low_stock(r, cfg)]

    records.sort(key=lambda r: (_available(r), str(r.get("product_code") or "")))
    limit = _clamp(limit, 50)

    rows = []
    for rec in records[:limit]:
        rows.append(
            {
                "상품코드": rec.get("product_code", ""),
                "상품명": rec.get("product_name", ""),
                "옵션": rec.get("option", ""),
                "브랜드": _brand_of(rec, cfg),
                "현재고": int(rec.get("stock_qty") or 0),
                "가용재고": _available(rec),
                "안전재고": int(rec.get("safety_stock") or 0),
                "위치": rec.get("location", ""),
                "재고부족": _is_low_stock(rec, cfg),
            }
        )

    return {
        "조회조건": {
            "검색어": query,
            "브랜드": brand,
            "재고부족만": bool(low_stock_only),
        },
        "안내": "재고는 현재 시점의 스냅샷입니다(기간 개념 없음). 기준 시각은 meta.데이터기준을 보세요.",
        "합계": {
            "품목수": len(records),
            "현재고": sum(int(r.get("stock_qty") or 0) for r in records),
            "가용재고": sum(_available(r) for r in records),
            "재고부족": sum(1 for r in records if _is_low_stock(r, cfg)),
        },
        "총건수": len(records),
        "표시": len(rows),
        "목록": rows,
        "meta": _meta(cfg, [result]),
    }


# ---------------------------------------------------------------------------
# 3) order_lookup
# ---------------------------------------------------------------------------


def _order_row(rec: dict, cfg, masker: Masker) -> dict:
    row = {
        "주문번호": rec.get("order_no", ""),
        "판매처": rec.get("mall", ""),
        "브랜드": _brand_of(rec, cfg),
        "주문일시": fmt_dt(rec.get("order_date")),
        "상태": rec.get("bucket", ""),
        "원문상태": rec.get("status") or rec.get("ship_status") or "",
        "상품명": rec.get("product_name", ""),
        "옵션": rec.get("option", ""),
        "수량": int(rec.get("qty") or 0),
        "금액": int(rec.get("amount") or 0),
    }
    masker.put(row, "수취인", rec.get("receiver_name"), "name")
    row["송장번호"] = rec.get("tracking_no", "")
    return row


def _return_rows(records: list[dict], cfg, masker: Masker) -> list[dict]:
    rows = []
    for rec in records:
        rows.append(
            {
                "접수일": fmt_dt(rec.get("receive_date")),
                "구분": rec.get("claim_type", ""),
                "처리상태": rec.get("claim_status", ""),
                "상품명": rec.get("product_name", ""),
                "수량": int(rec.get("qty") or 0),
                "사유": rec.get("reason", ""),
                "수거택배사": rec.get("pickup_courier", ""),
                "수거송장": rec.get("pickup_tracking_no", ""),
                "조회링크": tracking_url(
                    rec.get("pickup_courier"), rec.get("pickup_tracking_no"), cfg.courier_urls
                ),
            }
        )
    return rows


@_guard
def order_lookup(
    order_no: str = "",
    period: str = "",
    start_date: str = "",
    end_date: str = "",
    brand: str = "",
    status: str = "",
    query: str = "",
    limit: int = 20,
) -> dict:
    """주문번호 단건 상세 또는 기간별 주문 목록 조회."""
    cfg = get_config()
    masker = Masker(cfg.pii_mode)

    span = resolve_period(period, start_date, end_date, default="최근7일")
    try:
        orders = router.fetch(
            cfg,
            "orders",
            start_date=fmt_dt(span.start, with_time=False),
            end_date=fmt_dt(span.end, with_time=False),
        )
        returns = router.fetch(cfg, "returns")
    except Exception as exc:  # noqa: BLE001
        log.exception("order_lookup 실패")
        return _error(cfg, "주문 데이터를 읽는 중 오류가 발생했습니다 (%s)." % type(exc).__name__)

    if _source_failed(orders):
        return _error(cfg, orders.error, [orders])

    limit = _clamp(limit, 20)
    results = [orders, returns] if returns.ok else [orders]

    # --- 단건 상세 -------------------------------------------------------
    wanted = str(order_no or "").strip()
    if wanted:
        exact = [r for r in orders.records if str(r.get("order_no") or "").strip() == wanted]
        if exact:
            return _order_detail(exact, returns, cfg, masker, results)

        partial = [r for r in orders.records if wanted.lower() in str(r.get("order_no") or "").lower()]
        if not partial:
            return _notice(
                cfg,
                "주문번호 '%s' 를 찾지 못했습니다. 해당 기간 엑셀이 data/orders 폴더에 있는지 "
                "확인해 주세요." % wanted,
                results,
            )
        rows = [_order_row(r, cfg, masker) for r in _sort_by_date(partial, "order_date")[:limit]]
        return {
            "조회조건": {"주문번호": wanted},
            "안내": "정확히 일치하는 주문번호가 없어 부분 일치 결과를 보여줍니다.",
            "총건수": len(partial),
            "표시": len(rows),
            "목록": rows,
            "meta": _meta(cfg, results),
        }

    # --- 기간 목록 -------------------------------------------------------
    records, _, notice = brand_utils.filter_records(orders.records, brand, cfg.brands)
    if notice:
        return _notice(cfg, notice, results)

    if not span.is_open:
        records = [r for r in records if span.contains(r.get("order_date"))]
    if status:
        records = [r for r in records if _status_matches(r, status)]
    if query:
        records = [
            r
            for r in records
            if _contains(
                query,
                r.get("product_name"),
                r.get("option"),
                r.get("receiver_name"),
                r.get("order_no"),
            )
        ]

    records = _sort_by_date(records, "order_date")
    rows = [_order_row(r, cfg, masker) for r in records[:limit]]
    buckets = Counter(r.get("bucket", "") for r in records)

    return {
        "조회조건": {
            "조회기간": span.label,
            "브랜드": brand,
            "상태": status,
            "검색어": query,
        },
        "집계": {
            "총건수": len(records),
            "상태별": dict(buckets.most_common()),
            "총수량": sum(int(r.get("qty") or 0) for r in records),
            "총금액": sum(int(r.get("amount") or 0) for r in records),
        },
        "총건수": len(records),
        "표시": len(rows),
        "목록": rows,
        "meta": _meta(cfg, results),
    }


def _order_detail(
    items: list[dict], returns: SourceResult, cfg, masker: Masker, results: list[SourceResult]
) -> dict:
    head = items[0]
    detail: dict[str, Any] = {
        "주문번호": head.get("order_no", ""),
        "판매처": head.get("mall", ""),
        "브랜드": _brand_of(head, cfg),
        "주문일시": fmt_dt(head.get("order_date")),
        "상태": head.get("bucket", ""),
        "원문상태": head.get("status") or head.get("ship_status") or "",
    }
    masker.put(detail, "수취인", head.get("receiver_name"), "name")
    masker.put(detail, "주문자", head.get("orderer_name"), "name")
    masker.put(detail, "연락처", head.get("phone"), "phone")
    masker.put(detail, "주소", head.get("address"), "address")

    detail["택배사"] = head.get("courier", "")
    detail["송장번호"] = head.get("tracking_no", "")
    detail["발송일"] = fmt_dt(head.get("shipped_date"))
    detail["조회링크"] = tracking_url(
        head.get("courier"), head.get("tracking_no"), cfg.courier_urls
    )

    detail["품목"] = [
        {
            "상품코드": r.get("product_code", ""),
            "상품명": r.get("product_name", ""),
            "옵션": r.get("option", ""),
            "수량": int(r.get("qty") or 0),
            "금액": int(r.get("amount") or 0),
        }
        for r in items
    ]
    detail["합계"] = {
        "수량": sum(int(r.get("qty") or 0) for r in items),
        "금액": sum(int(r.get("amount") or 0) for r in items),
    }

    extras: dict[str, str] = {}
    for rec in items:
        extras.update(rec.get("extras") or {})
    filtered = masker.extras(extras)
    if filtered:
        detail["기타정보"] = filtered

    claims = [
        r
        for r in returns.records
        if str(r.get("order_no") or "").strip() == str(head.get("order_no") or "").strip()
    ]
    if claims:
        detail["반품정보"] = _return_rows(claims, cfg, masker)

    detail["meta"] = _meta(cfg, results)
    return detail


# ---------------------------------------------------------------------------
# 4) unshipped_list
# ---------------------------------------------------------------------------


@_guard
def unshipped_list(period: str = "", brand: str = "", limit: int = 50) -> dict:
    """접수됐지만 출고(송장 등록)되지 않은 주문 목록."""
    cfg = get_config()
    masker = Masker(cfg.pii_mode)

    span = resolve_period(period, "", "", default="")
    try:
        orders = router.fetch(
            cfg,
            "orders",
            start_date=fmt_dt(span.start, with_time=False),
            end_date=fmt_dt(span.end, with_time=False),
        )
    except Exception as exc:  # noqa: BLE001
        log.exception("unshipped_list 실패")
        return _error(cfg, "주문 데이터를 읽는 중 오류가 발생했습니다 (%s)." % type(exc).__name__)

    if _source_failed(orders):
        return _error(cfg, orders.error, [orders])

    records, _, notice = brand_utils.filter_records(orders.records, brand, cfg.brands)
    if notice:
        return _notice(cfg, notice, [orders])

    if not span.is_open:
        records = [r for r in records if span.contains(r.get("order_date"))]
    records = [r for r in records if _is_unshipped(r)]
    records = _sort_by_date(records, "order_date", reverse=False)

    limit = _clamp(limit, 50)
    delay_days = cfg.unshipped_delay_days

    rows = []
    delayed = 0
    for rec in records:
        elapsed = days_since(rec.get("order_date"))
        if elapsed is not None and elapsed >= delay_days:
            delayed += 1
    for rec in records[:limit]:
        elapsed = days_since(rec.get("order_date"))
        row = {
            "주문번호": rec.get("order_no", ""),
            "판매처": rec.get("mall", ""),
            "브랜드": _brand_of(rec, cfg),
            "주문일시": fmt_dt(rec.get("order_date")),
            "상태": rec.get("bucket", ""),
            "원문상태": rec.get("status") or rec.get("ship_status") or "",
            "상품명": rec.get("product_name", ""),
            "옵션": rec.get("option", ""),
            "수량": int(rec.get("qty") or 0),
            "경과일": elapsed if elapsed is not None else "",
            "지연": bool(elapsed is not None and elapsed >= delay_days),
        }
        masker.put(row, "수취인", rec.get("receiver_name"), "name")
        rows.append(row)

    return {
        "조회조건": {
            "조회기간": span.label,
            "브랜드": brand,
            "지연기준": "%d일 이상" % delay_days,
        },
        "집계": {
            "총건수": len(records),
            "지연건수": delayed,
            "버킷별": dict(Counter(r.get("bucket", "") for r in records).most_common()),
        },
        "총건수": len(records),
        "표시": len(rows),
        "목록": rows,
        "meta": _meta(cfg, [orders]),
    }


# ---------------------------------------------------------------------------
# 5) shipping_lookup
# ---------------------------------------------------------------------------

DIRECTION_ALIASES = {
    "": "전체",
    "전체": "전체",
    "all": "전체",
    "출고": "출고",
    "배송": "출고",
    "정방향": "출고",
    "반품": "반품",
    "회수": "반품",
    "수거": "반품",
    "교환": "반품",
}


def _shipping_row_from_order(rec: dict, cfg, masker: Masker, kind: str) -> dict:
    row = {
        "구분": kind,
        "주문번호": rec.get("order_no", ""),
        "브랜드": _brand_of(rec, cfg),
        "상품명": rec.get("product_name", ""),
        "옵션": rec.get("option", ""),
        "상태": rec.get("bucket", ""),
        "원문상태": rec.get("status") or rec.get("ship_status") or "",
        "택배사": rec.get("courier", ""),
        "송장번호": rec.get("tracking_no", ""),
        "발송일": fmt_dt(rec.get("shipped_date") or rec.get("order_date")),
        "조회링크": tracking_url(rec.get("courier"), rec.get("tracking_no"), cfg.courier_urls),
    }
    masker.put(row, "수취인", rec.get("receiver_name"), "name")
    return row


def _shipping_row_from_return(rec: dict, cfg) -> dict:
    return {
        "구분": "반품수거",
        "주문번호": rec.get("order_no", ""),
        "브랜드": _brand_of(rec, cfg),
        "상품명": rec.get("product_name", ""),
        "옵션": rec.get("option", ""),
        "상태": rec.get("claim_status") or rec.get("bucket", ""),
        "원문상태": rec.get("claim_type") or rec.get("claim_status") or "",
        "택배사": rec.get("pickup_courier", ""),
        "송장번호": rec.get("pickup_tracking_no", ""),
        "발송일": fmt_dt(rec.get("receive_date")),
        "조회링크": tracking_url(
            rec.get("pickup_courier"), rec.get("pickup_tracking_no"), cfg.courier_urls
        ),
        "사유": rec.get("reason", ""),
    }


@_guard
def shipping_lookup(
    order_no: str = "",
    tracking_no: str = "",
    period: str = "",
    brand: str = "",
    direction: str = "전체",
    limit: int = 20,
) -> dict:
    """출고·반품 배송 상황과 택배사 송장 조회 링크."""
    cfg = get_config()
    masker = Masker(cfg.pii_mode)

    want = DIRECTION_ALIASES.get(str(direction or "").strip().lower(), "전체")
    single = bool(str(order_no or "").strip() or str(tracking_no or "").strip())
    span = resolve_period(period, "", "", default="" if single else "최근7일")

    try:
        orders = router.fetch(
            cfg,
            "orders",
            start_date=fmt_dt(span.start, with_time=False),
            end_date=fmt_dt(span.end, with_time=False),
        )
        returns = router.fetch(cfg, "returns")
    except Exception as exc:  # noqa: BLE001
        log.exception("shipping_lookup 실패")
        return _error(cfg, "배송 데이터를 읽는 중 오류가 발생했습니다 (%s)." % type(exc).__name__)

    if _source_failed(orders):
        return _error(cfg, orders.error, [orders])

    results = [orders, returns] if returns.ok else [orders]
    extra_warnings: list[str] = []
    if returns.ok and not returns.files and want in ("반품", "전체"):
        extra_warnings.append(
            "data/returns 폴더에 반품 엑셀이 없어 주문 데이터의 반품·교환 상태로 대체했습니다."
        )

    order_records, _, notice = brand_utils.filter_records(orders.records, brand, cfg.brands)
    if notice:
        return _notice(cfg, notice, results)
    return_records, _, _ = brand_utils.filter_records(
        returns.records if returns.ok else [], brand, cfg.brands
    )

    order_no_token = str(order_no or "").strip().lower()
    tracking_token = str(tracking_no or "").strip().lower()

    def hit(rec_order_no, rec_tracking_no) -> bool:
        if order_no_token and order_no_token not in str(rec_order_no or "").lower():
            return False
        if tracking_token and tracking_token not in str(rec_tracking_no or "").lower():
            return False
        return True

    rows: list[dict] = []
    claim_order_nos = {str(r.get("order_no") or "").strip() for r in return_records}

    if want in ("출고", "전체"):
        for rec in order_records:
            if not str(rec.get("tracking_no") or "").strip():
                continue
            if not hit(rec.get("order_no"), rec.get("tracking_no")):
                continue
            when = rec.get("shipped_date") or rec.get("order_date")
            if not single and not span.is_open and not span.contains(when):
                continue
            rows.append(_shipping_row_from_order(rec, cfg, masker, "출고"))

    if want in ("반품", "전체"):
        for rec in return_records:
            if not hit(rec.get("order_no"), rec.get("pickup_tracking_no")):
                continue
            if not single and not span.is_open and not span.contains(rec.get("receive_date")):
                continue
            rows.append(_shipping_row_from_return(rec, cfg))

        for rec in order_records:
            if rec.get("bucket") not in ("반품", "교환"):
                continue
            if str(rec.get("order_no") or "").strip() in claim_order_nos:
                continue
            if not hit(rec.get("order_no"), rec.get("tracking_no")):
                continue
            if not single and not span.is_open and not span.contains(rec.get("order_date")):
                continue
            rows.append(_shipping_row_from_order(rec, cfg, masker, "반품(주문기준)"))

    rows.sort(key=lambda r: str(r.get("발송일") or ""), reverse=True)
    limit = _clamp(limit, 20)
    shown = rows[:limit]

    if not rows:
        message = "조건에 맞는 배송 건이 없습니다."
        if single:
            message = "주문번호·송장번호로 배송 건을 찾지 못했습니다. 기간 엑셀이 최신인지 확인해 주세요."
        return {
            "조회조건": {
                "구분": want,
                "주문번호": order_no,
                "송장번호": tracking_no,
                "조회기간": span.label,
                "브랜드": brand,
            },
            "안내": message,
            "총건수": 0,
            "표시": 0,
            "목록": [],
            "meta": _meta(cfg, results, extra_warnings),
        }

    return {
        "조회조건": {
            "구분": want,
            "주문번호": order_no,
            "송장번호": tracking_no,
            "조회기간": span.label if not single else "전체(단건 조회)",
            "브랜드": brand,
        },
        "안내": "상태는 이지어드민 데이터 기준입니다. 실시간 위치는 조회링크에서 확인하세요.",
        "집계": {
            "총건수": len(rows),
            "구분별": dict(Counter(r.get("구분", "") for r in rows).most_common()),
        },
        "총건수": len(rows),
        "표시": len(shown),
        "목록": shown,
        "meta": _meta(cfg, results, extra_warnings),
    }
