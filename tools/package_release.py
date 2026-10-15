#!/usr/bin/env python3
"""Validate and assemble the Foundry module release without developer tooling."""
import argparse
import json
import pathlib
import shutil
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OMIT = {".git", ".github", "tools", "docs", "dist", "__pycache__"}
MODULE_ID = "wod20-mage-charamancer"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="validate without packaging")
    args = parser.parse_args()
    manifest_path = ROOT / "module.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["id"] == MODULE_ID, "Unexpected Foundry module ID"
    version = manifest["version"]
    assert version and all(x.isdigit() for x in version.split(".")), "Invalid version"
    for field in ("esmodules", "styles", "scripts"):
        for target in manifest.get(field, []):
            assert (ROOT / target).is_file(), f"Missing {field}: {target}"
    assert (ROOT / "scripts/pdf-lib-LICENSE.md").is_file()
    assert (ROOT / "scripts/Liberation-fonts-LICENSE.txt").is_file()
    files = sorted(p for p in ROOT.rglob("*") if p.is_file()
                   and not any(part in OMIT for part in p.relative_to(ROOT).parts)
                   and not p.name.startswith(".") and p.suffix not in (".zip", ".pyc"))
    assert (ROOT / "module.json") in files and len(files) >= 40
    if args.check:
        print(f"Validated {MODULE_ID} v{version} with {len(files)} module files")
        return
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    archive = dist / f"{MODULE_ID}.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in files:
            relative = p.relative_to(ROOT).as_posix()
            data = p.read_bytes()
            entry = zipfile.ZipInfo(f"{MODULE_ID}/{relative}", (2020, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(entry, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        assert json.loads(z.read(f"{MODULE_ID}/module.json"))["version"] == version
    versioned = dist / f"{MODULE_ID}-{version}.zip"
    shutil.copyfile(archive, versioned)
    print(f"Created {archive.name} and {versioned.name}")

if __name__ == "__main__":
    main()
