# Releasing

Obsidian requires the GitHub release tag to equal `manifest.json`'s `version`, and the
release must attach `main.js`, `manifest.json`, and `styles.css`. `.npmrc` sets
`tag-version-prefix=` so `npm version` produces a bare tag (`0.1.1`, not `v0.1.1`).

## Automated release train (default)

Friday train v3 (canon: vault `playbooks/friday-release-train.md`). No cron in this repo,
no direct push to `master`.

```
agentage/automation (Fri) or manual dispatch
   └─► prepare-release.yml ─► PR "chore(release): X.Y.Z" off release/X.Y.Z, auto-merge armed
                                  │  CI gate green -> squash merge
                                  ▼
   push to master (manifest.json) ─► auto-tag-on-merge.yml ─► bare tag X.Y.Z + dispatch
                                  ▼
   release.yml ─► verify + GitHub Release with main.js, manifest.json, styles.css
```

1. **`prepare-release.yml`** (`workflow_dispatch`, input `bump` = auto/patch/minor/major).
   Skips if a `release/*` PR is already open, or (`auto`) if nothing releasable landed
   since the last bare tag. `auto`: any `feat:` -> minor, other code or `chore(deps*)` ->
   patch. `npm version --no-git-tag-version` runs the `version` script, so
   `package.json` + `manifest.json` + `versions.json` move together. The PR is opened
   with `PAT_TOKEN` so the CI gate runs on it.
2. **`auto-tag-on-merge.yml`** tags the `chore(release):` merge commit and dispatches
   `release.yml` (a `GITHUB_TOKEN` tag push fires no workflow).
3. **`release.yml`** checks tag == manifest, runs `npm run verify` and publishes the
   release. Notes come from the version's `CHANGELOG.md` section if present, else
   GitHub-generated notes.

Release any day: `gh workflow run prepare-release.yml -R agentage/obsidian-galaxy -f bump=minor`.

## Manual fallback (tag push)

If you need to release outside the train:

```bash
npm run verify                 # green gate before releasing
npm version patch              # bumps package.json + manifest.json + versions.json, makes the tag
git push --follow-tags         # fires .github/workflows/release.yml
```

The `version` npm script runs `version-bump.mjs`, which writes the new version into
`manifest.json` and records `version -> minAppVersion` in `versions.json`.

You can also run the **Release** workflow from the Actions tab (`workflow_dispatch`): it
builds and releases the *current* `manifest.json` version (creating the matching tag).
Tick **draft** to inspect the assets before publishing.

## Notes

- CI (`ci.yml`, job `🔧 Verify`) runs on every PR and push to `master`; it is the
  required check of the `master-protection` ruleset.
- This plugin makes no network calls, so it has none of the sync plugin's host/docs
  disclosure or mobile-safe bundle checks.
- Submitting to the Obsidian community catalog additionally needs a one-time PR to
  `obsidianmd/obsidian-releases`.
