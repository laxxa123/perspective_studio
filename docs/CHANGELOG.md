# Changelog

User-visible changes per release. Versions: `package.json` semver; each
milestone release bumps the minor version, and CI appends `-build.<run>`.

## 0.26.0 — Short question ids; holes in OBJECTS

- **Question ids** are now short and the same in every module: CUBE-Q-1,
  OBJECTS-Q-12; a version shows as **CUBE-Q-1.1** (question 1, version 1).
  Older ids (CUBE-Q-000001) show the same way.
- **OBJECTS · Hole tool** (drill icon): tap a face and a hole goes straight
  through every block in that line; tap again to fill it. Blocks added
  later are not drilled. Holes show in the drawings, views and cuts, turn
  with the object, and count in every question ("the hole missing" and
  "the hole in another direction" are new wrong answers).
- **OBJECTS · 2D** grids and fold sheets: 4 × 4 or 6 × 6.

## 0.25.0 — Notes everywhere

- **Notes** button on the home screen and in every module (PERSPECTIVE,
  CUBE, SKETCH, PUBLISH, OBJECTS): one note that follows you, saved as you
  type. Copy, Clear (with Undo), **Save** — up to three saved notes ① ② ③,
  newest first; a fourth drops the oldest. Tap a number to open that note,
  hold to remove it. PUBLISH's tile notepad is now this note (Place still
  puts text on the tile).

## 0.24.0 — OBJECTS: questions from blocks and 2D figures

- **Build** a block object (with a marked block for tracking) or a 2D
  figure (squares, dots, arrows); undo / redo; your work is saved as you go.
- **Question**: pick what to test — 3D: same object, turn, view, from
  views, count, cut, track, pieces; 2D: turn, mirror, same figure, two
  steps, fold & punch. Five options appear at once: the correct one is
  worked out exactly, the wrong ones are typical mistakes (mirror image,
  wrong turn, wrong side, a block moved …), each labelled. Reorder,
  replace or edit any option, change the wording and difficulty; the
  check says "✓ Ready to commit" or what needs attention.
- **Question Bank**: permanent ids (OBJECTS-Q-000001 …), every edit a new
  version, search and filters, preview (student / author), duplicate,
  variant, export as PNG, SVG or JSON.
- Every figure is an isometric line drawing (or a grid), the same in the
  Studio, the Bank and exports.

## 0.23.0 — OBJECTS (first look)

- **New module OBJECTS** on the home screen, for making visualisation and
  spatial-reasoning questions. This first step: build an object from
  blocks in a 3D view (tap to add, eraser to remove, turn about X / Y / Z,
  undo, fit, clear) and see it as the isometric line drawing that
  questions will use, at three sizes. One finger turns the view, two pan
  and zoom.

## 0.22.0 — New icon; CUBE fits the phone

- **New app icon:** a 2 × 2 × 2 cube with one blue side.
- **CUBE Design:** the board area is now just the board (no empty band
  below it); "Valid cube net" and Fit sit under the board; the properties
  ("Start from …") move up and keep clear of the phone's navigation
  buttons.

## 0.21.0 — SKETCH: cube grid, soft snap, quicker controls

- **Cube grid:** an unfolded cube (faces A–F) on a 4 × 4 square, with a dot
  grid on every face. Tap the grid button to show / hide it; hold it for
  the other grids and options.
- **Soft snap** (Snap in the brush panel): a line that starts or ends near
  a dot starts or ends exactly on it, with a light tick. Also along the
  3 × 3 grid's lines.
- **Hold the eraser** to clear the sheet (one Undo brings it back) — in
  SKETCH and in PUBLISH Draw.
- **Tap "Colour"** in the brush panel for the default colours: black,
  white, light grey, red.
- **Your brush is remembered** between sessions (with its size, opacity,
  colour and colours); the brush button shows it.

## 0.20.0 — PUBLISH: a compact Style bar and gestures

- **Style no longer covers the tile:** one row of small chips (Font, Weight,
  Size, Colour, Coils, Centre, Turn, Spacing, Opacity, Align, Order — only
  those that apply) and one control above it. While you adjust, the bar
  fades so you see the result; the tile moves up so the element stays in
  view.
- **Simple values:** Roboto or Ms Madi; weights 100 / 500 / 900; text sizes
  50–300 in five steps; spiral size 25–100 snapping to 5; coils 1–5; centre
  50–100 %; turn 0–360°; spacing −5 to 20; opacity 5–100 %; five recent
  colours plus a picker.
- **Gestures:** pinch a selected text or spiral to resize, twist to turn;
  drag a spiral's centre knob to change its centre size.
- **Slimmer action bar** (Edit · Style · Duplicate · Delete), icon and label
  side by side.

## 0.19.0 — Drawing: faster, calmer, clearer

- **Done is instant** when you finish drawing on a tile (it used to take
  seconds while the picture was saved; now it is saved in the background).
- **No more flicker:** the toolbars stay put while you draw (PUBLISH and
  SKETCH).
- **PUBLISH Draw looks like SKETCH:** the tile fills the screen; ‹ keeps your
  drawing (⋯ has Show tile, Clear and Discard, each undoable); one floating
  bar with colour, brush, eraser, grid, undo and redo.
- **One-tap eraser** (PUBLISH and SKETCH): tap to erase, tap again for your
  last brush; it remembers its own size.
- **Brush sheet:** brush names; opacity as a strip of tinted cells (no more
  mixing it up with sizes or colours); your five recent colours and + for
  more.
