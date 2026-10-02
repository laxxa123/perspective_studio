> **Document:** SKETCH requirements · **Version:** v1.2 (0.19.0, 2026-10-02) · **Location:** `docs/modules/sketch/REQUIREMENTS.md` · **Part of:** CREATIVE (`docs/CREATIVE.md`)
>
> **Revisions:** v1.2 (0.19.0, 2026-10-02) — Controls no longer fade while drawing; one-tap eraser on the bar; opacity strip; five recent colours in the brush panel; eyedropper (§31). · v1.1 (0.14.0, 2026-10-01) — Phase 1 built; §30 records what was built and the choices made where this specification leaves room. · v1.0 (2026-10-01) — Final Product & Engineering Requirement, as written by the developer (§1–§29 below, unchanged).

# SKETCH — Final Product & Engineering Requirement

## 1. Product Intent

**SKETCH** is a freeform mobile drawing and visual-thinking tool inside the existing **CREATIVE** application.

> **Brutally simple to use. Serious underneath.**

The user should open SKETCH and immediately draw without navigating complex menus. The canvas is the product; UI must remain minimal, contextual and non-intrusive.

SKETCH is **not** intended to become a miniature Photoshop/Procreate clone.

---

## 2. Core Expectations

Priority order:

1. **Excellent brush/stroke quality**
2. **Low drawing latency**
3. **Smooth zoom and pan**
4. **Minimal, modern UX**
5. **Reliable editable projects**
6. **Fast PNG export/share**

The drawing experience must feel natural on Android touchscreens and stylus-capable devices.

A feature should only exist if it improves drawing, visual thinking or workflow efficiency.

---

## 3. Technology Stack

SKETCH remains a module inside the existing React-based CREATIVE application.

- **React** — UI and module orchestration.
- **TypeScript** — application, document and engine contracts.
- **Custom WebGL2 raster engine** — primary painting/rendering engine.
- **Tiled GPU textures** — artwork and layers.
- **Pointer Events** — touch/stylus input, pressure and tilt where supported.
- **IndexedDB/storage abstraction** — local editable-project persistence.

### Fundamental rule

> **React owns the application and UI. The WebGL2 raster engine owns the artwork and high-frequency drawing operations.**

Never route individual pointer movements through React state.

Do not use Konva as the painting engine. Do not use HTML Canvas 2D for high-frequency painting.

---

## 4. Canvas

- Portrait only.
- **9:16 aspect ratio.**
- Full mobile-screen experience.
- One finger → draw.
- Two fingers → pan.
- Pinch → zoom.
- Quick fit-to-canvas action.
- Optional 100% view.

Pan and zoom are gestures, not permanent toolbar tools.

The canvas must remain visually dominant.

---

## 5. Minimalist UX

The default interface should contain only essential controls.

Conceptually:

```text
┌─────────────────────────┐
│                         │
│                         │
│                         │
│         CANVAS          │
│                         │
│                         │
│                         │
│   ●   ✎   ▦   ≡   ↶   │
└─────────────────────────┘
```

Possible primary controls:

- Color
- Brush/tool
- Grid
- Layers
- Undo

Controls should be floating/contextual rather than permanently occupying the canvas.

### Full-screen drawing mode

When drawing starts:

- UI fades/minimizes.
- Canvas becomes effectively unobstructed.
- Controls return with a light tap or equivalent gesture.

The application should feel like a sheet of paper rather than a conventional graphics editor.

---

## 6. Drawing Tools

Phase 1:

- Pen
- Brush
- Eraser
- Blender
- Airbrush

Treat these as brush-engine configurations/presets rather than unrelated hard-coded tools.

---

## 7. Brush Engine — Critical Requirement

**Brush quality is the highest technical priority.**

The engine must support:

- Continuous smooth strokes.
- High-frequency pointer sampling.
- Interpolation between input points.
- Stroke smoothing.
- GPU brush stamping.
- Variable size.
- Variable opacity.
- Pressure response.
- Tilt response where available.
- Velocity-aware dynamics where appropriate.
- Brush spacing.
- Hardness/softness.
- Flow.
- Texture capability.
- Rotation/orientation capability for future brushes.

Pipeline:

