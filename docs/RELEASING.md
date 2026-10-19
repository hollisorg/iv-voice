# Releasing a new version

Installed copies of IV Voice check GitHub Releases on launch and every six hours. When a newer
**published** release exists they download it in the background, show
"Restart to update to vX" in the status bar, and otherwise install it the next time the app quits.
Unfinished downloads are saved and resume after the restart.

## Steps

1. **Make the change** and test it with `npm run dev`. For packaging changes, also run `npm run dist`
   and install `dist\IV-Voice-Setup.exe`.
2. **Bump the version** (this updates package.json and package-lock.json and creates a `vX.Y.Z` tag):
   ```bash
   npm version patch
   ```
   Use `minor` for new features and `major` for breaking changes.
3. **Write the CHANGELOG entry** for that version (or write it first and commit it before step 2).
4. **Push the commit and the tag:**
   ```bash
   git push --follow-tags
   ```
5. GitHub Actions (`.github/workflows/release.yml`) builds and signs the installer, then creates a
   **draft** release with `IV-Voice-Setup.exe`, its `.blockmap` and `latest.yml`.
6. **Review the draft** on GitHub: download the installer, install it, check the publisher name and
   run one download. Paste the CHANGELOG entry into the release notes.
7. **Publish** the release. Installed apps pick it up within six hours or on their next launch. The
   website button always points at the newest published installer.

## Rules that keep updates working

- Never delete or replace the assets of a published release. Make a new version instead.
- Keep the installer name `IV-Voice-Setup.exe` and the `appId` `ai.infinitevariance.voice`.
  Changing the `appId` makes Windows treat it as a different app.
- Keep `owner`/`repo` in `build.publish` pointing at the public releases repo. Apps already installed
  only look there.
- Speech engine and model downloads don’t need an app release; the app fetches them
  on first run and from Settings.

## If a release is bad

Unpublish it (mark it as a draft) so no more installs pick it up, then ship a fixed higher version.
Copies that already updated get the fix through the normal update. Don't publish a lower version
number; the updater ignores downgrades.
