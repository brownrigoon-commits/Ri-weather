# -*- coding: utf-8 -*-
"""sync.py가 Git/원본 실패를 성공으로 오인하지 않는지 검사한다."""

from __future__ import annotations

import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


SCRIPT = Path(__file__).resolve().with_name("sync.py")
SPEC = importlib.util.spec_from_file_location("tourist_sync", SCRIPT)
assert SPEC and SPEC.loader
tourist_sync = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(tourist_sync)


def completed(args: tuple[str, ...], returncode: int, output: str = ""):
    return subprocess.CompletedProcess(args, returncode, stdout=output, stderr=output)


class SyncFailureTest(unittest.TestCase):
    def test_pending_stash_lookup_uses_commit_not_top_stash(self) -> None:
        entries = [
            {"commit": "user", "ref": "stash@{0}", "subject": "On main: user work"},
            {"commit": "sync", "ref": "stash@{1}", "subject": "On main: sync-temp-host"},
        ]
        with mock.patch.object(tourist_sync, "stash_entries", return_value=entries):
            self.assertEqual(tourist_sync.pending_stash_ref("sync"), "stash@{1}")

    def test_rerun_stops_when_previous_sync_stash_is_pending(self) -> None:
        with (
            mock.patch.object(sys, "argv", ["sync.py", "save"]),
            mock.patch.object(tourist_sync, "has_pending_sync_work", return_value=True),
            mock.patch.object(tourist_sync, "ensure_main_branch") as branch,
            mock.patch.object(tourist_sync, "sync_artifacts") as artifact,
        ):
            self.assertEqual(tourist_sync.main(), 1)
            branch.assert_not_called()
            artifact.assert_not_called()

    def test_successful_stash_command_without_new_stash_fails_closed(self) -> None:
        def fake_git(*args, check=True):
            if args[:3] == ("rev-parse", "--quiet", "--verify"):
                return completed(args, 0, "old-stash\n")
            return completed(args, 0)

        with (
            mock.patch.object(sys, "argv", ["sync.py", "--no-artifacts"]),
            mock.patch.object(tourist_sync, "ensure_main_branch", return_value=True),
            mock.patch.object(tourist_sync, "in_rebase", return_value=False),
            mock.patch.object(tourist_sync, "out", return_value=" M submodule"),
            mock.patch.object(tourist_sync, "git", side_effect=fake_git),
            mock.patch.object(
                tourist_sync,
                "stash_entries",
                return_value=[
                    {"commit": "old-stash", "ref": "stash@{0}", "subject": "On main: user"}
                ],
            ),
        ):
            self.assertEqual(tourist_sync.main(), 1)

    def test_in_rebase_uses_git_path_for_worktrees(self) -> None:
        def fake_git(*args, check=True):
            path = "C:/repo/.git/worktrees/task/rebase-merge" if args[-1] == "rebase-merge" else ""
            return completed(args, 0, path)

        with (
            mock.patch.object(tourist_sync, "git", side_effect=fake_git),
            mock.patch.object(tourist_sync.os.path, "exists", side_effect=lambda path: path.endswith("rebase-merge")),
        ):
            self.assertTrue(tourist_sync.in_rebase())

    def test_version_autofix_only_accepts_identical_hunk_except_version(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            target = root / "js" / "app.js"
            target.parent.mkdir(parents=True)
            target.write_text(
                '<<<<<<< HEAD\nconst APP_VER = "v1";\n=======\n'
                'const APP_VER = "v2";\n>>>>>>> other\n',
                encoding="utf-8",
            )
            with mock.patch.object(tourist_sync, "ROOT", str(root)):
                self.assertTrue(tourist_sync.pick_larger_version("js/app.js"))
            self.assertEqual(target.read_text(encoding="utf-8"), 'const APP_VER = "v2";\n')

    def test_version_autofix_preserves_hunk_with_other_code_changes(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            target = root / "js" / "app.js"
            target.parent.mkdir(parents=True)
            conflicted = (
                '<<<<<<< HEAD\nconst APP_VER = "v1";\nconst feature = "left";\n=======\n'
                'const APP_VER = "v2";\nconst feature = "right";\n>>>>>>> other\n'
            )
            target.write_text(conflicted, encoding="utf-8")
            with mock.patch.object(tourist_sync, "ROOT", str(root)):
                self.assertFalse(tourist_sync.pick_larger_version("js/app.js"))
            self.assertEqual(target.read_text(encoding="utf-8"), conflicted)

    def test_pull_failure_without_rebase_is_never_success(self) -> None:
        failed = completed(("git", "pull"), 1, "network unavailable")
        with (
            mock.patch.object(tourist_sync, "in_rebase", return_value=False),
            mock.patch.object(tourist_sync, "git", return_value=failed),
        ):
            ok, reason = tourist_sync.rebase_with_autofix()

        self.assertFalse(ok)
        self.assertEqual(reason, ["git pull --rebase"])

    def test_commit_failure_returns_nonzero_before_pull_or_push(self) -> None:
        calls: list[tuple[str, ...]] = []

        def fake_git(*args, check=True):
            calls.append(args)
            if args and args[0] == "commit":
                return completed(args, 1, "identity missing")
            return completed(args, 0)

        def fake_out(*args):
            return " M changed.txt" if args == ("status", "--porcelain") else ""

        with (
            mock.patch.object(sys, "argv", ["sync.py", "save", "--no-artifacts"]),
            mock.patch.object(tourist_sync, "has_pending_sync_work", return_value=False),
            mock.patch.object(tourist_sync, "ensure_main_branch", return_value=True),
            mock.patch.object(tourist_sync, "in_rebase", return_value=False),
            mock.patch.object(tourist_sync, "git", side_effect=fake_git),
            mock.patch.object(tourist_sync, "out", side_effect=fake_out),
            mock.patch.object(tourist_sync, "guard_huge_upload", return_value=True),
        ):
            result = tourist_sync.main()

        self.assertEqual(result, 1)
        self.assertTrue(any(call and call[0] == "commit" for call in calls))
        self.assertFalse(any(call and call[0] in ("pull", "push") for call in calls))

    def test_artifact_status_failure_returns_nonzero_unless_explicitly_skipped(self) -> None:
        with (
            mock.patch.object(sys, "argv", ["sync.py", "--status"]),
            mock.patch.object(tourist_sync, "has_pending_sync_work", return_value=False),
            mock.patch.object(tourist_sync, "ensure_main_branch", return_value=True),
            mock.patch.object(tourist_sync, "show_status"),
            mock.patch.object(tourist_sync, "sync_artifacts", return_value=False),
        ):
            self.assertEqual(tourist_sync.main(), 1)

        with (
            mock.patch.object(sys, "argv", ["sync.py", "--status", "--no-artifacts"]),
            mock.patch.object(tourist_sync, "has_pending_sync_work", return_value=False),
            mock.patch.object(tourist_sync, "ensure_main_branch", return_value=True),
            mock.patch.object(tourist_sync, "show_status"),
            mock.patch.object(tourist_sync, "sync_artifacts") as artifact,
        ):
            self.assertEqual(tourist_sync.main(), 0)
            artifact.assert_not_called()

    def test_non_main_branch_stops_before_artifact_or_git_mutation(self) -> None:
        with (
            mock.patch.object(sys, "argv", ["sync.py", "save"]),
            mock.patch.object(tourist_sync, "has_pending_sync_work", return_value=False),
            mock.patch.object(tourist_sync, "ensure_main_branch", return_value=False),
            mock.patch.object(tourist_sync, "sync_artifacts") as artifact,
        ):
            self.assertEqual(tourist_sync.main(), 1)
            artifact.assert_not_called()


if __name__ == "__main__":
    unittest.main()
