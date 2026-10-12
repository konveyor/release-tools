import hashlib
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch


def load(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + ".py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


runner = load("run")
installer = load("install")
SHA = "a" * 40


class ActionPinsTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.repo = Path(self.directory.name).resolve()
        subprocess.run(["git", "init", "-q"], cwd=self.repo, check=True)
        subprocess.run(["git", "config", "user.name", "Test"], cwd=self.repo, check=True)
        subprocess.run(["git", "config", "user.email", "test@example.org"], cwd=self.repo, check=True)

    def add(self, name, text):
        destination = self.repo / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(text)
        subprocess.run(["git", "add", "--", name], cwd=self.repo, check=True)
        return destination

    def commit(self):
        subprocess.run(["git", "commit", "-qm", "fixture"], cwd=self.repo, check=True)

    def binary(self):
        executable = os.environ.get("PINACT_TEST_BINARY")
        if not executable:
            self.skipTest("PINACT_TEST_BINARY must select the exact pinned binary")
        return executable

    def test_deep_composite_is_checked_despite_workflow_only_project_config(self):
        self.add(".github/workflows/ci.yml", f"steps:\n  - uses: actions/checkout@{SHA} # v6.0.2\n")
        self.add("components/a/b/c/.github/actions/build/action.yaml",
                 "runs:\n  using: composite\n  steps:\n    - uses: actions/cache@v4\n")
        self.add(".pinact.yaml", 'version: 3\nfiles:\n  - pattern: .github/workflows/*.yml\n')
        self.commit()
        with self.assertRaises(subprocess.CalledProcessError):
            runner.run(self.repo, "verify", "", self.binary())

    def test_verify_does_not_modify_unpinned_files(self):
        path = self.add(".github/workflows/ci.yml", "steps:\n  - uses: actions/checkout@v4\n")
        self.commit()
        before = path.read_bytes()
        with self.assertRaises(subprocess.CalledProcessError):
            runner.run(self.repo, "verify", "", self.binary())
        self.assertEqual(path.read_bytes(), before)

    def test_exact_ignore_does_not_ignore_similar_action_name(self):
        path = self.add(".github/workflows/ci.yml",
                        "steps:\n  - uses: konveyor/release-tools/cmd/verify-pr@main\n")
        self.commit()
        result = runner.run(self.repo, "verify",
                            "konveyor/release-tools/cmd/verify-pr@main", self.binary())
        self.assertEqual(result["changed"], [])
        path.write_text("steps:\n  - uses: konveyor/release-tools-other@main\n")
        with self.assertRaises(subprocess.CalledProcessError):
            runner.run(self.repo, "verify", "konveyor/release-tools/*", self.binary())

    def test_unconfigured_first_party_reference_is_not_implicitly_ignored(self):
        self.add(".github/workflows/ci.yml",
                 "steps:\n  - uses: konveyor/release-tools/cmd/verify-pr@main\n")
        self.commit()
        with self.assertRaises(subprocess.CalledProcessError):
            runner.run(self.repo, "verify", "", self.binary())

    def test_ignores_are_data_and_config_does_not_scan_its_own_directory(self):
        self.add(".github/workflows/ci.yml", "steps:\n  - uses: actions/checkout@v4\n")
        self.commit()
        observed = {}

        def fake_pinact(command, **kwargs):
            import json
            observed["config"] = json.loads(Path(command[2]).read_text())
            observed["files"] = command[command.index("-no-api") + 1:]
            observed["environment"] = kwargs["env"]

        with patch.object(runner, "invoke_pinact", side_effect=fake_pinact), patch.dict(
            os.environ, {"PINACT_GLOBAL_CONFIG": "/unexpected/config", "GITHUB_TOKEN": "unused"}
        ):
            runner.run(self.repo, "verify", "owner/repo/*@main", "/pinact")
        self.assertEqual(observed["files"], [str(self.repo / ".github/workflows/ci.yml")])
        self.assertNotIn("GITHUB_TOKEN", observed["environment"])
        self.assertNotIn("PINACT_GLOBAL_CONFIG", observed["environment"])
        self.assertEqual(observed["config"]["ignore_actions"][0]["ref"], "^main$")

    def test_update_is_repeatable_and_includes_major_upgrade_mode(self):
        path = self.add(".github/workflows/ci.yml", f"steps:\n  - uses: actions/checkout@{SHA} # v4.0.0\n")
        self.commit()
        commands = []

        def fake_pinact(command, **kwargs):
            commands.append(command)
            path.write_text(f"steps:\n  - uses: actions/checkout@{'b' * 40} # v6.0.2\n")

        with patch.object(runner, "invoke_pinact", side_effect=fake_pinact):
            first = runner.run(self.repo, "update", "", "/pinact")
            self.assertEqual(first["changed"], [".github/workflows/ci.yml"])
            subprocess.run(["git", "add", "--", ".github/workflows/ci.yml"],
                           cwd=self.repo, check=True)
            self.commit()
            second = runner.run(self.repo, "update", "", "/pinact")
        self.assertEqual(second["changed"], [])
        self.assertTrue(all("-update" in command for command in commands))
        self.assertTrue(all("-no-api" not in command for command in commands))

    def test_empty_checkout_and_symlink_fail_instead_of_silently_passing(self):
        with self.assertRaisesRegex(ValueError, "No tracked"):
            runner.tracked_files(self.repo)
        target = self.repo / "outside.txt"
        target.write_text("not an action")
        link = self.repo / ".github/workflows/ci.yml"
        link.parent.mkdir(parents=True)
        link.symlink_to(target)
        subprocess.run(["git", "add", "--", str(link)], cwd=self.repo, check=True)
        with self.assertRaisesRegex(ValueError, "regular"):
            runner.tracked_files(self.repo)

    def test_archive_checksum_rejects_tampering_and_extracts_only_binary(self):
        archive = io.BytesIO()
        with tarfile.open(fileobj=archive, mode="w:gz") as stream:
            content = b"test binary"
            member = tarfile.TarInfo("pinact")
            member.size = len(content)
            stream.addfile(member, io.BytesIO(content))
        data = archive.getvalue()
        destination = self.repo / "pinact"
        with self.assertRaisesRegex(ValueError, "checksum"):
            installer.extract_binary(data, "0" * 64, destination)
        self.assertFalse(destination.exists())
        installer.extract_binary(data, hashlib.sha256(data).hexdigest(), destination)
        self.assertEqual(destination.read_bytes(), b"test binary")

    def test_ref_ignore_leaves_other_refs_checked(self):
        path = self.add(".github/workflows/ci.yml",
                        "steps:\n  - uses: konveyor/release-tools/cmd/verify-pr@main\n")
        self.commit()
        runner.run(self.repo, "verify", "konveyor/release-tools/*@main", self.binary())
        path.write_text("steps:\n  - uses: konveyor/release-tools/cmd/verify-pr@feature\n")
        with self.assertRaises(subprocess.CalledProcessError):
            runner.run(self.repo, "verify", "konveyor/release-tools/*@main", self.binary())


if __name__ == "__main__":
    unittest.main()
