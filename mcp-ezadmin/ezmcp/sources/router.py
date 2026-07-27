"""소스 선택·폴백 (design/01).

- excel: 엑셀만
- api  : API만 (실패 시 폴백하지 않고 한국어 오류)
- auto : API 설정이 완비되면 API 우선, 실패하면 엑셀로 폴백 + 경고 명시
"""

from __future__ import annotations

import logging

from .api_source import ApiSource
from .base import SourceResult
from .excel_source import ExcelSource

log = logging.getLogger(__name__)


def make_sources(cfg) -> tuple[ExcelSource, ApiSource]:
    return ExcelSource(cfg), ApiSource(cfg)


def fetch(cfg, kind: str, **kwargs) -> SourceResult:
    excel, api = make_sources(cfg)
    mode = cfg.source_mode

    if mode == "excel":
        return excel.fetch(kind, **kwargs)

    if mode == "api":
        result = api.fetch(kind, **kwargs)
        if not result.ok:
            result.warnings.append(
                "소스 모드가 api 로 고정되어 있어 엑셀로 대체하지 않았습니다. "
                "엑셀 데이터를 쓰려면 .env 의 EZMCP_SOURCE_MODE 를 excel 또는 auto 로 바꾸세요."
            )
        return result

    # auto
    ok, reason = api.configured(kind)
    if ok:
        result = api.fetch(kind, **kwargs)
        if result.ok:
            return result
        fallback = excel.fetch(kind, **kwargs)
        fallback.warnings.insert(
            0, "API 호출 실패로 엑셀 데이터로 답변합니다: %s" % result.error
        )
        return fallback

    fallback = excel.fetch(kind, **kwargs)
    if (cfg.api or {}).get("enabled"):
        fallback.warnings.insert(0, "API 설정이 완료되지 않아 엑셀 데이터로 답변합니다: %s" % reason)
    return fallback
