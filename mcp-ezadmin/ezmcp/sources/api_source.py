"""이지어드민 API 소스 (design/03) — 조회 전용, 설정 주입형.

이지어드민 API는 신청제라서 상세 명세를 받은 뒤에야 엔드포인트를 알 수 있다.
그래서 여기에는 명세를 하드코딩하지 않고, `config.json` 의 api 섹션이 동작을 결정한다.

⛔ 쓰기 성격 엔드포인트(주문 상태 변경·재고 조정·송장 등록 등)는 등록하지 않는다.
   허용 메서드는 GET / POST(조회 조건 전달용) 두 가지뿐이다.
"""

from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from .. import normalize as nz
from .base import KIND_LABEL, Source, SourceResult

log = logging.getLogger(__name__)

ALLOWED_METHODS = ("GET", "POST")
_VAR_RE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")


def substitute(value: Any) -> str:
    """`${VAR}` 를 환경변수(.env) 값으로 치환."""
    text = str(value if value is not None else "")
    return _VAR_RE.sub(lambda m: os.environ.get(m.group(1), ""), text)


def _dig(payload: Any, path: list) -> Any:
    node = payload
    for step in path or []:
        if isinstance(node, dict):
            node = node.get(step)
        elif isinstance(node, list) and isinstance(step, int) and 0 <= step < len(node):
            node = node[step]
        else:
            return None
    return node


class ApiSource(Source):
    name = "api"

    def __init__(self, cfg):
        self.cfg = cfg
        self.api: dict[str, Any] = cfg.api or {}

    # ------------------------------------------------------------------
    # 설정 상태
    # ------------------------------------------------------------------

    def accounts(self) -> list[dict[str, Any]]:
        listed = self.api.get("accounts") or []
        if listed:
            return [dict(a) for a in listed]
        return [{"name": "", "auth_params": self.api.get("auth_params") or {}}]

    def configured(self, kind: str) -> tuple[bool, str]:
        """(설정 완비 여부, 사유). 사유에 인증키 값을 넣지 않는다."""
        if not self.api.get("enabled"):
            return False, "config.json 의 api.enabled 가 false 입니다."
        if not str(self.api.get("base_url") or "").strip():
            return False, "config.json 의 api.base_url 이 비어 있습니다."

        endpoint = (self.api.get("endpoints") or {}).get(kind) or {}
        if not str(endpoint.get("path") or "").strip():
            return False, "api.endpoints.%s.path 가 비어 있습니다." % kind

        method = str(endpoint.get("method") or "GET").upper()
        if method not in ALLOWED_METHODS:
            return False, "api.endpoints.%s.method 는 GET 또는 POST 만 허용합니다." % kind

        for account in self.accounts():
            params = account.get("auth_params") or {}
            if not params:
                return False, "api.auth_params 가 비어 있습니다."
            for key, value in params.items():
                if not substitute(value).strip():
                    return False, ".env 에 %s 인증값이 비어 있습니다 (%s)." % (kind, key)
        return True, ""

    def status_text(self) -> str:
        if not self.api.get("enabled"):
            return "미설정 (config.json 의 api.enabled = false)"
        problems = []
        for kind in ("orders", "inventory", "returns"):
            ok, reason = self.configured(kind)
            if not ok:
                problems.append("%s: %s" % (KIND_LABEL.get(kind, kind), reason))
        if not problems:
            return "설정 완료 (주문·재고·반품 엔드포인트 등록됨)"
        return "설정 미완료 — " + " / ".join(problems)

    # ------------------------------------------------------------------
    # 호출
    # ------------------------------------------------------------------

    def _call(self, endpoint: dict, auth_params: dict, context: dict) -> Any:
        base = str(self.api.get("base_url") or "").rstrip("/")
        path = str(endpoint.get("path") or "")
        url = base + ("/" + path.lstrip("/") if path else "")

        params: dict[str, str] = {}
        for key, value in (auth_params or {}).items():
            params[str(key)] = substitute(value)
        for key, value in (endpoint.get("params") or {}).items():
            text = str(value if value is not None else "")
            for token, replacement in context.items():
                text = text.replace("{%s}" % token, replacement)
            params[str(key)] = text

        method = str(endpoint.get("method") or "GET").upper()
        if method not in ALLOWED_METHODS:
            raise ValueError("허용되지 않은 HTTP 메서드입니다: %s" % method)

        timeout = float(self.api.get("timeout_sec") or 15)
        encoding = str(self.api.get("encoding") or "utf-8")
        query = urllib.parse.urlencode(params, encoding=encoding, errors="replace")

        if method == "GET":
            request = urllib.request.Request(url + ("?" + query if query else ""), method="GET")
        else:
            request = urllib.request.Request(
                url,
                data=query.encode(encoding, errors="replace"),
                method="POST",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

        with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310
            body = response.read().decode(encoding, errors="replace")
        return json.loads(body)

    def fetch(self, kind: str, **kwargs) -> SourceResult:
        ok, reason = self.configured(kind)
        if not ok:
            return SourceResult(source="api", ok=False, error=reason)

        endpoint = (self.api.get("endpoints") or {}).get(kind) or {}
        context = {
            "start_date": str(kwargs.get("start_date") or ""),
            "end_date": str(kwargs.get("end_date") or ""),
        }
        keywords = nz.status_keywords(self.cfg.status_keywords)
        field_map = endpoint.get("fields") or {}
        record_path = endpoint.get("record_path") or []

        merged: dict[tuple, dict[str, Any]] = {}
        warnings: list[str] = []
        infos: list[dict[str, str]] = []

        for account in self.accounts():
            label = str(account.get("name") or "기본계정")
            try:
                payload = self._call(endpoint, account.get("auth_params") or {}, context)
            except urllib.error.HTTPError as exc:
                return SourceResult(
                    source="api",
                    ok=False,
                    error="이지어드민 API 응답 오류 (%s, HTTP %s)" % (label, exc.code),
                )
            except urllib.error.URLError as exc:
                return SourceResult(
                    source="api",
                    ok=False,
                    error="이지어드민 API 연결 실패 (%s): %s" % (label, exc.reason),
                )
            except json.JSONDecodeError:
                return SourceResult(
                    source="api",
                    ok=False,
                    error="이지어드민 API 응답을 JSON으로 해석하지 못했습니다 (%s)." % label,
                )
            except Exception as exc:  # noqa: BLE001
                log.warning("API 호출 실패 (%s): %s", label, type(exc).__name__)
                return SourceResult(
                    source="api",
                    ok=False,
                    error="이지어드민 API 호출 중 오류가 발생했습니다 (%s, %s)."
                    % (label, type(exc).__name__),
                )

            rows = _dig(payload, record_path) if record_path else payload
            if not isinstance(rows, list):
                warnings.append(
                    "%s 응답에서 %s 목록을 찾지 못했습니다. api.endpoints.%s.record_path 를 확인하세요."
                    % (label, KIND_LABEL.get(kind, kind), kind)
                )
                continue

            count = 0
            for raw in rows:
                if not isinstance(raw, dict):
                    continue
                rec = nz.normalize_api_record(kind, raw, field_map, keywords)
                if rec is None:
                    continue
                rec["_file"] = "API"
                rec["_account"] = str(account.get("name") or "")
                merged[nz.dedupe_key(kind, rec)] = rec
                count += 1
            infos.append({"파일": "API(%s)" % label, "수정시각": "실시간", "행수": count})

        return SourceResult(
            records=list(merged.values()),
            files=infos,
            warnings=warnings,
            latest=None,
            source="api",
            ok=True,
        )
