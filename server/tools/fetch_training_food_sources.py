"""Fetch and verify pinned official AFCD Release 3 files; never write a database.

Run from server: python -m tools.fetch_training_food_sources
Use --verify-only to validate previously downloaded files without network access.
"""

import argparse
from hashlib import sha256
import json
from pathlib import Path
import sys
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools.training_test_support import REPO_ROOT, TMP_ROOT, local_tmp_path

CONFIG_PATH = REPO_ROOT / "server/app/config/training_foods.json"
SOURCE_DIR = TMP_ROOT / "afcd-release-3"
SOURCE_KEYS = {"food-details", "nutrient-profiles", "nutrient-details"}


def pinned_config():
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    release = config["release"]
    if release["name"] != "AFCD Release 3" or set(release["sources"]) != SOURCE_KEYS:
        raise ValueError("Expected the three pinned official AFCD Release 3 sources.")
    for source in release["sources"].values():
        parsed = urlsplit(source["url"])
        if (
            parsed.scheme != "https"
            or parsed.netloc != "www.foodstandards.gov.au"
            or not parsed.path.endswith(".xlsx")
            or parsed.query
            or parsed.fragment
            or len(source["sha256"]) != 64
            or not isinstance(source["bytes"], int)
            or not 0 < source["bytes"] <= 10_000_000
        ):
            raise ValueError("Invalid pinned official AFCD source metadata.")
    return config


def verify_source(raw: bytes, source: dict, name: str) -> None:
    if len(raw) != source["bytes"] or sha256(raw).hexdigest() != source["sha256"]:
        raise ValueError(f"{name}: official source size/SHA-256 mismatch; nothing was imported.")


def verified_release(source_dir: Path = SOURCE_DIR):
    from app.services.afcd_import import parse_release

    source_dir = local_tmp_path(source_dir)
    config = pinned_config()
    for name, source in config["release"]["sources"].items():
        path = local_tmp_path(source_dir / f"{name}.xlsx")
        verify_source(path.read_bytes(), source, name)
    payload = parse_release(source_dir)
    pinned = config["release"]
    if (
        payload["release"] != pinned["name"]
        or payload["fingerprint"] != pinned["fingerprint"]
        or payload["sources"] != pinned["sources"]
        or payload["basis"] != pinned["basis"]
    ):
        raise ValueError("Parsed AFCD content does not match the pinned release fingerprint.")
    return payload


def fetch_sources(source_dir: Path = SOURCE_DIR, *, verify_only: bool = False):
    source_dir = local_tmp_path(source_dir)
    config = pinned_config()
    for name, source in config["release"]["sources"].items():
        path = local_tmp_path(source_dir / f"{name}.xlsx")
        if path.exists():
            verify_source(path.read_bytes(), source, name)
            continue
        if verify_only:
            raise ValueError(f"Missing official AFCD file: {name}.xlsx")
        request = Request(source["url"], headers={"User-Agent": "AI-Hoops-AFCD-verifier/1.0"})
        with urlopen(request, timeout=45) as response:
            redirected = urlsplit(response.url)
            if redirected.scheme != "https" or redirected.netloc != "www.foodstandards.gov.au":
                raise ValueError("AFCD download redirected outside the official HTTPS source.")
            raw = response.read(source["bytes"] + 1)
        verify_source(raw, source, name)
        source_dir.mkdir(parents=True, exist_ok=True)
        with path.open("xb") as output:
            output.write(raw)
    return verified_release(source_dir)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=SOURCE_DIR)
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args(argv)
    payload = fetch_sources(args.source_dir, verify_only=args.verify_only)
    print(json.dumps({
        "source_dir": str(args.source_dir.resolve()),
        "release": payload["release"], "fingerprint": payload["fingerprint"],
        "foods": len(payload["foods"]), "files_verified": len(SOURCE_KEYS),
    }))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError) as exc:
        print(f"AFCD source verification failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
