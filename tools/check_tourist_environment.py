# -*- coding: utf-8 -*-
"""새 PC가 투어리스트 홀맵 작업을 재현할 수 있는지 한 번에 점검한다."""

from __future__ import annotations

import argparse
import importlib
import importlib.metadata
import os
import shutil
import subprocess
import sys
from pathlib import Path


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
REQUIRED_MODULES = {
    "PIL": "Pillow",
    "selenium": "selenium",
    "requests": "requests",
    "openpyxl": "openpyxl",
    "numpy": "numpy",
    "pytest": "pytest",
}
REQUIRED_COMMANDS = ("git",)
EXPECTED_REPOSITORY = "brownrigoon-commits/ri-weather"


def expected_versions() -> dict[str, str]:
    result: dict[str, str] = {}
    requirements = ROOT / "requirements-tourist.txt"
    for raw_line in requirements.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "==" not in line:
            continue
        package, version = line.split("==", 1)
        result[package.casefold()] = version
    return result


def find_chrome() -> Path | None:
    candidates = [
        os.environ.get("CHROME", ""),
        str(Path(os.environ.get("PROGRAMFILES", "C:/Program Files")) / "Google/Chrome/Application/chrome.exe"),
        str(Path(os.environ.get("PROGRAMFILES(X86)", "C:/Program Files (x86)")) / "Google/Chrome/Application/chrome.exe"),
        str(Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/Application/chrome.exe"),
    ]
    for value in candidates:
        if value and Path(value).is_file():
            return Path(value)
    return None


def run_git(*args: str, timeout: int = 30) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )


