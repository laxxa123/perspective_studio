# PERSPECTIVE_STUDIO — notes for Claude Code sessions

## Requirements are the source of truth

Read `PERSPECTIVE_STUDIO_Requirements_Base_<version>.md` in the repository root
before any work. There is exactly one such file; its name carries the current
requirements version. Detailed requirements are still being written: build only
what it states.

**Every change that adds a feature or changes behaviour must update the
requirements in the same commit** (section 10): bump the version, rename the
file with `git mv`, update the title and "Requirements version" lines, add a
changelog entry, update the affected sections. Pure bug fixes, refactors and
lint cleanups do not bump the version.

## Build & delivery

- Finished work is pushed straight to `main` (no pull requests). Keep the
  session's `claude/**` branch in step with it.
- Pushes to `main` build and publish a signed APK as a GitHub Release
  (`.github/workflows/build-apk.yml`); Obtainium on the phone picks it up.
- Run `npm run typecheck`, `npm test` and `npm run build` before pushing.
- Do not change the APK signing setup or the `DEBUG_KEYSTORE_BASE64` secret
  (shared with wp_studio): a different key makes installed copies refuse updates.
- The pinned toolchain is in section 0; don't upgrade it as a side effect.
