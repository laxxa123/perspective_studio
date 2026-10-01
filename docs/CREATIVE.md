# CREATIVE — main app document

> **App version:** 0.12.0 · **Document version:** 1.1 (2026-10-01) · Owner: sole developer/user · Location: `docs/CREATIVE.md`

CREATIVE is the app; its tools are **modules** (plugins). This document holds
what belongs to the app as a whole: the home screen, how modules plug in, the
module list, the version history of the app and of every module, the
functions modules will share, and what every new module's requirements must
settle up front. Each module has its own requirements in
`docs/modules/<id>/REQUIREMENTS.md`.

**Revisions:** 1.1 (0.12.0, 2026-10-01) — the app is named **CREATIVE** and the first module **PERSPECTIVE** (was "Perspective Studio"); docs reorganised per module (`docs/modules/`); CUBE registered as the next module, its stack recorded and its integration decision opened (CR-OD-1); new-module requirements checklist (§7). · 1.0 (0.11.0, 2026-10-01) — home screen, module registry, PERSPECTIVE as the first module (ADR-0007).

---

## 1. Product

**CREATIVE** — *Ideas to creation: Sketch · Explore · Analyze · Publish.*
One private, offline, single-user Android app (Capacitor host, delivered by
Obtainium). It opens on the home screen; each tile opens a module.

Kept unchanged so installed copies keep updating: app id
`com.perspectivestudio.app`, the signing key (`DEBUG_KEYSTORE_BASE64`), the
repository `laxxa123/perspective_studio` and its release tags.

## 2. Home screen (CR-01)

Built from the developer's mockup (`docs/brand/suite-home-mockup.png`).

- Header: "CREATIVE" eyebrow, title "Ideas to creation", tagline
  "SKETCH · EXPLORE · ANALYZE · PUBLISH"; ⋮ menu (Settings, version).
- A 3 × 3 grid of module tiles: Studio · Cube · **Perspective** · Publish ·
  Sketch · Sequence · Sensitivity · Toolbox · More.
- **PERSPECTIVE** opens its scene gallery. Every other tile shows
  "<Module> — coming soon." until its module ships.
- Bottom navigation: **Home** · **Library** (coming soon, CR-C2) ·
  **Settings** (shared settings screen).
- Android back: editor → gallery → home → leaves the app. A module's first
  screen has a back arrow to Home.
- Launcher label: **CREATIVE**.

## 3. Modules as plugins (CR-02, ADR-0007)

- **Registry:** `src/suite/modules.ts` — one `SuiteModule` per tile: `id`,
  `title`, tile `art`, `version` (null until it ships), `entry` (the screen it
  opens; null = coming soon). The home screen does not change when a module
  is added.
- **Isolation:** a module owns its code, its stored data and its requirements
  document. Modules never import each other; anything two modules need goes
  to the shared functions (§6) first.
- **Code layout:** the app shell lives in `src/suite/` (lint element `suite`,
  may use only `state`, `platform`, `theme`). PERSPECTIVE's code is the
  existing `src/{core,state,tools,render,export,ui,platform,theme}` tree.
  Further modules built on the same web stack go under `src/modules/<id>/`.
  A module on a different stack (CUBE) depends on CR-OD-1.
- **Docs layout:**

  ```
  docs/CREATIVE.md                      this document (app)
  docs/CHANGELOG.md                     user-visible notes, every release
  docs/decisions/ADR-NNNN-*.md          decisions, one numbering for the repo
  docs/brand/                           logo, mockups
  docs/modules/<id>/REQUIREMENTS.md     a module's requirements
  docs/modules/<id>/checklists/         its device checklists
  ```

## 4. Module list

| Module | Id | Status | Version | Stack | Requirements |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Studio | `studio` | coming soon | — | — | — |
| **Cube** | `cube` | **requirements in progress** | — | React Native · TypeScript · Skia · Filament · SQLite | `docs/modules/cube/` (awaiting) |
| **Perspective** | `perspective` | **live** | **0.12.0** | React · TypeScript · Konva · Vite · Capacitor · IndexedDB | `docs/modules/perspective/REQUIREMENTS.md` (v1.9) |
| Publish | `publish` | coming soon | — | — | — |
| Sketch | `sketch` | coming soon | — | — | — |
| Sequence | `sequence` | coming soon | — | — | — |
| Sensitivity | `sensitivity` | coming soon | — | — | — |
| Toolbox | `toolbox` | coming soon | — | — | — |
| More | `more` | placeholder | — | — | — |

## 5. Versioning and history

- **App version** = `package.json` `version`; CI publishes
  `v<version>-build.<run>`; Android `versionCode` = CI run number.
- **Module version** = the app version of the release in which the module
  last changed (registry + tables below). A module's requirements document
  has its own document version.
- Every release adds a row to §5.1 and to each module it touches.

### 5.1 CREATIVE (app)

