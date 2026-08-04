# -*- coding: utf-8 -*-
"""투어리스트의 Git 제외 원본을 여러 PC 사이에서 안전하게 동기화한다.

Git은 코드와 앱 산출물을 담당하고, 이 도구는 아래 두 종류만 비공개 보관소에
콘텐츠 주소(SHA-256) 방식으로 저장한다.

  coursedata/homepages_auto/<구장>/img/**
  coursedata/homepages_auto/<구장>/pages_v2/**

비밀키, 실행 로그, 다른 데이터 폴더는 설계상 스캔하지 않는다. 삭제는 전파하지
않으며, 두 PC가 같은 파일을 서로 다르게 바꾼 경우 어느 쪽도 덮어쓰지 않는다.

기본 보관소 탐색 순서:
  1. --vault 경로
  2. TOURLIST_ARTIFACT_VAULT 환경 변수
  3. .artifact-sync.local.json 의 이전 설정
  4. Google Drive 스트리밍/미러링 폴더의
     내 드라이브/Tourlist/Ri-weather-artifacts
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
import re
import shutil
import socket
import stat as stat_module
import sys
import unicodedata
import uuid
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any, Iterable


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROJECT = "Ri-weather"
SCHEMA = 1
ROOT = Path(__file__).resolve().parent.parent
STATE_NAME = ".artifact-sync.local.json"
MARKER_NAME = "vault.json"
CANONICAL_NAME = "artifact_vault_canonical.json"
HEADS_DIR = "heads"
ALLOWED_KINDS = ("img", "pages_v2")
HASH_RE = re.compile(r"^[0-9a-f]{64}$")
CHUNK = 4 * 1024 * 1024


class ArtifactError(RuntimeError):
    """사용자에게 설명할 수 있는 동기화 오류."""


class VaultNotReady(ArtifactError):
    """보관소가 아직 초기화되지 않았거나 이 PC에서 보이지 않음."""


class ConflictError(ArtifactError):
    """두 PC가 같은 논리 파일을 서로 다르게 변경함."""


class IntegrityError(ArtifactError):
    """매니페스트 또는 객체 무결성 오류."""


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def canonical_json(value: Any) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        while True:
            block = fh.read(CHUNK)
            if not block:
                break
            digest.update(block)
    return digest.hexdigest()


def sha256_file_with_size(path: Path) -> tuple[str, int]:
    digest = hashlib.sha256()
    total = 0
    with path.open("rb") as fh:
        while True:
            block = fh.read(CHUNK)
            if not block:
                break
            digest.update(block)
            total += len(block)
    return digest.hexdigest(), total


def stable_local_hash(path: Path, attempts: int = 3) -> tuple[str, os.stat_result]:
    """stat→hash→stat 동안 파일이 동일했을 때만 스냅샷 항목을 확정."""
    for _ in range(attempts):
        before = path.stat()
        digest, read_size = sha256_file_with_size(path)
        after = path.stat()
        before_key = (
            before.st_size,
            before.st_mtime_ns,
            before.st_ctime_ns,
            getattr(before, "st_ino", 0),
        )
        after_key = (
            after.st_size,
            after.st_mtime_ns,
            after.st_ctime_ns,
            getattr(after, "st_ino", 0),
        )
        if before_key == after_key and read_size == after.st_size:
            return digest, after
    raise ConflictError(f"해시 계산 중 파일이 계속 바뀌었습니다: {path}")


def move_no_replace(source: Path, destination: Path) -> None:
    """목적지가 생겼다면 절대 덮어쓰지 않는 원자적 이동."""
    if destination.exists():
        raise FileExistsError(str(destination))
    if os.name == "nt":
        os.rename(source, destination)
    else:
        os.link(source, destination)
        source.unlink()


def format_size(size: int) -> str:
    value = float(size)
    units = ("B", "KB", "MB", "GB", "TB")
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{value:.1f}{unit}" if unit != "B" else f"{int(value)}B"
        value /= 1024
    return f"{size}B"


def read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise
    except Exception as exc:
        raise IntegrityError(f"JSON을 읽을 수 없습니다: {path} ({exc})") from exc
    if not isinstance(value, dict):
        raise IntegrityError(f"JSON 최상위 값이 객체가 아닙니다: {path}")
    return value


def atomic_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.{socket.gethostname()}.{os.getpid()}.{uuid.uuid4().hex}.tmp")
    try:
        temp.write_text(
            json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        os.replace(temp, path)
    finally:
        try:
            temp.unlink(missing_ok=True)
        except OSError:
            pass


def allowed_logical_path(logical: str) -> bool:
    if "\\" in logical:
        return False
    if PureWindowsPath(logical).drive or PureWindowsPath(logical).root:
        return False
    path = PurePosixPath(logical)
    parts = path.parts
    if path.is_absolute() or any(part in ("", ".", "..") for part in parts):
        return False
    reserved = {
        "CON",
        "PRN",
        "AUX",
        "NUL",
        *(f"COM{i}" for i in range(1, 10)),
        *(f"LPT{i}" for i in range(1, 10)),
    }
    secret_names = {
        ".env",
        ".secrets",
        ".gemini_key",
        ".cse_key",
        "youtube_key.txt",
        "credentials.json",
        "client_secret.json",
        "token.json",
        "id_rsa",
        "id_ed25519",
    }
    for part in parts:
        if unicodedata.normalize("NFC", part) != part:
            return False
        if any(ord(char) < 32 or char in '<>:"\\|?*' for char in part):
            return False
        if part.endswith((" ", ".")):
            return False
        if part.split(".", 1)[0].upper() in reserved:
            return False
        if part.casefold() in secret_names:
            return False
        if part.casefold().endswith((".pem", ".p12", ".pfx")):
            return False
    return (
        len(parts) >= 5
        and parts[0] == "coursedata"
        and parts[1] == "homepages_auto"
        and bool(parts[2])
        and parts[3] in ALLOWED_KINDS
    )


def kind_for(logical: str) -> str:
    if not allowed_logical_path(logical):
        raise IntegrityError(f"허용되지 않은 논리 경로: {logical}")
    return PurePosixPath(logical).parts[3]


def same_entry(left: dict[str, Any] | None, right: dict[str, Any] | None) -> bool:
    return bool(
        left
        and right
        and left.get("sha256") == right.get("sha256")
        and int(left.get("size", -1)) == int(right.get("size", -2))
    )


def dataset_digest(files: dict[str, dict[str, Any]]) -> str:
    compact = [
        {
            "path": logical,
            "sha256": entry["sha256"],
            "size": int(entry["size"]),
            "kind": entry["kind"],
            "rights": entry.get("rights", "internal_research"),
        }
        for logical, entry in sorted(files.items())
    ]
    return sha256_bytes(canonical_json(compact))


def validate_entry(logical: str, entry: Any) -> dict[str, Any]:
    if not allowed_logical_path(logical):
        raise IntegrityError(f"매니페스트에 허용되지 않은 경로가 있습니다: {logical}")
    if not isinstance(entry, dict):
        raise IntegrityError(f"파일 항목 형식이 잘못되었습니다: {logical}")
    digest = entry.get("sha256")
    size = entry.get("size")
    if not isinstance(digest, str) or not HASH_RE.fullmatch(digest):
        raise IntegrityError(f"SHA-256 형식이 잘못되었습니다: {logical}")
    if not isinstance(size, int) or size < 0:
        raise IntegrityError(f"파일 크기가 잘못되었습니다: {logical}")
    kind = entry.get("kind")
    if kind != kind_for(logical):
        raise IntegrityError(f"파일 종류가 경로와 다릅니다: {logical}")
    rights = entry.get("rights", "internal_research")
    if rights != "internal_research":
        raise IntegrityError(f"지원하지 않는 내부 분류입니다: {logical} ({rights})")
    return {
        "sha256": digest,
        "size": size,
        "kind": kind,
        "rights": rights,
    }


def validate_manifest(value: dict[str, Any]) -> dict[str, Any]:
    if value.get("schema") != SCHEMA or value.get("project") != PROJECT:
        raise IntegrityError("다른 프로젝트이거나 지원하지 않는 매니페스트입니다.")
    raw_files = value.get("files")
    if not isinstance(raw_files, dict):
        raise IntegrityError("매니페스트 files 항목이 없습니다.")
    files: dict[str, dict[str, Any]] = {}
    folded: dict[str, str] = {}
    for logical, raw_entry in raw_files.items():
        if not isinstance(logical, str):
            raise IntegrityError("매니페스트 경로가 문자열이 아닙니다.")
        collision = folded.get(logical.casefold())
        if collision and collision != logical:
            raise IntegrityError(f"Windows에서 충돌하는 경로입니다: {collision} / {logical}")
        folded[logical.casefold()] = logical
        files[logical] = validate_entry(logical, raw_entry)
    expected = dataset_digest(files)
    if value.get("dataset_sha256") != expected:
        raise IntegrityError("매니페스트 dataset_sha256이 파일 목록과 다릅니다.")
    parents = value.get("parents")
    if not isinstance(parents, list) or any(
        not isinstance(parent, str) or not HASH_RE.fullmatch(parent)
        for parent in parents
    ):
        raise IntegrityError("매니페스트 parents 항목이 잘못되었습니다.")
    if len(parents) != len(set(parents)):
        raise IntegrityError("매니페스트 parents에 중복이 있습니다.")
    generation = value.get("generation")
    if not isinstance(generation, int) or generation < 0:
        raise IntegrityError("매니페스트 generation 항목이 잘못되었습니다.")
    result = dict(value)
    result["files"] = files
    return result


def load_state(root: Path) -> dict[str, Any]:
    path = root / STATE_NAME
    if not path.exists():
        return {}
    value = read_json(path)
    if value.get("schema") != SCHEMA or value.get("project") != PROJECT:
        raise IntegrityError(f"로컬 동기화 설정이 손상되었습니다: {path}")
    cache = value.get("cache", {})
    if not isinstance(cache, dict):
        raise IntegrityError(f"로컬 해시 캐시 형식이 잘못되었습니다: {path}")
    return value


def valid_vault_marker(path: Path) -> dict[str, Any] | None:
    marker_path = path / MARKER_NAME
    if not marker_path.is_file():
        return None
    try:
        marker = read_json(marker_path)
    except ArtifactError:
        return None
    if (
        marker.get("schema") == SCHEMA
        and marker.get("project") == PROJECT
        and marker.get("visibility") == "private-internal"
        and isinstance(marker.get("vault_id"), str)
    ):
        return marker
    return None


def load_canonical_config(root: Path) -> dict[str, Any] | None:
    path = root / "tools" / CANONICAL_NAME
    if not path.is_file():
        return None
    value = read_json(path)
    required_hashes = ("initial_snapshot", "initial_dataset_sha256")
    if (
        value.get("schema") != SCHEMA
        or value.get("project") != PROJECT
        or not isinstance(value.get("vault_id_sha256"), str)
        or not HASH_RE.fullmatch(value["vault_id_sha256"])
        or any(
            not isinstance(value.get(name), str)
            or not HASH_RE.fullmatch(value[name])
            for name in required_hashes
        )
        or not isinstance(value.get("initial_file_count"), int)
        or value["initial_file_count"] < 1
        or not isinstance(value.get("initial_object_count"), int)
        or value["initial_object_count"] < 1
        or not isinstance(value.get("initial_total_size"), int)
        or value["initial_total_size"] < 1
    ):
        raise IntegrityError(f"canonical 보관소 설정이 잘못되었습니다: {path}")
    return value


def discover_vault(root: Path, explicit: str | None = None) -> Path:
    if explicit:
        return Path(explicit).expanduser().resolve()
    env_path = os.environ.get("TOURLIST_ARTIFACT_VAULT", "").strip()
    if env_path:
        return Path(env_path).expanduser().resolve()
    state = load_state(root)
    previous = str(state.get("vault", "")).strip()
    if previous:
        previous_path = Path(previous).expanduser().resolve()
        marker = valid_vault_marker(previous_path)
        if marker and marker.get("vault_id") == state.get("vault_id"):
            return previous_path
    google_roots = discover_google_drive_roots()
    vaults = [
        (google_root / "Tourlist" / "Ri-weather-artifacts").resolve()
        for google_root in google_roots
    ]
    canonical = load_canonical_config(root)
    attached = []
    for candidate in vaults:
        marker = valid_vault_marker(candidate)
        if marker and (
            canonical is None
            or sha256_bytes(marker["vault_id"].encode("utf-8"))
            == canonical["vault_id_sha256"]
        ):
            attached.append(candidate)
    if len(attached) == 1:
        return attached[0]
    if len(attached) > 1:
        raise VaultNotReady(
            "유효한 Google Drive 보관소가 여러 개입니다. --vault로 사용할 계정을 지정하세요."
        )
    if len(vaults) == 1:
        return vaults[0]
    if len(vaults) > 1:
        raise VaultNotReady(
            "Google Drive 계정이 여러 개입니다. --vault로 새 보관소 위치를 지정하세요."
        )
    raise VaultNotReady(
        "Google Drive의 '내 드라이브'를 찾지 못했습니다. Drive for desktop에 "
        "로그인한 뒤 다시 실행하거나 --vault 경로를 지정하세요."
    )


def discover_google_drive_roots() -> list[Path]:
    """Google Drive for desktop의 내 드라이브 경로를 찾는다.

    스트리밍은 보통 G:\My Drive(또는 내 드라이브), 미러링은 사용자 폴더
    아래에 생긴다. 계정/언어/드라이브 문자에 의존하지 않도록 알려진 위치와
    현재 존재하는 Windows 드라이브를 모두 확인한다.
    """
    explicit = os.environ.get("GOOGLE_DRIVE_PATH", "").strip()
    candidates: list[Path] = []
    if explicit:
        candidates.append(Path(explicit).expanduser())

    home = Path.home()
    candidates.extend(
        [
            home / "Google Drive" / "My Drive",
            home / "Google Drive" / "내 드라이브",
            home / "My Drive",
            home / "내 드라이브",
        ]
    )
    if os.name == "nt":
        for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
            drive = Path(f"{letter}:\\")
            candidates.extend([drive / "My Drive", drive / "내 드라이브"])

    seen: set[str] = set()
    found: list[Path] = []
    for candidate in candidates:
        key = str(candidate).casefold()
        if key in seen:
            continue
        seen.add(key)
        try:
            if candidate.is_dir():
                found.append(candidate.resolve())
        except OSError:
            continue
    return found


def path_is_inside(child: Path, parent: Path) -> bool:
    child_resolved = child.resolve()
    parent_resolved = parent.resolve()
    return child_resolved == parent_resolved or parent_resolved in child_resolved.parents


def is_google_drive_stream_path(path: Path) -> bool:
    """Windows DriveFS의 Google Drive 볼륨 아래 내 드라이브인지 확인."""
    if os.name != "nt" or not path.anchor:
        return False
    parts = {part.casefold() for part in path.parts}
    if "my drive".casefold() not in parts and "내 드라이브".casefold() not in parts:
        return False
    try:
        import ctypes

        volume_name = ctypes.create_unicode_buffer(261)
        ok = ctypes.windll.kernel32.GetVolumeInformationW(
            path.anchor,
            volume_name,
            len(volume_name),
            None,
            None,
            None,
            None,
            0,
        )
        return bool(ok) and volume_name.value.casefold() == "google drive".casefold()
    except Exception:
        return False


def has_reparse_point(path: Path, strict: bool = False) -> bool:
    """Windows junction/symlink 등 작업 폴더 밖으로 이어질 수 있는 경로인지 확인."""
    try:
        stat = path.lstat()
    except OSError as exc:
        if strict:
            raise IntegrityError(f"경로 속성을 읽을 수 없습니다: {path} ({exc})") from exc
        return False
    attributes = getattr(stat, "st_file_attributes", 0)
    return path.is_symlink() or bool(attributes & 0x400)


def raise_walk_error(error: OSError) -> None:
    raise IntegrityError(f"원본 폴더를 열거할 수 없습니다: {error}") from error


class ArtifactStore:
    def __init__(self, root: Path, vault: Path):
        self.root = root.resolve()
        self.vault = vault.resolve()
        self.state_path = self.root / STATE_NAME
        self.lock_path = self.root / ".artifact-sync.lock"
        self.marker_path = self.vault / MARKER_NAME
        self.manifest_dir = self.vault / "manifests"
        self.head_dir = self.vault / HEADS_DIR
        self.object_dir = self.vault / "objects" / "sha256"
        self.allow_local = False
        if path_is_inside(self.vault, self.root) or path_is_inside(self.root, self.vault):
            raise ArtifactError("비공개 보관소와 Git 작업 폴더를 서로 안에 둘 수 없습니다.")

    def initialize(
        self,
        create: bool = False,
        allow_local: bool = False,
    ) -> dict[str, Any]:
        self.allow_local = allow_local
        if self.marker_path.exists():
            marker = read_json(self.marker_path)
            if (
                marker.get("project") != PROJECT
                or marker.get("schema") != SCHEMA
                or marker.get("visibility") != "private-internal"
                or not isinstance(marker.get("vault_id"), str)
            ):
                raise IntegrityError(f"다른 프로젝트의 보관소입니다: {self.vault}")
        else:
            if not create:
                raise VaultNotReady(
                    f"연결할 기존 보관소가 없습니다: {self.vault}\n"
                    "원본이 있는 최초 PC에서만 init --create를 사용하세요."
                )
            if not allow_local and not is_google_drive_stream_path(self.vault):
                raise ArtifactError(
                    "새 보관소는 Google Drive for desktop의 '내 드라이브' "
                    "스트리밍 경로에서만 만들 수 있습니다."
                )
            if self.vault.exists() and any(self.vault.iterdir()):
                raise ArtifactError(
                    f"표식 없는 비어 있지 않은 폴더에는 새 보관소를 만들지 않습니다: {self.vault}"
                )
            if not allow_local:
                count, _ = self.discover_local()
                if count == 0:
                    raise ArtifactError("최초 원본 PC에 보관할 파일이 하나도 없습니다.")
            self.vault.mkdir(parents=True, exist_ok=True)
            marker = {
                "schema": SCHEMA,
                "project": PROJECT,
                "vault_id": str(uuid.uuid4()),
                "visibility": "private-internal",
                "classification": "private-beta-internal-research",
                "created_at": utc_now(),
                "warning": "공개 Git/공개 링크로 공유하지 마세요.",
            }
            atomic_json(self.marker_path, marker)
        self.vault.mkdir(parents=True, exist_ok=True)
        self.manifest_dir.mkdir(parents=True, exist_ok=True)
        self.head_dir.mkdir(parents=True, exist_ok=True)
        self.object_dir.mkdir(parents=True, exist_ok=True)
        self.require_ready()
        state = load_state(self.root)
        same_vault = (
            state.get("vault_id") == marker["vault_id"]
            and str(state.get("vault", "")).casefold() == str(self.vault).casefold()
        )
        self._save_state(
            base_manifest=state.get("base_manifest") if same_vault else None,
            base_files=state.get("base_files", {}) if same_vault else {},
            cache=state.get("cache", {}) if same_vault else {},
        )
        return marker

    def require_ready(self) -> None:
        if not self.allow_local and not is_google_drive_stream_path(self.vault):
            raise ArtifactError(
                "canonical 원본 보관소는 Google Drive for desktop의 "
                "파일 스트리밍 볼륨에 있어야 합니다. 로컬 복사 폴더는 거부합니다."
            )
        if not self.marker_path.exists():
            raise VaultNotReady(
                f"보관소가 초기화되지 않았습니다: {self.vault}\n"
                "먼저 .\\tourist.cmd tools\\artifact_sync.py init 을 실행하세요."
            )
        marker = read_json(self.marker_path)
        if (
            marker.get("schema") != SCHEMA
            or marker.get("project") != PROJECT
            or marker.get("visibility") != "private-internal"
            or not isinstance(marker.get("vault_id"), str)
        ):
            raise IntegrityError(f"보관소 표식이 잘못되었습니다: {self.marker_path}")
        self._require_canonical_anchor(marker)

    def _require_canonical_anchor(self, marker: dict[str, Any]) -> None:
        canonical = load_canonical_config(self.root)
        if canonical is None:
            return
        if (
            sha256_bytes(marker["vault_id"].encode("utf-8"))
            != canonical["vault_id_sha256"]
        ):
            raise IntegrityError(
                "이 저장소에 고정된 Google Drive 보관소 UUID와 다릅니다. "
                "--vault 경로와 로그인 계정을 확인하세요."
            )
        snapshot = canonical["initial_snapshot"]
        head_path = self._head_path(snapshot)
        manifest_path = self._manifest_path(snapshot)
        if not head_path.is_file() or not manifest_path.is_file():
            raise VaultNotReady(
                "canonical 최초 스냅샷이 아직 Google Drive에서 보이지 않습니다: "
                f"{snapshot}\nDrive 동기화 완료 후 다시 실행하세요."
            )
        head = read_json(head_path)
        if (
            head.get("schema") != SCHEMA
            or head.get("project") != PROJECT
            or head.get("manifest") != snapshot
            or head.get("dataset_sha256") != canonical["initial_dataset_sha256"]
        ):
            raise IntegrityError("canonical 최초 head 표식의 기준값이 다릅니다.")
        manifest_raw = read_json(manifest_path)
        if sha256_bytes(canonical_json(manifest_raw)) != snapshot:
            raise IntegrityError("canonical 최초 매니페스트의 내용 해시가 다릅니다.")
        manifest = validate_manifest(manifest_raw)
        if (
            manifest["dataset_sha256"] != canonical["initial_dataset_sha256"]
            or len(manifest["files"]) != canonical["initial_file_count"]
            or len({entry["sha256"] for entry in manifest["files"].values()})
            != canonical["initial_object_count"]
            or sum(entry["size"] for entry in manifest["files"].values())
            != canonical["initial_total_size"]
        ):
            raise IntegrityError("canonical 최초 스냅샷의 기준값이 다릅니다.")

    def _save_state(
        self,
        base_manifest: str | None,
        base_files: dict[str, dict[str, Any]],
        cache: dict[str, dict[str, Any]],
    ) -> None:
        marker = valid_vault_marker(self.vault)
        if not marker:
            raise VaultNotReady(f"유효한 보관소 표식이 없습니다: {self.vault}")
        value: dict[str, Any] = {
            "schema": SCHEMA,
            "project": PROJECT,
            "vault": str(self.vault),
            "vault_id": marker["vault_id"],
            "base_manifest": base_manifest,
            "base_files": base_files,
            "last_sync": utc_now(),
            "cache": cache,
        }
        atomic_json(self.state_path, value)

    def object_path(self, digest: str) -> Path:
        if not HASH_RE.fullmatch(digest):
            raise IntegrityError(f"잘못된 객체 SHA-256: {digest}")
        return self.object_dir / digest[:2] / digest

    def _manifest_path(self, manifest_id: str) -> Path:
        if not HASH_RE.fullmatch(manifest_id):
            raise IntegrityError(f"잘못된 매니페스트 ID: {manifest_id}")
        return self.manifest_dir / f"{manifest_id}.json"

    def load_manifest(self, manifest_id: str | None) -> dict[str, Any] | None:
        if not manifest_id:
            return None
        path = self._manifest_path(manifest_id)
        if not path.exists():
            raise VaultNotReady(
                f"매니페스트가 아직 Google Drive에서 보이지 않습니다: {manifest_id}"
            )
        raw = read_json(path)
        actual_id = sha256_bytes(canonical_json(raw))
        if actual_id != manifest_id:
            raise IntegrityError(f"매니페스트 내용 해시가 파일명과 다릅니다: {path}")
        return validate_manifest(raw)

    def _head_path(self, manifest_id: str) -> Path:
        if not HASH_RE.fullmatch(manifest_id):
            raise IntegrityError(f"잘못된 head ID: {manifest_id}")
        return self.head_dir / f"{manifest_id}.json"

    def load_head_markers(self) -> dict[str, dict[str, Any]]:
        self.require_ready()
        if not self.head_dir.is_dir():
            return {}
        markers: dict[str, dict[str, Any]] = {}
        for path in sorted(self.head_dir.glob("*.json")):
            manifest_id = path.stem
            if not HASH_RE.fullmatch(manifest_id):
                raise IntegrityError(f"잘못된 head 파일명입니다: {path}")
            marker = read_json(path)
            parents = marker.get("parents")
            if (
                marker.get("schema") != SCHEMA
                or marker.get("project") != PROJECT
                or marker.get("manifest") != manifest_id
                or not isinstance(parents, list)
                or any(
                    not isinstance(parent, str) or not HASH_RE.fullmatch(parent)
                    for parent in parents
                )
                or not isinstance(marker.get("generation"), int)
                or marker["generation"] < 0
                or not isinstance(marker.get("dataset_sha256"), str)
                or not HASH_RE.fullmatch(marker["dataset_sha256"])
            ):
                raise IntegrityError(f"head 표식 형식이 잘못되었습니다: {path}")
            markers[manifest_id] = marker
        for manifest_id, marker in markers.items():
            missing_parents = [
                parent for parent in marker["parents"] if parent not in markers
            ]
            if missing_parents:
                raise VaultNotReady(
                    "부모 head가 아직 Google Drive에서 보이지 않습니다: "
                    + ", ".join(missing_parents[:5])
                )
            expected_generation = (
                max(markers[parent]["generation"] for parent in marker["parents"]) + 1
                if marker["parents"]
                else 0
            )
            if marker["generation"] != expected_generation:
                raise IntegrityError(f"head generation이 부모와 맞지 않습니다: {manifest_id}")
            manifest = self.load_manifest(manifest_id)
            assert manifest is not None
            if (
                manifest["parents"] != marker["parents"]
                or manifest["generation"] != marker["generation"]
                or manifest["dataset_sha256"] != marker["dataset_sha256"]
            ):
                raise IntegrityError(f"head와 매니페스트가 다릅니다: {manifest_id}")
            marker["_manifest_value"] = manifest
        return markers

    def _ancestor_set(
        self,
        manifest_id: str,
        markers: dict[str, dict[str, Any]],
        memo: dict[str, set[str]],
        visiting: set[str] | None = None,
    ) -> set[str]:
        if manifest_id in memo:
            return memo[manifest_id]
        if manifest_id not in markers:
            raise VaultNotReady(
                f"head의 부모가 아직 Google Drive에서 보이지 않습니다: {manifest_id}\n"
                "Drive 동기화가 끝난 뒤 다시 실행하세요."
            )
        visiting = set() if visiting is None else set(visiting)
        if manifest_id in visiting:
            raise IntegrityError("head 그래프에 순환이 있습니다.")
        visiting.add(manifest_id)
        result = {manifest_id}
        for parent in markers[manifest_id]["parents"]:
            result.update(self._ancestor_set(parent, markers, memo, visiting))
        memo[manifest_id] = result
        return result

    def _resolve_manifest_files(
        self,
        manifest_ids: list[str],
        markers: dict[str, dict[str, Any]],
        ancestor_memo: dict[str, set[str]],
        resolve_memo: dict[tuple[str, ...], dict[str, dict[str, Any]]],
    ) -> dict[str, dict[str, Any]]:
        """여러 DAG head를 maximal common ancestors의 가상 병합 기준으로 합친다."""
        key = tuple(sorted(set(manifest_ids)))
        if key in resolve_memo:
            return resolve_memo[key]
        if len(key) == 1:
            files = dict(markers[key[0]]["_manifest_value"]["files"])
            resolve_memo[key] = files
            return files

        ancestor_sets = [
            self._ancestor_set(item, markers, ancestor_memo) for item in key
        ]
        common = set.intersection(*ancestor_sets) if ancestor_sets else set()
        maximal_common = sorted(
            candidate
            for candidate in common
            if not any(
                candidate != other
                and candidate
                in self._ancestor_set(other, markers, ancestor_memo)
                for other in common
            )
        )
        if len(maximal_common) == 1:
            base_files = dict(
                markers[maximal_common[0]]["_manifest_value"]["files"]
            )
        elif maximal_common:
            base_files = self._resolve_manifest_files(
                maximal_common,
                markers,
                ancestor_memo,
                resolve_memo,
            )
        else:
            base_files = {}

        views = [markers[item]["_manifest_value"]["files"] for item in key]
        merged: dict[str, dict[str, Any]] = {}
        conflicts: list[str] = []
        all_paths = set(base_files)
        for view in views:
            all_paths.update(view)
        for logical in sorted(all_paths):
            base = base_files.get(logical)
            unique: dict[tuple[str, int], dict[str, Any]] = {}
            for view in views:
                entry = view.get(logical)
                if entry is not None:
                    unique[(entry["sha256"], entry["size"])] = entry
            if len(unique) <= 1:
                if unique:
                    merged[logical] = next(iter(unique.values()))
                elif base:
                    merged[logical] = base
                continue
            changed = {
                entry_key: entry
                for entry_key, entry in unique.items()
                if not same_entry(entry, base)
            }
            if len(changed) == 1:
                merged[logical] = next(iter(changed.values()))
            elif not changed and base:
                merged[logical] = base
            else:
                conflicts.append(logical)

        if conflicts:
            self._write_conflict_report("remote-heads", conflicts)
            raise ConflictError(
                "Google Drive에 같은 원본의 서로 다른 head가 있습니다. "
                "어느 쪽도 자동 선택하지 않았습니다:\n  "
                + "\n  ".join(conflicts[:20])
            )
        resolve_memo[key] = merged
        return merged

    def load_latest(self) -> tuple[str | None, dict[str, Any] | None]:
        """append-only head들을 읽어 현재 원격 뷰를 결정한다.

        Google Drive 폴더 동기화에는 원자적인 compare-and-swap이 없으므로 단일
        latest.json을 쓰지 않는다. 동시 push는 서로 다른 불변 head로 남고, 다음
        PC가 공통 조상 기준으로 합친다. 같은 논리 파일의 분기는 충돌로 중단한다.
        """
        self.require_ready()
        markers = self.load_head_markers()
        if not markers:
            return None, None
        referenced = {
            parent
            for marker in markers.values()
            for parent in marker["parents"]
        }
        leaves = sorted(set(markers) - referenced)
        if not leaves:
            raise IntegrityError("원격 head 그래프에 leaf가 없습니다.")

        merged = self._resolve_manifest_files(
            leaves,
            markers,
            ancestor_memo={},
            resolve_memo={},
        )

        # head가 하나면 사용자가 Google Drive에서 보는 실제 불변 snapshot ID를
        # 그대로 돌려준다. 여러 동시 head를 가상 병합한 경우에만 합성 view ID다.
        view_id = leaves[0] if len(leaves) == 1 else sha256_bytes(
            canonical_json(
                {"heads": leaves, "dataset_sha256": dataset_digest(merged)}
            )
        )
        view = {
            "schema": SCHEMA,
            "project": PROJECT,
            "head_ids": leaves,
            "virtual": len(leaves) > 1,
            "generation": max(markers[item]["generation"] for item in leaves) + 1,
            "dataset_sha256": dataset_digest(merged),
            "files": merged,
        }
        return view_id, view

    def _iter_allowed_files(self) -> Iterable[tuple[str, Path, str]]:
        base = self.root / "coursedata" / "homepages_auto"
        try:
            base_stat = base.stat()
        except FileNotFoundError:
            return
        except OSError as exc:
            raise IntegrityError(f"원본 루트를 읽을 수 없습니다: {base} ({exc})") from exc
        if not stat_module.S_ISDIR(base_stat.st_mode):
            raise IntegrityError(f"원본 루트가 폴더가 아닙니다: {base}")
        if has_reparse_point(base, strict=True):
            raise IntegrityError(f"junction/심볼릭 링크 루트는 허용하지 않습니다: {base}")
        folded: dict[str, str] = {}
        for course in sorted(base.iterdir(), key=lambda item: item.name.casefold()):
            if has_reparse_point(course, strict=True):
                raise IntegrityError(f"junction/심볼릭 링크 구장 폴더는 허용하지 않습니다: {course}")
            try:
                course_stat = course.stat()
            except OSError as exc:
                raise IntegrityError(f"구장 경로를 읽을 수 없습니다: {course} ({exc})") from exc
            if not stat_module.S_ISDIR(course_stat.st_mode):
                continue
            for kind in ALLOWED_KINDS:
                kind_dir = course / kind
                try:
                    kind_stat = kind_dir.stat()
                except FileNotFoundError:
                    continue
                except OSError as exc:
                    raise IntegrityError(
                        f"원본 폴더를 읽을 수 없습니다: {kind_dir} ({exc})"
                    ) from exc
                if not stat_module.S_ISDIR(kind_stat.st_mode):
                    raise IntegrityError(f"원본 경로가 폴더가 아닙니다: {kind_dir}")
                if has_reparse_point(kind_dir, strict=True):
                    raise IntegrityError(f"junction/심볼릭 링크 원본 폴더는 허용하지 않습니다: {kind_dir}")
                for current, dirs, names in os.walk(
                    kind_dir,
                    followlinks=False,
                    onerror=raise_walk_error,
                ):
                    current_path = Path(current)
                    for dirname in sorted(dirs, key=str.casefold):
                        directory = current_path / dirname
                        if has_reparse_point(directory, strict=True):
                            raise IntegrityError(
                                f"junction/심볼릭 링크 폴더는 허용하지 않습니다: {directory}"
                            )
                    for filename in sorted(names, key=str.casefold):
                        path = current_path / filename
                        if has_reparse_point(path, strict=True):
                            raise IntegrityError(
                                f"junction/심볼릭 링크 파일은 허용하지 않습니다: {path}"
                            )
                        try:
                            file_stat = path.stat()
                        except OSError as exc:
                            raise IntegrityError(
                                f"원본 파일을 읽을 수 없습니다: {path} ({exc})"
                            ) from exc
                        if not stat_module.S_ISREG(file_stat.st_mode):
                            continue
                        logical = path.relative_to(self.root).as_posix()
                        if not allowed_logical_path(logical):
                            raise IntegrityError(f"허용 목록 밖 파일이 스캔되었습니다: {logical}")
                        folded_key = unicodedata.normalize("NFC", logical).casefold()
                        collision = folded.get(folded_key)
                        if collision and collision != logical:
                            raise IntegrityError(
                                f"Windows에서 충돌하는 로컬 경로입니다: {collision} / {logical}"
                            )
                        folded[folded_key] = logical
                        yield logical, path, kind

    def discover_local(self) -> tuple[int, int]:
        count = 0
        size = 0
        for _, path, _ in self._iter_allowed_files():
            stat = path.stat()
            count += 1
            size += stat.st_size
        return count, size

    def scan_local(
        self, deep: bool = False
    ) -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
        # push/pull/status의 판단 근거이므로 mtime/size 캐시를 신뢰하지 않는다.
        # 같은 크기로 수정한 뒤 mtime이 복원된 파일도 반드시 잡아야 한다.
        files: dict[str, dict[str, Any]] = {}
        cache: dict[str, dict[str, Any]] = {}
        for logical, path, kind in self._iter_allowed_files():
            digest, stat = stable_local_hash(path)
            files[logical] = {
                "sha256": digest,
                "size": stat.st_size,
                "kind": kind,
                "rights": "internal_research",
            }
            cache[logical] = {
                "sha256": digest,
                "size": stat.st_size,
                "mtime_ns": stat.st_mtime_ns,
            }
        return files, cache

    def _cache_for_files(
        self, files: dict[str, dict[str, Any]]
    ) -> dict[str, dict[str, Any]]:
        cache: dict[str, dict[str, Any]] = {}
        for logical, entry in files.items():
            path = self.local_path(logical)
            if not path.is_file():
                continue
            stat = path.stat()
            if stat.st_size != entry["size"]:
                continue
            cache[logical] = {
                "sha256": entry["sha256"],
                "size": stat.st_size,
                "mtime_ns": stat.st_mtime_ns,
            }
        return cache

    def local_path(self, logical: str) -> Path:
        if not allowed_logical_path(logical):
            raise IntegrityError(f"허용되지 않은 논리 경로: {logical}")
        target = self.root.joinpath(*PurePosixPath(logical).parts)
        resolved = target.resolve(strict=False)
        if self.root != resolved and self.root not in resolved.parents:
            raise IntegrityError(f"작업 폴더 밖으로 나가는 경로입니다: {logical}")
        current = target.parent
        while current != self.root.parent:
            if current.exists() and has_reparse_point(current):
                raise IntegrityError(f"junction/심볼릭 링크 조상에는 쓰지 않습니다: {current}")
            if current == self.root:
                break
            current = current.parent
        return target

    def _copy_and_verify(
        self,
        source: Path,
        destination: Path,
        expected: str,
        expected_size: int,
    ) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.is_symlink():
            raise IntegrityError(f"심볼릭 링크에는 쓰지 않습니다: {destination}")
        resolved = destination.resolve(strict=False)
        if destination.parts[: len(self.root.parts)] == self.root.parts:
            if self.root != resolved and self.root not in resolved.parents:
                raise IntegrityError(f"작업 폴더 밖으로 나가는 대상입니다: {destination}")
        temp = destination.with_name(
            f".{destination.name}.{socket.gethostname()}.{os.getpid()}.{uuid.uuid4().hex}.tmp"
        )
        digest = hashlib.sha256()
        copied_size = 0
        try:
            with source.open("rb") as src, temp.open("xb") as dst:
                while True:
                    block = src.read(CHUNK)
                    if not block:
                        break
                    digest.update(block)
                    copied_size += len(block)
                    dst.write(block)
            actual = digest.hexdigest()
            if actual != expected or copied_size != expected_size:
                raise IntegrityError(
                    f"복사 무결성 불일치: {source} "
                    f"(SHA 예상 {expected}, 실제 {actual}; "
                    f"크기 예상 {expected_size}, 실제 {copied_size})"
                )
            os.replace(temp, destination)
        finally:
            try:
                temp.unlink(missing_ok=True)
            except OSError:
                pass

    def _ensure_object(self, logical: str, entry: dict[str, Any]) -> bool:
        destination = self.object_path(entry["sha256"])
        if destination.exists():
            self._check_object(entry, deep=True)
            return False
        source = self.local_path(logical)
        if not source.is_file():
            raise IntegrityError(f"업로드할 로컬 파일이 없습니다: {logical}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        self._copy_and_verify(
            source,
            destination,
            entry["sha256"],
            entry["size"],
        )
        self._check_object(entry, deep=True)
        return True

    def _check_object(self, entry: dict[str, Any], deep: bool = True) -> None:
        path = self.object_path(entry["sha256"])
        if not path.is_file():
            raise VaultNotReady(
                f"원격 객체가 아직 보이지 않습니다: {entry['sha256']}\n"
                "Google Drive 동기화가 끝난 뒤 같은 명령을 다시 실행하세요."
            )
        if path.stat().st_size != entry["size"]:
            raise IntegrityError(f"원격 객체 크기가 다릅니다: {path}")
        if deep and sha256_file(path) != entry["sha256"]:
            raise IntegrityError(f"원격 객체 SHA-256이 다릅니다: {path}")

    def _matches_planned_local(
        self,
        logical: str,
        expected: dict[str, Any] | None,
    ) -> bool:
        target = self.local_path(logical)
        if expected is None:
            return not target.exists()
        if not target.is_file() or target.stat().st_size != expected["size"]:
            return False
        return sha256_file(target) == expected["sha256"]

    @staticmethod
    def _path_matches_entry(path: Path, entry: dict[str, Any] | None) -> bool:
        if entry is None:
            return not path.exists()
        return (
            path.is_file()
            and path.stat().st_size == entry["size"]
            and sha256_file(path) == entry["sha256"]
        )

    def _materialize_batch(
        self,
        plans: list[tuple[str, dict[str, Any], dict[str, Any] | None]],
    ) -> None:
        """원격 파일을 전부 staging한 뒤 목적지 변화가 없을 때만 일괄 교체."""
        if not plans:
            return
        transaction = self.root / ".artifact-tmp" / uuid.uuid4().hex
        staged_root = transaction / "staged"
        backup_root = transaction / "backup"
        applied: list[tuple[Path, Path, bool, dict[str, Any]]] = []
        preserve_transaction = False
        try:
            for logical, entry, _ in plans:
                self._check_object(entry, deep=True)
                staged = staged_root.joinpath(*PurePosixPath(logical).parts)
                self._copy_and_verify(
                    self.object_path(entry["sha256"]),
                    staged,
                    entry["sha256"],
                    entry["size"],
                )

            changed = [
                logical
                for logical, _, expected in plans
                if not self._matches_planned_local(logical, expected)
            ]
            if changed:
                self._write_conflict_report("destination-changed", changed)
                raise ConflictError(
                    "동기화 준비 중 로컬 원본이 바뀌어 덮어쓰지 않았습니다:\n  "
                    + "\n  ".join(changed[:20])
                )

            for index, (logical, entry, expected) in enumerate(plans):
                if not self._matches_planned_local(logical, expected):
                    raise ConflictError(
                        f"교체 직전 로컬 원본이 바뀌었습니다. 덮어쓰지 않았습니다: {logical}"
                    )
                target = self.local_path(logical)
                staged = staged_root.joinpath(*PurePosixPath(logical).parts)
                backup = backup_root / f"{index:08d}.bak"
                target.parent.mkdir(parents=True, exist_ok=True)
                had_original = target.exists()
                if had_original:
                    backup.parent.mkdir(parents=True, exist_ok=True)
                    os.replace(target, backup)
                    if not self._path_matches_entry(backup, expected):
                        if not target.exists():
                            preserve_transaction = True
                            try:
                                move_no_replace(backup, target)
                                preserve_transaction = False
                            except FileExistsError:
                                pass
                        else:
                            preserve_transaction = True
                        raise ConflictError(
                            f"백업 이동 중 로컬 원본이 바뀌었습니다: {logical}"
                        )
                if target.exists():
                    if had_original:
                        preserve_transaction = True
                    raise ConflictError(
                        f"교체 직전 새 로컬 파일이 생겼습니다. 덮어쓰지 않았습니다: {logical}"
                    )
                try:
                    move_no_replace(staged, target)
                except FileExistsError as exc:
                    if had_original:
                        preserve_transaction = True
                    raise ConflictError(
                        f"교체 순간 새 로컬 파일이 생겼습니다. 덮어쓰지 않았습니다: {logical}"
                    ) from exc
                except Exception:
                    if had_original and backup.exists():
                        preserve_transaction = True
                        if not target.exists():
                            try:
                                move_no_replace(backup, target)
                                preserve_transaction = False
                            except FileExistsError:
                                pass
                    raise
                applied.append((target, backup, had_original, entry))
        except Exception as original_error:
            rollback_errors: list[str] = []
            for rollback_index, (target, backup, had_original, entry) in enumerate(
                reversed(applied)
            ):
                try:
                    if target.exists():
                        candidate = backup_root / f"rollback-new-{rollback_index:08d}.tmp"
                        os.replace(target, candidate)
                        if not self._path_matches_entry(candidate, entry):
                            if not target.exists():
                                move_no_replace(candidate, target)
                            raise IntegrityError(
                                f"롤백 중 외부 변경을 발견했습니다. 수동 확인 필요: {target}"
                            )
                    if had_original and backup.exists():
                        move_no_replace(backup, target)
                except Exception as exc:
                    rollback_errors.append(str(exc))
            if rollback_errors or preserve_transaction:
                preserve_transaction = True
                details = "; ".join(rollback_errors) if rollback_errors else str(original_error)
                raise IntegrityError(
                    "자동 롤백을 완전히 끝내지 못해 백업을 보존했습니다. "
                    f"수동 확인 폴더: {transaction} ({details})"
                ) from original_error
            raise
        finally:
            if not preserve_transaction:
                shutil.rmtree(transaction, ignore_errors=True)

    def _write_manifest(
        self,
        files: dict[str, dict[str, Any]],
        parents: list[str],
    ) -> tuple[str, dict[str, Any]]:
        parents = sorted(set(parents))
        markers = self.load_head_markers()
        for parent in parents:
            if parent not in markers:
                raise VaultNotReady(
                    f"부모 head가 아직 Google Drive에서 보이지 않습니다: {parent}"
                )
        generation = (
            max(markers[parent]["generation"] for parent in parents) + 1
            if parents
            else 0
        )
        value: dict[str, Any] = {
            "schema": SCHEMA,
            "project": PROJECT,
            "created_at": utc_now(),
            "created_by": socket.gethostname(),
            "parents": parents,
            "generation": generation,
            "classification": "private-beta-internal-research",
            "deletion_policy": "preserve",
            "scopes": [
                "coursedata/homepages_auto/*/img/**",
                "coursedata/homepages_auto/*/pages_v2/**",
            ],
            "dataset_sha256": dataset_digest(files),
            "files": dict(sorted(files.items())),
        }
        manifest_id = sha256_bytes(canonical_json(value))
        path = self._manifest_path(manifest_id)
        if path.exists():
            existing = read_json(path)
            if canonical_json(existing) != canonical_json(value):
                raise IntegrityError(f"동일 ID의 매니페스트 내용이 다릅니다: {path}")
        else:
            atomic_json(path, value)
        head = {
            "schema": SCHEMA,
            "project": PROJECT,
            "manifest": manifest_id,
            "parents": parents,
            "generation": generation,
            "dataset_sha256": value["dataset_sha256"],
            "created_at": value["created_at"],
            "created_by": value["created_by"],
        }
        head_path = self._head_path(manifest_id)
        if head_path.exists():
            existing_head = read_json(head_path)
            if canonical_json(existing_head) != canonical_json(head):
                raise IntegrityError(f"동일 ID의 head 내용이 다릅니다: {head_path}")
        else:
            atomic_json(head_path, head)
        return manifest_id, value

    def _base_files(self) -> tuple[str | None, dict[str, dict[str, Any]]]:
        state = load_state(self.root)
        base_id = state.get("base_manifest")
        if base_id is not None and not isinstance(base_id, str):
            raise IntegrityError("로컬 기준 매니페스트 ID가 잘못되었습니다.")
        raw_files = state.get("base_files", {})
        if not isinstance(raw_files, dict):
            raise IntegrityError("로컬 기준 파일 목록이 잘못되었습니다.")
        files = {
            logical: validate_entry(logical, entry)
            for logical, entry in raw_files.items()
        }
        return base_id, files

    @contextlib.contextmanager
    def operation_lock(self) -> Iterable[None]:
        token = uuid.uuid4().hex
        payload = canonical_json(
            {
                "project": PROJECT,
                "host": socket.gethostname(),
                "pid": os.getpid(),
                "created_at": utc_now(),
                "token": token,
            }
        )
        try:
            fd = os.open(
                self.lock_path,
                os.O_WRONLY | os.O_CREAT | os.O_EXCL,
            )
        except FileExistsError as exc:
            raise ArtifactError(
                f"다른 원본 동기화가 실행 중입니다: {self.lock_path}\n"
                "실행 중인 작업이 없다면 파일 내용을 확인한 뒤 수동으로 정리하세요."
            ) from exc
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(payload)
            yield
        finally:
            try:
                current = read_json(self.lock_path)
                if current.get("token") == token:
                    self.lock_path.unlink(missing_ok=True)
            except (ArtifactError, OSError):
                pass

    def pull(self) -> dict[str, Any]:
        with self.operation_lock():
            return self._pull_unlocked()

    def _pull_unlocked(self) -> dict[str, Any]:
        remote_id, remote_manifest = self.load_latest()
        if not remote_id or not remote_manifest:
            raise VaultNotReady("보관소에 아직 최신 스냅샷이 없습니다. 원본 PC에서 push 하세요.")
        _, base_files = self._base_files()
        local_files, _ = self.scan_local()
        remote_files = remote_manifest["files"]
        conflicts: list[str] = []
        to_copy: list[str] = []
        pending_local: list[str] = []

        for logical, remote in remote_files.items():
            local = local_files.get(logical)
            base = base_files.get(logical)
            if same_entry(local, remote):
                continue
            if local is None:
                to_copy.append(logical)
            elif base and same_entry(local, base):
                to_copy.append(logical)
            elif base and same_entry(remote, base):
                pending_local.append(logical)
            else:
                conflicts.append(logical)

        if conflicts:
            self._write_conflict_report("pull", conflicts)
            raise ConflictError(
                "같은 원본을 양쪽 PC에서 다르게 변경했습니다. 자동으로 덮어쓰지 않았습니다:\n  "
                + "\n  ".join(conflicts[:20])
            )

        plans = [
            (logical, remote_files[logical], local_files.get(logical))
            for logical in to_copy
        ]
        self._materialize_batch(plans)
        for logical in to_copy:
            local_files[logical] = remote_files[logical]
        combined = dict(local_files)
        for logical, entry in remote_files.items():
            if logical not in pending_local:
                combined[logical] = entry
        self._save_state(
            remote_id,
            base_files=remote_files,
            cache=self._cache_for_files(combined),
        )
        return {
            "manifest": remote_id,
            "copied": len(to_copy),
            "pending_local": pending_local,
            "local_count": len(combined),
            "dataset_sha256": remote_manifest["dataset_sha256"],
        }

    def push(self) -> dict[str, Any]:
        with self.operation_lock():
            return self._push_unlocked()

    def _push_unlocked(self) -> dict[str, Any]:
        self.require_ready()
        initial_remote_id, remote_manifest = self.load_latest()
        _, base_files = self._base_files()
        local_files, _ = self.scan_local()
        remote_files = remote_manifest["files"] if remote_manifest else {}
        if not local_files and not remote_files:
            raise ArtifactError("동기화할 원본 파일이 하나도 없어 빈 보관소를 만들지 않았습니다.")

        merged: dict[str, dict[str, Any]] = {}
        conflicts: list[str] = []
        remote_wins: list[str] = []
        local_wins: list[str] = []

        for logical in sorted(set(local_files) | set(remote_files) | set(base_files)):
            local = local_files.get(logical)
            remote = remote_files.get(logical)
            base = base_files.get(logical)
            if local and remote and same_entry(local, remote):
                merged[logical] = remote
            elif local and not remote:
                merged[logical] = local
                local_wins.append(logical)
            elif remote and not local:
                merged[logical] = remote
                remote_wins.append(logical)
            elif local and remote:
                if base and same_entry(local, base) and not same_entry(remote, base):
                    merged[logical] = remote
                    remote_wins.append(logical)
                elif base and same_entry(remote, base) and not same_entry(local, base):
                    merged[logical] = local
                    local_wins.append(logical)
                else:
                    conflicts.append(logical)

        if conflicts:
            self._write_conflict_report("push", conflicts)
            raise ConflictError(
                "같은 원본을 양쪽 PC에서 다르게 변경했습니다. 어느 쪽도 올리지 않았습니다:\n  "
                + "\n  ".join(conflicts[:20])
            )

        uploaded = 0
        verified_objects: set[str] = set()
        for logical, entry in merged.items():
            object_path = self.object_path(entry["sha256"])
            if object_path.exists():
                if entry["sha256"] not in verified_objects:
                    self._check_object(entry, deep=True)
                    verified_objects.add(entry["sha256"])
                continue
            local = local_files.get(logical)
            if local and same_entry(local, entry):
                if self._ensure_object(logical, entry):
                    uploaded += 1
            else:
                raise VaultNotReady(
                    f"선택된 원격 객체가 아직 이 PC에서 보이지 않습니다: {logical}\n"
                    "Google Drive 동기화 완료 후 다시 실행하세요."
                )

        plans = [
            (logical, merged[logical], local_files.get(logical))
            for logical in remote_wins
            if not same_entry(local_files.get(logical), merged[logical])
        ]
        self._materialize_batch(plans)
        for logical, remote, _ in plans:
            local_files[logical] = remote

        # 스캔 뒤 수집기/편집기가 파일을 바꿨다면 오래된 스냅샷을 성공으로
        # 발표하지 않는다. 이미 올라간 CAS 객체는 무해하므로 다음 push가 재사용한다.
        final_local, _ = self.scan_local(deep=True)
        changed_during_push = sorted(
            logical
            for logical in set(final_local) | set(merged)
            if not same_entry(final_local.get(logical), merged.get(logical))
        )
        if changed_during_push:
            self._write_conflict_report("changed-during-push", changed_during_push)
            raise ConflictError(
                "push 도중 로컬 원본이 바뀌었습니다. 새 변경은 보존했으며 "
                "다시 push해야 합니다:\n  "
                + "\n  ".join(changed_during_push[:20])
            )

        changed = not remote_manifest or (
            dataset_digest(merged) != remote_manifest["dataset_sha256"]
        ) or bool(remote_manifest.get("virtual"))
        if changed:
            parents = remote_manifest.get("head_ids", []) if remote_manifest else []
            manifest_id, manifest = self._write_manifest(merged, parents)
        else:
            assert initial_remote_id and remote_manifest
            manifest_id, manifest = initial_remote_id, remote_manifest

        self._save_state(
            manifest_id,
            base_files=merged,
            cache=self._cache_for_files(merged),
        )
        return {
            "manifest": manifest_id,
            "uploaded_objects": uploaded,
            "restored_from_remote": len(remote_wins),
            "changed_files": len(local_wins),
            "file_count": len(merged),
            "total_size": sum(entry["size"] for entry in merged.values()),
            "dataset_sha256": manifest["dataset_sha256"],
            "new_snapshot": changed,
        }

    def status(self) -> dict[str, Any]:
        remote_id, remote_manifest = self.load_latest()
        base_id, base_files = self._base_files()
        local_files, _ = self.scan_local()
        remote_files = remote_manifest["files"] if remote_manifest else {}
        local_changes: list[str] = []
        remote_changes: list[str] = []
        conflicts: list[str] = []

        for logical in sorted(set(local_files) | set(remote_files) | set(base_files)):
            local = local_files.get(logical)
            remote = remote_files.get(logical)
            base = base_files.get(logical)
            if same_entry(local, remote):
                continue
            if local and not remote:
                local_changes.append(logical)
            elif remote and not local:
                remote_changes.append(logical)
            elif local and remote:
                if base and same_entry(local, base):
                    remote_changes.append(logical)
                elif base and same_entry(remote, base):
                    local_changes.append(logical)
                else:
                    conflicts.append(logical)

        return {
            "vault": str(self.vault),
            "base_manifest": base_id,
            "remote_manifest": remote_id,
            "local_count": len(local_files),
            "local_size": sum(entry["size"] for entry in local_files.values()),
            "remote_count": len(remote_files),
            "remote_size": sum(entry["size"] for entry in remote_files.values()),
            "local_changes": local_changes,
            "remote_changes": remote_changes,
            "conflicts": conflicts,
            "dataset_sha256": remote_manifest.get("dataset_sha256") if remote_manifest else None,
        }

    def verify(self, deep: bool = False) -> dict[str, Any]:
        remote_id, remote_manifest = self.load_latest()
        if not remote_id or not remote_manifest:
            raise VaultNotReady("검증할 원격 스냅샷이 없습니다.")
        local_files, cache = self.scan_local(deep=True)
        remote_files = remote_manifest["files"]
        missing = sorted(set(remote_files) - set(local_files))
        extra = sorted(set(local_files) - set(remote_files))
        mismatch = sorted(
            logical
            for logical in set(remote_files) & set(local_files)
            if not same_entry(remote_files[logical], local_files[logical])
        )
        checked: set[str] = set()
        object_errors: list[str] = []
        for entry in remote_files.values():
            digest = entry["sha256"]
            if digest in checked:
                continue
            checked.add(digest)
            try:
                self._check_object(entry, deep=True)
            except ArtifactError as exc:
                object_errors.append(str(exc))
        if not missing and not extra and not mismatch and not object_errors:
            self._save_state(
                remote_id,
                base_files=remote_files,
                cache=cache,
            )
        return {
            "manifest": remote_id,
            "deep": True,
            "files": len(remote_files),
            "objects": len(checked),
            "missing": missing,
            "extra": extra,
            "mismatch": mismatch,
            "object_errors": object_errors,
            "dataset_sha256": remote_manifest["dataset_sha256"],
        }

    def _write_conflict_report(self, operation: str, paths: list[str]) -> None:
        report_dir = self.root / ".artifact-conflicts"
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        atomic_json(
            report_dir / f"{stamp}-{operation}-{uuid.uuid4().hex[:8]}.json",
            {
                "schema": SCHEMA,
                "project": PROJECT,
                "operation": operation,
                "created_at": utc_now(),
                "host": socket.gethostname(),
                "paths": paths,
                "message": "자동 덮어쓰기를 하지 않았습니다. 두 버전을 사람이 확인하세요.",
            },
        )


def print_paths(paths: list[str], limit: int = 8) -> None:
    for logical in paths[:limit]:
        print(f"    - {logical}")
    if len(paths) > limit:
        print(f"    ... 외 {len(paths) - limit}개")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="투어리스트 Git 제외 원본의 비공개 다중 PC 동기화"
    )
    parser.add_argument("--vault", help="비공개 동기화 폴더 경로")
    parser.add_argument(
        "--root",
        help=argparse.SUPPRESS,
        default=str(ROOT),
    )
    sub = parser.add_subparsers(dest="command", required=True)
    init = sub.add_parser("init", help="비공개 보관소 연결")
    init.add_argument(
        "--create",
        action="store_true",
        help="원본이 있는 최초 PC에서 새 보관소 생성",
    )
    init.add_argument(
        "--allow-local-vault",
        action="store_true",
        help=argparse.SUPPRESS,
    )
    sub.add_parser("pull", help="다른 PC의 원본을 안전하게 받기")
    sub.add_parser("push", help="이 PC의 원본을 안전하게 저장")
    sub.add_parser("status", help="로컬/원격 변경과 충돌 확인")
    verify = sub.add_parser("verify", help="로컬과 보관소 무결성 확인")
    verify.add_argument(
        "--deep",
        action="store_true",
        help="호환 옵션 (검증은 항상 전체 SHA-256으로 수행)",
    )
    sub.add_parser("doctor", help="경로와 기본 준비 상태 점검")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    root = Path(args.root).resolve()
    try:
        vault = discover_vault(root, args.vault)
        store = ArtifactStore(root, vault)

        if args.command == "doctor":
            count, size = store.discover_local()
            print("■ 투어리스트 원본 보관소 점검")
            print(f"  작업 폴더: {root}")
            print(f"  보관소 후보: {vault}")
            store.require_ready()
            ready = True
            print(f"  초기화: {'예' if ready else '아니오'}")
            print(f"  허용 원본: {count:,}개 · {format_size(size)}")
            print("  범위: homepages_auto/*/img, homepages_auto/*/pages_v2")
            print("  제외: 비밀키, 로그, 앱용 holeimg, 그 밖의 모든 폴더")
            return 0 if ready else 3

        if args.command == "init":
            store.initialize(
                create=args.create,
                allow_local=args.allow_local_vault,
            )
            print("✔ 비공개 원본 보관소를 연결했습니다.")
            print(f"  {vault}")
            print("  기존 원본 PC: .\\tourist.cmd tools\\artifact_sync.py push")
            print("  새 PC:        .\\tourist.cmd tools\\artifact_sync.py pull")
            return 0

        if args.command == "pull":
            result = store.pull()
            print("✔ 비공개 원본 받기 완료")
            print(
                f"  복원 {result['copied']:,}개 · 로컬 {result['local_count']:,}개 · "
                f"스냅샷 {result['manifest'][:12]}"
            )
            if result["pending_local"]:
                print(f"  아직 올리지 않은 로컬 변경 {len(result['pending_local']):,}개 보존")
                print_paths(result["pending_local"])
            return 0

        if args.command == "push":
            result = store.push()
            print("✔ Google Drive 로컬 보관소 기록 완료")
            print(
                f"  파일 {result['file_count']:,}개 · {format_size(result['total_size'])} · "
                f"새 객체 {result['uploaded_objects']:,}개"
            )
            print(
                f"  스냅샷 {result['manifest'][:12]} · "
                f"dataset {result['dataset_sha256'][:12]}"
            )
            if result["restored_from_remote"]:
                print(
                    f"  다른 PC 원본 {result['restored_from_remote']:,}개를 먼저 안전하게 복원했습니다."
                )
            print("  Google Drive 아이콘이 '동기화 완료'가 될 때까지 PC를 켜 두세요.")
            return 0

        if args.command == "status":
            result = store.status()
            print("■ 투어리스트 비공개 원본 현황")
            print(f"  보관소: {result['vault']}")
            print(
                f"  로컬: {result['local_count']:,}개 · {format_size(result['local_size'])}"
            )
            print(
                f"  원격: {result['remote_count']:,}개 · {format_size(result['remote_size'])}"
            )
            print(f"  올릴 변경: {len(result['local_changes']):,}개")
            print(f"  받을 변경: {len(result['remote_changes']):,}개")
            print(f"  충돌: {len(result['conflicts']):,}개")
            if result["conflicts"]:
                print_paths(result["conflicts"])
                return 2
            return 0

        if args.command == "verify":
            result = store.verify(deep=args.deep)
            errors = (
                len(result["missing"])
                + len(result["extra"])
                + len(result["mismatch"])
                + len(result["object_errors"])
            )
            if errors:
                print("✖ 원본 검증 실패")
                print(
                    f"  누락 {len(result['missing']):,} · 추가 {len(result['extra']):,} · "
                    f"불일치 {len(result['mismatch']):,} · 객체 오류 {len(result['object_errors']):,}"
                )
                print_paths(result["missing"] + result["mismatch"] + result["extra"])
                for message in result["object_errors"][:5]:
                    print(f"    - {message}")
                return 2
            print("✔ 원본과 이 PC의 Google Drive 보관소가 일치합니다.")
            print(
                f"  파일 {result['files']:,}개 · 객체 {result['objects']:,}개 · "
                f"dataset {result['dataset_sha256'][:12]}"
            )
            print("  검증 방식: 전체 SHA-256")
            print("  클라우드 업로드 완료 여부는 Google Drive 아이콘에서도 확인하세요.")
            return 0

        raise ArtifactError(f"알 수 없는 명령입니다: {args.command}")
    except ConflictError as exc:
        print(f"✖ 원본 충돌\n{exc}")
        print("  보고서: .artifact-conflicts/")
        return 2
    except IntegrityError as exc:
        print(f"✖ 원본 무결성 오류: {exc}")
        return 2
    except VaultNotReady as exc:
        print(f"⚠ {exc}")
        return 3
    except ArtifactError as exc:
        print(f"✖ {exc}")
        return 1
    except OSError as exc:
        print(f"✖ 파일 시스템 오류: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
