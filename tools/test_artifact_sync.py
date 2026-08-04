# -*- coding: utf-8 -*-
"""artifact_sync.py의 삭제 방지, 충돌 방지, 새 PC 복원 검사."""

from __future__ import annotations

import importlib.util
import os
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().with_name("artifact_sync.py")
SPEC = importlib.util.spec_from_file_location("artifact_sync", SCRIPT)
assert SPEC and SPEC.loader
artifact_sync = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(artifact_sync)


class ArtifactSyncTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.vault = self.base / "vault"
        self.pc_a = self.base / "pc-a"
        self.pc_b = self.base / "pc-b"
        self.pc_a.mkdir()
        self.pc_b.mkdir()
        self.store_a = artifact_sync.ArtifactStore(self.pc_a, self.vault)
        self.store_b = artifact_sync.ArtifactStore(self.pc_b, self.vault)
        self.store_a.initialize(create=True, allow_local=True)
        self.store_b.initialize(allow_local=True)

    def tearDown(self) -> None:
        self.temp.cleanup()

    @staticmethod
    def put(root: Path, logical: str, body: bytes) -> Path:
        path = root.joinpath(*logical.split("/"))
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
        return path

    def test_push_then_fresh_pc_pull_and_deduplicate(self) -> None:
        first = "coursedata/homepages_auto/가람CC/img/hole01.png"
        second = "coursedata/homepages_auto/나래CC/img/hole01-copy.png"
        body = b"same-image-bytes"
        self.put(self.pc_a, first, body)
        self.put(self.pc_a, second, body)

        pushed = self.store_a.push()
        pulled = self.store_b.pull()

        self.assertEqual(pushed["file_count"], 2)
        self.assertEqual(pushed["uploaded_objects"], 1)
        self.assertEqual(pulled["copied"], 2)
        self.assertEqual(self.pc_b.joinpath(*first.split("/")).read_bytes(), body)
        self.assertEqual(self.pc_b.joinpath(*second.split("/")).read_bytes(), body)

    def test_same_file_changed_on_two_pcs_is_never_overwritten(self) -> None:
        logical = "coursedata/homepages_auto/충돌CC/img/hole01.png"
        self.put(self.pc_a, logical, b"base")
        self.store_a.push()
        self.store_b.pull()

        self.put(self.pc_a, logical, b"from-a")
        self.store_a.push()
        local_b = self.put(self.pc_b, logical, b"from-b")

        with self.assertRaises(artifact_sync.ConflictError):
            self.store_b.pull()
        self.assertEqual(local_b.read_bytes(), b"from-b")
        reports = list((self.pc_b / ".artifact-conflicts").glob("*.json"))
        self.assertEqual(len(reports), 1)

    def test_local_delete_is_restored_not_propagated(self) -> None:
        first = "coursedata/homepages_auto/보존CC/img/hole01.png"
        second = "coursedata/homepages_auto/보존CC/img/hole02.png"
        self.put(self.pc_a, first, b"one")
        deleted = self.put(self.pc_a, second, b"two")
        self.store_a.push()

        deleted.unlink()
        pushed = self.store_a.push()

        self.assertEqual(pushed["file_count"], 2)
        self.assertEqual(pushed["restored_from_remote"], 1)
        self.assertEqual(deleted.read_bytes(), b"two")

    def test_allowlist_excludes_secrets_logs_and_tracked_pages(self) -> None:
        allowed = "coursedata/homepages_auto/범위CC/pages_v2/rendered.html"
        self.put(self.pc_a, allowed, b"allowed")
        self.put(self.pc_a, ".secrets/youtube_key.txt", b"secret")
        self.put(self.pc_a, "tools/jp/.gemini_key", b"secret")
        self.put(
            self.pc_a,
            "coursedata/homepages_auto/범위CC/pages/tracked.html",
            b"tracked",
        )
        self.put(
            self.pc_a,
            "coursedata/homepages_auto/범위CC/meta.json",
            b"tracked",
        )

        files, _ = self.store_a.scan_local(deep=True)

        self.assertEqual(set(files), {allowed})

    def test_secret_named_file_inside_allowed_tree_blocks_sync(self) -> None:
        self.put(
            self.pc_a,
            "coursedata/homepages_auto/비밀CC/pages_v2/.env",
            b"SECRET=value",
        )

        with self.assertRaises(artifact_sync.IntegrityError):
            self.store_a.scan_local()

    def test_verify_detects_local_tampering(self) -> None:
        logical = "coursedata/homepages_auto/검증CC/img/hole01.png"
        path = self.put(self.pc_a, logical, b"original")
        self.store_a.push()
        path.write_bytes(b"tampered")

        result = self.store_a.verify(deep=True)

        self.assertEqual(result["mismatch"], [logical])

    def test_same_size_same_mtime_change_is_still_pushed(self) -> None:
        logical = "coursedata/homepages_auto/캐시CC/img/hole01.png"
        path = self.put(self.pc_a, logical, b"AAAA")
        self.store_a.push()
        before = path.stat()
        path.write_bytes(b"BBBB")
        os.utime(path, ns=(before.st_atime_ns, before.st_mtime_ns))

        pushed = self.store_a.push()
        self.store_b.pull()

        self.assertTrue(pushed["new_snapshot"])
        self.assertEqual(
            self.pc_b.joinpath(*logical.split("/")).read_bytes(),
            b"BBBB",
        )

    def test_same_size_object_corruption_is_detected(self) -> None:
        logical = "coursedata/homepages_auto/객체CC/img/hole01.png"
        self.put(self.pc_a, logical, b"good")
        self.store_a.push()
        _, remote = self.store_a.load_latest()
        assert remote
        entry = remote["files"][logical]
        self.store_a.object_path(entry["sha256"]).write_bytes(b"evil")

        result = self.store_a.verify()

        self.assertEqual(len(result["object_errors"]), 1)
        with self.assertRaises(artifact_sync.IntegrityError):
            self.store_a.push()

    def test_pull_stages_every_file_before_replacing_anything(self) -> None:
        first = "coursedata/homepages_auto/일괄CC/img/hole01.png"
        second = "coursedata/homepages_auto/일괄CC/img/hole02.png"
        first_b = self.put(self.pc_a, first, b"old-1")
        second_b = self.put(self.pc_a, second, b"old-2")
        self.store_a.push()
        self.store_b.pull()
        first_b.write_bytes(b"new-1")
        second_b.write_bytes(b"new-2")
        self.store_a.push()

        original_copy = self.store_b._copy_and_verify

        def fail_second(
            source: Path,
            destination: Path,
            expected: str,
            expected_size: int,
        ) -> None:
            if "hole02.png" in str(destination) and ".artifact-tmp" in str(destination):
                raise OSError("simulated staging failure")
            original_copy(source, destination, expected, expected_size)

        self.store_b._copy_and_verify = fail_second
        with self.assertRaises(OSError):
            self.store_b.pull()

        self.assertEqual(
            self.pc_b.joinpath(*first.split("/")).read_bytes(),
            b"old-1",
        )
        self.assertEqual(
            self.pc_b.joinpath(*second.split("/")).read_bytes(),
            b"old-2",
        )

    def test_destination_change_after_plan_is_preserved(self) -> None:
        logical = "coursedata/homepages_auto/경합CC/img/hole01.png"
        source = self.put(self.pc_a, logical, b"base")
        self.store_a.push()
        self.store_b.pull()
        source.write_bytes(b"remote")
        self.store_a.push()
        target = self.pc_b.joinpath(*logical.split("/"))
        original_batch = self.store_b._materialize_batch

        def mutate_then_materialize(plans):
            target.write_bytes(b"local!")
            return original_batch(plans)

        self.store_b._materialize_batch = mutate_then_materialize
        with self.assertRaises(artifact_sync.ConflictError):
            self.store_b.pull()
        self.assertEqual(target.read_bytes(), b"local!")

    def test_append_only_heads_merge_concurrent_disjoint_changes(self) -> None:
        first = "coursedata/homepages_auto/동시CC/img/hole01.png"
        second = "coursedata/homepages_auto/동시CC/img/hole02.png"
        first_a = self.put(self.pc_a, first, b"base-1")
        second_a = self.put(self.pc_a, second, b"base-2")
        self.store_a.push()
        self.store_b.pull()

        before_heads = set(self.vault.joinpath("heads").glob("*.json"))
        first_a.write_bytes(b"from-a")
        self.store_a.push()
        a_head = next(iter(set(self.vault.joinpath("heads").glob("*.json")) - before_heads))
        hidden = self.base / a_head.name
        a_head.replace(hidden)

        second_b = self.pc_b.joinpath(*second.split("/"))
        second_b.write_bytes(b"from-b")
        self.store_b.push()
        hidden.replace(a_head)

        self.store_b.push()
        pc_c = self.base / "pc-c"
        pc_c.mkdir()
        store_c = artifact_sync.ArtifactStore(pc_c, self.vault)
        store_c.initialize(allow_local=True)
        store_c.pull()

        self.assertEqual(pc_c.joinpath(*first.split("/")).read_bytes(), b"from-a")
        self.assertEqual(pc_c.joinpath(*second.split("/")).read_bytes(), b"from-b")

    def test_windows_unsafe_paths_and_nested_vaults_are_rejected(self) -> None:
        bad = [
            "coursedata/homepages_auto/NUL/img/a.png",
            "coursedata/homepages_auto/CON.txt/img/a.png",
            "coursedata/homepages_auto/구장/img/a.png:secret",
            "coursedata/homepages_auto/구장/img/a.png.",
            "coursedata/homepages_auto/e\u0301/img/a.png",
        ]
        for logical in bad:
            self.assertFalse(artifact_sync.allowed_logical_path(logical), logical)
        nested_root = self.base / "outer-vault" / "repo"
        nested_vault = self.base / "outer-vault"
        nested_root.mkdir(parents=True)
        with self.assertRaises(artifact_sync.ArtifactError):
            artifact_sync.ArtifactStore(nested_root, nested_vault)

    def test_change_during_push_is_not_reported_as_saved(self) -> None:
        logical = "coursedata/homepages_auto/진행중CC/img/hole01.png"
        path = self.put(self.pc_a, logical, b"before")
        original_scan = self.store_a.scan_local
        calls = 0

        def mutate_before_final_scan(deep=False):
            nonlocal calls
            calls += 1
            if calls == 2:
                path.write_bytes(b"during")
            return original_scan(deep=deep)

        self.store_a.scan_local = mutate_before_final_scan
        with self.assertRaises(artifact_sync.ConflictError):
            self.store_a.push()

        self.assertEqual(path.read_bytes(), b"during")
        self.assertEqual(list(self.vault.joinpath("heads").glob("*.json")), [])

    def test_file_changing_between_stat_and_hash_never_publishes_head(self) -> None:
        logical = "coursedata/homepages_auto/해시경합CC/img/hole01.png"
        path = self.put(self.pc_a, logical, b"AAAA")
        original_hash = artifact_sync.sha256_file_with_size

        def always_change(target: Path):
            digest, size = original_hash(target)
            target.write_bytes(b"BBBBB" if target.stat().st_size == 4 else b"CCCC")
            return digest, size

        artifact_sync.sha256_file_with_size = always_change
        try:
            with self.assertRaises(artifact_sync.ConflictError):
                self.store_a.push()
        finally:
            artifact_sync.sha256_file_with_size = original_hash
        self.assertEqual(list(self.vault.joinpath("heads").glob("*.json")), [])

    def test_external_write_after_backup_is_preserved_with_backup(self) -> None:
        logical = "coursedata/homepages_auto/백업경합CC/img/hole01.png"
        source = self.put(self.pc_a, logical, b"base")
        self.store_a.push()
        self.store_b.pull()
        source.write_bytes(b"next")
        self.store_a.push()
        target = self.pc_b.joinpath(*logical.split("/"))
        original_replace = artifact_sync.os.replace

        def inject_external(src, dst):
            original_replace(src, dst)
            if Path(src) == target and str(dst).endswith(".bak"):
                target.write_bytes(b"external")

        artifact_sync.os.replace = inject_external
        try:
            with self.assertRaises(artifact_sync.IntegrityError):
                self.store_b.pull()
        finally:
            artifact_sync.os.replace = original_replace

        self.assertEqual(target.read_bytes(), b"external")
        backups = list((self.pc_b / ".artifact-tmp").rglob("*.bak"))
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].read_bytes(), b"base")

    def test_criss_cross_heads_use_all_maximal_common_ancestors(self) -> None:
        x = "coursedata/homepages_auto/DAGCC/img/x.png"
        y = "coursedata/homepages_auto/DAGCC/img/y.png"

        def entry(char: str):
            return {
                "sha256": char * 64,
                "size": 1,
                "kind": "img",
                "rights": "internal_research",
            }

        h0, _ = self.store_a._write_manifest({x: entry("a"), y: entry("b")}, [])
        ha, _ = self.store_a._write_manifest({x: entry("c"), y: entry("b")}, [h0])
        hb, _ = self.store_a._write_manifest({x: entry("a"), y: entry("d")}, [h0])
        self.store_a._write_manifest({x: entry("e"), y: entry("d")}, [ha, hb])
        self.store_a._write_manifest({x: entry("c"), y: entry("f")}, [ha, hb])

        _, view = self.store_a.load_latest()

        assert view
        self.assertEqual(view["files"][x], entry("e"))
        self.assertEqual(view["files"][y], entry("f"))

    def test_create_rejects_non_google_or_nonempty_unmarked_folder(self) -> None:
        local_root = self.base / "local-root"
        local_root.mkdir()
        fake_vault = self.base / "not-google"
        store = artifact_sync.ArtifactStore(local_root, fake_vault)
        with self.assertRaises(artifact_sync.ArtifactError):
            store.initialize(create=True)

        fake_vault.mkdir()
        (fake_vault / "orphan-object").write_bytes(b"x")
        with self.assertRaises(artifact_sync.ArtifactError):
            store.initialize(create=True, allow_local=True)

    def test_existing_local_copy_cannot_masquerade_as_google_drive(self) -> None:
        pc_c = self.base / "pc-local-copy"
        pc_c.mkdir()
        copied = artifact_sync.ArtifactStore(pc_c, self.vault)

        with self.assertRaises(artifact_sync.ArtifactError):
            copied.initialize()

    def test_canonical_vault_anchor_rejects_wrong_uuid_and_accepts_snapshot(self) -> None:
        logical = "coursedata/homepages_auto/기준CC/img/hole01.png"
        self.put(self.pc_a, logical, b"canonical")
        pushed = self.store_a.push()
        marker = artifact_sync.read_json(self.vault / artifact_sync.MARKER_NAME)
        tools_dir = self.pc_b / "tools"
        tools_dir.mkdir()
        config_path = tools_dir / artifact_sync.CANONICAL_NAME
        base_config = {
            "schema": artifact_sync.SCHEMA,
            "project": artifact_sync.PROJECT,
            "vault_id_sha256": artifact_sync.sha256_bytes(b"wrong-vault-id"),
            "initial_snapshot": pushed["manifest"],
            "initial_dataset_sha256": pushed["dataset_sha256"],
            "initial_file_count": 1,
            "initial_object_count": 1,
            "initial_total_size": len(b"canonical"),
        }
        artifact_sync.atomic_json(config_path, base_config)
        with self.assertRaises(artifact_sync.IntegrityError):
            self.store_b.require_ready()

        base_config["vault_id_sha256"] = artifact_sync.sha256_bytes(
            marker["vault_id"].encode("utf-8")
        )
        artifact_sync.atomic_json(config_path, base_config)
        self.store_b.require_ready()


if __name__ == "__main__":
    unittest.main()
