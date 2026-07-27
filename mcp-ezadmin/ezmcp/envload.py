"""`.env` 파서 — 표준 라이브러리만 사용.

규칙:
- `KEY=VALUE` 형태의 줄만 인식, `#` 주석과 빈 줄 무시
- 값 양끝의 따옴표 제거
- 이미 `os.environ`에 있는 값이 우선 (셸에서 준 값을 덮어쓰지 않음)
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

log = logging.getLogger(__name__)

_loaded = False


def parse_env_file(path: Path) -> dict[str, str]:
    """`.env` 파일을 읽어 dict로 반환. 파일이 없으면 빈 dict."""
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    try:
        text = path.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError:
        text = path.read_text(encoding="cp949", errors="replace")
    except OSError as exc:
        log.warning(".env 파일을 읽지 못했습니다: %s", exc)
        return values

    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.lower().startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if not key:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key] = value
    return values


def load_env(path: Path, override: bool = False) -> dict[str, str]:
    """`.env` 값을 os.environ에 반영한다. 기본적으로 기존 환경변수가 우선."""
    global _loaded
    values = parse_env_file(path)
    for key, value in values.items():
        if override or key not in os.environ:
            os.environ[key] = value
    _loaded = True
    return values