```text
Pointer Events
      ↓
Input Buffer
      ↓
Stroke Sampling / Interpolation
      ↓
Brush Dynamics
      ↓
Brush Stamp Generator
      ↓
GPU Tile Rendering
      ↓
Layer
      ↓
GPU Compositor
      ↓
Screen
```

### Performance target

- Sustained 60 FPS minimum.
- 120 Hz responsiveness where device/display supports it.
- Low perceived input-to-render latency.
- No visible stutter during normal drawing, zooming or panning.

---

## 8. Brush Controls

### Quick controls

- Size — 5 levels.
- Opacity — 5 levels.
- Color.

Internally, the engine may use continuous values.

### Advanced Brush Settings

Available through Settings / Brush Editor:

- Size
- Opacity
- Flow
- Hardness
- Spacing
- Smoothing
- Pressure → size
- Pressure → opacity
- Velocity response
- Tilt response
- Brush texture
- Brush rotation

Advanced controls must never clutter the drawing surface.

---

## 9. Brush Presets

Presets are a first-class concept.

Initial presets:

- Pencil
- Pen
- Marker
- Brush
- Soft Brush
- Airbrush
- Blender
- Eraser

Presets must be data-driven and editable.

Conceptual model:

```ts
BrushPreset {
  id
  name
  engine
  size
  opacity
  flow
  hardness
  spacing
  smoothing
  pressureSize
  pressureOpacity
  texture
  blendMode
}
```

---

## 10. Layers

Each layer supports:

- Create
- Select
- Visibility ON/OFF
- Opacity
- Lock/unlock
- Reorder
- Duplicate
- Rename
- Delete

Prefer direct drag-and-drop reordering.

### Layer architecture

Layers should be tiled surfaces:

```text
Layer
 ├── Tile
 ├── Tile
 ├── Tile
 └── ...
```

Only affected/visible/required tiles should be processed.

---

## 11. Layer UI

Compact layer panel:

```text
LAYERS

👁  Layer 3
👁  Layer 2
👁  Layer 1
     + Layer
```

- Tap → select.
- Drag → reorder.
- Long press/contextual action → rename, duplicate, delete, lock.

Layer properties:

- Visibility
- Opacity
- Lock

Avoid a desktop-style inspector.

---

## 12. Blend Modes

Phase 1:

- Normal
- Multiply
- Screen
- Overlay
- Erase

Use GPU compositing.

Additional blend modes can be added later without changing the document model.

---

## 13. Grid / Guides

Grid is a first-class guide system, not artwork.

Available:

- None
- 3 × 3
- 1-point perspective
- 2-point perspective
- 3-point perspective

Properties:

- Visible/hidden
- Opacity
- Locked/free

Perspective grids should allow intuitive manipulation of:

- Horizon line
- Vanishing points
- Grid extent

Guides are not included in PNG output by default.

---

## 14. Reference Image

Support a simple reference-image layer:

- Import image
- Move
- Scale
- Opacity
- Lock
- Hide

Reference images remain separate from paint layers.

---

## 15. Selection

Lightweight selection system:

- Rectangle
- Lasso/freehand

Operations:

- Move
- Scale
- Rotate
- Duplicate
- Delete

Selection should generate a mask respected by the painting engine.

Do not build a full Photoshop-style selection ecosystem in Phase 1.

---

## 16. Undo / Redo

Mandatory.

Use **tile-level snapshots combined with command history**.

Example:

```text
Stroke #184
 ├── affected tiles
 ├── previous tile states
 └── operation metadata
```

Do not snapshot the entire 9:16 document for every stroke.

Undo architecture should support:

- Paint
- Erase
- Layer creation/deletion
- Layer ordering
- Layer opacity
- Layer visibility
- Transformations
- Selection operations

Undo must feel immediate.

---

## 17. Dirty Tile Rendering

Track affected tiles.

```text
Stroke
  ↓
Affected bounds
  ↓
Affected tiles
  ↓
Mark dirty
  ↓
Render only required tiles
```

Never redraw the entire document for every brush movement unless profiling proves it is faster and still meets performance targets.

---

## 18. Project Model

PNG is an **export format**, not the primary editable format.

The editable project preserves:

- Canvas
- Layers
- Layer order
- Layer opacity
- Visibility
- Locks
- Paint data
- Brush information where required
- Grid state
- Reference images
- Project metadata

Conceptually:

