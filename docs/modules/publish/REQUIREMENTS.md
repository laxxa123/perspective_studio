> **Document:** PUBLISH requirements · **Version:** v1.0 (0.16.0, 2026-10-01) · **Location:** `docs/modules/publish/REQUIREMENTS.md` · **Part of:** CREATIVE (`docs/CREATIVE.md`)
>
> **Revisions:** v1.0 (0.16.0, 2026-10-01) — PUBLISH set up as a new CREATIVE module (the successor of the separate WP Studio app); Phase 1 (TILES) built; PUBLISH, WP and SETTINGS tabs in place as "coming next".

# PUBLISH — tiles to WordPress

## 1. Intent (as asked by the developer, 2026-10-01)

PUBLISH is WP Studio rebuilt as a CREATIVE module. Same concept, with the
upgrades below; the old WP Studio canvas and its local data are **not**
migrated.

- **Tiles are the basic element.** A tile holds reusable media with
  canonical names, TEXT, painting (the same brush engine as SKETCH) and other
  graphical tools such as the spiral.
- Media get industry-standard **trim** and **resize**.
- Tiles have excellent **alignment with soft snap**.
- Eventually the WordPress theme **rebuilds tiles fully**, except flattened
  elements (spiral, drawings): everything else is a **schema-based
  reconstruction from JSON**, each tile's meta and the tiles' meta stored
  together as post meta.
- **Tabs:** TILES (`+` makes a 9:16 tile) · PUBLISH (compose selected tiles
  into a post; Publish sends it to WordPress) · WP (published posts and the
  media gallery in sync with WordPress — by default the last 25 posts and
  the last 25 media, first in first out; both searchable on WordPress and
  pulled back; edit and republish old posts, reuse published media as
  canonical files) · SETTINGS (WordPress login).
- **Start with TILES only**; the other tabs are placeholders. Usability
  brutally simple and modern, matching best-in-class app conventions.

## 2. Principles (carried over from WP Studio, kept)

- The data model outranks the UI. Coordinates are normalised (0..1 of the
  tile), never screen pixels.
- One renderer draws the editor, thumbnails and published pictures
  (`render/draw.ts`); there is never a second implementation.
- What will be published is **resolved, not reconstructed**: the app writes
  fully computed values; the theme never guesses.
- Every stored document is versioned (`schema`); new optional fields are
  additive.
- Save → reopen reproduces the tile exactly.

## 3. Module layout

```text
src/modules/publish/
├── core/      pure (lint element publish-core): tile model + zod schema, edits,
│              snapping, text wrapping, spiral layout, trim maths, canonical names,
│              drawing ⇄ brush-engine tiles
├── render/    the one Canvas 2D renderer; picture cache; photo cleaning
├── storage/   PublishStore (IndexedDB `creative-publish`)
├── state/     zustand: tab, open tile with undo / redo, selection, sheets
└── ui/        Tiles tab, tile editor (Konva), sheets, writer, trim, drawing
```

PUBLISH uses SKETCH's UI-free brush engine (`sketch/core`, `sketch/engine`,
`sketch/input`) as a library — never SKETCH's UI or storage (ADR-0010,
lint-enforced).

## 4. The tile (data model)

`schema: creative.publish.tile.v1`

```text
TileDocument
├── id            stable tileId (survives edits and republishing)
├── name, createdAt, updatedAt
├── canvas        1080 × 1920 (9:16), background colour
├── elements[]    bottom → top, any order (see §4.2)
└── meta          tile meta (caption …), travels into the post meta
```

### 4.1 Elements

Every element: stable `id`, box `x, y, w, h` (normalised; x / w of the
width, y / h of the height; top-left of the unrotated box), `rotation`
(degrees clockwise about the box centre — CSS `transform-origin: center`),
`opacity`, optional `locked`.

