"""설정 로딩 — `.env`(비밀·접속) + `config.json`(동작 설정).

로드 순서 (design/07):
1. `.env` 로드 (기존 os.environ 우선)
2. `config.json` 로드. 없으면 `config.example.json`을 복사해 자동 생성
3. 환경변수가 config의 대응 항목을 오버라이드
"""

from __future__ import annotations

import json
import logging
import os
import shutil
from pathlib import Path
from typing import Any

from .envload import load_env

log = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_SUBDIRS = ("orders", "inventory", "returns")

VALID_SOURCE_MODES = ("excel", "api", "auto")
VALID_PII_MODES = ("masked", "summary", "full")

_cache: "Config | None" = None


class Config:
    """서버 동작 설정. 값 읽기 전용으로만 사용한다."""

    def __init__(self, raw: dict[str, Any], root: Path):
        self.root = root
        self.raw = raw

        self.source_mode = self._pick_mode(
            os.environ.get("EZMCP_SOURCE_MODE"),
            raw.get("source_mode"),
            VALID_SOURCE_MODES,
            "excel",
            "EZMCP_SOURCE_MODE",
        )
        self.pii_mode = self._pick_mode(
            os.environ.get("EZMCP_PII_MODE"),
            raw.get("pii_mode"),
            VALID_PII_MODES,
            "masked",
            "EZMCP_PII_MODE",
        )

        data_dir = (os.environ.get("EZMCP_DATA_DIR") or "").strip() or str(
            raw.get("data_dir") or ""
        ).strip()
        self.data_dir = Path(data_dir).expanduser() if data_dir else root / "data"

        self.brands: dict[str, dict] = dict(raw.get("brands") or {})
        self.columns: dict[str, dict] = dict(raw.get("columns") or {})
        self.status_keywords: dict[str, list] = dict(raw.get("status_keywords") or {})
        self.courier_urls: dict[str, str] = dict(raw.get("courier_urls") or {})
        self.api: dict[str, Any] = dict(raw.get("api") or {})

        self.unshipped_delay_days = _as_int(raw.get("unshipped_delay_days"), 2)
        self.low_stock_threshold = _as_int(raw.get("low_stock_threshold"), 3)
        self.stale_hours = _as_int(raw.get("stale_hours"), 24)

        if self.pii_mode == "full":
            log.warning(
                "pii_mode=full 입니다. 고객 개인정보가 마스킹 없이 반환됩니다. "
                "슬랙 등 외부로 답변이 나가는 환경에서는 masked 로 되돌리세요."
            )

    @staticmethod
    def _pick_mode(env_value, cfg_value, valid, default, env_name) -> str:
        for candidate, origin in ((env_value, env_name), (cfg_value, "config.json")):
            if candidate is None:
                continue
            value = str(candidate).strip().lower()
            if not value:
                continue
            if value in valid:
                return value
            log.warning(
                "%s 값 '%s' 은(는) 사용할 수 없습니다. 허용값: %s. 기본값 '%s' 을 사용합니다.",
                origin,
                value,
                ", ".join(valid),
                default,
            )
        return default

    def data_subdir(self, kind: str) -> Path:
        return self.data_dir / kind

    def ensure_data_dirs(self) -> None:
        """data/ 하위 폴더 생성 (설계상 허용된 두 가지 쓰기 예외 중 하나)."""
        for name in DATA_SUBDIRS:
            try:
                (self.data_dir / name).mkdir(parents=True, exist_ok=True)
            except OSError as exc:
                log.warning("데이터 폴더를 만들지 못했습니다 (%s): %s", name, exc)


def _as_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _load_raw(root: Path) -> dict[str, Any]:
    config_path = root / "config.json"
    example_path = root / "config.example.json"

    if not config_path.is_file() and example_path.is_file():
        try:
            shutil.copyfile(example_path, config_path)
            log.info(
                "config.json 이 없어 config.example.json 을 복사해 만들었습니다: %s",
                config_path,
            )
        except OSError as exc:
            log.warning("config.json 자동 생성 실패: %s", exc)

    for path in (config_path, example_path):
        if not path.is_file():
            continue
        try:
            return json.loads(path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as exc:
            log.error(
                "%s 의 JSON 형식이 잘못되었습니다 (%s행): %s", path.name, exc.lineno, exc.msg
            )
        except OSError as exc:
            log.error("%s 를 읽지 못했습니다: %s", path.name, exc)
    log.warning("설정 파일을 찾지 못해 기본값으로 동작합니다.")
    return {}


def get_config(reload: bool = False) -> Config:
    """설정 인스턴스를 반환 (캐시됨)."""
    global _cache
    if _cache is not None and not reload:
        return _cache
    load_env(PROJECT_ROOT / ".env")
    cfg = Config(_load_raw(PROJECT_ROOT), PROJECT_ROOT)
    cfg.ensure_data_dirs()
    _cache = cfg
    return cfg


def reset_cache() -> None:
    """설정 캐시 초기화 (테스트에서 환경변수를 바꾼 뒤 재로드할 때 사용)."""
    global _cache
    _cache = None
