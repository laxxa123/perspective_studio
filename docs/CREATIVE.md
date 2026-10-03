# CREATIVE — main app document

> **App version:** 0.27.0 · **Document version:** 1.17 (2026-10-03) · Owner: sole developer/user · Location: `docs/CREATIVE.md`

CREATIVE is the app; its tools are **modules** (plugins). This document holds
what belongs to the app as a whole: the home screen, how modules plug in, the
module list, the version history of the app and of every module, the
functions modules will share, and what every new module's requirements must
settle up front. Each module has its own requirements in
`docs/modules/<id>/REQUIREMENTS.md`.

**Revisions:** 1.17 (0.27.0, 2026-10-03) — OBJECTS v1.5: holes are see-through cutouts; module list and history updated. · 1.16 (0.26.0, 2026-10-03) — Question ids for all modules: `<MODULE>-Q-<n>`, a version `<MODULE>-Q-<n>.<v>` (§3.1); CUBE v1.4, OBJECTS v1.4 (holes, 2D 4 × 4 / 6 × 6). · 1.15 (0.25.0, 2026-10-03) — Notes everywhere (§2.4): one app-wide note on the home screen and in every module, three saved notes; PUBLISH requirements v1.6. · 1.14 (0.24.0, 2026-10-03) — OBJECTS Phase 1a (requirements v1.3); module list and history updated. · 1.13 (0.23.0, 2026-10-03) — OBJECTS M0 on the home screen (requirements v1.2, ADR-0012); module list and history updated. · 1.12 (2026-10-03) — OBJECTS planned: requirements v1.1 (blocks and 2D figures first, isometric line drawings); CR-OD-5 decided. · 1.11 (0.22.0, 2026-10-03) — New launcher icon (a 2 × 2 × 2 cube); CUBE requirements v1.3 (phone layout); module list and history updated. · 1.10 (0.21.0, 2026-10-03) — SKETCH requirements v1.3 (cube-net grid, soft snap, hold actions), PUBLISH requirements v1.5; module list and history updated. · 1.9 (0.20.0, 2026-10-02) — PUBLISH requirements v1.4 (compact Style bar, gestures); module list and history updated. · 1.8 (0.19.0, 2026-10-02) — Drawing controls reworked in PUBLISH (requirements v1.3) and SKETCH (requirements v1.2); module list and history updated. · 1.7 (0.18.0, 2026-10-02) — PUBLISH requirements v1.2 (old posts converted on Edit, compact layout, notepad); module list and history updated. · 1.6 (0.17.0, 2026-10-02) — PUBLISH publishes to WordPress (PUBLISH requirements v1.1; ADR-0011: Application Password in the Android Keystore through `@aparajita/capacitor-secure-storage`, wrapped in `src/platform/secrets.ts`); module list and history updated. · 1.5 (0.16.0, 2026-10-01) — PUBLISH added (WP Studio rebuilt as a module, Phase 1: TILES; ADR-0010): CR-OD-4 decided; module list, code layout, data and history updated. · 1.4 (0.15.0, 2026-10-01) — CUBE design rework (CUBE requirements v1.2); module list and history updated. · 1.3 (0.14.0, 2026-10-01) — SKETCH Phase 1 built as an in-app module with its own WebGL2 raster engine (ADR-0009): CR-OD-3 decided; module list, code layout, data and history updated. · 1.2 (0.13.0, 2026-10-01) — CUBE Phase 1 built as an in-app module (ADR-0008): CR-OD-1 and CR-OD-2 decided; module list, code layout and history updated. · 1.1 (0.12.0, 2026-10-01) — the app is named **CREATIVE** and the first module **PERSPECTIVE** (was "Perspective Studio"); docs reorganised per module (`docs/modules/`); CUBE registered as the next module, its stack recorded and its integration decision opened (CR-OD-1); new-module requirements checklist (§7). · 1.0 (0.11.0, 2026-10-01) — home screen, module registry, PERSPECTIVE as the first module (ADR-0007).

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
- **PERSPECTIVE** opens its scene gallery; **CUBE** opens CUBE (Studio ·
  Question Bank · Test · Analysis). Every other tile shows
  "<Module> — coming soon." until its module ships.
- Bottom navigation: **Home** · **Library** (coming soon, CR-C2) ·
  **Settings** (shared settings screen).