```text
SketchDocument
├── canvas
├── layers[]
├── guides
├── references[]
├── activeLayer
└── metadata
```

The project must reopen exactly as the user left it.

---

## 19. Save / Autosave

Support:

- New sketch
- Save project
- Autosave
- Reopen/edit
- Duplicate
- Rename
- Delete

Autosave should be invisible and automatic.

No unnecessary save-confirmation dialogs.

---

## 20. PNG Export

Export a flattened 9:16 PNG.

Requirements:

- Full-resolution output.
- Correct layer compositing.
- Correct opacity.
- Correct blend modes.
- No UI.
- No guides by default.
- No hidden layers.

Actions:

- Save PNG to device.
- Share PNG using Android sharing.

Export must not modify the editable project.

---

## 21. Project Gallery

Minimal gallery:

```text
SKETCH

+ NEW

┌──────┐ ┌──────┐ ┌──────┐
│ art  │ │ art  │ │ art  │
└──────┘ └──────┘ └──────┘
```

Actions:

- Open
- Rename
- Duplicate
- Delete
- Share PNG

Recently edited projects appear first.

---

## 22. Settings

Settings can be sophisticated while normal use remains simple.

### Drawing defaults

- Default brush
- Default size
- Default opacity
- Default color

### Brush

- Brush presets
- Advanced brush parameters
- Pressure response
- Smoothing

### Canvas

- Background
- Default zoom
- Grid default

### Gestures

- Undo gesture
- Redo gesture
- Pan/zoom behavior

### Export

- PNG resolution/quality where relevant
- Transparent background option if supported

Organize settings into short, understandable groups.

---

## 23. UX Rules

Always prefer:

- Direct manipulation.
- Contextual controls.
- Gestures.
- One-tap actions.
- Visual feedback.
- Persistent state.
- Predictable behavior.

Avoid:

- Nested menus.
- Desktop-style toolbars.
- Permanent inspector panels.
- Excessive icons.
- Dozens of visible brush controls.
- Routine confirmation dialogs.
- Features that interrupt drawing.

> **Simple to discover. Fast to operate. Deep only when requested.**

---

## 24. Performance Requirements

Performance is a product requirement.

### Drawing

- 60 FPS minimum target.
- Target 120 Hz responsiveness on capable devices.
- Low input-to-render latency.
- No visible stroke lag under normal conditions.

### Zoom / Pan

- GPU accelerated.
- No unnecessary document rasterization.

### Layers

- Add/reorder/hide should feel immediate.

### Undo

- Immediate for normal operations.

### Memory

- Tiled allocation.
- Avoid unnecessary full-document copies.
- Release unused GPU resources.
- Monitor texture memory.

### Export

Export may take longer for large documents, but UI must remain responsive.

---

## 25. Architecture Boundaries

Suggested structure, adapted to existing CREATIVE conventions:

```text
src/modules/sketch/

├── ui/
│   ├── SketchScreen
│   ├── ToolBar
│   ├── BrushPanel
│   ├── LayerPanel
│   ├── GridPanel
│   └── Settings
│
├── document/
│   ├── SketchDocument
│   ├── LayerModel
│   ├── GuideModel
│   └── ReferenceModel
│
├── engine/
│   ├── RasterEngine
│   ├── TileManager
│   ├── BrushEngine
│   ├── StrokeEngine
│   ├── Compositor
│   ├── SelectionEngine
│   └── UndoEngine
│
├── input/
│   ├── PointerInput
│   ├── GestureEngine
│   └── StylusInput
│
├── storage/
│   ├── ProjectStore
│   └── ExportService
│
└── presets/
    ├── BrushPresets
    └── GridPresets
```

Adapt to the existing CREATIVE architecture. Do not duplicate infrastructure unnecessarily.

---

## 26. Non-negotiable Engineering Rules

1. Do not use React state for per-pointer-movement painting.
2. Do not use Konva as the raster painting engine.
3. Do not use Canvas 2D for the primary brush renderer.
4. Do not flatten layers during normal editing.
5. Do not snapshot the entire document for every undo.
6. Do not redraw unchanged tiles unnecessarily.
7. Do not expose advanced controls permanently.
8. Do not sacrifice stroke quality for feature count.
9. Do not introduce another framework unless profiling proves it necessary.
10. Keep the paint engine independent from the UI.

