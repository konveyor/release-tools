"""Install a checksum-pinned upstream binary without a Go toolchain."""

import hashlib
import io
import os
from pathlib import Path
import platform
import tarfile
import urllib.request


VERSION = "v4.1.1"
ASSETS = {
    "x86_64": ("pinact_linux_amd64.tar.gz",
               "d1cffebe5704b74e2e5f8a864efb9f7e54768972dc686188c008033fb1797841"),
    "aarch64": ("pinact_linux_arm64.tar.gz",
                "dd1f29908319ed3e59f9fe6b39196efbb76936357f3bd741cd759a96306ae8d8"),
}


def extract_binary(data, checksum, destination):
    if hashlib.sha256(data).hexdigest() != checksum:
        raise ValueError("pinact archive checksum does not match the pinned release")
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        member = archive.getmember("pinact")
        if not member.isfile():
            raise ValueError("pinact archive does not contain a regular binary")
        with archive.extractfile(member) as source:
            destination.write_bytes(source.read())
    destination.chmod(0o755)


def main():
    if platform.system() != "Linux" or platform.machine() not in ASSETS:
        raise ValueError("The action requires a Linux amd64 or arm64 runner")
    asset, checksum = ASSETS[platform.machine()]
    url = f"https://github.com/suzuki-shunsuke/pinact/releases/download/{VERSION}/{asset}"
    request = urllib.request.Request(url, headers={"User-Agent": "konveyor-release-tools"})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read()
    destination = Path(os.environ["RUNNER_TEMP"]) / "pinact"
    extract_binary(data, checksum, destination)
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as stream:
        stream.write(f"binary={destination}\n")


if __name__ == "__main__":
    main()
