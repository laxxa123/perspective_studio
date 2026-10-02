> **Document:** PUBLISH requirements · **Version:** v1.1 (0.17.0, 2026-10-02) · **Location:** `docs/modules/publish/REQUIREMENTS.md` · **Part of:** CREATIVE (`docs/CREATIVE.md`)
>
> **Revisions:** v1.1 (0.17.0, 2026-10-02) — Publishing to WordPress: Drafts in TILES; the PUBLISH tab (name, categories, row layout by drag, Publish); POSTS (latest 25, edit / republish, old posts as marked tiles, pictures on WordPress); SETTINGS (site, user, encrypted Application Password); permanent picture ids inside the files; names fixed at first publish; featured picture per tile; post meta `_creative_post` (§5, §7–§13; ADR-0011; theme: wp_studio requirements 2.10 §22).
> v1.0 (0.16.0, 2026-10-01) — PUBLISH set up as a new CREATIVE module (the successor of the separate WP Studio app); Phase 1 (TILES) built; PUBLISH, WP and SETTINGS tabs in place as "coming next".

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

**2026-10-02 (v1.1):** the PUBLISH tab shows the tiles from TILES, a
category option and the post name; Publish pushes the post to WordPress,
keeps its new pictures in the local Media, clears TILES and the PUBLISH tab
and puts the post at the top of the POSTS list (first in, first out). Edit
on a post brings it back (tiles into TILES, the post into PUBLISH), all
editable, then Publish again. Picture names stay canonical and are made
from the post / tile when first published; pictures are cleaned of GPS,
phone and personal data and carry a permanent id inside the file so the
same file is never stored twice. Nothing is flattened: drawings and spirals
are standalone pictures with their own ids, a spiral is rebuilt from its
data. A tile can choose its featured picture. Work-in-progress tiles can be
moved aside to Drafts. Tiles are arranged by dragging: to a side → half
width, to the middle → full width. Old posts come in as marked tiles for
manual re-arranging. Best-in-class, simple usability throughout.

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
├── state/     zustand: tab, open tile with undo / redo, selection, sheets, busy
├── wp/        WordPress REST client; publish / pull pipeline (pure of the DOM:
│              rendering, storage and the client are passed in)
└── ui/        tabs (Tiles, Publish, Posts, Settings), tile editor (Konva),
               sheets, writer, trim, drawing, hold-and-drag
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
  its orientation applied and re-encoded, which drops EXIF / GPS / camera /
  phone data and any personal details; at most 2560 px on the long side;
  PNG stays PNG, everything else becomes JPEG (quality 0.92). The original
  on the phone is never changed, and its file name is never used.
- **Name before publishing:** `photo-<yyyymmdd>-<id6>.<ext>`. The readable
  part can be renamed by hand (Media → info).
- **Name at first publish (fixed for good):** `<post>-<tile nn>-<id6>.<ext>`
  (e.g. `harbour-walk-03-3fa2c1.jpg`), unless it was renamed by hand; that
  is the file name on WordPress and on the phone from then on. A picture
  already on WordPress keeps its name wherever it is reused; renaming is
  then off.
- Drawings and spirals are pictures too: `<post>-<tile nn>-drawing-<id6>.png`,
  `<post>-<tile nn>-spiral-<id6>.png`.
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

### 5.3 Permanent picture id

Every picture carries a **permanent id** (32 hex characters: the start of
the SHA-256 of the cleaned picture) written **inside the file** — JPEG: a
minimal EXIF segment holding only `ImageUniqueID` (tag 0xA420), replacing
any other EXIF; PNG: a `tEXt` chunk `ImageUniqueID`. On WordPress the
attachment's description also reads `creative_uid:<id>`. The id survives
renaming, uploading and pulling back, so one picture is stored once: on the
phone (import, pull) and on WordPress (publishing finds it by id before
uploading).

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

