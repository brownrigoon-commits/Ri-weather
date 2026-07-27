"""헤더 매핑·값 파싱·상태 버킷 (design/02).

엑셀 소스와 API 소스가 **같은 표준 레코드 형태**를 만들도록 여기 규칙을 공유한다.
"""

from __future__ import annotations

import re
from datetime import date, datetime, time, timedelta
from typing import Any, Iterable

# --------------------------------------------------------------------------
# 헤더 정규화
# --------------------------------------------------------------------------

_HEADER_STRIP = re.compile(r"[\s()\[\]{}_/\\.\-:]+")


def norm_header(value: Any) -> str:
    """헤더 문자열 정규화: 소문자화 + 공백·괄호·구분기호 제거."""
    if value is None:
        return ""
    return _HEADER_STRIP.sub("", str(value)).strip().lower()


# --------------------------------------------------------------------------
# 표준 필드 ← 헤더 후보 (design/02)
# --------------------------------------------------------------------------

EXACT_CANDIDATES: dict[str, dict[str, list[str]]] = {
    "orders": {
        "order_no": ["주문번호", "통합주문번호", "주문ID", "orderno", "주문코드"],
        "mall": ["판매처", "판매처명", "쇼핑몰", "쇼핑몰명", "판매채널", "몰명", "사이트"],
        "order_date": [
            "주문일",
            "주문일시",
            "주문일자",
            "주문시간",
            "결제일",
            "결제일시",
            "수집일",
            "수집일시",
        ],
        "status": ["주문상태", "처리상태", "진행상태", "주문단계", "상태"],
        "ship_status": ["배송상태", "배송단계"],
        "product_name": ["상품명", "제품명", "품명"],
        "product_code": [
            "상품코드",
            "품목코드",
            "자체상품코드",
            "자체코드",
            "품번",
            "SKU",
            "상품번호",
        ],
        "option": ["옵션", "옵션명", "옵션정보"],
        "qty": ["수량", "주문수량", "개수", "EA"],
        "amount": ["결제금액", "총결제금액", "판매금액", "상품금액", "판매가", "금액"],
        "receiver_name": ["수취인", "수취인명", "받는사람", "받는분", "수령인", "수하인"],
        "orderer_name": ["주문자", "주문자명", "구매자", "구매자명"],
        "phone": [
            "전화번호",
            "휴대폰",
            "휴대폰번호",
            "연락처",
            "수취인전화번호",
            "수취인휴대폰",
            "핸드폰",
        ],
        "address": ["주소", "배송주소", "수취인주소", "배송지", "배송지주소"],
        "courier": ["택배사", "택배사명", "배송사", "택배회사", "배송업체"],
        "tracking_no": ["송장번호", "운송장번호", "운송장", "송장"],
        "shipped_date": [
            "발송일",
            "발송일자",
            "발송일시",
            "출고일",
            "출고일자",
            "발송처리일",
            "송장등록일",
        ],
        "brand_col": ["브랜드", "브랜드명", "공급처", "공급처명", "공급사", "매입처", "제조사"],
    },
    "inventory": {
        "product_code": [
            "상품코드",
            "품목코드",
            "자체상품코드",
            "자체코드",
            "품번",
            "SKU",
            "상품번호",
        ],
        "product_name": ["상품명", "제품명", "품명"],
        "option": ["옵션", "옵션명", "옵션정보"],
        "brand_col": ["브랜드", "브랜드명", "공급처", "공급처명", "공급사", "매입처", "제조사"],
        "stock_qty": ["현재고", "재고", "재고수량", "현재고수량", "보유재고", "실재고", "총재고"],
        "available_qty": ["가용재고", "가용수량", "판매가능재고", "판매가능수량"],
        "safety_stock": ["안전재고", "안전재고수량"],
        "location": ["로케이션", "위치", "재고위치", "적치위치", "보관위치", "랙", "셀"],
    },
    "returns": {
        "order_no": ["주문번호", "통합주문번호", "주문ID", "orderno", "주문코드"],
        "product_name": ["상품명", "제품명", "품명"],
        "option": ["옵션", "옵션명", "옵션정보"],
        "qty": ["수량", "주문수량", "개수", "EA"],
        "receive_date": ["접수일", "접수일시", "클레임접수일", "등록일"],
        "claim_type": ["클레임구분", "클레임", "반품구분", "클레임유형", "유형", "구분"],
        "claim_status": ["처리상태", "클레임상태", "진행상태", "상태"],
        "reason": ["사유", "클레임사유", "반품사유", "상세사유"],
        "pickup_courier": ["수거택배사", "회수택배사", "반품택배사"],
        "pickup_tracking_no": [
            "수거송장",
            "수거송장번호",
            "회수송장",
            "회수송장번호",
            "반품송장",
            "반품송장번호",
        ],
        "brand_col": ["브랜드", "브랜드명", "공급처", "공급처명", "공급사", "매입처", "제조사"],
    },
}

