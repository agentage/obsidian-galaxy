# Releasing

Obsidian requires the GitHub release tag to equal `manifest.json`'s `version`, and the
release must attach `main.js`, `manifest.json`, and `styles.css`. `.npmrc` sets
`tag-version-prefix=` so `npm version` produces a bare tag (`0.1.1`, not `v0.1.1`).

## Automated release train (default)

```
Friday 20:00 Prague cron ┐
   or manual dispatch   ├─► release-prepare.yml ─► opens PR "chore(release): X.Y.Z"
                        ┘        (bumps version, no tag; notes in PR body)
                                        │  review + merge (squash)
                                        ▼
   push to master (manifest.json) ─► auto-tag-on-merge.yml ─► pushes bare tag X.Y.Z
                                        │
                                        ▼
   tag push (*.*.*) ─► release.yml ─► builds + publishes the GitHub Release
```

1. **`release-prepare.yml`** runs every Friday 20:00 Europe/Prague or on manual dispatch
   (Actions -> *Prepare Release* -> `bump_type` = auto/patch/minor/major, optional
   `auto_merge`). GitHub cron is UTC-only and Prague shifts CEST/CET, so both `0 18 * * 5`
   and `0 19 * * 5` are scheduled and a gate job lets only the run where the local Prague
   hour is 20 proceed (the other exits 0 silently; dispatch bypasses the gate). It:
   - skips if an open `release/*` PR already exists;
   - skips (exit 0, no PR) if there are no releasable commits since the last tag - only
     `docs:` / `chore:` / `ci:` do not count, EXCEPT `chore(deps*):` dependency bumps,
     which release as a patch (they ship in the bundle);
   - picks the bump when `auto`: any `feat:` -> minor, any `!` / `BREAKING CHANGE` ->
     major, else patch;
   - runs `npm run verify`;
   - bumps `package.json` + `manifest.json` + `versions.json` via `npm version
     --no-git-tag-version` (no tag here - the tag comes after merge);
   - generates release notes with Claude (`scripts/generate-changelog.mjs`, Anthropic API
     via the `ANTHROPIC_API_KEY` secret). Hard fallback: if the key is missing or the API
     call fails, the script emits a mechanical conventional-commit grouping instead - the
     train is never blocked by the API;
   - writes the notes into `CHANGELOG.md` (`scripts/update-changelog.mjs`, Keep a
     Changelog format) and commits them alongside the version bump;
   - opens the PR `chore(release): X.Y.Z` off branch `release/X.Y.Z` with a rich body
     (notes + checklist + what happens on merge) and the `release` label.
2. **Merge the PR** (squash keeps the `chore(release): X.Y.Z` subject).
3. **`auto-tag-on-merge.yml`** sees the merge to `master` touching `manifest.json` with a
   `chore(release):` subject and pushes the bare tag `X.Y.Z`.
4. **`release.yml`** (tag trigger) checks tag == manifest, runs `npm run verify`, attaches
   the three plugin files, and publishes the GitHub Release. The release body embeds the
   version's section extracted from `CHANGELOG.md`; if no section exists it falls back to
   GitHub's auto-generated notes.

### Dry-run / on-demand

- Preview a bump without waiting for Friday: Actions -> *Prepare Release* ->
  `workflow_dispatch`, leave `auto_merge` off, then inspect the opened PR (version,
  notes, diff) and close it if you do not want to ship.
- `gh workflow run release-prepare.yml -f bump_type=minor` from the CLI does the same.

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

- CI (`ci.yml`) runs `npm run verify` on every push to `master`; `pr-validation.yml` runs
  the full check suite + a sticky status comment on every PR (including release PRs).
- Token chain for the release PR push/create: `RELEASE_PAT || PAT_TOKEN || GITHUB_TOKEN`.
  A PAT is needed for the release PR's push to fire `pr-validation` (GITHUB_TOKEN pushes
  are suppressed by GitHub to prevent recursion); `PAT_TOKEN` is available org-wide.
- `ANTHROPIC_API_KEY` (org secret) powers the Claude release notes; without it the
  mechanical fallback notes are used - releases still ship.
- This plugin makes no network calls, so it has none of the sync plugin's host/docs
  disclosure or mobile-safe bundle checks.
- Submitting to the Obsidian community catalog additionally needs a one-time PR to
  `obsidianmd/obsidian-releases`.