- Android back: editor → gallery → home, CUBE → home, home → leaves the app.
  A module's first screen has a back arrow to Home.
- Launcher label: **CREATIVE**.

### 2.4 Notes everywhere (0.25.0)

One note for the whole app, for quick ideas and copy / paste while
working: the **Notes** button (notebook icon) sits on the home screen
(next to ⋮) and in every module's top bar — PERSPECTIVE gallery and
editor, CUBE, SKETCH (gallery and drawing screen), PUBLISH (every tab and
the tile editor) and OBJECTS. It opens a small card at the top right over
the current screen; the same note shows wherever it is opened.
- Saved as you type (on the device, `localStorage` `creative.notes.v1`).
- **Copy** (the selection or all), **Clear** (with Undo), **Save**: keeps
  the note as a saved note — up to **three, newest first; a fourth drops
  the oldest** (FIFO). **① ② ③** open a saved note in the pad (the text it
  replaces can be brought back with Undo); hold one to remove it (Undo).
  In the PUBLISH tile editor, **Place** also puts the selection (or all)
  on the tile as text.
- Code: `src/shared/` (NoteButton, Notepad, `notes.ts` — pure, tested);
  every screen and module may use `src/shared/` (lint), which depends on
  nothing but `platform`.

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
  Further modules go under `src/modules/<id>/` — CUBE (`src/modules/cube/`),
  SKETCH (`src/modules/sketch/`) and PUBLISH (`src/modules/publish/`).
  Exception (ADR-0010): PUBLISH uses SKETCH's UI-free brush engine
  (`sketch/core`, `sketch/engine`, `sketch/input`) as a library. A module is lazy-loaded from `App.tsx` (its own
  chunk), receives an `onExit` callback, may use `src/platform/` and the CSS
  tokens, and never imports another module (lint elements `cube-core`, `cube`,
  `sketch-core`, `sketch-engine`, `sketch` in `eslint.config.js`; a module's
  pure core has no UI / storage imports). A module may register an Android
  back-button handler (SKETCH: `sketchBack` in its `index.ts`).
- **Data:** each module keeps its own storage — PERSPECTIVE in IndexedDB,
  CUBE in SQLite (`cube`) on Android (IndexedDB in a browser), SKETCH in
  IndexedDB (`creative-sketch`), PUBLISH in IndexedDB (`creative-publish`). No sharing.
- **Docs layout:**

  ```
  docs/CREATIVE.md                      this document (app)
  docs/CHANGELOG.md                     user-visible notes, every release
  docs/decisions/ADR-NNNN-*.md          decisions, one numbering for the repo
  docs/brand/                           logo, mockups
  docs/modules/<id>/REQUIREMENTS.md     a module's requirements
  docs/modules/<id>/checklists/         its device checklists
  ```

### 3.1 Question ids (all modules, 0.26.0)

Every module that makes questions numbers them the same way:
- **Permanent id** `<MODULE>-Q-<n>`: CUBE-Q-1, OBJECTS-Q-12. `n` counts up
  from a stored counter and is never reused.
- **A version** is written `<MODULE>-Q-<n>.<version>`: **CUBE-Q-1.1** is
  question 1, version 1; editing and committing it gives CUBE-Q-1.2. Lists,
  sheets, messages and export file names use this form.
- Ids stored before 0.26.0 were zero-padded (CUBE-Q-000001); they are kept
  as stored and shown the same way (CUBE-Q-1.1); search finds either form.
- Code: `src/shared/ids/questionId.ts` (pure; any module, its core
  included, may use it).

## 4. Module list

