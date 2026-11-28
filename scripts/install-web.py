#!/usr/bin/env python3
"""Install only the frontend-owned web directory, never machine/DSP data."""
import argparse
import os
from pathlib import Path
import shutil
import sys
import tempfile

MARKER = ".kmx-web-owned"
OWNER = "KMotionXCNC web bundle v1\n"


def absolute(value):
    path = Path(value)
    if not path.is_absolute() or ".." in path.parts:
        raise ValueError(f"Expected an absolute path without '..': {value}")
    return path


def install(mode, source, prefix, sharedir=None, destdir=""):
    prefix = absolute(prefix)
    share = absolute(sharedir) if sharedir else prefix / "share"
    destination = share / "kmx/web"
    if destdir:
        destination = absolute(destdir) / destination.relative_to("/")
    # Ownership is limited to exactly this directory. Never adopt an unknown tree.
    if destination.is_symlink() or destination.parent.is_symlink():
        raise ValueError(f"Refusing symlink destination: {destination}")
    if destination.exists():
        marker = destination / MARKER
        if marker.is_symlink() or not marker.is_file() or marker.read_text() != OWNER:
            raise ValueError(f"Refusing unowned web directory: {destination}")
    if mode == "uninstall":
        if destination.exists():
            shutil.rmtree(destination)
        return destination
    if not (source / "index.html").is_file():
        raise ValueError("Production bundle missing: run ./build-web.sh prod (or npm run build) first")
    if source.is_symlink() or any(path.is_symlink() for path in source.rglob("*")):
        raise ValueError("Production bundle must not contain symlinks")
    if destination.resolve() == source.resolve():
        raise ValueError("Install destination must differ from the build directory")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".kmx-web-", dir=destination.parent) as temp:
        staged = Path(temp) / "new"
        shutil.copytree(source, staged)
        (staged / MARKER).write_text(OWNER)
        for path in staged.rglob("*"):
            path.chmod(0o755 if path.is_dir() else 0o644)
        staged.chmod(0o755)
        backup = Path(temp) / "previous"
        if destination.exists():
            destination.rename(backup)
        try:
            staged.rename(destination)
        except OSError:
            if backup.exists():
                backup.rename(destination)
            raise
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("install", "uninstall"))
    parser.add_argument("--prefix", default=os.environ.get("PREFIX", str(Path.home() / ".local")))
    parser.add_argument("--sharedir", default=os.environ.get("SHAREDIR"))
    args = parser.parse_args()
    try:
        target = install(args.mode, Path(__file__).resolve().parents[1] / "apps/web/dist",
                         args.prefix, args.sharedir, os.environ.get("DESTDIR", ""))
        print(f"{args.mode}: {target}")
    except (OSError, ValueError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
