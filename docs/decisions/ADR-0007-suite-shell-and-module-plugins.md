# ADR-0007 — The app is a suite; Perspective Studio is its first module

- **Status:** Accepted (0.11.0, 2026-10-01)
- **Requirements:** CREATIVE.md §2–§3 (CR-01, CR-02); modules/perspective/REQUIREMENTS.md §10.8 (v1.8)
- **Note (0.12.0):** the app is now named CREATIVE and this module PERSPECTIVE; docs/SUITE.md became docs/CREATIVE.md.

## Context

The developer wants one app, "Creative Suite — Ideas to creation", with a
home screen of tools: Studio, Cube, Perspective, Publish, Sketch, Sequence,
Sensitivity, Toolbox, More. Only Perspective exists. The others will be
built later, separately, as independent plugin modules.

## Decision

- The app opens on a suite home screen (`src/suite/SuiteHome.tsx`). Its
  tiles come from a registry (`src/suite/modules.ts`). Perspective opens the
  existing gallery; every other tile says "coming soon" until it has an
  entry point.
- The suite shell is a new lint element (`suite`) that may use only UI state,
  platform and theme; `app` may use it. Modules never import each other.
- Perspective Studio's code stays where it is (moving every file would be a
  large, risky diff for no behaviour change). New modules go under
  `src/modules/<id>/`.
- Same app id, signing key and release pipeline: one APK, one version
  number; each module's own version is recorded in `docs/CREATIVE.md`.
- `docs/CREATIVE.md` is the main app document: home screen, plugin contract,
  module list, per-module version history, shared functions.

## Consequences

- The Perspective gallery gains a back arrow to Home; Android back goes
  editor → gallery → home.
- No new dependency. Tile illustrations are cropped from the developer's
  mockup (`src/suite/art/`).