---

## 27. Explicitly Out of Phase 1

Do not build:

- Text tool
- Complex vector shapes
- Animation/timeline
- Filters
- AI generation
- Cloud collaboration
- Brush marketplace
- Complex colour-management UI
- Dozens of blend modes
- Advanced masking
- Desktop-grade typography
- Infinite canvas
- Multiple aspect ratios

---

## 28. Definition of Done

A user can:

1. Open SKETCH and immediately draw.
2. Work on a 9:16 canvas.
3. Select a brush/preset.
4. Change size and opacity quickly.
5. Select/change color.
6. Draw smooth, responsive strokes.
7. Use pressure/tilt where hardware supports it.
8. Erase, blend and airbrush.
9. Create and manage layers.
10. Change layer opacity, visibility, order and lock.
11. Use 3×3 and perspective grids.
12. Zoom and pan smoothly.
13. Undo/redo reliably.
14. Import a reference image.
15. Make a selection and transform it.
16. Save and autosave an editable project.
17. Close and reopen without losing artwork.
18. Export a clean 9:16 PNG.
19. Share the PNG.
20. Use the application without needing to understand its advanced features.

---

## 29. Final Product Principle

> **SKETCH should look simple because the complexity is in the engine, not because the engine is simple.**

The ideal experience is:

**Open → Draw → Explore → Save → Share.**

No friction.  
No visual clutter.  
No unnecessary workflow.

The user should notice the **quality of the stroke**, not the technology behind it.

---

## 30. Phase 1 as built (v1.1, release 0.14.0)

This section records what was built and the choices made where §1–§29 leave
room. §1–§29 above are the developer's specification, unchanged.

### 30.1 Code layout (§25, adapted to CREATIVE)

```text
src/modules/sketch/
├── core/        pure TypeScript, unit-tested (lint element sketch-core: no React, DOM, GL, storage)
│   ├── types.ts      SketchDocument, LayerModel, GuideModel, ReferenceModel, BrushPreset, Dab, InputPoint
│   ├── document.ts   create / validate (zod) / layer-stack edits
│   ├── presets.ts    BrushPresets + GridPresets (data)
│   ├── stroke.ts     StrokeEngine: smoothing → interpolation → dynamics → spaced dabs
│   ├── geometry.ts   tiles, view (pan / zoom / pinch), guides, selection maths
│   └── history.ts    command history with a memory budget
├── engine/      WebGL2, no React (lint element sketch-engine)
│   ├── RasterEngine.ts   the facade the UI talks to; on-demand frame loop
│   ├── TileManager.ts    tile pool + per-layer sparse tile surfaces
│   ├── BrushEngine.ts    GPU dab stamping, stroke buffer, commit, airbrush, blender
│   ├── Compositor.ts     dirty-tile compositing, blend modes, screen pass, export
│   ├── SelectionEngine.ts, UndoEngine.ts, Renderer.ts, shaders.ts, gl.ts
├── input/PointerInput.ts  Pointer Events: coalesced samples, pressure, tilt, gestures (GestureEngine + StylusInput)
├── storage/     ProjectStore (IndexedDB), ExportService (PNG)
├── state/       zustand UI store, settings
└── ui/          SketchScreen, ToolBar, panels, Gallery, SettingsScreen
```

The engine never imports the UI; React never sees a pointer move (§3, §26.1).

### 30.2 Canvas, view and input (§4, §5, §24)

- The document is **1080 × 1920 px** (9:16), split into **256 px tiles** (5 × 8).
- Opening SKETCH resumes the most recent sketch (a new one when there is
  none), so drawing starts at once (§28.1); the gallery is the top-left arrow.
- One finger or the pen draws; two fingers pan and pinch-zoom in one gesture
  (0.1×–16×); **two-finger tap = undo**, **three-finger tap = redo**. A second
  finger within 150 ms of the first turns the just-started stroke into a
  gesture (the mark is withdrawn). Mouse wheel zooms (desktop).
- Fingers: by default a finger draws until a stylus is seen, then fingers only
  navigate (palm-friendly); Settings → Gestures can make fingers always draw or
  never draw.
- Pressure: the pen's pressure; fingers and mouse count as full pressure.
  Tilt / azimuth from `altitudeAngle` / `azimuthAngle` or `tiltX` / `tiltY`
  when the device reports them.
