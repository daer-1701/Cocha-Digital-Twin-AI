"""Back up local Compose PostGIS or restore into a NEW dedicated review database.

No shell interpolation, no binary PowerShell redirection, no overwrite/clean/drop.
The dump may contain restricted data: keep it outside Git and protect its storage.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def checksum(path: Path) -> str:
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def backup(destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation protects existing archives; failed output remains identifiable.
    partial = destination.with_suffix(destination.suffix + ".partial")
    manifest = destination.with_suffix(destination.suffix + ".json")
    if destination.exists() or manifest.exists():
        raise ValueError("Destination or manifest already exists; choose a new filename")
    with partial.open("xb") as handle:
        partial.chmod(0o600)
        result = subprocess.run(
            [
                "docker",
                "compose",
                "exec",
                "-T",
                "db",
                "sh",
                "-c",
                'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom',
            ],
            cwd=ROOT,
            stdout=handle,
            stderr=subprocess.PIPE,
            check=False,
        )
    if result.returncode:
        raise RuntimeError("Backup failed; incomplete archive retained with .partial suffix")
    # Publish complete bytes without replacing any existing destination.
    os.link(partial, destination)
    partial.unlink()
    with manifest.open("x", encoding="utf-8") as handle:
        json.dump(
            {
                "created_at": datetime.now(UTC).isoformat(),
                "format": "postgresql-custom",
                "sha256": checksum(destination),
                "bytes": destination.stat().st_size,
                "restoration_verified": False,
            },
            handle,
            indent=2,
        )
    print(f"Archive created: {destination}. Restoration has not been verified.")


def restore(archive: Path, database: str) -> None:
    if not re.fullmatch(r"[a-z][a-z0-9_]{0,45}_restore_test", database):
        raise ValueError("Target must be a new lowercase database ending in _restore_test")
    manifest = json.loads(archive.with_suffix(archive.suffix + ".json").read_text("utf-8"))
    if checksum(archive) != manifest["sha256"]:
        raise ValueError("Archive checksum does not match its manifest")
    created = subprocess.run(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            "db",
            "sh",
            "-c",
            'exec createdb -U "$POSTGRES_USER" --template=template0 "$1"',
            "restore",
            database,
        ],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        check=False,
    )
    if created.returncode:
        raise RuntimeError("Could not create a new database; existing databases are never reused")
    with archive.open("rb") as handle:
        result = subprocess.run(
            [
                "docker",
                "compose",
                "exec",
                "-T",
                "db",
                "sh",
                "-c",
                'exec pg_restore -U "$POSTGRES_USER" -d "$1" --exit-on-error '
                "--single-transaction --no-owner --no-privileges",
                "restore",
                database,
            ],
            cwd=ROOT,
            stdin=handle,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            check=False,
        )
    if result.returncode:
        raise RuntimeError("Restore failed; isolated target retained for operator inspection")
    print(f"Restored into {database}. Check PostGIS, Alembic and row counts before accepting it.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    save = commands.add_parser("backup")
    save.add_argument("destination", type=Path)
    recover = commands.add_parser("restore")
    recover.add_argument("archive", type=Path)
    recover.add_argument("--database", required=True)
    args = parser.parse_args()
    try:
        if args.command == "backup":
            backup(args.destination.resolve())
        else:
            restore(args.archive.resolve(), args.database)
    except (OSError, ValueError, KeyError, RuntimeError) as error:
        # Do not print subprocess stderr, connection strings or configuration.
        raise SystemExit(
            f"Archive operation failed ({type(error).__name__}). No existing database was replaced."
        ) from None


if __name__ == "__main__":
    main()
