# Changelog

User-visible changes per release. Versions: `package.json` semver; each
milestone release bumps the minor version, and CI appends `-build.<run>`.

## 0.13.0 — CUBE (Phase 1)

- **CUBE is open**: tap Cube on the home screen.
- **Design a cube**: pick a net (cross, offset cross, zig-zag, long strip, or
  drag faces into your own), colour faces, draw (pen, line, arrow, rectangle,
  ellipse, polygon), add text, stamps and gallery images. Anything drawn
  across a fold becomes one continuous pattern. The app tells you at once
  whether the net folds into a cube.
- **Live 3D cube** next to the net: turn it, zoom, standard views; tap a face
  in either view to select it in both.
- **Build questions**: Net → Cube or Cube → Net, five options with one correct
  answer and four deliberate distractors (opposite faces touching, wrong
  corner, turned or mirrored face, impossible net, broken pattern …). Edit
  anything, set difficulty on eight skills, check the explanation; the app
  refuses ambiguous questions.
- **Question Bank**: commit gives a permanent id (CUBE-Q-000001); edits become
  new versions; search, filter, preview, duplicate, make a variant, export PNG
  or JSON.
- Work is saved automatically; everything works offline. Test and Analysis
  are placeholders for later phases.

## 0.12.0 — CREATIVE

- The app is now called **CREATIVE** (name under the icon and on the home
  screen); the perspective tool is the **PERSPECTIVE** module.
- Preparation for **CUBE**, the next module (requirements in progress).

## 0.11.0 — Creative Suite home

- The app now opens on the **Creative Suite** home screen — "Ideas to
  creation" — with tiles for Studio, Cube, Perspective, Publish, Sketch,
  Sequence, Sensitivity, Toolbox and More.
- **Perspective** opens Perspective Studio (your scenes, as before); the
  other tiles say "coming soon" until they are built.
- Bottom bar: Home · Library (coming soon) · Settings.
- The scene gallery has a back arrow to Home; Android back goes editor →
  gallery → home.

## 0.10.0 — M9: the eye and the View

- **View** (rotate icon in the top bar): two sliders walk your eye around the
  selected object (or the ground point). **Turn** goes from the left face
  square on, through the corner view, to the right face square on; **Tilt**
  goes from level to straight down (Top). Tap L · ¾ · R or Level · 45° · Top
  to jump. It is a preview: **Apply** keeps it (one undo step), **Revert**
  goes back. Sketch strokes stay on the paper.
- **Exact 1-point and top views:** a face-on or straight-down view draws its
  parallel lines exactly (that vanishing point is at infinity, so it has no
  handle there).
- **Your scenes are converted** on first open; they look the same.
- **Less clutter:** the VP capsules are now small arrows with a tiny label at
  the screen edge; no more fans of VP lines — only the edges of the selected
  object point to their VPs; the ground-point axes are thin lines.
- **Sketch options fit the screen** (they wrap into rows), with four tappable
  brush sizes.

## 0.9.0 — M8: scene & viewing revision

- **The horizon is your eye level.** Dragging it raises or lowers the eye —
  boxes keep their size and the horizon slides along tall objects. Eye height
  in the Scene panel does the same. New scenes use a standing eye (1.6 u).
- **Objects above the horizon:** place a ceiling (Shapes → Ceiling) and hang
  boxes under it; set a working plane to place things in the air; you can only
  place on surfaces you can actually see.
- **Shapes** button with a menu (Box, floor rect, walls, ceiling, working plane).
- **Quick zoom** in the top bar: fit page, fit page + all vanishing points.
- **Plan view** (map icon): a top-down map with your eye, what it sees, and
  the objects; tap to select.
- **Ground point** shows three coloured axes pointing at the vanishing points;
  a 1 u floor grid; optional cone of vision; live eye-height / distance readout.
- **Less clutter:** the sketch palette folds into a chip; bars hide while you
  draw; the inspector no longer covers tool bars.
- Lift handle has its own arrow shape; Multi-select for touch; cube lock grows
  from the base; optional scale lock and pin while moving vanishing points;
  2-point centre-of-vision handle.

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