- Pan / zoom only redraws the composite as one textured quad (mipmapped when
  zoomed out, nearest-pixel above 2× device scale); nothing is re-rasterised.
- The floating controls stay put while a stroke is drawn (v1.2, §31: they
  used to fade and came back after every stroke, which flickered); drawing
  or tapping the canvas closes an open panel.

### 30.3 Brush engine (§6–§9)

- Pipeline as §7: coalesced pointer samples → exponential smoothing (preset
  `smoothing`) → quadratic curves through the midpoints → dabs at
  `spacing × size` along the arc (carried between events) → dynamics
  (pressure → size / opacity, speed → size, tilt → size / softness / angle /
  roundness) → **instanced GPU dabs** drawn into tiles.
- Dabs: elliptical (roundness, rotation, optional turn-with-stroke), hardness
  falloff, anti-aliased edge, procedural textures (grain, canvas, chalk).
- **Paint / airbrush / eraser** stamp coverage into a per-stroke **stroke
  buffer**; the compositor shows the active layer with the stroke merged live,
  and the stroke is committed into the layer when it ends. Overlapping dabs
  therefore never exceed the stroke opacity (preset opacity × quick opacity).
- **Airbrush** keeps spraying while the pen rests.
- **Blender** smudges the active layer: each dab pulls paint from the previous
  dab's place (sequential GPU smudge through a document-size work texture).
- Presets (data, editable in Settings → Brushes, reset per preset): Pencil,
  Pen, Marker, Brush, Soft Brush, Airbrush, Blender, Eraser. The brush panel
  offers the presets, **5 sizes** (0.35×–2.6× the preset size), **5
  opacities** (20–100 %), and the two selection tools.
- Colour: 12 quick swatches, a hue / saturation-value picker, the last 8
  colours.

### 30.4 Layers and blend modes (§10–§12)

- Up to **12 layers**, each a sparse set of tiles allocated on first paint.
- Panel: tap selects; the grip drags to reorder; the eye hides; long press or
  ⋯ opens rename, duplicate, lock / unlock, clear and delete; the active layer
  shows its opacity slider and blend mode. A locked or hidden layer refuses
  paint with a short notice.
- Blend modes Normal, Multiply, Screen, Overlay, Erase, composited on the GPU
  per tile: Normal / Screen / Erase with fixed-function premultiplied
  blending, Multiply / Overlay in a shader reading a copy of the backdrop
  tile. **Erase** as a layer mode cuts that layer's paint out of the layers
  below.

### 30.5 Grid / guides (§13)

- None, 3 × 3, 1-, 2- and 3-point perspective; visible / hidden, opacity,
  locked / free, **extent** (rays per vanishing point, 6–48), reset.
- Unlocked: drag the vanishing points on the canvas; points on the horizon
  move the horizon with them (it is their shared eye level); the third (vertical)
  point moves freely. Points start on the page so they can be grabbed; pinch
  out to drag them beyond it.
- Guide lines are drawn on screen only, clipped to the page; never exported.
  Guide changes are saved with the sketch but are not undo steps.

### 30.6 Reference images (§14)

- More → Reference image: import from the device (decoded, capped at 2048 px),
  move / scale / rotate on the canvas (one finger drags, two fingers scale and
  turn), opacity, lock, hide, remove. Shown **under** the artwork, kept as
  project assets, never exported.

### 30.7 Selection (§15)

- Rectangle and lasso (brush panel). A finished selection returns to drawing:
  brushes paint only inside the mask (anti-aliased).
- Contextual bar: **Transform** (lifts the pixels; one finger moves, two
  fingers scale and rotate; Done / Cancel), **Duplicate** (lifts a copy),
  **Delete**, **Deselect**. Operations apply to the active layer.
- While transforming, the floating pixels are previewed above all layers;
  the commit places them exactly into the active layer.

### 30.8 Undo / redo (§16, §17)

- One command history: tile snapshots (only the tiles a change touched, the
  "after" state captured on first undo) for paint, erase, blend, clear,
  transform and delete; before / after layer stacks for layer create /
  delete / order / opacity / visibility / lock / rename / blend; selection
  changes. A transform is one step (pixels + selection).