def mark(ok: bool) -> str:
    return "✔" if ok else "✖"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="투어리스트 새 PC 실행환경 점검")
    parser.add_argument(
        "--skip-artifacts",
        action="store_true",
        help="코드 전용 PC에서만 Google Drive 원본 점검을 건너뜀",
    )
    args = parser.parse_args(argv)
    failures: list[str] = []
    warnings: list[str] = []
    pinned = expected_versions()
    print("■ 투어리스트 작업 환경")

    python_ok = sys.version_info >= (3, 11)
    print(f"  {mark(python_ok)} Python {sys.version.split()[0]} ({sys.executable})")
    if not python_ok:
        failures.append("Python 3.11 이상이 필요합니다.")

    for command in REQUIRED_COMMANDS:
        path = shutil.which(command)
        print(f"  {mark(bool(path))} {command}: {path or '없음'}")
        if not path:
            failures.append(f"{command} 명령을 찾지 못했습니다.")

    git_path = shutil.which("git")
    if git_path:
        top = run_git("rev-parse", "--show-toplevel")
        try:
            top_ok = top.returncode == 0 and Path(top.stdout.strip()).resolve() == ROOT.resolve()
        except OSError:
            top_ok = False
        print(f"  {mark(top_ok)} Git 저장소 루트")
        if not top_ok:
            failures.append("현재 폴더가 Ri-weather Git 저장소 루트가 아닙니다.")

        branch = run_git("symbolic-ref", "--quiet", "--short", "HEAD")
        branch_name = branch.stdout.strip()
        branch_ok = branch.returncode == 0 and branch_name == "main"
        print(f"  {mark(branch_ok)} Git 브랜치: {branch_name or 'detached HEAD'}")
        if not branch_ok:
            failures.append("main 브랜치가 아닙니다.")

        origin = run_git("remote", "get-url", "origin")
        origin_url = origin.stdout.strip()
        normalized_origin = origin_url.casefold().replace("\\", "/").removesuffix(".git")
        origin_ok = origin.returncode == 0 and normalized_origin.endswith(EXPECTED_REPOSITORY)
        print(f"  {mark(origin_ok)} Git origin: {'Ri-weather' if origin_ok else origin_url or '없음'}")
        if not origin_ok:
            failures.append("origin이 brownrigoon-commits/Ri-weather가 아닙니다.")

        git_name = run_git("config", "--get", "user.name")
        git_email = run_git("config", "--get", "user.email")
        identity_ok = bool(git_name.stdout.strip() and git_email.stdout.strip())
        print(f"  {mark(identity_ok)} Git 커밋 신원: {'설정됨' if identity_ok else '없음'}")
        if not identity_ok:
            failures.append("Git user.name/user.email이 설정되지 않았습니다.")

        push_ok = False
        if top_ok and branch_ok and origin_ok and identity_ok:
            try:
                push_check = run_git("push", "--dry-run", "origin", "HEAD:main")
                push_ok = push_check.returncode == 0
            except subprocess.TimeoutExpired:
                push_ok = False
        print(f"  {mark(push_ok)} GitHub main 쓰기 인증(dry-run)")
        if not push_ok:
            failures.append("GitHub main 쓰기 인증을 확인하지 못했습니다.")

    node_path = shutil.which("node")
    npm_path = shutil.which("npm")
    node_ok = False
    node_version = ""
    if node_path:
        checked = subprocess.run(
            [node_path, "-p", "process.versions.node"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        node_version = checked.stdout.strip()
        try:
            node_ok = checked.returncode == 0 and int(node_version.split(".", 1)[0]) >= 20
        except (TypeError, ValueError):
            node_ok = False
    print(f"  {mark(node_ok)} node: {node_version or node_path or '없음'} (20 이상)")
    if not node_ok:
        failures.append("Node.js 20 이상을 찾지 못했습니다.")
    print(f"  {mark(bool(npm_path))} npm: {npm_path or '없음'}")
    if not npm_path:
        failures.append("npm 명령을 찾지 못했습니다.")

    for module, package in REQUIRED_MODULES.items():
        try:
            importlib.import_module(module)
            version = importlib.metadata.version(package)
            wanted = pinned.get(package.casefold())
            version_ok = wanted is None or version == wanted
            print(f"  {mark(version_ok)} {package} {version}" + (f" (고정 {wanted})" if wanted else ""))
            if not version_ok:
                failures.append(f"{package} 버전이 {wanted}가 아닙니다: {version}")
        except Exception:
            print(f"  ✖ {package}: 설치 안 됨")
            failures.append(
                f"{package}가 없습니다. requirements-tourist.txt를 설치하세요."
            )

    playwright_ok = False
    playwright_version = ""
    if node_ok:
        playwright = subprocess.run(
            [
                node_path,
                "-e",
                "process.stdout.write(require('playwright-core/package.json').version)",
            ],
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        playwright_ok = playwright.returncode == 0
        playwright_version = playwright.stdout.strip()
    print(f"  {mark(playwright_ok)} playwright-core: {playwright_version or '없음'}")
    if not playwright_ok:
        failures.append("playwright-core가 없습니다. npm ci를 실행하세요.")

    chrome = find_chrome()
    print(f"  {mark(chrome is not None)} Chrome: {chrome or '없음'}")
    if chrome is None:
        failures.append("Google Chrome을 찾지 못했습니다.")

    lock_ok = (ROOT / "package-lock.json").is_file()
    print(f"  {mark(lock_ok)} package-lock.json")
    if not lock_ok:
        failures.append("package-lock.json이 없습니다.")

    secrets = {
        "YouTube": ROOT / ".secrets" / "youtube_key.txt",
        "Gemini": ROOT / "tools" / "jp" / ".gemini_key",
        "Google CSE": ROOT / "tools" / "jp" / ".cse_key",
    }
    for name, path in secrets.items():
        present = path.is_file() and path.stat().st_size > 0
        print(f"  {'✔' if present else '△'} {name} 키: {'있음' if present else '없음(필요할 때만 입력)'}")
        if not present:
            warnings.append(f"{name} 키 없음")

    if args.skip_artifacts:
        print("  △ Google Drive 원본 점검 생략(코드 전용 PC 옵션)")
        warnings.append("Google Drive 원본 점검 생략")
    else:
        artifact = subprocess.run(
            [sys.executable, str(ROOT / "tools" / "artifact_sync.py"), "doctor"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if artifact.stdout.strip():
            print()
            print(artifact.stdout.rstrip())
        if artifact.returncode != 0:
            print(f"  ✖ Google Drive 원본 보관소 점검 실패 (코드 {artifact.returncode})")
            failures.append("Google Drive 원본 보관소가 준비되지 않았습니다.")

    print()
    if failures:
        print(f"✖ 필수 항목 {len(failures)}개가 준비되지 않았습니다.")
        for message in failures:
            print(f"  - {message}")
        return 1
    print("✔ 필수 실행 환경이 준비되었습니다.")
    if warnings:
        print(f"  선택 항목 경고 {len(warnings)}개: " + ", ".join(warnings))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
