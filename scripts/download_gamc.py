"""Download the documented GAMC MONICA archive, without overwriting existing data."""

import hashlib
import io
import json
import urllib.request
import zipfile
from datetime import UTC, datetime
from pathlib import Path

URL = "https://recursosgamc.cochabamba.bo/assets/geo/red_monica.zip"
MAX_ARCHIVE = 8_000_000
MAX_MEMBER = 12_000_000
MEMBERS = ("red_monica.kanata (1).csv", "red_monica.semapa (1).csv")


def save_new(path: Path, content: bytes) -> None:
    if path.exists():
        if path.read_bytes() != content:
            raise ValueError(f"Existing file differs; preserve and review it: {path.name}")
        return
    with path.open("xb") as output:
        output.write(content)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    folder = root / "data/raw/gamc/monica"
    folder.mkdir(parents=True, exist_ok=True)
    archive = folder / "red_monica.zip"
    downloaded = not archive.exists()
    metadata = {}
    if downloaded:
        request = urllib.request.Request(URL, headers={"User-Agent": "CochaDigitalTwin/0.1"})
        with urllib.request.urlopen(request, timeout=40) as response:
            content = response.read(MAX_ARCHIVE + 1)
            metadata = {
                "content_type": response.headers.get("Content-Type"),
                "last_modified": response.headers.get("Last-Modified"),
                "etag": response.headers.get("ETag"),
            }
        if len(content) > MAX_ARCHIVE:
            raise ValueError("Archive exceeds pilot download limit")
        # Validate the entire archive before publishing any raw data.
        with zipfile.ZipFile(io.BytesIO(content)) as compressed:
            validate_members(compressed)
        save_new(archive, content)
    elif archive.stat().st_size > MAX_ARCHIVE:
        raise ValueError("Existing archive exceeds pilot limit")

    with zipfile.ZipFile(archive) as compressed:
        validate_members(compressed)
        for name in MEMBERS:
            save_new(folder / name, compressed.read(name))

    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    manifest = folder / f"manifest-{digest[:16]}.json"
    if not manifest.exists():
        document = {
            "source_url": URL,
            "documentation_url": "https://recursosgamc.cochabamba.bo/api-doc",
            "recorded_at": datetime.now(UTC).isoformat(),
            "retrieved_in_this_run": downloaded,
            "http_metadata": metadata,
            "license_status": "Not confirmed in downloaded CSV files",
            "units_status": "Not declared in CSV headers; must be verified",
            "timezone_status": "Timestamps have no offset; must be verified",
            "station_coordinates_status": "Not present in these CSV files",
            "files": {
                name: {
                    "bytes": (folder / name).stat().st_size,
                    "sha256": hashlib.sha256((folder / name).read_bytes()).hexdigest(),
                }
                for name in (archive.name, *MEMBERS)
            },
        }
        save_new(manifest, (json.dumps(document, indent=2) + "\n").encode("utf-8"))
    else:
        document = json.loads(manifest.read_text(encoding="utf-8"))
        for name, entry in document["files"].items():
            if hashlib.sha256((folder / name).read_bytes()).hexdigest() != entry["sha256"]:
                raise ValueError(f"Manifest checksum mismatch: {name}")
    print("Downloaded MONICA archive" if downloaded else "Reused existing MONICA archive")
    print("Verified two CSV files and checksums; no files overwritten")
    print("Location: data/raw/gamc/monica/")


def validate_members(compressed: zipfile.ZipFile) -> None:
    if len(compressed.infolist()) != len(MEMBERS):
        raise ValueError("Unexpected archive layout; inspect it before extracting")
    if set(compressed.namelist()) != set(MEMBERS):
        raise ValueError("Unexpected archive members; no automatic extraction")
    for member in compressed.infolist():
        if member.file_size > MAX_MEMBER or member.flag_bits & 1:
            raise ValueError("Oversized or encrypted archive member")
    if compressed.testzip() is not None:
        raise ValueError("Archive failed CRC verification")


if __name__ == "__main__":
    main()