- Budget: **96 MB** of snapshot textures; the oldest steps are dropped beyond
  it. Deleted layers keep their tiles while an undo step can bring them back.
- Undo during a transform cancels the transform.
- Rendering is on demand and per dirty tile (§17); an idle canvas draws
  nothing.

### 30.9 Projects, autosave, gallery (§18, §19, §21)

- IndexedDB `creative-sketch`: `projects` (the SketchDocument JSON,
  `schema: creative.sketch.document.v1`, validated with zod on load), `tiles`
  (raw premultiplied RGBA per tile, deflate-compressed), `thumbs`, `assets`
  (reference images).
- Autosave about 1.2 s after a change, when the app goes to the background
  and when leaving the sketch; only changed tiles are written. No save
  dialogs.
- Gallery: newest first, thumbnails; New, open, rename (tap the name),
  duplicate, Share PNG (rendered without opening the sketch), delete (a second
  tap confirms — no dialog).

### 30.10 PNG export (§20)

- More → Save PNG (Android: `Documents/CREATIVE/<name>_<time>.png`) or Share
  PNG (share sheet). 1080 × 1920 (or half size), flattened with the layers'
  opacity and blend modes, background colour or transparent (setting), no UI,
  guides, references or hidden layers. Export never changes the project.

### 30.11 Settings (§22)

- Drawing defaults (brush, size, opacity, colour — applied when SKETCH starts),
  Brushes (the editor: size, opacity, flow, hardness, spacing, smoothing,
  pressure → size / opacity, speed, tilt, rotation, roundness, texture, turn
  with stroke, blender strength; reset per preset), Canvas (background for new
  sketches: white / paper / transparent; open at fit or 100 %; grid for new
  sketches), Gestures (two-finger undo, three-finger redo, finger drawing),
  Export (transparent background, full / half size), Reset. Stored on the
  device (localStorage).

### 30.12 Known limits

- Device frame rate and latency are verified on the phone (checklist
  `docs/modules/sketch/checklists/P1.md`); 120 Hz follows the WebView's frame
  rate.
- If Android drops the GPU context, SKETCH offers Reopen; changes since the
  last autosave (about a second) are lost.
- The blender smudges within the active layer only.
- Grid and reference changes are saved but not undoable.

### 30.13 Conflict review (v1.1)

| Topic | Resolution |
| :-- | :-- |
| §3 stack vs the earlier Flutter + Impeller idea | This specification's stack is used: React, TypeScript, custom WebGL2 engine, Pointer Events, IndexedDB (ADR-0009). No new runtime dependency. |
| §26.3 "no Canvas 2D for painting" | Canvas 2D is used only to rasterise a selection polygon into its mask and to encode PNG files; every brush mark is a GPU dab. |
| §25 folder names | `document/` and `presets/` live in the pure `core/`; `StrokeEngine` is `core/stroke.ts` (testable without a GPU); `GestureEngine` and `StylusInput` are one `input/PointerInput.ts`. |
| §4 two fingers pan, pinch zooms | One two-finger gesture does both. |
| §5 controls return "with a light tap" | They return by themselves when the stroke ends; a tap also closes panels. |
| §22 "PNG resolution / quality" | PNG is lossless: full or half size. |
| §28.1 "open SKETCH and immediately draw" | SKETCH opens on the latest sketch, or a new one. |

## 31. Drawing controls review (v1.2, release 0.19.0)

From device use and a consolidated usability review (shared with PUBLISH's
Draw, PUBLISH requirements §6.5):
- **No fading:** the bar and round buttons stay put while drawing; fading
  them for each stroke made them flicker. This supersedes "UI fades /
  minimizes" in §4 by the developer's decision.
- **Eraser on the bar:** colour · brush · **eraser** · grid · layers · undo ·
  redo. One tap erases, the next returns to the last brush; the eraser keeps
  its own size. The eraser is no longer in the brush panel.
- **Brush panel:** brushes with names; Size as round dots; **Opacity as a
  strip of five tinted cells** (never confused with sizes or colours);
  **Colour: the five most recent colours and +** (opens the colour panel);
  the selection tools and brush settings as before.
- **Eyedropper** in the colour panel: touch the canvas; a loupe shows the
  colour under the finger; letting go picks it.
- Choosing a colour leaves the eraser. One accent colour marks selection
  (no stray focus rings).

