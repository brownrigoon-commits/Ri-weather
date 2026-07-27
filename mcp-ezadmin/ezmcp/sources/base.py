"""데이터 소스 공통 인터페이스 (design/01).

모든 소스는 `SourceResult` 를 돌려주고, 그 안의 records 는
`normalize.py` 가 정의한 **동일한 표준 레코드 형태**여야 한다.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

KINDS = ("orders", "inventory", "returns")
KIND_LABEL = {"orders": "주문", "inventory": "재고", "returns": "반품"}


@dataclass
class SourceResult:
    records: list[dict[str, Any]] = field(default_factory=list)
    files: list[dict[str, str]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    latest: datetime | None = None
    source: str = ""
    ok: bool = True
    error: str = ""


class Source:
    """조회 전용 인터페이스. 쓰기 메서드를 추가하지 않는다."""

    name = "base"

    def fetch(self, kind: str, **kwargs) -> SourceResult:  # pragma: no cover
        raise NotImplementedError

    def get_orders(self, **kwargs) -> SourceResult:
        return self.fetch("orders", **kwargs)

    def get_inventory(self, **kwargs) -> SourceResult:
        return self.fetch("inventory", **kwargs)

    def get_returns(self, **kwargs) -> SourceResult:
        return self.fetch("returns", **kwargs)