| App | Date | Change |
| :-- | :-- | :-- |
| 0.12.0 | 2026-10-01 | Named CREATIVE (launcher label, home header); module renamed PERSPECTIVE; docs per module; CUBE registered (requirements pending). |
| 0.11.0 | 2026-10-01 | Home screen, module registry, Library / Settings navigation; Perspective becomes the first module (ADR-0007). |

### 5.2 PERSPECTIVE

| Version | Date | Milestone | Requirements | Summary |
| :-- | :-- | :-- | :-- | :-- |
| 0.1.0 | 2026-09-30 | — | 0.1 | Project created: skeleton, Capacitor Android, APK workflow. |
| 0.2.0 | 2026-09-30 | M0 | v1.1 | Foundation and device spike. |
| 0.3.0 | 2026-09-30 | M1 | v1.2 | Perspective core (solver, validity, property tests). |
| 0.4.0 | 2026-09-30 | M2 | v1.3 | Canvas and perspective setup. |
| 0.8.0 | 2026-09-30 | M3–M6 | v1.4 | Boxes, documents, scenes, layers, sketch. |
| 0.9.0 | 2026-09-30 | M8 | v1.6 | Horizon = eye level, Shapes, placement above the horizon, plan view, quick zoom. |
| 0.10.0 | 2026-10-01 | M9 | v1.7 | The eye is stored (ADR-0006), View turn / tilt, VP hints, clean-up. |
| 0.11.0 | 2026-10-01 | — | v1.8 | Opens from the home screen; back arrow to Home. |
| 0.12.0 | 2026-10-01 | — | v1.9 | Renamed PERSPECTIVE (was Perspective Studio). |

### 5.3 CUBE

Not released. Requirements in progress.

## 6. Shared functions (planned, CR-C*)

To be specified before they are built; `PARKED` until then.

| Id | Function | Notes |
| :-- | :-- | :-- |
| CR-C1 | Settings | Split into app-wide (theme, handedness) and per-module sections. |
| CR-C2 | Library | Every module's saved work in one place (thumbnails, search, open in its module). |
| CR-C3 | Storage and backup | One backup / restore covering all modules (incl. CUBE's SQLite if it is a separate app). |
| CR-C4 | Export and share | Shared PNG / SVG / JSON / share-sheet conventions. |
| CR-C5 | Theme and design tokens | One token set (colours incl. family L/R/V, type, spacing) for every module and stack. |
| CR-C6 | About and updates | Version, per-module versions, release notes. |
| CR-C7 | Cross-module hand-off | e.g. a PERSPECTIVE scene opened in CUBE; needs a shared file format. |

## 7. What every new module's requirements must settle up front

1. How it joins CREATIVE (same web stack inside the app, or a separate app
   launched from its tile) — for CUBE this is CR-OD-1.
2. Repository and release layout: folder or repo, app id, release tag prefix
   (Obtainium filters by it), versioning.
3. Product definition, goals, non-goals; relation to existing modules.
4. Exceptions to app-wide rules (e.g. a 3D engine is a non-goal for
   PERSPECTIVE, not necessarily for others).
5. World / unit / colour conventions shared with other modules.
6. Pinned toolchain and library versions; minimum Android version and GPU
   needs.
7. Rendering split between libraries.
8. Assets: formats, size budget.
9. Data model, persistence, migrations, import / export, backup, Library.
10. Interaction model: gestures, stylus, selection, snapping, undo / redo.
11. Look and feel: CREATIVE tokens, light / dark, screens.
12. Performance targets on the developer's phone.
13. Testing strategy and device checklists.
14. Milestones with acceptance criteria, starting with an M0 device spike.
15. Requirement IDs (e.g. `CB-01`), document versioning and changelog.
16. Permissions, offline, privacy.

## 8. Open decisions

| # | Question | Default until decided |
| :-- | :-- | :-- |
| CR-OD-1 | How CUBE (React Native · Skia · Filament · SQLite) joins CREATIVE, whose host is Capacitor + React web. (a) CUBE is its own React Native app (own app id, same signing key, own tag prefix `cube-v*`), launched from the CUBE tile by intent, with "Install CUBE" when missing; (b) CREATIVE's host moves to React Native and PERSPECTIVE runs in a WebView; (c) CUBE uses the web stack. | (a) recommended; nothing built until decided. CUBE tile stays "coming soon". |
| CR-OD-2 | Where CUBE's code lives | Same repository, `apps/cube/` (own `package.json`, own CI workflow building only on changes there), if CR-OD-1 = (a). |

## 9. Change management

- Behaviour changes update this document (app) or the module's requirements
  in the same commit; each release adds its rows to §5.
- New module: registry entry + art, `docs/modules/<id>/REQUIREMENTS.md`,
  rows in §4 and §5, an ADR for its stack / dependencies, and the §7 items.