PARTIAL_CANDIDATES: dict[str, dict[str, list[str]]] = {
    "orders": {
        "order_no": ["주문번호"],
        "order_date": ["주문일"],
        "product_name": ["상품명"],
        "phone": ["전화", "휴대폰", "연락처"],
        "address": ["주소"],
        "tracking_no": ["송장"],
    },
    "inventory": {
        "product_name": ["상품명"],
        "stock_qty": ["재고수량"],
        "location": ["로케이션"],
    },
    "returns": {
        "order_no": ["주문번호"],
        "product_name": ["상품명"],
        "pickup_tracking_no": ["수거송장", "회수송장"],
    },
}

DATE_FIELDS = {"order_date", "shipped_date", "receive_date"}
INT_FIELDS = {"qty", "amount", "stock_qty", "available_qty", "safety_stock"}

STANDARD_FIELDS = {
    kind: tuple(fields.keys()) for kind, fields in EXACT_CANDIDATES.items()
}


def candidates_for(kind: str, cfg_columns: dict | None = None) -> dict[str, list[str]]:
    """기본 후보에 config.columns 의 커스텀 헤더를 '추가'한 목록."""
    merged = {field: list(vals) for field, vals in EXACT_CANDIDATES[kind].items()}
    extra = (cfg_columns or {}).get(kind) or {}
    for field, vals in extra.items():
        if field in merged:
            merged[field].extend(str(v) for v in vals)
        else:
            merged[field] = [str(v) for v in vals]
    return merged


# --------------------------------------------------------------------------
# 헤더 행 탐지 · 컬럼 매핑
# --------------------------------------------------------------------------


def detect_header_row(
    rows: list[list[Any]], kind: str, cfg_columns: dict | None = None, scan: int = 10
) -> int | None:
    """상위 `scan`행 중 후보 헤더명과 3개 이상 일치하는 '첫' 행의 인덱스."""
    cands = candidates_for(kind, cfg_columns)
    all_norm: set[str] = set()
    for vals in cands.values():
        all_norm.update(norm_header(v) for v in vals)
    all_norm.discard("")

    for idx, row in enumerate(rows[:scan]):
        cells = [norm_header(c) for c in row]
        hits = sum(1 for c in cells if c and c in all_norm)
        if hits >= 3:
            return idx
    return None


def map_columns(
    header_cells: list[Any], kind: str, cfg_columns: dict | None = None
) -> dict[str, int]:
    """헤더 → 표준 필드 인덱스 매핑. 1패스 정확 일치, 2패스 부분 포함."""
    normed = [norm_header(c) for c in header_cells]
    exact = candidates_for(kind, cfg_columns)
    mapping: dict[str, int] = {}
    used: set[int] = set()

    for field, cands in exact.items():
        targets = {norm_header(c) for c in cands}
        targets.discard("")
        for idx, cell in enumerate(normed):
            if idx in used or not cell:
                continue
            if cell in targets:
                mapping[field] = idx
                used.add(idx)
                break

    for field, cands in PARTIAL_CANDIDATES.get(kind, {}).items():
        if field in mapping:
            continue
        targets = [norm_header(c) for c in cands if norm_header(c)]
        for idx, cell in enumerate(normed):
            if idx in used or not cell:
                continue
            if any(t in cell for t in targets):
                mapping[field] = idx
                used.add(idx)
                break

    return mapping


# --------------------------------------------------------------------------
# 값 파싱
# --------------------------------------------------------------------------

_DATETIME_FORMATS = (
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%d",
    "%Y/%m/%d %H:%M:%S",
    "%Y/%m/%d %H:%M",
    "%Y/%m/%d",
    "%Y.%m.%d %H:%M:%S",
    "%Y.%m.%d %H:%M",
    "%Y.%m.%d",
    "%Y%m%d%H%M%S",
    "%Y%m%d",
)