| Kind | Fields | On WordPress |
| :-- | :-- | :-- |
| `image` | `mediaId` (library picture), `crop {x,y,w,h}` (fractions of the source) | **live**: the canonical file, positioned and cropped by data |
| `text` | `text`, `font` (Roboto · Ms Madi), `weight` 100–900, `size` (px of a 1080-wide tile), `color`, `align`, `lineHeight`, `letterSpacing` | **live**: HTML text from data |
| `spiral` | `text`, `font`, `weight`, `size`, `color`, `letterSpacing`, `turns` 1–6, `innerScale` 0.1–1, `rotationOffset` | **flattened**: a transparent picture of its box |
| `paint` | `assetId` (a full-tile transparent PNG) | **flattened**: a transparent picture |

### 4.2 Stacking

Elements stack in list order, freely (no fixed groups as in WP Studio's
overlay / images / text). This is possible because every flattened element
will be published as **its own** transparent picture at its own box and
place in the stack, not merged into one overlay. (The post-meta format that
carries this is defined with the PUBLISH tab; §9.)

## 5. Media library

### 5.1 Import and names

- "From phone" picks one or more photos. Each is **cleaned**: decoded with
  its orientation applied and re-encoded, which drops EXIF / GPS / camera
  data; at most 2560 px on the long side; PNG stays PNG, everything else
  becomes JPEG (quality 0.92). The original on the phone is never changed.
- **Canonical name:** `<slug>-<yyyymmdd>-<hash6>.<ext>` (e.g.
  `harbour-sunset-20261001-3fa2c1.jpg`) — readable, stable, unique per
  content. The readable part can be renamed; the date and hash stay. It will
  be the file name on WordPress.
- **One copy per content:** a SHA-256 of the stored bytes; importing the
  same picture again reuses the existing entry ("Already in Media —
  reused").
- A picture used by a tile cannot be deleted (the sheet says where it is
  used).

### 5.2 Trim and resize

- **Trim** (full screen, dark): the whole picture with a crop frame and a
  rule-of-thirds grid; drag corners and edges, drag inside to move; presets
  Free, Original, 1:1, 4:5, 3:4, 9:16, 16:9 (a preset keeps its aspect while
  dragging corners); Reset. Done keeps the element's width and centre; its
  height follows the crop, so a picture is **never distorted**.
- **Resize** on the tile with the corner handles (aspect kept), and turn
  with the rotation handle (snaps every 45°).

## 6. The tile editor

### 6.1 Layout

- Top: back (to Tiles, saving), the tile name (tap to rename), undo, redo.
- The 9:16 tile fills the screen; a dashed **safe margin** (5 % = 54 px)
  shows while editing and is never published.
- One bottom bar. Nothing selected: **Media · Text · Draw · Spiral · Layers
  · Colour** (background). Something selected: its few actions —
  picture: **Trim · Style · Duplicate · Delete**; text and spiral: **Edit ·
  Style · Duplicate · Delete**; drawing: **Draw · Style · Delete**.
- Tap an element to select it, drag it to move it (no prior selection
  needed); tap the empty tile to deselect; double-tap to edit (text, spiral)
  or trim (picture). Handles are thumb-sized (22 px).
- **Style** sheet: type controls for text / spiral, opacity, **Align** to the
  tile (left / centre / right margin, top / middle / bottom margin), **Order**
  (front, forward, backward, back) and **Lock**.
- **Layers** sheet: every element top to bottom with its number, type and
  name; tap to select; move up / down.
- Undo / redo (100 steps) for every change; a slider drag is one step.
- **Autosave** 0.8 s after a change, when leaving the tile and when the app
  goes to the background; no save button.

### 6.2 Text

- Text adds "Your text" across the safe width and opens a calm full-screen
  writer in the element's font; Done keeps it, Cancel drops the change (and
  the new element). Empty text removes the element.
- Fonts: **Roboto** (variable, 100–900) and **Ms Madi** — the same two as
  WP Studio, bundled with the app (no CDN, works offline).