IndexedDB `creative-publish` (version 2): `tiles` (TileDocument JSON,
validated with zod on load), `thumbs` (270 × 480 JPEG per tile), `media`
(MediaAsset: name, hash, permanent id, size, source, WordPress id and URL;
indexes by hash and by id), `blobs` (picture bytes and private drawing
PNGs), `kv` (the workspace — tiles of the next post in order, and Drafts —
the post being composed, the posts list, the site and user, cached
categories). Version 1 libraries are upgraded in place (each picture gets
its id from its hash). The Application Password is not here (§12). Drawing
versions replaced while a tile is open are kept for undo and deleted when it
closes.

**Media kept on the phone:** pictures that are on WordPress beyond the
newest 25 are removed from the phone after publishing unless a tile uses
them (they can be pulled back any time); pictures only on the phone always
stay.

## 8. TILES tab

Two sections: **the next post** (its tiles in post order; `+` adds a new
9:16 tile at the end and opens it) and, below a line, **Drafts** — tiles
kept aside, never published, kept after publishing. **Hold a tile and
drag** to reorder it or move it between the post and Drafts (the page
scrolls near the edges; a bar shows where it lands). ⋯ renames, duplicates
(drawings copied; the copy sits next to it), moves to Drafts / to the post,
or deletes (a second tap confirms — no dialogs). A **red dot** marks a tile
made from an old post (§11.3). The section heading shows the post's name
and tile count, and "Editing" while a published post is being changed.

The editor's Style sheet has **Featured picture** for a photo, drawing or
spiral (a star in Layers): the post's cover is the first tile's chosen one,
else the top photo of the first tile with a photo.

## 9. PUBLISH tab

### 9.1 The post

- **Post name** (the title; it can change on every publish — the slug
  WordPress made at first publish never changes).
- **Categories:** chips of the site's categories (tap to pick one or more)
  and `+ Category` to type a new one (created when publishing).
- **Publish** (or **Update post**) — goes live at once. While it works a
  card shows each step; nothing on the phone changes until WordPress has
  confirmed the post.
- After publishing: the post's tiles are cleared from TILES, the PUBLISH
  tab is empty again, the post is at the top of POSTS; pictures stay in
  Media; Drafts stay.
- While a published post is edited: a band says so, links to the post on
  the site, and offers **Drop changes** (a second tap confirms; the tiles
  go, the post on WordPress is unchanged).

### 9.2 Layout

Rows: a tile fills a row (**full**) or half of one (**left** / **right**;
the other half may be empty). New tiles join as full rows at the end, in
TILES order. The layout is shown small (each tile a thumbnail; tap one to
edit it).

### 9.3 Hold and drag

Hold a tile (about a third of a second), then drag; a highlight shows the
drop:
- onto a row's **left or right third** → the tile takes that half; a full
  row becomes two halves; a tile already in that half moves to a new full
  row just below;
- onto a row's **middle** → the tile takes the whole row; the tiles that
  were there move out as full rows, the left one above and the right one
  below;
- onto a row's **top or bottom edge**, or above / below all rows → a new
  full row there.
A quick swipe still scrolls; near the edges the list scrolls by itself.

## 10. Publishing to WordPress

### 10.1 Transport

WordPress REST API with an Application Password (Basic auth), plain
`fetch` (ADR-0011). Errors say what to do: wrong password, site not
reachable, theme too old, timeout (90 s).

### 10.2 Steps

