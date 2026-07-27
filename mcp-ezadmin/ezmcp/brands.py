"""브랜드 매칭 (design/05).

이지어드민에서 브랜드는 두 방식이 병행된다:
① 상품명·상품코드에 브랜드 식별자 ② 브랜드별 판매처(몰)·계정 분리.
따라서 아래 조건 중 하나라도 맞으면 그 브랜드로 본다 (OR).
"""

from __future__ import annotations

import re

_SPACE = re.compile(r"\s+")


def norm(value) -> str:
    """비교용 정규화: 공백 제거 + 소문자화."""
    return _SPACE.sub("", str(value or "")).strip().lower()


def resolve(name, brands_cfg: dict) -> str | None:
    """입력한 브랜드명(별칭 포함) → 설정에 등록된 브랜드 키. 없으면 None."""
    target = norm(name)
    if not target:
        return None
    for key, spec in (brands_cfg or {}).items():
        if norm(key) == target:
            return key
        for alias in (spec or {}).get("aliases", []) or []:
            if norm(alias) == target:
                return key
    return None


def matches(rec: dict, key: str, spec: dict) -> bool:
    """레코드가 해당 브랜드에 속하는지."""
    spec = spec or {}

    brand_col = norm(rec.get("brand_col"))
    if brand_col:
        if brand_col == norm(key):
            return True
        for alias in spec.get("aliases", []) or []:
            if brand_col == norm(alias):
                return True

    mall = norm(rec.get("mall"))
    if mall and any(mall == norm(m) for m in spec.get("malls", []) or []):
        return True

    # 상품 키워드는 원문 그대로 부분 포함 (LM- 같은 접두어의 기호·대소문자가 의미를 가짐)
    haystack = "\n".join(
        str(rec.get(f) or "") for f in ("product_name", "product_code", "option")
    )
    for keyword in spec.get("product_keywords", []) or []:
        if keyword and str(keyword) in haystack:
            return True

    account = norm(rec.get("_account"))
    if account and any(account == norm(a) for a in spec.get("accounts", []) or []):
        return True

    return False


def detect(rec: dict, brands_cfg: dict) -> str:
    """표시용 브랜드명. 매칭되는 등록 브랜드가 없으면 원본 브랜드 컬럼 값."""
    for key, spec in (brands_cfg or {}).items():
        if matches(rec, key, spec):
            return key
    return str(rec.get("brand_col") or "")


def filter_records(records: list[dict], name, brands_cfg: dict):
    """(필터된 목록, 해석된 브랜드키, 안내메시지) 반환.

    등록되지 않은 브랜드명이면 오류가 아니라 안내 메시지를 돌려준다 (design/05).
    """
    if not str(name or "").strip():
        return records, "", ""

    key = resolve(name, brands_cfg)
    if key is None:
        registered = ", ".join(brands_cfg.keys()) if brands_cfg else "(등록된 브랜드 없음)"
        return (
            [],
            "",
            "'%s' 은(는) 등록되지 않은 브랜드입니다. 등록된 브랜드: %s. "
            "config.json 의 brands 에 추가할 수 있습니다." % (name, registered),
        )

    spec = brands_cfg.get(key) or {}
    return [r for r in records if matches(r, key, spec)], key, ""