| Module | Id | Status | Version | Stack | Requirements |
| :-- | :-- | :-- | :-- | :-- | :-- |
| Studio | `studio` | coming soon | — | — | — |
| **Cube** | `cube` | **live (Phase 1: Studio, Question Bank)** | **0.26.0** | React · TypeScript · Konva · Three.js · SQLite (Capacitor) | `docs/modules/cube/REQUIREMENTS.md` (v1.4) |
| **Perspective** | `perspective` | **live** | **0.12.0** | React · TypeScript · Konva · Vite · Capacitor · IndexedDB | `docs/modules/perspective/REQUIREMENTS.md` (v1.9) |
| **Publish** | `publish` | **live (Tiles · Publish · Posts · Settings)** | **0.25.0** | React · TypeScript · Konva · SKETCH brush engine · IndexedDB · WordPress REST · Keystore secure storage | `docs/modules/publish/REQUIREMENTS.md` (v1.6) |
| **Sketch** | `sketch` | **live (Phase 1)** | **0.21.0** | React · TypeScript · custom WebGL2 tiled raster engine · Pointer Events · IndexedDB | `docs/modules/sketch/REQUIREMENTS.md` (v1.3) |
| **Objects** | `objects` | **live (Phase 1a: Studio, Question Bank)** | **0.27.0** | React · TypeScript · Three.js (authoring view) · pure SVG renderer (question figures) · SQLite (Capacitor) | `docs/modules/objects/REQUIREMENTS.md` (v1.5) |
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
| 0.27.0 | 2026-10-03 | OBJECTS: holes are see-through cutouts in the 3D view, drawings, views and cuts. |
| 0.26.0 | 2026-10-03 | Question ids CUBE-Q-1.1 style for all modules; OBJECTS holes through block lines; 2D grids 4 × 4 / 6 × 6. |
| 0.25.0 | 2026-10-03 | Notes everywhere: the app-wide note with three saved notes on the home screen and in every module. |
| 0.24.0 | 2026-10-03 | OBJECTS Phase 1a: 3D block and 2D figure questions (13 types) with exact answers and intentional wrong options; Question Bank with ids, versions, export. |
| 0.23.0 | 2026-10-03 | OBJECTS M0: build block objects in a 3D view; isometric line drawings as questions will show them. |
| 0.22.0 | 2026-10-03 | New launcher icon (cube); CUBE phone layout: board area fits the board, nothing against the phone's navigation bar. |
| 0.21.0 | 2026-10-03 | SKETCH: cube-net grid with dots, soft snap, tap / hold grid, hold eraser to clear, default colours, remembered brush (also in PUBLISH Draw). |
| 0.20.0 | 2026-10-02 | PUBLISH: compact Style bar, pinch / twist gestures, slimmer action bar. |
| 0.19.0 | 2026-10-02 | Drawing controls (PUBLISH Draw, SKETCH): instant Done, no flicker, one-tap eraser, opacity strip, recent colours, eyedropper. |
| 0.18.0 | 2026-10-02 | PUBLISH: old posts converted on Edit; compact layout; Undo; notepad. |
| 0.17.0 | 2026-10-02 | PUBLISH publishes to WordPress; secure storage plugin for the Application Password (ADR-0011). |
| 0.16.0 | 2026-10-01 | PUBLISH module (Phase 1: TILES) on its tile; fonts Roboto + Ms Madi bundled (ADR-0010). |
| 0.15.0 | 2026-10-01 | CUBE design rework (board, snap points, fill, image skin, 3D pop-up, bank paging). |
| 0.14.0 | 2026-10-01 | SKETCH module (Phase 1) on its tile; lazy-loaded; no new dependency (ADR-0009). |
| 0.13.0 | 2026-10-01 | CUBE module (Phase 1) on its tile; lazy-loaded; SQLite plugin added to the Android build (ADR-0008). |
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

| Version | Date | Phase | Requirements | Summary |
| :-- | :-- | :-- | :-- | :-- |
| 0.13.0 | 2026-10-01 | 1 — Studio | v1.1 | Cube / net studio, geometry engine, live 3D cube, question builder (Net → Cube, Cube → Net, five options, D01–D09 distractors), validation, permanent ids and versions, Question Bank, SQLite, autosave. Test / Analysis placeholders. |
| 0.15.0 | 2026-10-01 | 1 — Studio | v1.2 | Design rework from device testing: 4 × 4 board, faces move only with Net (drag bug fixed), soft snap points, S / M / L sizes, draw anywhere and trim, one Shape tool, Fill tool, image as a board skin, New, 3D pop-up, full-width question cards, bank details inline and 10 a page. |

### 5.4 SKETCH

| Version | Date | Phase | Requirements | Summary |
| :-- | :-- | :-- | :-- | :-- |
| 0.19.0 | 2026-10-02 | 1.1 | v1.2 | Controls stay put while drawing; one-tap eraser on the bar; opacity strip; five recent colours; eyedropper. |
| 0.14.0 | 2026-10-01 | 1 | v1.1 | WebGL2 tiled raster engine; eight brush presets with pressure / tilt / smoothing; layers with five blend modes; grids incl. 1-, 2-, 3-point perspective; reference images; rectangle / lasso selection with transform; tile-snapshot undo; autosaved projects, gallery, PNG save / share. |

