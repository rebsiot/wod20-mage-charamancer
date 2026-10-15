# GitHub releases and Foundry deployment

## Baseline

The imported baseline is the complete `wod20-mage-charamancer-0.5.33.zip` source package.
The original 40 application files are preserved byte-for-byte **except `module.json`**, which
only adds the GitHub repository, manifest, and stable release-download URLs.
The repository-only `.github`, `docs`, and `tools` files are excluded from installed module ZIPs.

## Version and packaging workflow

- Module ID: `wod20-mage-charamancer` (do not change).
- Source and release version are declared in root `module.json`; update the version when functionality changes.
- Commits to `main` that change `module.json`, or manually dispatching the release workflow,
  validate/package the module. The workflow publishes a GitHub release named `v<version>`
  **only if that release does not already exist**. This prevents silently rewriting releases.
- Release assets include a stable `wod20-mage-charamancer.zip` used by the module manifest
  and a versioned ZIP for retention or rollback.
- The Foundry manifest is `https://raw.githubusercontent.com/rebsiot/wod20-mage-charamancer/main/module.json`.
- Distribution ZIPs install with `module.json` immediately inside the `wod20-mage-charamancer` folder.

## Install/upgrade in the St. Louis Foundry environment

1. Preserve a copy of the current `Z:\Data\modules\wod20-mage-charamancer` folder.
   If a later release will update Actor data, also back up the affected Foundry world.
2. Stop Foundry before replacing files in the module directory over Samba.
3. Extract the **contents of the release ZIP** into `Z:\Data\modules` so the
   installed manifest is at `Z:\Data\modules\wod20-mage-charamancer\module.json`.
4. Restart Foundry, enable the module in the intended world, and reload the browser client.
5. Test one actual Mage creation and the existing-Actor backup-before-update flow.
   Round-trip one real character including XP and non-core traits with the Mage web app.

**Rollback:** Stop Foundry and restore the previous module folder or matching versioned ZIP.
If an update modified world documents, restore the corresponding world snapshot as needed.
The source import to GitHub itself does **not** update the running Foundry installation.

## Test evidence

- **Automated/local:** ZIP integrity, package manifest references, byte comparison with the
  original app files (except added manifest metadata), JavaScript syntax checks.
- **Live Foundry/browser:** Not run as part of repository migration.
- **Cross-component:** Mage web Character Tools and Player Actions use the same Actor data
  contract; no import/export changes were introduced by this migration.

This repository includes the MIT license for pdf-lib and the SIL OFL license for bundled
Liberation fonts. No license for the surrounding custom module is implied by those licenses.