- **Eyedropper:** pick any colour from the tile / canvas with a loupe.
- Your drawing settings are remembered.

## 0.18.0 — PUBLISH: old posts, compact layout, notepad

- **Old posts convert when you edit them** — no separate migration. WP Studio
  posts (yellow dot) keep their layout: every tile becomes 9:16 with the old
  tile fitted inside on its background colour, rows of one or two tiles,
  pictures with their crop, text still editable; decorations become one
  drawing. Ordinary WordPress posts (red dot) come in as a story: a cover,
  each picture with its caption, then the text. Publishing makes them normal
  posts.
- **Publish tab:** the post name and a small Publish button at the top, the
  layout in the middle, categories as small chips at the bottom, and a ? for
  help. Moves can be undone.
- **Posts:** tap a post to edit it; scroll on through every post on the site;
  search covers them all. Same for pictures.
- **Undo** instead of "tap twice": deleting a tile, discarding an edit,
  moving tiles. All messages appear in one bar at the bottom.
- **Tiles:** smaller thumbnails, so more fit on screen.
- **Editor:** the tile uses the full width; FP star for the featured picture
  (Style → Order row); a proper colour picker for the background (square,
  hue, hex, recent colours); a tiny notepad for quick notes, saved as you
  type.
- Slimmer title and tab bars.

## 0.17.0 — PUBLISH to WordPress

- **Publish tab:** name the post, pick or add categories, and arrange the
  tiles: hold a tile and drag it — to a side for half width, to the middle
  for full width, between rows for a new row. Publish sends it to WordPress
  and clears the tiles for the next post.
- **Posts tab:** your latest 25 posts. Edit brings one back into Tiles and
  Publish to change and republish (with a warning if it was changed on the
  site meanwhile). Old WP Studio and ordinary posts open as tiles marked
  with a red dot, ready to rearrange. Search WordPress for any post or
  picture; download pictures into Media.
- **Drafts:** hold a tile and drag it below the line to keep it aside; drafts
  are never published.
- **Featured picture:** pick a tile's cover in Style; otherwise the first
  photo is used.
- **Pictures keep one identity:** a permanent id inside the file means a
  picture is stored and uploaded once; its name is set from the post when
  first published and never changes after. Phone file names are never used.
- **Settings:** your site, user name and Application Password (stored
  encrypted on the phone); Save and test.
- Needs the studioview theme 0.9.0 on the site (it updates itself).

## 0.16.0 — PUBLISH (Phase 1: Tiles)

- **PUBLISH is open** on the home screen — the WP Studio app, rebuilt inside
  CREATIVE. Tabs: Tiles · Publish · WP · Settings (the last three are coming
  next).
- **Tiles:** tap + for a 9:16 tile. Add pictures, text, spirals and drawings;
  everything saves itself.
- **Media library:** photos from the phone are cleaned (no location or
  camera data), kept once even if imported twice, and get a stable canonical
  name ready for WordPress. Trim with presets (1:1, 4:5, 9:16 …); resize and
  turn with large handles — pictures are never stretched.
- **Text** in Roboto (thin to black) or Ms Madi, written in a calm
  full-screen writer; **spiral** text along a coil.
- **Draw** on a tile with SKETCH's brushes, pressure and gestures.
- **Soft snapping** to the centre, the margins and other elements, with
  guide lines; align to the margins in one tap; layers, lock, undo / redo.

## 0.15.0 — CUBE design rework

- **Faces stay put**: dragging or resizing artwork no longer moves faces; faces
  move only with the Net tool.
- The net sits on a **4 × 4 board** that is always shown; **Fit** fits it.
- **New** starts a blank cube (Undo brings the previous one back).
- **Soft snap points** on every face: shapes, stamps and text land on them, so
  sizes and positions repeat; stamps and text come in S / M / L.
- **Draw anywhere** on the board with Pen or Shape; whatever falls outside the
  faces is trimmed away. The five shape tools are now one **Shape** tool.
- **Fill** tool: colour faces with one tap (four colours; white clears).
- **Pictures** first cover the whole board; move, scale and turn them, then
  Done trims them to the faces.
- **3D** opens as a pop-up from the tool bar; the Question step uses the full
  screen for its cards.
- **Question Bank**: details open right under the question; 10 questions a page.

## 0.14.0 — SKETCH (Phase 1)

- **SKETCH is open**: tap Sketch on the home screen and draw at once on a 9:16
  page (the last sketch reopens; the arrow leads to the gallery).
- **Eight brushes**: Pencil, Pen, Marker, Brush, Soft Brush, Airbrush, Blender
  (smudge) and Eraser, with stylus pressure and tilt, smoothing and textures.
  Five quick sizes and opacities; colour swatches, a picker and recent colours.
  Every brush can be fine-tuned in Settings.
- **Gestures**: two fingers pan and zoom, two-finger tap undoes, three-finger
  tap redoes; the controls fade while you draw.
- **Layers** (up to 12): opacity, visibility, lock, drag to reorder, rename,
  duplicate, clear, delete; Normal, Multiply, Screen, Overlay and Erase.
- **Grids**: 3 × 3 and 1-, 2-, 3-point perspective with draggable vanishing
  points; **reference images** under the drawing.
- **Selection**: rectangle or lasso; paint inside it, move, scale, rotate,
  duplicate or delete what is selected.
- **Undo / redo** for strokes, layer changes, transforms and selections.
- Sketches **save themselves**; the gallery lists them newest first with
  rename, duplicate, Share PNG and delete. **Save / share a PNG** at full
  1080 × 1920 (optionally transparent).

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