### 5.5 PUBLISH

| Version | Date | Phase | Requirements | Summary |
| :-- | :-- | :-- | :-- | :-- |
| 0.20.0 | 2026-10-02 | 2.3 — Style bar | v1.4 | Style as chips + one control over the tile (tile lifts to keep the element in view, bar fades while adjusting); developer's value set; pinch / twist on text and spirals; spiral centre knob; half-height action bar. |
| 0.19.0 | 2026-10-02 | 2.2 — Draw | v1.3 | Draw on SKETCH's layout: one floating bar (colour, brush, eraser, grid, undo, redo), brush sheet with names, opacity strip, five recent colours, palette with eyedropper, show tile, ‹ = done; instant Done (background PNG write); no flicker. |
| 0.18.0 | 2026-10-02 | 2.1 — Old posts, usability | v1.2 | WP Studio posts converted faithfully on Edit (fit into 9:16 on the background colour, rows of 1–2, exact trims, live text, decorations as one drawing); ordinary posts as a story (cover, picture + caption tiles, reading tiles); red / yellow dots; compact Publish tab (name + Publish on top, categories + help at the bottom); posts and pictures browsed and searched across the whole site; Undo for delete / discard / moves; denser Tiles; edge-to-edge editor, FP star, colour picker, notepad. |
| 0.17.0 | 2026-10-02 | 2 — WordPress | v1.1 | Drafts in Tiles; Publish tab (name, categories, half / full row layout by hold-and-drag); publish with pictures found by a permanent in-file id or uploaded under names fixed at first publish; post meta `_creative_post` rendered by the studioview theme 0.9.0; Posts (latest 25, edit and republish with conflict check, old posts as red-dot tiles, search, pictures from WordPress); Settings with the Application Password in the Keystore; featured picture per tile. |
| 0.16.0 | 2026-10-01 | 1 — Tiles | v1.0 | 9:16 tiles with pictures (media library: canonical names, dedup, trim, resize), live text (Roboto / Ms Madi), spiral text, drawings with SKETCH's brushes; soft snapping with guides, align, layers, undo, autosave. PUBLISH / WP / SETTINGS tabs as "coming next". Successor of the WP Studio app (not migrated). |

## 6. Shared functions (planned, CR-C*)

To be specified before they are built; `PARKED` until then.

| Id | Function | Notes |
| :-- | :-- | :-- |
| CR-C1 | Settings | Split into app-wide (theme, handedness) and per-module sections. |
| CR-C2 | Library | Every module's saved work in one place (thumbnails, search, open in its module). |
| CR-C3 | Storage and backup | One backup / restore covering all modules (PERSPECTIVE's IndexedDB and CUBE's SQLite). |
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
| CR-OD-1 | How CUBE joins CREATIVE | **Decided (2026-10-01):** an in-app module on the existing web stack — React, TypeScript, Konva, Three.js, SQLite via Capacitor (CUBE spec §3, §5; ADR-0008). React Native, Skia and Filament are not used. |
| CR-OD-2 | Where CUBE's code lives | **Decided:** `src/modules/cube/`, same build and release as the app. |
| CR-OD-4 | How WP Studio joins CREATIVE | **Decided (2026-10-01):** rebuilt in full as the PUBLISH module on the web stack (ADR-0010); old canvas and local data not migrated; the `studioview` theme stays in the `wp_studio` repository and keeps serving existing posts. |
| CR-OD-3 | SKETCH's stack (Flutter + Impeller was floated) | **Decided (2026-10-01):** an in-app module on the web stack with a custom WebGL2 raster engine, as the SKETCH specification §3 requires (ADR-0009); code in `src/modules/sketch/`. |
| CR-OD-5 | How OBJECTS joins CREATIVE | **Decided (2026-10-03):** an in-app module on the existing web stack in `src/modules/objects/` (OBJECTS spec §4–§7); Phase 1a needs no new dependency (ADR-0012); the Phase 1c boolean library gets its own ADR. |

## 9. Change management

- Behaviour changes update this document (app) or the module's requirements
  in the same commit; each release adds its rows to §5.
- New module: registry entry + art, `docs/modules/<id>/REQUIREMENTS.md`,
  rows in §4 and §5, an ADR for its stack / dependencies, and the §7 items.
