# Changelog

User-visible changes per release. Versions: `package.json` semver; each
milestone release bumps the minor version, and CI appends `-build.<run>`.

## 0.8.0 — M3–M6: boxes, documents, scenes, sketch

- **Gallery:** your scenes with thumbnails; new 3-point / 2-point scene;
  rename, duplicate, export, delete; import JSON; back up everything to the
  Documents folder. Scenes save themselves (every second, and when the app
  goes to the background).
- **Boxes:** tap the ground (or a box top) to place cubes; drag to move (grid
  and neighbour snapping, stacking), coloured handles to resize along each
  vanishing direction, a lift handle, cube lock, duplicate, delete, long-press
  menu. Hidden edges and construction rays in Construction mode.
- **Rectangles** on the ground and on left / right walls.
- **Layers** panel: add, rename, reorder, hide, lock, opacity, item list.
- **Undo / redo** for everything (buttons, two-finger tap / three-finger tap).
- **Display** presets Construction / Clean / Guides plus fine toggles.
- **Export** PNG (1×, 2×, 4×), SVG and JSON through the share sheet.
- **Sketch:** pencil, pen, marker, colours, width, eraser; perspective snapping
  Soft (straightens near-VP lines) and Locked (L, R, V or nearest).
- **Settings:** light / dark theme, grid snap, toolbar position.
- New launcher icon.

## 0.4.0 — M2 Canvas & perspective setup

- The app opens on the editor: paper, horizon, anchor and a test cube, with
  two-finger pan and pinch zoom, Fit paper and Fit all.
- Perspective tool: drag VP-L, VP-R, VP-V, the horizon and the anchor; the
  cube re-projects live. Impossible placements are shaded and the handle stops
  at the edge, with a vibration tick.
- Off-screen vanishing points show as coloured chips: tap to go there, drag to
  move the VP.
- 2-point / 3-point switch and a perspective lock.
- The M0 device-check screen is gone.

## 0.3.0 — M1 Perspective core

- No visible change (the app still opens on the M0 device check). Under the
  hood: the exact perspective solver the editor will be built on, with its
  property tests.

## 0.2.0 — M0 Foundation & risk spike

- The app opens on an "M0 device check" screen: a rendering test (300 lines,
  pan and re-project) and a pen-input test, with a "Copy results" button.
- Foundation: folder layout, lint-enforced module rules, docs, ADRs.

## 0.1.0 — Project created

- Signed APK delivered through GitHub Releases and Obtainium; a first canvas
  with a draggable horizon and three vanishing points.
