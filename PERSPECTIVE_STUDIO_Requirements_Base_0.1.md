# PERSPECTIVE_STUDIO_Requirements_Base_0.1.md

**Requirements version: 0.1** (2026-09-30). See the changelog below and the
versioning rule in section 10.

This is the single source of truth for any Claude Code session working in this
repository. The detailed product requirements are **still being written**;
sections marked *(draft)* hold only what the owner has stated so far. Do not
invent features beyond them.

### Changelog

- **0.1** (2026-09-30) — Project created. Tech stack, delivery pipeline and a
  working skeleton: a full-screen Konva canvas with a draggable horizon and
  three draggable vanishing points (left and right locked to the horizon),
  guide rays from each, and a Reset button.

## 0. Current state

- Skeleton only (see changelog 0.1). `npm run typecheck`, `npm test` and
  `npm run build` are clean.
- Pinned toolchain (don't upgrade as a side effect): Node 22, React 19.3,
  TypeScript 7.0, Vite 8.3, Konva 10.7 / react-konva 19.3, Vitest 5.0,
  Capacitor 8.5 (Android: AGP 8.13, Gradle 8.14.3, Java 21, minSdk 24,
  target/compile SDK 36).

## 1. Concept *(draft)*

PERSPECTIVE_STUDIO is a 2D perspective drawing skill app. The user sets a
horizon and three vanishing points, constructs multiple perspective cubes, and
eventually sketches freely or with perspective assistance.

Single developer, single user (the owner), private. Separate project from
wp_studio; it shares only the owner, the phone and the delivery method.

## 2. Technology

| Part | Role |
|---|---|
| React | App interface: toolbars, panels, controls, layers, interaction states |
| TypeScript | Perspective mathematics, object model, sketch/stroke model, app logic |
| Konva (react-konva) | Interactive 2D canvas: perspective geometry, cubes, guides, sketches |
| Vite | Dev server and production build |
| PWA | Optional later layer: installable web app |
| Capacitor | Packages the web build as the Android app (iOS possible later) |
| Obtainium | Installs and updates the APK from this repo's GitHub Releases |
| IndexedDB / Local Storage | Saved drawings, scenes, settings, exercises |
| SVG / PNG export | Share or further edit finished drawings |

## 3. Architecture

Keep the layers separate:
- `src/math/` — pure geometry (no React, no Konva), unit-tested.
- `src/model/` — scene / object / stroke model, plain serialisable data.
- `src/canvas/` — Konva rendering and interaction.
- `src/App.tsx` and future `src/ui/` — React chrome (toolbars, panels).

## 4. Perspective setup *(draft — implemented in 0.1)*

- One horizon line (a height). Dragging it vertically moves the left and right
  vanishing points with it.
- Left and right vanishing points lie on the horizon; they drag horizontally.
- The vertical (third) vanishing point drags freely, above or below the horizon.
- Each vanishing point shows a fan of light guide rays.
- Reset restores the default setup for the current screen size.

## 5. Perspective cubes *(to be specified)*

## 6. Sketching and perspective assistance *(to be specified)*

## 7. Storage *(to be specified — IndexedDB / Local Storage)*

## 8. Export *(to be specified — SVG / PNG)*

## 9. Build & delivery

- Every push to `main` runs `.github/workflows/build-apk.yml`: typecheck,
  tests, Vite build, `cap sync android`, a signed release APK, and a GitHub
  Release `v<package version>-build.<run number>` carrying
  `perspective_studio.apk`. Obtainium on the phone picks it up.
- The APK is signed with the same fixed debug keystore as wp_studio (repository
  secret `DEBUG_KEYSTORE_BASE64`, alias `androiddebugkey`, password `android`).
  Never change it: a different key makes installed copies refuse updates. The
  workflow refuses to publish an APK signed with any other key.
- App id `com.perspectivestudio.app`, so it installs next to wp_studio.
- The version shown in the toolbar is the build's version name (`APP_VERSION`,
  `dev` locally).

## 10. Requirements versioning

Whenever a change adds a feature or changes behaviour, the same commit also
updates this file:
- bump the version (minor `0.1` → `0.2` for features; major for breaking
  changes to saved data), rename the file with `git mv`, and update the title
  line and the "Requirements version" line;
- add a changelog entry at the top (version, date, what changed, sections);
- update the affected sections so this file describes the product as it is.

Pure bug fixes, test fixes, refactors and lint cleanups that change no
behaviour do not bump the version.

## 11. Development method (for Claude Code)

- Finished work is pushed straight to `main` (no pull requests). Keep the
  session's `claude/**` branch in step with it.
- Before pushing, run `npm run typecheck`, `npm test` and `npm run build`.
  Never push a red build: every push to `main` publishes an APK.
- Small, focused commits. Don't bump dependencies or the toolchain as a side
  effect. Never commit secrets or keystores.