_EXCEL_EPOCH = datetime(1899, 12, 30)
_NUM_STRIP = re.compile(r"(?:ea)|[,\s원₩￦개]", re.IGNORECASE)


def parse_date(value: Any) -> datetime | None:
    """날짜 파싱. 실패하면 None (기간 필터에서 제외됨)."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, date):
        return datetime.combine(value, time.min)
    if isinstance(value, time):
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        serial = float(value)
        if 30000 <= serial <= 80000:
            return _EXCEL_EPOCH + timedelta(days=serial)
        # 시리얼이 아니면 20260727 처럼 숫자로 적힌 날짜일 수 있으므로 문자열로 재시도
        value = int(serial) if float(serial).is_integer() else serial

    text = str(value).strip()
    if not text:
        return None
    text = text.replace("T", " ")
    for fmt in _DATETIME_FORMATS:
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    # "2026-07-27 09:12:33.123" 같은 밀리초 꼬리 제거 후 재시도
    trimmed = re.sub(r"\.\d+$", "", text)
    if trimmed != text:
        for fmt in _DATETIME_FORMATS:
            try:
                return datetime.strptime(trimmed, fmt)
            except ValueError:
                continue
    try:
        serial = float(text)
    except ValueError:
        return None
    if 30000 <= serial <= 80000:
        return _EXCEL_EPOCH + timedelta(days=serial)
    return None


def parse_int(value: Any) -> int:
    """수량·금액 파싱. 실패하면 0."""
    if value is None or value == "":
        return 0
    if isinstance(value, bool):
        return 0
    if isinstance(value, (int, float)):
        try:
            return int(round(float(value)))
        except (ValueError, OverflowError):
            return 0
    text = _NUM_STRIP.sub("", str(value))
    if not text:
        return 0
    match = re.match(r"^-?\d+(\.\d+)?", text)
    if not match:
        return 0
    try:
        return int(round(float(match.group(0))))
    except (ValueError, OverflowError):
        return 0


def clean_str(value: Any) -> str:
    """문자열 정리. 빈 값은 ''."""
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")
    return str(value).strip()


# --------------------------------------------------------------------------
# 상태 버킷 (design/02 — 순서가 중요)
# --------------------------------------------------------------------------

BUCKET_ORDER = (
    "취소",
    "반품",
    "교환",
    "배송완료",
    "배송준비",
    "배송중",
    "신규주문",
    "보류",
)

DEFAULT_STATUS_KEYWORDS: dict[str, list[str]] = {
    "취소": ["취소"],
    "반품": ["반품"],
    "교환": ["교환"],
    "배송완료": ["배송완료", "구매확정", "수취확인", "배달완료"],
    "배송준비": [
        "배송준비",
        "상품준비",
        "출고대기",
        "출고지시",
        "송장출력",
        "미출고",
        "발주확인",
        "준비중",
    ],
    "배송중": ["배송중", "출고완료", "발송완료", "발송처리", "집화"],
    "신규주문": ["신규", "주문확인", "결제완료", "입금확인", "접수"],
    "보류": ["보류", "품절"],
}

BUCKET_OTHER = "기타"
SHIPPED_BUCKETS = ("배송중", "배송완료")
UNSHIPPED_EXCLUDE_BUCKETS = ("배송중", "배송완료", "취소", "반품", "교환")


def status_keywords(cfg_status_keywords: dict | None = None) -> dict[str, list[str]]:
    merged = {b: list(v) for b, v in DEFAULT_STATUS_KEYWORDS.items()}
    for bucket, extra in (cfg_status_keywords or {}).items():
        merged.setdefault(bucket, [])
        merged[bucket].extend(str(v) for v in extra)
    return merged


def classify_status(raw: Any, keywords: dict[str, list[str]] | None = None) -> str:
    """상태 문자열 → 버킷. 어디에도 안 걸리면 '기타'."""
    text = norm_header(raw)
    if not text:
        return BUCKET_OTHER
    kw = keywords or DEFAULT_STATUS_KEYWORDS
    order = list(BUCKET_ORDER) + [b for b in kw if b not in BUCKET_ORDER]
    for bucket in order:
        for word in kw.get(bucket, []):
            token = norm_header(word)
            if token and token in text:
                return bucket
    return BUCKET_OTHER


def resolve_bucket(
    status: Any, ship_status: Any, keywords: dict[str, list[str]] | None = None
) -> str:
    """주문상태 우선, 단 미확정 버킷이면 배송상태로 보정 (design/02)."""
    bucket = classify_status(status, keywords)
    if not clean_str(status) and clean_str(ship_status):
        return classify_status(ship_status, keywords)
    if bucket in ("신규주문", "배송준비", BUCKET_OTHER) and clean_str(ship_status):
        ship_bucket = classify_status(ship_status, keywords)
        if ship_bucket in SHIPPED_BUCKETS:
            return ship_bucket
    return bucket


# --------------------------------------------------------------------------
# 레코드 조립
# --------------------------------------------------------------------------


def build_record(
    kind: str,
    row: Iterable[Any],
    mapping: dict[str, int],
    header_cells: list[Any],
    keywords: dict[str, list[str]] | None = None,
) -> dict[str, Any] | None:
    """한 행 → 표준 레코드. 의미 있는 값이 하나도 없으면 None."""
    cells = list(row)

    def cell(idx: int) -> Any:
        return cells[idx] if 0 <= idx < len(cells) else None

    rec: dict[str, Any] = {}
    for field in STANDARD_FIELDS[kind]:
        idx = mapping.get(field)
        value = cell(idx) if idx is not None else None
        if field in DATE_FIELDS:
            rec[field] = parse_date(value)
        elif field in INT_FIELDS:
            rec[field] = parse_int(value)
        else:
            rec[field] = clean_str(value)

    used = set(mapping.values())
    extras: dict[str, str] = {}
    for idx, header in enumerate(header_cells):
        if idx in used:
            continue
        name = clean_str(header)
        if not name:
            continue
        value = clean_str(cell(idx))
        if value:
            extras[name] = value
    rec["extras"] = extras

    if kind == "orders":
        rec["bucket"] = resolve_bucket(rec.get("status"), rec.get("ship_status"), keywords)
    elif kind == "returns":
        rec["bucket"] = classify_status(
            rec.get("claim_status") or rec.get("claim_type"), keywords
        )

    if not any(rec.get(f) for f in ("order_no", "product_name", "product_code")):
        return None
    return rec


def normalize_api_record(
    kind: str,
    raw: dict[str, Any],
    field_map: dict[str, str],
    keywords: dict[str, list[str]] | None = None,
) -> dict[str, Any] | None:
    """API 응답 1건 → 엑셀과 동일한 표준 레코드 (design/03)."""
    mapped: dict[str, Any] = {}
    used_keys: set[str] = set()
    for src, dest in (field_map or {}).items():
        if src in raw:
            mapped[dest] = raw[src]
            used_keys.add(src)

    rec: dict[str, Any] = {}
    for field in STANDARD_FIELDS[kind]:
        value = mapped.get(field)
        if field in DATE_FIELDS:
            rec[field] = parse_date(value)
        elif field in INT_FIELDS:
            rec[field] = parse_int(value)
        else:
            rec[field] = clean_str(value)

    rec["extras"] = {
        str(k): clean_str(v) for k, v in raw.items() if k not in used_keys and clean_str(v)
    }

    if kind == "orders":
        rec["bucket"] = resolve_bucket(rec.get("status"), rec.get("ship_status"), keywords)
    elif kind == "returns":
        rec["bucket"] = classify_status(
            rec.get("claim_status") or rec.get("claim_type"), keywords
        )

    if not any(rec.get(f) for f in ("order_no", "product_name", "product_code")):
        return None
    return rec


def dedupe_key(kind: str, rec: dict[str, Any]) -> tuple:
    """병합 시 중복 판정 키 (design/02)."""
    if kind == "orders":
        return (
            rec.get("order_no", ""),
            rec.get("product_code") or rec.get("product_name", ""),
            rec.get("option", ""),
        )
    if kind == "inventory":
        return (
            rec.get("product_code") or rec.get("product_name", ""),
            rec.get("option", ""),
        )
    return (
        rec.get("order_no", ""),
        rec.get("product_name", ""),
        rec.get("receive_date").isoformat() if rec.get("receive_date") else "",
    )