1. Sign in; check the theme answers `creative/v1/info` (else stop: "update
   the studioview theme").
2. When updating: the post's `modified` time must equal the one seen when
   it was opened; otherwise "Someone changed this post on WordPress after
   you opened it" with **Publish anyway** / Cancel.
3. Create new categories.
4. Every picture: a photo already on WordPress is reused as it is;
   otherwise it is looked up by its permanent id (`creative_uid:`), and
   uploaded under its name (§5.1) only when not found. Drawings and spirals
   (a spiral drawn into a transparent PNG of its own box) the same way.
   A photo used several times is uploaded once.
5. The post: title, categories, `featured_media`, a plain `content`
   fallback (pictures and paragraphs, for feeds and other themes) and the
   post meta (§10.3). The saved post must come back with the meta, else
   "update the studioview theme".
6. Tidy up (not fatal if it fails): an old WP Studio post loses its
   `_wpstudio_manifest`; drawings and spirals the post used before and no
   longer uses are deleted from WordPress.
7. Then the phone: the post goes to the top of POSTS, the post's tiles and
   the draft are cleared, Media is trimmed (§7).

### 10.3 Post meta

`_creative_post`, schema `creative.publish.post` version 1 — the layout
(`{full}` / `{left, right}` rows), the featured picture and every tile
whole: each element keeps all its editable data; pictures (photo, drawing,
spiral) add `media {wpMediaId, url, uid, name, width, height}` and refer to
the picture by its permanent id; text adds `lines` (the app's own wrapping)
and `cssFontFamily`. Nothing is flattened into the tile. The theme's side:
wp_studio requirements (2.10) §22.

## 11. POSTS tab

### 11.1 Posts

The latest 25 posts, newest first (published or opened here; older ones
drop off the phone only). Each shows its cover, name and date; the one
being edited is highlighted and shows its new name live. Refresh updates
them from WordPress (an empty list starts from the site's newest 25).
**Search** finds any post on WordPress. Open on the site (↗).

### 11.2 Edit

Edit brings a post back: its tiles into TILES (pictures found on the phone
by their id or downloaded; drawings as drawings; spirals rebuilt from their
data), its name, categories and layout into PUBLISH. If TILES already holds
tiles for another post, Edit first offers to move them to Drafts (one tap).
Publishing replaces the post (§10.2).

### 11.3 Old posts

A post not made by PUBLISH (WP Studio manifest posts, ordinary posts) opens
as tiles for reference: all its pictures in grid tiles (12 per tile) with
their captions as editable text under each, then the title and body text
set for reading over as many text tiles as needed. Such posts and tiles
carry a red dot. Once republished they are ordinary PUBLISH posts.

### 11.4 Media

**On this phone** (the library; a globe marks pictures on WordPress) and
**On WordPress** (the newest 25, or a search). Tap a WordPress picture to
download it into Media, under its WordPress name, to use in any tile.

## 12. SETTINGS tab

Site address, user name, Application Password (shown on demand), **Save
and test** (signs in, checks the theme), **Remove password from this
phone**. The password is stored encrypted by the Android Keystore
(ADR-0011); site and user in `kv`.

## 13. Conflict review (v1.0, v1.1)

| Topic | Resolution |
| :-- | :-- |
| WP Studio's fixed layer groups (overlay < images < text) | Free stacking; each flattened element becomes its own picture (§4.2). |
| WP Studio's P1 9:25 and SQ sizes | New tiles are 9:16 only, as asked ("A + in TILES can create a 9:16 tile"). |
| Rectangles and labels (WP Studio) | Not carried over; not asked for. |
| "Paint tool same as SKETCH" vs modules never importing each other | PUBLISH uses SKETCH's UI-free engine as a shared library (ADR-0010); UI and storage stay separate. |
| Canvas 2D in PUBLISH | Allowed here: it renders tiles and decodes photos; SKETCH's no-Canvas-2D rule covers its painting, which PUBLISH does through SKETCH's engine. |
| Spec "clear the tiles" after publishing vs keeping work | The post's tiles are deleted (they live on WordPress and come back with Edit); Drafts are never touched. |
| Spec "do not flatten anything" vs spirals and drawings on WordPress | Each is its own picture with its own id (never merged into the tile); its data stays in the meta, so it is rebuilt for editing. |
| Edit while TILES has tiles | Offer to move them to Drafts (non-destructive) rather than clear them. |
| WP Studio's `wpstudio_hash:` description tag | New tag `creative_uid:` with the permanent id inside the file; old tags are not read. |

