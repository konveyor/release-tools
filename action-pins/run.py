"""Run pinact against the caller's tracked workflows and composite actions."""

import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
from subprocess import run as invoke_pinact
import tempfile
import uuid


def tracked_files(workspace):
    output = subprocess.check_output(
        ["git", "ls-files", "-z"], cwd=workspace
    ).decode("utf-8")
    files = []
    for name in output.split("\0"):
        if not name:
            continue
        path = PurePosixPath(name)
        workflow = path.parent == PurePosixPath(".github/workflows") and path.suffix in {
            ".yml", ".yaml"
        }
        if not workflow and path.name not in {"action.yml", "action.yaml"}:
            continue
        if any(character in name for character in "\n\r,"):
            raise ValueError("Action file names must not contain newlines or commas")
        full_path = workspace / name
        if full_path.is_symlink() or not full_path.is_file():
            raise ValueError(f"Expected a regular tracked action file: {name}")
        if not full_path.resolve().is_relative_to(workspace):
            raise ValueError(f"Action file is outside the checkout: {name}")
        files.append(name)
    if not files:
        raise ValueError("No tracked workflow or action files found in the checkout")
    return sorted(files)


def glob_regex(pattern):
    return "^" + re.escape(pattern).replace(r"\*", ".*").replace(r"\?", ".") + "$"


def configuration(ignore_actions):
    ignored = []
    for line in ignore_actions.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        name, separator, ref = line.partition("@")
        if "/" not in name or (separator and not ref) or "@" in ref:
            raise ValueError(f"Expected owner/repo[/path][@ref] ignore pattern: {line}")
        ignored.append({"name": glob_regex(name), "ref": glob_regex(ref or "*")})
    return {"version": 3, "ignore_actions": ignored}


def run(workspace, mode, ignore_actions, binary):
    workspace = Path(workspace).resolve()
    if mode not in {"verify", "update"}:
        raise ValueError("mode must be verify or update")
    files = tracked_files(workspace)
    # CLI file arguments override pinact's depth-limited discovery and any
    # project file selection. The temporary config contains only caller inputs.
    environment = os.environ.copy()
    for name in ("PINACT_CONFIG", "PINACT_GLOBAL_CONFIG"):
        environment.pop(name, None)
    if mode == "verify":
        for name in ("GITHUB_TOKEN", "GH_TOKEN"):
            environment.pop(name, None)
    with tempfile.TemporaryDirectory(prefix="action-pins-") as directory:
        config = Path(directory) / "pinact.yaml"
        config.write_text(json.dumps(configuration(ignore_actions)), encoding="utf-8")
        command = [str(binary), "-c", str(config), "run"]
        command += ["-fix=false", "-no-api"] if mode == "verify" else ["-update"]
        command += [str(workspace / name) for name in files]
        invoke_pinact(command, cwd=workspace, env=environment, check=True)
    changed = subprocess.check_output(
        ["git", "diff", "--name-only", "-z", "--"] +
        [f":(literal){name}" for name in files], cwd=workspace
    ).decode("utf-8").split("\0")
    changed = sorted(name for name in changed if name)
    return {"files": files, "changed": changed}


def output(name, value):
    destination = os.environ.get("GITHUB_OUTPUT")
    if destination:
        delimiter = "action_pins_" + uuid.uuid4().hex
        with open(destination, "a", encoding="utf-8") as stream:
            stream.write(f"{name}<<{delimiter}\n{value}\n{delimiter}\n")


def main():
    result = run(
        os.environ["GITHUB_WORKSPACE"],
        os.environ["PINACT_MODE"],
        os.environ.get("PINACT_IGNORE_ACTIONS", ""),
        os.environ["PINACT_BINARY"],
    )
    output("changed", str(bool(result["changed"])).lower())
    # Keep a nonempty commit allowlist even when no files changed: an empty
    # create-pull-request add-paths value stages every new or modified file.
    # The action still runs on unchanged updates to close obsolete PRs.
    output("paths", "\n".join(f":(literal){name}" for name in result["files"]))
    print(f"Checked {len(result['files'])} action/workflow files; "
          f"{len(result['changed'])} changed.")
    if os.environ.get("PINACT_DRY_RUN") == "true":
        subprocess.run(["git", "diff", "--"] + [
            f":(literal){name}" for name in result["files"]
        ], cwd=os.environ["GITHUB_WORKSPACE"], check=True)


if __name__ == "__main__":
    main()
