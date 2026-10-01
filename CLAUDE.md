# CLAUDE.md — CREATIVE (app) · PERSPECTIVE (first module)

Read first: docs/CREATIVE.md (the app CREATIVE: home screen, module plugins, per-module version history, open decisions), docs/modules/<id>/REQUIREMENTS.md (the module you work on; PERSPECTIVE today, CUBE next), docs/decisions/*.

Names: the app is **CREATIVE**; modules are **PERSPECTIVE**, **CUBE**, …. Never rename the app id `com.perspectivestudio.app`, the repository or the signing key.

## Rules

- Work only on the current milestone. Implement only ACTIVE requirement IDs. Cite IDs in commits.
- If a requirement is ambiguous or missing, stop and ask. Do not invent features, fields, or UI.
- Objects are 3D world geometry; the screen is a projection (ADR-0001). Never store projected 2D geometry for world entities.
- All projection/unprojection goes through core/perspective. No math in React or Konva code.
- core/ imports nothing from React, Konva, DOM, Zustand, Capacitor.
- Every document change is a command. Drags = one history entry.
- New entity kind = new folder in core/entities + registry line + tests. Do not edit the pipeline to add a shape.
- Schema change = schemaVersion bump + migration + fixture test.
- No new dependency without an ADR.
- Geometry changes require passing property tests (§6.6). Never loosen a tolerance to make a test pass without an ADR.
- Update docs/modules/perspective/REQUIREMENTS.md (Perspective) or docs/CREATIVE.md (suite, other modules) in the same change when behaviour changes; add each release to CREATIVE.md §5.
- CUBE (React Native · Skia · Filament · SQLite) has its own stack: write no CUBE code until CR-OD-1 (docs/CREATIVE.md §8) is decided.
- New modules are plugins: `src/modules/<id>/` + one entry in `src/suite/modules.ts` + `docs/modules/<id>/REQUIREMENTS.md`. Modules never import each other.
- Prefer small, surgical diffs. Don't reformat or refactor unrelated code.
- Use glossary terms exactly (VP-L, VP-R, VP-V, family L/R/V, picture plane, world, anchor).

## Delivery (REQUIREMENTS §14)

- Finished work is pushed straight to `main` (no pull requests). Keep the session's `claude/**` branch in step with it.
- Every push to `main` runs `.github/workflows/build-apk.yml`: lint, typecheck, tests, build, signed APK, GitHub Release. Obtainium on the phone installs it. Push only green work.
- Never change the signing key or the `DEBUG_KEYSTORE_BASE64` secret (shared with wp_studio): a different key makes the installed app refuse updates.
- Bump `package.json` `version` for each milestone release (§14); user-visible changes go in docs/CHANGELOG.md.

## Commands

- dev: npm run dev · test: npm test · lint: npm run lint · typecheck: npm run typecheck · android: npm run android · release: push to main (CI)
