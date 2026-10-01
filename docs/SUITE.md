# Creative Suite — main app document

> **Suite version:** 0.11.0 · **Document version:** 1.0 (2026-10-01) · Owner: sole developer/user · Location: `docs/SUITE.md`

This is the umbrella document for the app: the home screen, how modules plug
in, the version history of every module, and the functions modules will
share. Each module keeps its own requirements document. **Perspective
Studio**, the first module, is specified in `docs/REQUIREMENTS.md`.

**Revisions:** 1.0 (0.11.0, 2026-10-01) — the suite created: home screen, module registry, Perspective Studio as the first module (ADR-0007).

---

## 1. Product

One Android app (Capacitor, delivered by Obtainium; app id
`com.perspectivestudio.app` and the signing key are unchanged, so installed
copies keep updating). It opens on the suite home screen. Each tile opens a
**module**: a self-contained tool with its own requirements, data and
version. Modules are added one at a time as independent plugins.

Tagline: *Ideas to creation — Sketch · Explore · Analyze · Publish.*

## 2. Home screen (SU-01)

Built from the developer's mockup (`docs/brand/suite-home-mockup.png`).

- Header: "CREATIVE SUITE" eyebrow, title "Ideas to creation", tagline
  "SKETCH · EXPLORE · ANALYZE · PUBLISH"; ⋮ menu (Settings, version).
- A 3 × 3 grid of module tiles, each an illustration with its name:
  Studio · Cube · **Perspective** · Publish · Sketch · Sequence ·
  Sensitivity · Toolbox · More.
- **Perspective** opens the Perspective Studio module (its scene gallery).
  Every other tile shows "<Module> — coming soon." until its module ships.
- Bottom navigation: **Home** (this screen) · **Library** (coming soon,
  SU-C2) · **Settings** (the shared settings screen).
- Android back: editor → gallery → home → leaves the app. A module's first
  screen has a back arrow to Home.
- Light and dark themes; tiles keep their light illustration in dark mode.

## 3. Modules as plugins (SU-02, ADR-0007)

- **Registry:** `src/suite/modules.ts` lists one `SuiteModule` per tile:
  `id`, `title`, tile `art`, `version` (null until it ships) and `entry`
  (the screen it opens; null = coming soon). Adding a module = its code +
  one registry entry + its art; the home screen does not change.
- **Isolation:** a module owns its code, its stored data (its own IndexedDB
  database / store names) and its requirements document. Modules do not
  import each other; anything two modules need goes to the shared functions
  (§6) first.
- **Layout:** the suite shell lives in `src/suite/` (lint element `suite`:
  it may use only `state`, `platform`, `theme`). Perspective Studio's code
  is the existing `src/{core,state,tools,render,export,ui,platform,theme}`
  tree; new modules go under `src/modules/<id>/` with their own
  `docs/modules/<id>/REQUIREMENTS.md`.
- **One release train:** all modules ship in the same APK. A module that
  is not ready stays `entry: null` (coming soon).

## 4. Module list

| Module | Id | Status | Module version | Requirements |
| :-- | :-- | :-- | :-- | :-- |
| Studio | `studio` | coming soon | — | — |
| Cube | `cube` | coming soon | — | — |
| **Perspective** | `perspective` | **live** | **0.11.0** | `docs/REQUIREMENTS.md` (v1.8) |
| Publish | `publish` | coming soon | — | — |
| Sketch | `sketch` | coming soon | — | — |
| Sequence | `sequence` | coming soon | — | — |
| Sensitivity | `sensitivity` | coming soon | — | — |
| Toolbox | `toolbox` | coming soon | — | — |
| More | `more` | placeholder for future modules | — | — |

## 5. Versioning and history

- **Suite (app) version** = `package.json` `version`; CI publishes
  `v<version>-build.<run>`; the Android `versionCode` is the CI run number
  (always increasing). Every push to `main` is a release.
- **Module version**: the suite version of the release in which the module
  last changed, recorded in the registry and the tables below. A module's
  requirements document carries its own document version.
- Every release adds a row to the suite history and to each module it
  touches; user-visible notes go in `docs/CHANGELOG.md`.

### 5.1 Suite history

| Suite | Date | Change |
| :-- | :-- | :-- |
| 0.11.0 | 2026-10-01 | Suite home screen, module registry, Library / Settings navigation; Perspective becomes the first module (ADR-0007). |

### 5.2 Perspective Studio history

| Version | Date | Milestone | Requirements | Summary |
| :-- | :-- | :-- | :-- | :-- |
| 0.1.0 | 2026-09-30 | — | 0.1 | Project created: skeleton, Capacitor Android, APK workflow. |
| 0.2.0 | 2026-09-30 | M0 | v1.1 | Foundation and device spike. |
| 0.3.0 | 2026-09-30 | M1 | v1.2 | Perspective core (solver, validity, property tests). |
| 0.4.0 | 2026-09-30 | M2 | v1.3 | Canvas and perspective setup. |
| 0.8.0 | 2026-09-30 | M3–M6 | v1.4 | Boxes, documents, scenes, layers, sketch. |
| 0.9.0 | 2026-09-30 | M8 | v1.6 | Horizon = eye level, Shapes, placement above the horizon, plan view, quick zoom. |
| 0.10.0 | 2026-10-01 | M9 | v1.7 | The eye is stored (ADR-0006), View turn / tilt, VP hints, clean-up. |
| 0.11.0 | 2026-10-01 | — | v1.8 | Opens from the suite home; back arrow to Home. |

### 5.3 Other modules

None released yet.

## 6. Shared functions (planned, SU-C*)

To be specified before they are built; until then each is `PARKED`.

| Id | Function | Notes |
| :-- | :-- | :-- |
| SU-C1 | Settings | Today the Perspective settings screen doubles as the suite's; split into suite-wide (theme, handedness) and per-module sections. |
| SU-C2 | Library | One place for every module's saved work (thumbnails, search, open in its module). |
| SU-C3 | Storage and backup | One backup / restore covering all modules' data. |
| SU-C4 | Export and share | Shared PNG / SVG / JSON / share-sheet helpers. |
| SU-C5 | Theme and design tokens | One stylesheet / token set for every module. |
| SU-C6 | About and updates | Version, per-module versions, release notes. |
| SU-C7 | Cross-module hand-off | e.g. a Perspective scene as the background of a Sketch. |

## 7. Change management

- Behaviour changes update this document (suite) or the module's
  requirements document in the same commit.
- New module: add its registry entry, art, `docs/modules/<id>/REQUIREMENTS.md`,
  a row in §4 and §5, and an ADR if it brings a new dependency.