- The box width is the wrap width (side handles); its height always fits the
  lines.

### 6.3 Spiral

- A clockwise Archimedean coil from the box edge (94 % of its half-size)
  inward; glyphs placed by true arc length, standing on the exact tangent,
  never distorted; size scales linearly with the distance from the centre
  (outer 100 % → `innerScale`); `rotationOffset` turns the coil; text that
  does not fit is dropped. Deterministic (WP Studio's `layoutSpiral` rules).
- A new spiral is a square 40 % of the tile width, centred, with a
  placeholder sentence. Style: coils, centre size, turn, spacing, font,
  weight, size, colour.

### 6.4 Soft snapping

While dragging or resizing (unrotated), an element's left / centre / right
snaps to vertical lines and its top / middle / bottom to horizontal lines
within **8 screen px**: the tile edges, the safe margins, the centre lines,
and every other element's edges and centres. The line snapped to is drawn
(accent blue). Dragging a little further breaks free. Resizing keeps a
picture's aspect while an edge snaps. Rotation snaps every 45°.

### 6.5 Drawing

- **Draw** opens full screen with **SKETCH's brush engine**: the eight
  brushes (Pencil, Pen, Marker, Brush, Soft Brush, Airbrush, Blender,
  Eraser), five sizes, five opacities, colours, undo / redo, pressure and
  tilt, two fingers to pan / zoom, two-finger tap undo, three-finger tap
  redo. The tile shows underneath (locked).
- Done keeps the drawing as one full-tile transparent PNG (a `paint`
  element). Editing it again loads it back into the engine. Nothing drawn →
  nothing added; an emptied drawing is removed.
- A drawing covers the tile, so it is not a tap target on the canvas;
  select it from Layers.

## 7. Storage

IndexedDB `creative-publish`: `tiles` (TileDocument JSON, validated with
zod on load), `thumbs` (270 × 480 JPEG per tile), `media` (MediaAsset:
canonical name, hash, size, source, WordPress id later; unique index by
hash), `blobs` (picture bytes and private drawing PNGs). Drawing versions
replaced while a tile is open are kept for undo and deleted when it closes.

## 8. TILES tab

Tiles newest first as 9:16 thumbnails with their names; `+` makes a new
9:16 tile and opens it; ⋯ renames, duplicates (drawings copied) or deletes
(a second tap confirms — no dialogs).

## 9. Next phases (placeholders now)

- **PUBLISH:** select tiles, arrange them into a post, publish. Defines the
  post-meta format: each tile's JSON (live elements by data, flattened
  elements as positioned pictures) plus the post's tile meta, stored as
  post meta; media uploaded under their canonical names, reused by hash.
- **WP:** the last 25 posts and 25 media kept in sync (first in, first
  out); search WordPress; pull back, edit, republish; reuse published media.
- **SETTINGS:** WordPress site, user and Application Password (encrypted
  storage — needs a native plugin and its own ADR).
- The WordPress theme (`studioview`, in the `wp_studio` repository) is
  extended for the new tile format then; it keeps rendering WP Studio's
  manifest v3 posts.

## 10. Conflict review (v1.0)

| Topic | Resolution |
| :-- | :-- |
| WP Studio's fixed layer groups (overlay < images < text) | Free stacking; each flattened element becomes its own picture (§4.2). |
| WP Studio's P1 9:25 and SQ sizes | New tiles are 9:16 only, as asked ("A + in TILES can create a 9:16 tile"). |
| Rectangles and labels (WP Studio) | Not carried over; not asked for. |
| "Paint tool same as SKETCH" vs modules never importing each other | PUBLISH uses SKETCH's UI-free engine as a shared library (ADR-0010); UI and storage stay separate. |
| Canvas 2D in PUBLISH | Allowed here: it renders tiles and decodes photos; SKETCH's no-Canvas-2D rule covers its painting, which PUBLISH does through SKETCH's engine. |
