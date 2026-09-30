# PERSPECTIVE\_STUDIO — Foundation Requirements

> **Status:** v1.5 · Foundation document · Owner: sole developer/user **Audience:** Claude Code (primary), developer (secondary) **Location in repo:** `docs/REQUIREMENTS.md`

**Revisions:** v1.5 (2026-09-30, requirements only) — scene & viewing revision from the developer's review: horizon = eye level (PS-08, ADR-0005), placement above the horizon, hanging, working plane, Shapes submenu, quick zoom, collapsible sketch palette, plan view, origin marker, floor grid; new milestone M8; conflicts reviewed in §16.2; open decisions OD-8…OD-14. · v1.4 (0.8.0, 2026-09-30) — M3–M6 built in one delivery at the developer's request; §16.1 records what was built and the choices made. · v1.3 (M2, 2026-09-30) — M0 closed (ADR-0002); OD-3 eye height tuned to 2.2 u; §10.3 / §10.5 details fixed in M2 (below); §16 M2 status. · v1.2 (M1, 2026-09-30) — §6.3 constraint constants fixed in `core/math/tolerance.ts`; §16 M1 status. · v1.1 (M0, 2026-09-30) — §13 TypeScript pinned to 6.0; §14 records the delivery actually used (CI on push to `main`, app id, versioning, signing key); §16 M0 status. · v1.0 — foundation document.

---

## 0\. How to use this document

This is the **single source of truth** for what PERSPECTIVE\_STUDIO is, how it is structured, and how it may change.

Claude Code must:

1. Read this document, `CLAUDE.md`, and `docs/decisions/` before starting any task.  
2. Work on **one milestone (§16) at a time**, in order, unless the developer says otherwise.  
3. Cite requirement IDs (e.g. `PS-03`, `BX-05`) in commit messages and PR descriptions.  
4. Never implement anything not traceable to a requirement ID in `ACTIVE` status. If something seems missing, **ask** — do not invent.  
5. When a requirement changes, update this document **in the same change** as the code (§17).

Order of authority when documents conflict: **developer's latest instruction → this document → ADRs → code comments**.

---

## 1\. Product definition

**One line:** A 2D perspective drawing skill app where the user sets a horizon and three vanishing points, constructs multiple mathematically exact perspective objects (starting with cubes), and later sketches freely or with perspective assistance on top of that perspective backdrop.

| Attribute | Value |
| :---- | :---- |
| Users | One (the developer). Private. No accounts, no sharing platform. |
| Primary platform | Android (tablet and phone), packaged via Capacitor, installed/updated via Obtainium. |
| Secondary platform | Desktop browser (development \+ occasional use). Same codebase. |
| Connectivity | Fully offline. No backend, ever, unless an ADR adds one. |
| Nature | A 2D drawing/editor app whose geometry is governed by exact 3D perspective mathematics. Not a 3D modelling app. |

### 1.1 Product principles (tie-breakers for every decision)

1. **Accuracy first.** Every perspective line is mathematically exact. Nothing is "perspective-looking".  
2. **One model, many views.** Objects live in a 3D world; the screen is a projection. Moving a vanishing point changes the view, never the objects.  
3. **Canvas first, chrome last.** The drawing surface dominates; UI appears only when needed.  
4. **Grow by adding modules, not by editing the core.** New shapes/tools plug in through defined extension points (§8.4).  
5. **Nothing speculative.** Build only what the active milestone needs. Extension points exist; unused features do not.

---

## 2\. Scope

### 2.1 Goals (in order)

- G1 — An exact, interactive 3-point (and 2-point) perspective system controlled by draggable horizon and vanishing points.  
- G2 — Multiple perspective objects (boxes/cubes first) that can be placed, moved, resized, stacked, duplicated and deleted while remaining exact.  
- G3 — Reliable local persistence, undo/redo, export (PNG, SVG, JSON).  
- G4 — A sketch layer (pencil/pen/eraser, pressure) using the perspective system as a backdrop, with optional perspective snapping.  
- G5 — (Later) Learning exercises built on the same engine.

### 2.2 Non-goals (do not build, do not scaffold)

- 3D engines (Three.js, Babylon, WebGL scene graphs), lighting, materials, textures, 3D camera orbit UI. (The plan view, CV-05, is a flat orthographic top view of the same world data — not an orbit camera.)  
- Backend, authentication, cloud sync, analytics, telemetry, ads.  
- Multi-user, collaboration, social sharing features.  
- Google Play Store distribution (V1 uses Obtainium).  
- UI component libraries (MUI, Ant, etc.), CSS frameworks beyond what §13 lists.  
- Internationalisation, accessibility audits beyond sensible defaults, theming engines.  
- Raster painting engine (brushes as pixel operations). Sketching is vector stroke data (§7.6).

---

## 3\. Glossary (canonical vocabulary — do not rename)

| Term | Meaning |
| :---- | :---- |
| **Picture plane** | The fixed 2D drawing coordinate space. VPs, horizon, strokes live here. Independent of zoom/pan. |
| **Paper** | A rectangle in the picture plane that defines the export frame. The canvas extends beyond it. |
| **Viewport** | The on-screen window onto the picture plane (pan \+ zoom). UI state only. |
| **World** | The 3D space where perspective objects live. Right-handed, **Z up**, units \= "u" (think metres). |
| **Ground** | The world plane `z = 0`. |
| **Horizon** | Horizontal line `y = horizonY` in the picture plane (camera roll is always 0). **The horizon is the eye level**: the image of the horizontal plane through the eye (`z = eyeHeight`). Everything lower than the eye appears below it, everything higher above it; an object crossing eye height is cut by it. |
| **VP-L / VP-R** | Left / right horizontal vanishing points. Both lie on the horizon. |
| **VP-V** | Vertical vanishing point. Finite in 3-point mode, at infinity in 2-point mode. |
| **Family L / R / V** | The three edge directions. Family L edges converge to VP-L, R to VP-R, V to VP-V. Always named by their VP, never by axis letter in UI. |
| **Perspective system (PS)** | The persisted parameters: horizon, VP-L, VP-R, VP-V, anchor, eye height, mode. |
| **Camera** | Derived (never persisted) projection computed from the PS. |
| **Anchor** | A picture-plane point where the world origin (0,0,0) on the floor is pinned. Keeps objects on screen when VPs move; together with the eye height it fixes where the eye stands. Not the camera. UI label "Ground point" (OD-9); drawn as a 3D axis marker (UI-05). |
| **Eye level** | The horizontal plane `z = eyeHeight`; its image is the horizon. |
| **Centre of vision** | The principal point `p` (§6.2): where the eye looks straight ahead. On the horizon in 2pt; at `x = verticalX` in both modes. |
| **Working plane** | An optional horizontal plane `z = h` used for placement when a tap hits nothing (PL-01). UI state, per document. |
| **Shape** | A placeable world entity kind (box, rect; later cylinder…), offered in the Shapes submenu (UI-01). |
| **Plan view** | An orthographic top-down view of the world (X/Y), for checking layout (CV-05). |
| **Entity** | Any persisted drawable item (box, rect, stroke…). Has a `kind`. |
| **Entity kind** | A registered module defining an entity type (§8.4). |
| **Box** | Axis-aligned rectangular prism in the world. A **cube** is a box with `uniform: true`. |
| **Render model** | Flat list of 2D primitives with semantic roles produced from the document (§8.3). |
| **Construction** | Display of rays/hidden edges that show *how* geometry is built. |
| **Command** | The only way to mutate the document. Undoable. |
| **Tool** | An interaction state machine (Select, Box, Sketch, Perspective…). |

---

## 4\. The core architectural decision

> **Objects are stored as 3D world geometry. The vanishing points define a camera. Everything on screen is a projection.**

The brainstorm framed cubes as "intersections of rays toward VPs" in 2D. That is how a human *constructs* perspective by hand, and the app will *show* it that way (construction mode). But it must **not** be the storage model, because a pure 2D construction model:

- gives "width/height/depth" no consistent meaning (sizes change arbitrarily when a VP moves),  
- makes stacking, alignment, equal sizes, and relative location ambiguous,  
- requires a new bespoke construction algorithm for every new shape.

The world-model approach instead gives:

| Need | How the world model delivers it |
| :---- | :---- |
| Perspective accuracy | Projection of straight 3D edges through one camera is exact by construction; every family-L edge passes through VP-L. |
| More cubes / rectangles / locations | Every entity is just 3D points. Adding a shape \= defining its 3D vertices. |
| Size change | Sizes are world units; numeric and consistent. |
| Stacked cubes | `position.z = top of the box below`. Trivial in 3D, painful in 2D. |
| Moving VPs | Camera changes; world unchanged; everything re-projects. |
| Painting later | Sketch strokes sit on the picture plane, with the projected geometry as backdrop. |

This is still a **2D app**: the "3D" is \~200 lines of pure TypeScript (vectors, a 3×3 rotation, a pinhole projection). No 3D engine.

---

## 5\. Coordinate spaces

| Space | Dimensions | Units | Axes | Persisted? | Holds |
| :---- | :---- | :---- | :---- | :---- | :---- |
| World | 3D | u | \+X toward VP-R, \+Y toward VP-L, \+Z up | Yes | Boxes, rects, future solids |
| Picture plane | 2D | px-like "pp" | \+x right, **\+y down** | Yes | Horizon, VPs, anchor, paper, strokes |
| Screen | 2D | CSS px | \+x right, \+y down | No | Pointer events, Konva stage |

- `screen = (pp − viewport.offset) × viewport.zoom` (and inverse). Only the viewport module converts between these.  
- **Zoom/pan never alter the perspective system or the document.** (NFR-A-04)  
- All geometry math uses `number` (float64). No rounding in stored values; rounding only for display.

---

## 6\. Perspective system (the mathematical core)

### 6.1 Persisted parameters

interface PerspectiveSystem {

  mode: '3pt' | '2pt';

  horizonY: number;        // pp

  vpLeftX: number;         // pp, VP-L \= (vpLeftX, horizonY)

  vpRightX: number;        // pp, VP-R \= (vpRightX, horizonY)

  verticalX: number;       // pp, x of VP-V (3pt) / principal point x (2pt)

  vpVerticalY: number | null; // pp, y of VP-V; null in 2pt (VP-V at infinity)

  anchor: Vec2;            // pp, where world origin (0,0,0) projects; must be below horizon

  eyeHeight: number;       // u, camera height above ground (\> 0); sets world scale

}

Camera roll is fixed at 0 (horizon always horizontal). This is a deliberate constraint, not a TODO.

### 6.2 Deriving the camera (exact formulas — implement exactly)

Let `h = horizonY`, `xL = vpLeftX`, `xR = vpRightX`, `xV = verticalX`.

a \= (xV − xL) · (xR − xV)            // must be \> 0  ⇒  xL \< xV \< xR

3-point (yV finite):

  d  \= yV − h                        // ≠ 0

  principal p \= (xV, h \+ a / d)      // orthocenter of triangle VP-L, VP-R, VP-V

  f² \= a · (1 − a / d²)              // focal length squared, must be \> 0  ⇒  d² \> a

2-point (yV \= null):

  principal p \= (xV, h)

  f² \= a

Direction (camera coords: x right, y down, z forward) of a VP v:

  dir(v) \= normalize(v.x − p.x, v.y − p.y, f)

World axes in camera coords:

  x̂ \= dir(VP-R)

  ŷ \= dir(VP-L)

  ẑ \= normalize(x̂ × ŷ)               // world up; in 3pt it is ±dir(VP-V) — assert parallel

  Re-orthonormalize (Gram–Schmidt) to remove float error.

  M \= \[x̂ ŷ ẑ\]                         // 3×3, columns; maps world vectors → camera coords

Camera position (pins world origin to the anchor):

  r \= Mᵀ · (anchor.x − p.x, anchor.y − p.y, f)     // world-space ray through anchor

  require r.z \< 0                                   // anchor below horizon

  solve C \+ t·r \= (0,0,0) with C.z \= eyeHeight:

  t \= eyeHeight / (−r.z)        // \> 0

  C \= −t · r                     // world-space camera centre

**Projection** of world point `P`:

Pc \= M · (P − C)

if Pc.z ≤ NEAR (1e-6·scale): point is behind camera → clip (§6.5)

screen\_pp \= (p.x \+ f·Pc.x/Pc.z, p.y \+ f·Pc.y/Pc.z)

**Unprojection** of picture point `q` onto world plane `z = z0`:

dirW \= Mᵀ · (q.x − p.x, q.y − p.y, f)

t \= (z0 − C.z) / dirW.z ; valid iff t \> 0

P \= C \+ t · dirW

These live in `core/perspective`. No other module may compute projections.

### 6.3 Validity constraints (enforced, never violated in stored state)

| ID | Constraint | Meaning for the user |
| :---- | :---- | :---- |
| PV-1 | `xL < xV < xR` | VP-V's vertical axis sits between the two horizontal VPs. |
| PV-2 | 3pt: `(yV − h)² > a · (1 + ε)` | VP-V must be far enough from the horizon; closer is physically impossible (no real camera). |
| PV-3 | `xR − xL ≥ minSpread` | Horizontal VPs can't collapse together. |
| PV-4 | `anchor.y > horizonY + margin` (and in 3pt, anchor projects in front of camera) | The ground point must be below the horizon. |
| PV-5 | `eyeHeight > 0` | — |

Constants (in `core/math/tolerance.ts`): PV-1 margin \= 1% of `xR − xL`; PV-2 `ε` \= 0.05; PV-3 `minSpread` \= 50 pp; PV-4 margin \= 4 pp; PV-5 minimum \= 0.001 u. In 2pt, `vpVerticalY` must be `null`. The repair (`clampPerspective`) fixes, in order: spread (PV-3, around the midpoint), VP-V's x (PV-1), VP-V's distance from the horizon keeping its side (PV-2), anchor y (PV-4), eye height (PV-5); a valid system is returned unchanged.

During a drag, the Perspective tool **clamps** proposed values to the nearest valid configuration and visually shades the invalid region (§10.5). Loading a file with an invalid PS repairs it deterministically and logs a warning.

### 6.4 Behaviour when perspective changes

- World entities are unchanged. Camera is re-derived; all entities re-project.  
- The anchor keeps the world origin pinned in place, so the scene rotates "around" the anchor rather than flying off-screen.  
- ~~Dragging the horizon moves VP-L, VP-R and preserves `verticalX`, `vpVerticalY` unless that violates PV-2, in which case VP-V is pushed.~~ *REMOVED v1.5 (2026-09-30): it made the horizon a camera-distance control — boxes ballooned or shrank to the anchor. Superseded by PS-08 / ADR-0005.*  
- **Dragging the horizon changes the eye height (PS-08, ADR-0005):** VP-L, VP-R and (3pt) VP-V move with it by the same amount, so camera orientation and focal length are unchanged; the anchor stays pinned and the camera keeps its horizontal distance to the world origin; `eyeHeight` is re-derived. Raising the horizon raises the eye; lowering it toward the anchor lowers the eye toward the floor, clamped by PV-4 / PV-5.  
- Switching `3pt → 2pt` sets `vpVerticalY = null`; `2pt → 3pt` sets it to a default valid distance below the horizon.

### 6.5 Clipping & degeneracy

- Edges with one endpoint behind the camera are clipped at the near plane in camera space before projection.  
- Entities entirely behind the camera render nothing and show an off-screen indicator when selected.  
- Vanishing points are represented as homogeneous 2D points internally so VP-V at infinity (2pt) is handled by the same line math (snapping, rays).

### 6.6 Mandatory invariants (property-tested, §15)

| ID | Invariant | Tolerance |
| :---- | :---- | :---- |
| PS-T1 | For random valid PS and random boxes: the line through any projected family-L edge passes through VP-L (same for R, V). In 2pt, family-V edges are exactly vertical. | ≤ 1e-6 pp distance (scaled) |
| PS-T2 | `M` is orthonormal and right-handed. | ≤ 1e-12 |
| PS-T3 | World origin projects to `anchor`; `C.z = eyeHeight`. | ≤ 1e-9 |
| PS-T4 | `project(unproject(q, z0)) = q` for q below horizon. | ≤ 1e-9 |
| PS-T5 | Re-deriving the VPs from the camera returns the stored PS. | ≤ 1e-9 |
| PS-T6 | Serialize → load → project gives bit-identical render model. | exact |

Tolerances live in one file: `core/math/tolerance.ts`.

---

## 7\. Data model

### 7.1 Three kinds of state (never mix)

| State | Examples | Persisted | Undoable | Store |
| :---- | :---- | :---- | :---- | :---- |
| **Document** | PS, paper, layers, entities | Yes | Yes | `documentStore` |
| **Session/UI** | selection, active tool, viewport, display toggles, panel open | Viewport \+ display prefs only (per document, not undoable) | No | `uiStore` |
| **Derived** | camera, render model, hit-test index | No | — | memoized selectors |

### 7.2 Document

type Id \= string;               // crypto.randomUUID()

type Vec2 \= { x: number; y: number };

type Vec3 \= { x: number; y: number; z: number };

interface SceneDocument {

  schemaVersion: number;        // integer, starts at 1

  id: Id;

  name: string;

  createdAt: string;            // ISO

  updatedAt: string;

  paper: { width: number; height: number };   // pp, origin at (0,0)

  perspective: PerspectiveSystem;

  layers: Layer\[\];              // bottom → top draw order

  entities: Record\<Id, Entity\>;

}

interface Layer {

  id: Id;

  name: string;

  role: 'objects' | 'sketch';   // what entity kinds it accepts

  visible: boolean;

  locked: boolean;

  opacity: number;              // 0..1

  order: Id\[\];                  // entity ids, bottom → top

}

The **perspective guides** (horizon, VPs, rays) are not a layer in the document; they are a system overlay controlled by display toggles.

### 7.3 Entity base

interface EntityBase {

  id: Id;

  kind: string;                 // registered entity kind

  layerId: Id;

  name?: string;

  visible: boolean;

  locked: boolean;

  style?: StyleRef;             // optional override; default from theme by role

}

type Entity \= BoxEntity | RectEntity | StrokeEntity | UnknownEntity;

### 7.4 Box (cube) — M3

interface BoxEntity extends EntityBase {

  kind: 'box';

  position: Vec3;               // world, min corner (−X,−Y,−Z corner); z=0 means on ground

  size: Vec3;                   // world u; x along family R, y along family L, z along family V; all \> 0

  uniform: boolean;             // true \= cube: resizing any dimension resizes all

}

Rotation about Z (`yaw`, giving the box its own VPs on the horizon) is **not** in V1. It is added later by schema migration (backlog B-01).

### 7.5 Rect (ground/wall plane rectangle) — M5

interface RectEntity extends EntityBase {

  kind: 'rect';

  plane: 'ground' | 'wallL' | 'wallR';  // normal Z, normal X, normal Y

  position: Vec3;               // world, min corner

  size: Vec2;                   // extents in the plane's two axes

}

### 7.6 Stroke (sketch) — M6

interface StrokeEntity extends EntityBase {

  kind: 'stroke';

  space: 'picture';             // V1: strokes live on the picture plane

  tool: 'pencil' | 'pen' | 'marker';

  color: string;

  width: number;                // base width, pp

  opacity: number;

  points: number\[\];             // flat \[x, y, pressure, x, y, pressure, …\] in pp

  constraint?: { family: 'L' | 'R' | 'V'; mode: 'soft' | 'locked' };  // how it was drawn (for feedback)

}

- Strokes are **picture-plane** data: they do not move when VPs move. This matches drawing on paper over a guide. The UI warns once when editing the PS of a document that contains strokes.  
- Eraser \= stroke-level delete (V1) or split (later). No pixel erasing.  
- Strokes projected onto a world plane (`space: { plane… }`) are backlog B-05.

### 7.7 Unknown entities

On load, an entity whose `kind` is not registered is kept as `UnknownEntity { kind, raw }`, not rendered, not dropped, and re-saved unchanged. Removing a feature never destroys data in old files.

### 7.8 Schema versioning & migrations

- `schemaVersion` bump on any persisted shape change.  
- `core/document/migrations/NNN_description.ts`: pure function `(docN) → docN+1`. Chained on load.  
- All loaded JSON is validated with a Zod schema **after** migration. Validation failure → file is not opened, error shown, original untouched.  
- Every migration has a fixture test (`fixtures/vN.json` → expected `vN+1`).

### 7.9 Persistence

- IndexedDB (via `idb`): stores `documents` (full JSON) and `thumbnails` (PNG blob).  
- Autosave: debounced 1 s after the last command; also on app pause (Capacitor `appStateChange`).  
- LocalStorage: only tiny app preferences (last opened doc id, theme).  
- JSON export/import is the backup format (identical to the stored document).

---

## 8\. Architecture

### 8.1 Module layout

src/

  core/                       \# PURE TypeScript. No React, no Konva, no DOM, no Capacitor.

    math/                     \# vec2, vec3, mat3, homogeneous lines, intersections, tolerance

    perspective/              \# PS ⇄ camera, validity/clamp, project/unproject, clipping

    document/                 \# types, zod schemas, migrations, factories

    commands/                 \# command definitions, history (undo/redo)

    entities/                 \# entity-kind registry \+ one folder per kind

      box/  rect/  stroke/

    derive/                   \# document \+ camera → RenderModel; hit-test index

    snapping/                 \# perspective snapping for strokes & placement

  render/konva/               \# RenderModel → Konva nodes. No math beyond pp→screen.

  export/                     \# RenderModel → SVG string; stage → PNG; JSON

  tools/                      \# interaction state machines (select, perspective, box, sketch, pan)

  state/                      \# zustand stores: documentStore, uiStore

  ui/                         \# React components: shell, toolbar, inspector, layers, gallery

  platform/                   \# Capacitor adapters: filesystem, share, haptics, app lifecycle

  features.ts                 \# feature flags

### 8.2 Dependency rules (enforced by lint, CI fails otherwise)

ui ─▶ tools ─▶ state ─▶ core

ui ─▶ render/konva ─▶ core/derive (types only)

export ─▶ core

platform ◀─ ui/tools (via interfaces only)

core ─▶ (nothing outside core)

- `core/**` must not import React, Konva, DOM types, Zustand, or Capacitor.  
- `render/**` must not import from `core/perspective` (it only receives the render model).  
- Enforced with `eslint-plugin-boundaries` (or `dependency-cruiser`).

### 8.3 Pipeline

Command ─▶ Document (immutable) ─▶ derive(document, camera) ─▶ RenderModel ─▶ Konva / SVG export

                 ▲                                                       │

                 └──── Tool (pointer events, hit-test on RenderModel) ◀──┘

interface RenderItem {

  key: string;                          // stable: \`\${entityId}:\${part}\`

  entityId?: Id;

  role: 'edge' | 'hiddenEdge' | 'face' | 'ray' | 'horizon' | 'vp' | 'anchor'

      | 'stroke' | 'handle' | 'paper' | 'selection';

  family?: 'L' | 'R' | 'V';

  points: number\[\];                     // pp, flat

  closed?: boolean;

  data?: Record\<string, number | string\>; // e.g. pressure widths for strokes

}

type RenderModel \= { items: RenderItem\[\]; bounds: Rect };

- **Styling is by role \+ family**, resolved from the theme in the renderer. Core never chooses colours.  
- Derivation is memoized per entity, keyed by `(entity reference, perspective reference)`. Unchanged entities are not recomputed.  
- SVG export serializes the RenderModel directly (not via Konva), so vector output is exact.

### 8.4 Extension point: entity kinds (how the app grows without bloat)

Every entity type is a self-contained folder in `core/entities/<kind>/` that exports:

interface EntityKindDef\<E extends EntityBase\> {

  kind: string;

  schema: ZodSchema\<E\>;

  layerRole: 'objects' | 'sketch';

  create(params: unknown, ctx: CreateCtx): E;

  derive(e: E, ctx: DeriveCtx): RenderItem\[\];     // uses ctx.project only

  handles(e: E, ctx: DeriveCtx): HandleDef\[\];     // e.g. resize along family L/R/V

  applyHandle(e: E, handleId: string, drag: DragInput, ctx: DeriveCtx): Partial\<E\>;

  bounds(e: E, ctx: DeriveCtx): Rect;             // pp

}

plus an optional `ui/inspectors/<Kind>Inspector.tsx`. Registration is one line in `core/entities/registry.ts`.

- **Adding** a shape \= new folder \+ registry line \+ tests. No edits to core pipeline.  
- **Removing** a shape \= delete folder \+ registry line; old files keep the data as `UnknownEntity` (§7.7).  
- Tools follow the same pattern: `tools/<tool>/` \+ one line in `tools/registry.ts`.

### 8.5 Commands & undo/redo

- Every document mutation is a named command: `SetPerspective`, `AddEntity`, `UpdateEntity`, `DeleteEntities`, `DuplicateEntities`, `ReorderLayer`, `AddLayer`, `UpdateLayer`, …  
- Implemented with Immer `produceWithPatches`; history stores `{ label, patches, inversePatches }`.  
- A continuous drag produces **one** history entry (begin/commit transaction).  
- History limit: 200 entries. History is not persisted.  
- Session/UI state changes (selection, zoom, tool) are never in history.

### 8.6 Tools

Each tool is a small explicit state machine: `idle → pressing → dragging → commit/cancel`. Tools receive normalized pointer input (`{pp, screen, pointerType, pressure, buttons}`) from a single input router, never raw DOM events. Only one tool is active; the input router handles pan/zoom gestures before tools see events (§10.3).

---

## 9\. Rendering

- `react-konva` with fixed Konva layers (bottom → top): `paper`, `guides` (horizon, rays), `objects`, `sketch`, `sketchLive` (in-progress stroke only), `overlay` (selection, handles, VP handles).  
- `listening: false` on guides/paper/sketch layers; hit-testing uses the core hit-test index, not Konva events.  
- Box rendering:  
  - Visible faces determined per box by back-face test: face visible iff `normal · (C − faceCenter) > 0`. Exact for a single box.  
  - Visible edges \= edges of visible faces. Hidden edges → role `hiddenEdge` (dashed, shown only in Construction).  
  - Optional face fill (light tint per family) toggle.  
  - **Inter-object occlusion (V1):** painter's order by camera-space depth of box centre. Known limitation: can be wrong for interpenetrating boxes. Exact occlusion is backlog B-07.  
- Construction rays: from each endpoint of a selected (or all) box's visible edges toward its family VP, extended to the VP or viewport edge.  
- Stroke rendering: pressure → variable-width outline polygon (library chosen in M6 spike, candidate `perfect-freehand`).  
- Pixel ratio: stage uses `devicePixelRatio`; line widths are in screen px (constant visual weight across zoom) for guides/edges, in pp for strokes.

---

## 10\. UX strategy — simple, modern, canvas-first

### 10.1 Principles

1. **Canvas is the app.** Full-bleed; ≤ 3 floating UI clusters; no permanent side panels on phones. (On phones the plan view, when open, takes the inspector's slot; contextual palettes collapse to one row, UI-02.)  
2. **Colour \= family.** One consistent colour each for L, R, V used on VPs, rays, edge highlights, handles, and inspector labels. Learning happens by colour association.  
3. **Two clear modes of touching the world:** *Perspective* (move VPs/horizon/anchor) vs *Objects* (everything else). Objects can never move the perspective by accident, and vice versa.  
4. **Direct manipulation first, numbers second.** Drag handles on the canvas; exact values in the inspector.  
5. **Immediate feedback.** Every drag updates every object live at 60 fps.  
6. **Quiet by default.** Neutral paper, thin lines, one accent. No decoration.

### 10.2 Layout

┌───────────────────────────────────────────────────────┐

│ ☰ Scene name              ⟲ ⟳   ◐ Display   ⚙         │  top bar (auto-hides while drawing)

│                                                       │

│        ◀ VP-L (off-screen indicator)                  │

│   ─────────────●──────────── horizon ─────────●────   │

│                                                       │

│                     ┌────┐                            │

│                    ╱    ╱│       canvas               │

│                   └────┘ │                            │

│                   │    │╱                             │

│                   └────┘                              │

│                        ▼ VP-V (off-screen indicator)  │

│                                                       │

│  ┌────────────────────────────────────┐   ┌────────┐  │

│  │ ⬚ Select  ⊞ Box  ✎ Sketch  ◎ Persp │   │Inspector│ │  bottom toolbar · contextual sheet

│  └────────────────────────────────────┘   └────────┘  │

└───────────────────────────────────────────────────────┘

- **Phone portrait:** toolbar bottom-centre; inspector \= bottom sheet (collapsed/half/full).  
- **Tablet/landscape:** toolbar bottom-centre; inspector \= floating right card; layers \= floating left card (toggle).  
- **Desktop:** same as tablet plus keyboard shortcuts.

### 10.3 Input model

| Input | Action (all tools) |
| :---- | :---- |
| One finger / mouse drag | Active tool's action |
| Two-finger drag | Pan |
| Pinch | Zoom (anchored at gesture centre) |
| Pen (stylus) | Active tool; in Sketch, pen draws and **touch never draws** (palm rejection) |
| Two-finger tap | Undo |
| Three-finger tap | Redo |
| Long press on entity | Context menu (duplicate, delete, stack on top, bring forward) |
| Mouse wheel / trackpad | Zoom / pan (desktop) |
| Keys (desktop) | `V` select, `B` box, `S` sketch, `P` perspective, `Del` delete, `Ctrl+D` duplicate, `Ctrl+Z / Ctrl+Shift+Z`, `G` guides, `C` construction, `F` fit |

**As built (M2):** one-finger drag on empty canvas does nothing in Select / Perspective (pan is two-finger, as above). Desktop: mouse wheel zooms at the cursor, Ctrl+wheel (trackpad pinch) zooms, Shift+wheel pans sideways, middle-button drag pans; keys V, P, F.

### 10.4 Tools (V1 set; others added only via milestones)

| Tool | Purpose |
| :---- | :---- |
| **Select** | Tap to select, drag body to move on its base plane, drag handles to resize, marquee on desktop. |
| **Shapes** (UI-01) | A submenu: Box, Rect (Ground / Wall L / Wall R / Ceiling), later Cylinder… The chosen shape is placed by tapping per BX-02 (revised); the button shows the last-used shape. Tool returns to Select after placing (setting). *(Replaces the separate Box and Rect tools, v1.5.)* |
| **Perspective** | VP-L, VP-R, VP-V, horizon, anchor become draggable; objects dim to 40% and are non-interactive. |
| **Sketch** (M6) | Draw strokes; snap mode chip (Off / Soft / Locked \+ family). |

### 10.5 Perspective editing UX

- VPs are **first-class canvas objects**: large touch targets (≥ 44 px), labelled, family-coloured.  
- **Off-screen VPs** (the normal case) show as edge-of-viewport arrow chips with their label; tapping one pans to it; dragging the chip drags the VP.  
- **Fit** (`F`, button): zooms to show paper \+ all VPs.  
- **Invalid region:** while dragging VP-V (or horizon/VP-L/VP-R), the forbidden band around the horizon (PV-2) is shaded; the handle clamps to its edge with a haptic tick.  
- 2-point / 3-point toggle in the Perspective tool's mini bar.  
- **Lock** toggle: when locked, the Perspective tool is disabled (prevents accidental edits).  
- Mini bar numeric readout (optional): horizon y, VP positions, eye height.

**As built (M2):**
- Handles: VP-L and VP-R drag along the horizon (x only); the horizon line drags vertically (VP-L / VP-R move with it; VP-V is pushed out of the PV-2 band if needed, §6.4); VP-V (3pt) and the anchor drag freely. Touch radius 26 px (≥ 44 px targets). A second finger cancels the drag and restores the system.
- Clamping: when the target is invalid, the handle stops at the edge of the valid region along the drag, with a haptic tick when clamping starts; a valid target is taken as is, so VP-V can jump across the band to look up.
- Shading: the PV-2 band while dragging VP-V, the horizon, VP-L or VP-R (3pt); the region above horizon + 4 pp while dragging the anchor.
- Lock: padlock button in the top bar; while locked the Perspective tool is disabled.
- In 2pt the principal point x (`verticalX`) has no handle.

### 10.6 Object manipulation UX (box)

- Selected box shows: family-coloured edge highlights, and **three resize handles** at the centres of the visible faces, each dragging strictly along its family direction (L, R, or V) in world space.  
- **Move:** drag the body → moves on the plane it rests on (ground, or the top face it is stacked on). A vertical "lift" handle (family V colour) changes elevation.  
- **Cube lock** (`uniform`): on by default for new cubes; any handle then scales all three dimensions.  
- **Snapping (objects):** to world-unit grid (0.1 u default, toggle), to other boxes' faces/edges (stack, align flush). Snap feedback \= brief highlight of the target face.  
- Inspector: name, W (R) / D (L) / H (V) with steppers and numeric entry, elevation, cube lock, layer, duplicate, delete.

### 10.7 Display modes

A single "Display" popover with three presets and fine toggles:

| Preset | Shows |
| :---- | :---- |
| **Construction** | Horizon, VPs, rays (selected/all), hidden edges dashed, edges |
| **Clean** | Edges (and fills if on) only |
| **Guides** | Horizon, VPs, rays, no objects (backdrop for sketching) |

Fine toggles: rays none/selected/all · hidden edges · face fills · grid on ground · paper frame · world-unit labels.

### 10.8 Screens

1. **Gallery** (home): grid of scene thumbnails, "New scene" (choose 2pt/3pt preset), long-press to rename/duplicate/delete/export.  
2. **Editor** (above).  
3. **Settings**: theme (light/dark/system), default snapping, handedness of toolbar, about/version.

No onboarding flow. A new scene opens with a valid 3-point system and one cube so the user can immediately drag a VP.

### 10.9 Visual language

- Light "paper" theme default (warm off-white), dark theme available.  
- Family colours (to be tuned, must stay distinct in both themes and for common colour-vision deficiency): L \= blue, R \= orange, V \= purple; neutral grey for horizon.  
- One typeface (system UI stack). Icons: a single outline icon set (e.g. Lucide).  
- Motion: 120–180 ms ease-out for panels; no motion on canvas geometry except user-driven.  
- Haptics (Capacitor): light tick on snap, on clamp, on selection.

---

## 11\. Functional requirements

Status: all `ACTIVE` unless marked. Milestone in brackets.

### PS — Perspective system

- **PS-01** \[M1\] Implement §6.2 solver, §6.3 validity \+ clamp, §6.5 clipping, as pure functions with §6.6 tests.  
- **PS-02** \[M2\] Render horizon, VP-L, VP-R, VP-V (3pt), anchor, and paper.  
- **PS-03** \[M2\] Drag each of: horizon, VP-L, VP-R, VP-V, anchor in the Perspective tool; all entities update live.  
- **PS-04** \[M2\] 2-point / 3-point mode switch.  
- **PS-05** \[M2\] Off-screen VP indicators and Fit.  
- **PS-06** \[M2\] Perspective lock toggle.  
- **PS-07** \[M3, revised v1.5\] Eye height adjustable (inspector with nothing selected → "Scene" panel). Editing it moves the horizon exactly as PS-08 does (one meaning: eye height ⇔ horizon).  
- **PS-08** \[M8\] Horizon = eye level: dragging the horizon (or editing eye height) raises / lowers the eye, keeping the camera's horizontal distance to the origin, its orientation and focal length (ADR-0005). VP-V moves with the horizon in 3pt.  
- **PS-09** \[M8\] Optional scale lock during VP-L / VP-R / VP-V drags: the eye height is re-derived so a 1 u vertical edge at the anchor keeps its paper length (OD-11, default off).  
- **PS-10** \[M8\] Optional "pin selection": during perspective drags the selected object's front-bottom corner stays fixed on paper instead of the world origin (OD-11, default off).  
- **PS-11** \[M8\] Centre-of-vision handle in 2pt: `verticalX` draggable along the horizon between VP-L and VP-R (PV-1).

### CV — Canvas & viewport

- **CV-01** \[M2\] Infinite canvas, pan, pinch/wheel zoom (0.05×–20×), fit to paper, fit to all.  
- **CV-02** \[M2\] Input router: pointer normalization, gesture detection, pen vs touch distinction.  
- **CV-03** \[M2\] Viewport persisted per document as UI state (not undoable).  
- **CV-04** \[M8\] Quick zoom: one-tap buttons always visible in the top bar — "Fit page" and "Fit page + all VPs" (key `F`).  
- **CV-05** \[M8\] Plan view: an orthographic top view of world X/Y, oriented per OD-12, showing the floor grid, the origin, object footprints (boxes, ground rects; walls as lines), the eye position with its view direction and field-of-view wedge, and the selection. Read-only in M8 except tap-to-select (OD-13). Toggle from the top bar; phone: an inset panel in the inspector's slot, resizable; tablet/desktop: a floating card. Its viewport (pan / zoom) is UI state per document.

### BX — Boxes / cubes

- **BX-01** \[M3\] Box entity per §7.4 with `derive`, `handles`, `applyHandle`, `bounds`.  
- ~~**BX-02** \[M3\] Place by tapping ground (unproject to `z=0`). Tapping above the horizon when no surface is hit shows a hint, places nothing.~~ *Revised v1.5 (2026-09-30), below.*  
- **BX-02** \[M8, revised\] Placement resolves against the first surface **facing the eye** along the tap's ray: top faces of boxes and horizontal rects below eye level → the new object rests on it; undersides of boxes and horizontal rects (incl. ceilings) above eye level → it hangs from it (BX-08); the ground below the horizon; otherwise the working plane if set (PL-01); otherwise a hint. Faces the eye cannot see are never targets.  
- **BX-03** \[M3, revised v1.5\] Select, move on base plane, lift (elevation), resize along L/R/V, cube lock. With cube lock, resizing grows / shrinks about the base centre (the footprint centre stays put, the base stays on its surface).  
- **BX-04** \[M3\] Duplicate (offset by \+1 u along R), delete, multi-select delete.  
- **BX-05** \[M3\] Visible/hidden edges; construction rays.  
- **BX-06** \[M5, extended v1.5\] Stack: place on/move onto a top face snaps `z` to that face; flush-align snapping to neighbours. A hanging box (BX-08) keeps hanging when moved, re-attaching under the underside beneath the finger.  
- **BX-07** \[M5\] Painter's ordering across boxes (§9).

- **BX-08** \[M8\] Hanging: a box whose top touches the underside of a box or horizontal rect is hanging; placement above eye level hangs objects (BX-02); moving keeps them attached.

### RC — Rectangles

- **RC-01** \[M5\] Rect entity per §7.5 on ground / wallL / wallR planes; place, move, resize.  
- **RC-02** \[M8\] Ceiling preset: a `ground`-plane rect placed at a chosen height (default OD-14), seen from below; no schema change.

### PL — Working plane

- **PL-01** \[M8\] Optional working plane `z = h` (UI state per document): shown as a faint band / grid when active; taps that hit no surface land on it (BX-02); set from the Shapes submenu or the Scene panel. `h` must differ from the eye height by at least 0.05 u (a plane at eye level is seen edge-on as the horizon and cannot be tapped); above the eye it catches taps above the horizon, below the eye taps below it.

### UI — Usability (from the v1.5 review)

- **UI-01** \[M8\] Shapes submenu on the bottom toolbar (one button → Box, Rect planes, future shapes); adding a shape kind adds a menu entry via the entity registry (§8.4), no toolbar change.  
- **UI-02** \[M8\] Contextual palettes never cover the canvas needlessly: the Sketch palette is a single collapsible row (tool · colour · width · snap), collapsed to a chip by default on phones, and hides while a stroke is being drawn; the same rule for other tool palettes.  
- **UI-03** \[M8\] Distinct lift handle: a vertical double-arrow glyph (family V colour), not a circle like the H resize handle.  
- **UI-04** \[M8\] Multi-select on touch: long-press menu "Add to selection" and a Select-mode toggle "Multi"; marquee stays for mouse / pen.  
- **UI-05** \[M8\] Origin marker: the anchor is drawn as a 3D axis marker — three 1 u family-coloured arrows along +X (→VP-R), +Y (→VP-L), +Z (up), exact by PS-T1; in Construction, optionally extended dashed to the VPs.  
- **UI-06** \[M8\] Floor grid: a 1 u grid on `z = 0` centred on the origin (display toggle, §10.7). Adjustable spacing and wall grids stay in B-04.  
- **UI-07** \[M8\] Cone of vision: a 60° circle around the centre of vision (display toggle).  
- **UI-08** \[M8\] Live readouts in the Perspective mini bar while dragging: eye height (u) and origin distance (u).  
- **UI-09** \[M8\] The anchor's UI label is "Ground point" (OD-9) with a one-line tooltip; the glossary term stays "Anchor".

### LY — Layers

- **LY-01** \[M3\] Default layers: "Objects" (objects), "Sketch" (sketch).  
- **LY-02** \[M5\] Layers panel: add, rename, reorder, visibility, lock, opacity; entity list per layer with select-on-tap.

### DOC — Document, history, persistence

- **DOC-01** \[M4\] Commands \+ undo/redo per §8.5, from the first mutation in M3 (history scaffold in M3, UI in M4 at latest).  
- **DOC-02** \[M4\] Autosave to IndexedDB per §7.9; gallery lists saved scenes with thumbnails.  
- **DOC-03** \[M4\] JSON export/import (Capacitor Filesystem \+ Share on Android; download/upload on web).  
- **DOC-04** \[M4\] Schema versioning, Zod validation, migration framework with fixture tests.  
- **DOC-05** \[M4\] Manual "Backup all" → single JSON of all scenes to device Documents folder.

### EXP — Export

- **EXP-01** \[M4\] PNG export of the paper area at 1×/2×/4×, respecting current display mode.  
- **EXP-02** \[M4\] SVG export from the RenderModel (exact vectors), respecting display mode.

### SK — Sketching

- **SK-01** \[M6\] Stroke entity per §7.6; pencil, pen, marker; colour, width, opacity.  
- **SK-02** \[M6\] Pressure from pen input; coalesced pointer events for smooth lines.  
- **SK-03** \[M6\] Eraser (stroke-level).  
- **SK-04** \[M6\] Perspective snap modes: **Off**, **Soft** (after stroke ends, if its best-fit line is within 6° of a family through its start point, it is straightened toward that VP), **Locked** (while drawing, the stroke is constrained to the line from start point to the chosen/nearest VP; VP-V at infinity → vertical).  
- **SK-05** \[M6\] "Guides" display preset as the backdrop; sketch layer above objects.  
- **SK-06** \[M6\] Warning when changing PS in a document containing strokes (strokes stay on the picture plane).

### LX — Learning (placeholder; `PARKED` until M7 is scoped)

- **LX-01** \[M7\] Exercises defined as data: a starting document \+ locked PS \+ goal checks evaluated against the document. Detailed requirements to be written when M7 starts.

---

## 12\. Non-functional requirements

### Accuracy

- **NFR-A-01** All perspective invariants in §6.6 pass in CI with ≥ 1,000 random cases each.  
- **NFR-A-02** Stored values are never rounded. Display rounding only.  
- **NFR-A-03** A document saved and reopened renders identically (PS-T6).  
- **NFR-A-04** Viewport changes never mutate document or PS.

### Performance (on the developer's Android device; baseline recorded in M0)

- **NFR-P-01** 60 fps while dragging a VP with 100 boxes; ≥ 45 fps with 300\.  
- **NFR-P-02** Stroke input latency (pen down → ink visible) ≤ 1 frame beyond platform baseline; smooth with 5,000 strokes present (strokes pre-rendered, cached layer).  
- **NFR-P-03** Cold start to editor ≤ 2 s.

### Reliability

- **NFR-R-01** No data loss on app kill: autosave \+ save on pause.  
- **NFR-R-02** Invalid/corrupt files never overwrite existing data.  
- **NFR-R-03** Unknown entity kinds preserved (§7.7).

### Platform

- **NFR-X-01** Works fully offline.  
- **NFR-X-02** Android via Capacitor; web build runs in current Chrome/Edge/Safari/Firefox.  
- **NFR-X-03** Portrait and landscape; phone and tablet.

### Maintainability

- **NFR-M-01** TypeScript `strict: true`, no `any` in `core/`.  
- **NFR-M-02** Dependency rules (§8.2) enforced in lint.  
- **NFR-M-03** `core/` test coverage ≥ 90% lines.  
- **NFR-M-04** No new runtime dependency without an ADR.

---

## 13\. Tech stack

| Technology | Role |
| :---- | :---- |
| **TypeScript** (strict) | All code. Powers the perspective math, document/entity model, stroke model, and app logic. Pinned to 6.0.x: typescript-eslint (needed for §8.2 lint) does not support TypeScript 7 yet. |
| **React** | App shell and UI: toolbar, inspector, layers, gallery, settings, display popover. |
| **Konva \+ react-konva** | Interactive 2D canvas rendering of the RenderModel: guides, objects, sketches, handles. |
| **Vite** | Dev server and production build. |
| **Zustand \+ Immer** | `documentStore` (immutable document \+ patch-based undo/redo) and `uiStore`. |
| **Zod** | Runtime validation of loaded/imported documents. |
| **idb** | Thin IndexedDB wrapper for scene storage and thumbnails. |
| **IndexedDB / LocalStorage** | Scenes and thumbnails in IndexedDB; tiny preferences in LocalStorage. |
| **SVG / PNG export** | SVG serialized from the RenderModel; PNG from the Konva stage. |
| **Capacitor (Android)** | Native Android packaging; plugins: Filesystem, Share, Haptics, App (lifecycle). |
| **Obtainium** | Installs and updates the signed APK from GitHub Releases, no Play Store. |
| **PWA** | Optional, low priority (backlog B-10). Not required for Android. |
| **Vitest \+ fast-check** | Unit and property-based tests (geometry invariants). |
| **eslint-plugin-boundaries** | Enforces module dependency rules. |
| **CSS Modules \+ CSS variables** | Styling and theming. No CSS framework. |
| **Lucide icons** | Single outline icon set. |
| **perfect-freehand** *(candidate, M6)* | Pressure-sensitive stroke outlines; adopted only via ADR after the M6 spike. |

Versions: latest stable at project start, pinned via lockfile. Upgrades are deliberate, one at a time.

---

## 14\. Build & release (Android via Obtainium)

- App id: `com.perspectivestudio.app` (kept from the first install, so Obtainium updates in place).  
- Release APK signed with a single long-lived keystore stored **outside** the repo (backed up): the developer's debug keystore, shared with wp_studio, held in the GitHub repository secret `DEBUG_KEYSTORE_BASE64`. Never change the key — Obtainium/Android updates require the same signature. CI refuses to publish an APK signed with any other key.  
- `versionName` \= semver from `package.json` plus `-build.<run>`; `versionCode` \= the CI run number (monotonic). Each milestone release bumps the minor version (M0 \= 0.2.0, M1 \= 0.3.0, …).  
- Release: every push to `main` runs `.github/workflows/build-apk.yml` → lint, typecheck, tests → build web → `cap sync android` → Gradle `assembleRelease` → GitHub Release `v<versionName>` with `perspective_studio.apk` attached. (Replaces the local `npm run release` / `gh` flow: the developer delivers by pushing to `main`.) `npm run android` builds and syncs locally.  
- Obtainium tracks the (private) GitHub repo's releases using a GitHub personal access token configured in Obtainium.  
- Debug builds use a different app id suffix (`.dev`) so they install alongside the release build.

---

## 15\. Testing strategy

| Level | Scope | Tooling |
| :---- | :---- | :---- |
| Property tests | §6.6 invariants over random valid PS \+ entities | Vitest \+ fast-check |
| Unit | math, solver, clamp, migrations, commands, snapping, each entity kind's derive/handles | Vitest |
| Golden | Fixed documents → SVG export snapshot (detects any geometry regression) | Vitest snapshot |
| Integration | Tool state machines driven by synthetic pointer sequences against stores | Vitest |
| Device | Manual checklist per milestone on the Android device (stylus, gestures, fps) | `docs/checklists/Mx.md` |

A milestone is **done** only when its acceptance checklist (§16) passes and all tests are green.

---

## 16\. Milestones & acceptance

Each milestone is small, demoable, and closes with a tagged release.

### M0 — Foundation & risk spike

- Repo, Vite \+ React \+ TS strict, lint boundaries, Vitest, folder layout (§8.1), `CLAUDE.md`, `docs/decisions/ADR-0001-world-model.md`.  
- Capacitor Android build, signed release, installed through Obtainium.  
- **Spike:** Konva stage in the Android WebView — measure fps with 300 synthetic polylines and pen input latency/pressure/coalesced events. Record results in `docs/decisions/ADR-0002-rendering-baseline.md`.  
- ✅ Accept: app installs/updates via Obtainium; spike numbers recorded.  
- **Status:** done (2026-09-30). Device baseline in ADR-0002: 75 fps pan and re-project (300 lines), touch event → frame ≤ 16 ms; no stylus measured (→ M6).

### M1 — Perspective core (no UI)

- `core/math`, `core/perspective` per §6. All §6.6 invariants.  
- ✅ Accept: property tests pass (≥ 1,000 cases each); coverage ≥ 90%.  
- **Status (0.3.0):** done. `core/math` (vectors, 3×3, homogeneous lines, tolerances) and `core/perspective` (solver, validity + clamp, project / unproject / near-plane clipping, VP re-derivation, §6.4 horizon and mode edits); PS-T1…PS-T6 at 1,000 cases each, core line coverage 100%, enforced in CI (`npm run test:coverage`). PS-T6 is checked at projection level until the render model exists (M3).

### M2 — Canvas & perspective setup

- PS-02…06, CV-01…03. Perspective tool, off-screen indicators, invalid-region shading, 2pt/3pt.  
- A hard-coded test box renders (read-only) to prove live re-projection.  
- ✅ Accept: drag every control; box responds live at 60 fps; clamping works; zoom never changes geometry.  
- **Status:** built in 0.4.0 (PS-02…06, CV-01…03); the test box was replaced by real boxes in 0.8.0. Device checklist `docs/checklists/M2.md`.

### M3 — Boxes

- BX-01…05, LY-01, PS-07, command/history scaffold.  
- ✅ Accept: place 6 cubes, move, lift, resize, cube-lock, duplicate, delete; move VP-L/VP-R/VP-V/horizon → all correct; construction/clean toggles.  
- **Status (0.8.0):** built; device checklist `docs/checklists/M3-M6.md`.

### M4 — Document

- DOC-01…05, EXP-01…02, gallery.  
- ✅ Accept: kill the app mid-edit → reopen, nothing lost; export/import JSON round-trips identically; PNG & SVG match the screen; undo/redo every M3 action.  
- **Status (0.8.0):** built; device checklist `docs/checklists/M3-M6.md`.

### M5 — Scenes: stacking, rects, layers

- BX-06, BX-07, RC-01, LY-02.  
- ✅ Accept: stack 3 cubes and a tall box; place ground/wall rects; layer visibility/lock/reorder; all exact under VP changes.  
- **Status (0.8.0):** built; device checklist `docs/checklists/M3-M6.md`.

### M6 — Sketch

- SK-01…06. Spike for stroke rendering library → ADR.  
- ✅ Accept: pen draws with pressure, touch pans; snap Off/Soft/Locked behave per SK-04; 5,000 strokes smooth; sketch over the "Guides" backdrop.  
- **Status (0.8.0):** built; stroke renderer decided in ADR-0004 (no stylus available: pressure simulated for finger input). Device checklist `docs/checklists/M3-M6.md`; NFR-P-02 still to be measured.

### M7 — Learning (to be specified)

- Write LX requirements first (this document), then build.

### M8 — Scene & viewing revision (from the v1.5 review)

- PS-08…11, CV-04, CV-05, BX-02 (revised), BX-03 (revised), BX-06 (extended), BX-08, RC-02, PL-01, UI-01…09; OD-3 re-tuned; ADR-0005.
- ✅ Accept: dragging the horizon slides it along a tall box (eye level) with boxes keeping their size; a table sits below, a hanging lamp above and a tower across the horizon, all placed directly; the Shapes submenu places box and rects; Fit page / Fit page + VPs are one tap; the sketch palette collapses and never covers the drawing while sketching; the plan view shows the eye, its view wedge and footprints and follows every change; PS-T1…T6 still pass.

### 16.1 As built in 0.8.0 (M3–M6 in one delivery)

Choices made where this document leaves room, and known deviations:

- **Boxes (BX-01…07).** Resize handles at the centre of the visible face of each family (W along R, D along L, H along V); the opposite face stays put; Cube lock scales all three. The lift handle sits on the vertical edge nearest the camera. Body drag moves the box on its base plane with 0.1 u grid snap (OD-6, Settings); a box resting on the ground or on a top face re-seats onto the top face under the finger (stacking, BX-06) and snaps flush to a neighbour within 0.12 u. The Box tool places a 1 u cube centred on the tap, on the highest top face under it or on the ground. Painter's order by camera depth of the centre within each layer (BX-07).
- **Rects (RC-01).** A Rect tool with a plane chooser (Ground / Wall L / Wall R); 1 × 1 u when placed; two resize handles (the +u and +v edges); moves on its base plane.
- **Selection.** Tap selects; Shift+tap adds (desktop); mouse / pen drag on empty canvas draws a marquee (desktop, §10.4). On a phone, multi-select comes from the marquee only with a pen/mouse; deleting several is done from the inspector. Locked entities and entities on hidden or locked layers are not pickable.
- **Long press (§10.3)** on an entity: Duplicate, Stack on top (a copy on its top face, boxes), Bring forward, Delete.
- **Commands / history (DOC-01).** Immer patches, 200 entries, one entry per drag; undo / redo buttons, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, two-finger tap = undo, three-finger tap = redo.
- **Display (§10.7).** Presets Construction (guides, rays for the selection, hidden edges), Clean (edges and face fills), Guides (horizon, VPs, VP guide-line fans, no objects — the sketching backdrop, SK-05); fine toggles: rays none / selected / all, hidden edges, face fills, VP guide lines, paper frame, guides, objects. Not built: ground grid (see B-04) and world-unit labels.
- **Rendering (§9).** Konva layers: guides (paper, horizon, VPs, anchor, fans), one document layer that draws the document's layers in their order (so a reordered sketch layer can sit below objects, LY-02), and one overlay layer (live stroke, marquee, handles). Line weights in screen px; stroke widths in pp. The sketch layer is not yet cached as a bitmap (NFR-P-02).
- **Persistence (DOC-02…05).** idb stores `documents` and `thumbnails`; autosave 1 s after the last change, on app pause and when leaving the editor; the gallery shows thumbnails (320 px PNG). Import accepts one document or a backup; every file is fully validated before anything is stored; an imported id that already exists gets a new id. Backup all writes `Documents/PerspectiveStudio/perspective_studio_backup_<date>.json`. Viewport and display prefs are saved per document in LocalStorage.
- **Export (EXP-01…02).** The paper area in the current display mode, without selection or handles. SVG is serialized from the RenderModel; PNG rasterizes that SVG at 1× / 2× / 4× (instead of the Konva stage) so PNG and SVG match exactly. On Android the file goes to the share sheet.
- **Layers (LY-01…02).** Default "Objects" and "Sketch"; add objects or sketch layers; rename (double-tap), reorder, visibility, lock, opacity, delete (with its entities; the last layer of a role cannot be deleted); tap a layer name to make it the active layer for new entities of its role; entity list with tap-to-select; move an entity to another layer from the inspector.
- **Sketch (SK-01…06).** Pencil / pen / marker presets, 6 colours, width in screen px (stored in pp). Pressure from a pen; constant pressure (finger) is simulated (ADR-0004). Coalesced pointer events are fed one by one. Eraser removes whole strokes it sweeps (SK-03). Snap Off / Soft (6°, OD-7) / Locked with Auto / L / R / V; Auto picks the family after 12 screen px. Once a pen has been used, fingers pan in the Sketch tool (palm rejection). SK-06: a one-time note per opened document when the perspective is dragged in a document with strokes.
- **Settings (§10.8).** Theme light / dark / system; grid snap; after placing a box: back to Select (OD-5) or stay; toolbar left / centre / right. Paper size stays 1200 × 800 (OD-2), no UI.
- **Screens.** Gallery → editor → back (top-left arrow or Android back, which first closes panels). A selected entity entirely behind the camera shows a note (§6.5).
- **Styling.** One global stylesheet with CSS variables (light / dark) instead of CSS Modules (§13) — a deliberate simplification for a small UI; icons from Lucide.
- **Launcher icon** from the developer's logo (`docs/brand/`).

### 16.2 Conflict review (v1.5)

| Conflict | Resolution |
| :-- | :-- |
| §6.4 "horizon drag preserves VP-V" vs PS-08 (VP-V moves with the horizon; eye height changes) | §6.4 bullet REMOVED and replaced; ADR-0005 supersedes that part of §6.4. PV-2 can no longer be hit by a horizon drag (d is unchanged). |
| PS-07 "eye height editable" vs PS-08 "horizon drag changes eye height" | One meaning: eye height ⇔ horizon. Editing eye height moves the horizon; distance changes only by dragging the anchor. |
| PV-4 / PV-5 vs lowering the horizon | Lowering the horizon toward the anchor now lowers the eye toward the floor; it stops at the minimum eye height (PV-5) — no more shrinking to a point. |
| OD-3 eye height 2.2 u (tuned for cube size) vs "horizon is eye level" | OD-3 revised: eye height 1.6 u (standing adult); the default cube size is reached through the anchor position instead. |
| BX-02 "above the horizon places nothing" vs objects above eye level | BX-02 revised: visible-face placement, hanging (BX-08), working plane (PL-01). |
| §10.4 separate Box / Rect tools vs Shapes submenu | Replaced by one Shapes tool (UI-01); the entity registry (§8.4) feeds the menu. |
| §10.1 "≤ 3 floating UI clusters" vs plan view | On phones the plan view takes the inspector's slot; on wide screens it is a floating card that replaces the inspector while open. |
| §2.2 non-goal "3D camera orbit UI" vs plan view | Plan view is an orthographic 2D top view of world X/Y (no rotation, no 3D rendering); it is derived in core like the picture (new `core/derive/plan`), so §8.2 rules hold. |
| §3 "do not rename" glossary vs renaming Anchor | Glossary term stays "Anchor"; only the UI label changes (UI-09, OD-9). |
| B-04 (grids, PARKED) vs floor grid | UI-06 promotes only a fixed 1 u floor grid; adjustable spacing and wall grids stay PARKED in B-04. |
| PS-09 scale lock / PS-10 pin selection vs PS-08 | They apply to VP drags only; the horizon drag is always PS-08. Both default off (OD-11). |
| "All projection goes through core/perspective" vs plan view | The plan view uses an orthographic mapping, not a projection of the picture; it lives in core and receives no camera maths in UI. |
| Top bar "auto-hides while drawing" (§10.2) vs CV-04 quick-zoom buttons | Quick-zoom buttons auto-hide with the top bar during a stroke, like everything else. |
| Working plane at eye height (first draft of OD-14) vs PL-01 | A plane at eye level projects onto the horizon (edge-on) and can never be hit; PL-01 now requires `h ≠ eyeHeight` (≥ 0.05 u apart), default 2.4 u. When the eye moves (PS-08) past `h`, the plane simply switches from catching taps above the horizon to below it. |

---

## 17\. Change management — preventing drift and bloat

The app will pivot. These rules keep the structure stable while features change.

### 17.1 Repository docs

CLAUDE.md                       \# operating rules for Claude Code (seed in §18)

docs/REQUIREMENTS.md            \# this file

docs/decisions/ADR-NNNN-\*.md    \# one decision per file: context, decision, consequences

docs/checklists/Mx.md           \# device acceptance checklists

docs/CHANGELOG.md               \# user-visible changes per release

### 17.2 Requirement lifecycle

- Every requirement has an ID and a status: `ACTIVE`, `PARKED` (kept for later, no code), `REMOVED` (kept in doc, struck through, with the reason and date).  
- IDs are **never reused or renumbered**.  
- New feature ⇒ add requirement(s) with new IDs **before** code.  
- Removed feature ⇒ mark `REMOVED`, delete its code entirely (no commented-out code, no dead flags), keep data compatibility via §7.7 or a migration.

### 17.3 Decisions

- Any change to: the world model, coordinate spaces, perspective math, dependency rules, persistence format, or the tech stack ⇒ ADR first.  
- An ADR may supersede an earlier ADR; mark the old one `Superseded by ADR-NNNN`.

### 17.4 Feature flags

- `src/features.ts`: `const features = { sketch: false, rects: false, … } as const`.  
- Flags exist only for work-in-progress on the main branch. Once a feature is accepted, its flag is deleted. No permanent flags.

### 17.5 Anti-bloat rules

- No abstraction without two real uses (the entity-kind and tool registries are the pre-approved exceptions).  
- No "reserved" fields in schemas; add them by migration when needed.  
- One way to do each thing: one projection function, one command path, one input router, one theme source.  
- Pivot test: before a pivot, update §1–§2 (goals/non-goals) first; if the pivot contradicts a principle in §1.1, write an ADR.

---

## 18\. `CLAUDE.md` seed (create in M0, keep current)

\# CLAUDE.md — PERSPECTIVE\_STUDIO

Read first: docs/REQUIREMENTS.md, docs/decisions/\*.

\#\# Rules

\- Work only on the current milestone. Implement only ACTIVE requirement IDs. Cite IDs in commits.

\- If a requirement is ambiguous or missing, stop and ask. Do not invent features, fields, or UI.

\- Objects are 3D world geometry; the screen is a projection (ADR-0001). Never store projected 2D geometry for world entities.

\- All projection/unprojection goes through core/perspective. No math in React or Konva code.

\- core/ imports nothing from React, Konva, DOM, Zustand, Capacitor.

\- Every document change is a command. Drags \= one history entry.

\- New entity kind \= new folder in core/entities \+ registry line \+ tests. Do not edit the pipeline to add a shape.

\- Schema change \= schemaVersion bump \+ migration \+ fixture test.

\- No new dependency without an ADR.

\- Geometry changes require passing property tests (§6.6). Never loosen a tolerance to make a test pass without an ADR.

\- Update docs/REQUIREMENTS.md in the same change when behaviour changes.

\- Prefer small, surgical diffs. Don't reformat or refactor unrelated code.

\- Use glossary terms exactly (VP-L, VP-R, VP-V, family L/R/V, picture plane, world, anchor).

\#\# Commands

\- dev: npm run dev · test: npm test · lint: npm run lint · android: npm run android · release: npm run release

---

## 19\. Open decisions (defaults apply until the developer says otherwise)

| \# | Question | Default |
| :---- | :---- | :---- |
| OD-1 | Primary device (phone vs tablet), stylus model | Recorded in M0; UX tuned for tablet landscape, usable on phone portrait. |
| OD-2 | Default paper size | 1200 × 800 pp. |
| OD-3 | Default 3pt system | horizonY 280, VP-L x −700, VP-R x 1900, VP-V (600, 3200), eyeHeight **1.6 u** (standing adult; revised v1.5 from 2.2 u, which was tuned only for cube size), anchor moved up toward the horizon (≈ (600, 515), tuned in M8) so a 1 u cube is still ≈ 15% of the paper width. |
| OD-4 | Family colours | L blue, R orange, V purple (tuned in M2). |
| OD-5 | After placing a box, stay in Box tool or return to Select | Return to Select (setting). |
| OD-6 | Object grid snap step | 0.1 u, on. |
| OD-7 | Soft-snap angle threshold | 6°. |
| OD-8 | One-finger drag on empty canvas in Select | Does nothing (§10.3: pan is two-finger). |
| OD-9 | UI label for the anchor | "Ground point". |
| OD-10 | Plan view on phones | Inset panel in the inspector's slot, about 40% of the screen height, resizable. |
| OD-11 | Scale lock (PS-09) and pin selection (PS-10) | Both available, both off by default. |
| OD-12 | Plan view orientation | Eye at the bottom, looking up the screen (view direction up), so left/right match the picture. |
| OD-13 | Plan view interaction in M8 | Read-only plus tap-to-select; moving objects in the plan view is later. |
| OD-14 | Default ceiling height (RC-02) / working-plane height (PL-01) | 2.7 u / 2.4 u (above the default 1.6 u eye, so it catches taps above the horizon). |

---

## 20\. Backlog (PARKED — not to be built until promoted to a milestone)

| ID | Idea |
| :---- | :---- |
| B-01 | Box yaw (rotation about vertical) → per-object VPs on the horizon. |
| B-02 | 1-point perspective preset. |
| B-03 | Cylinders, cones, wedges/ramps, stairs (as entity kinds). |
| B-04 | Ground/wall perspective grids with adjustable spacing. (A fixed 1 u floor grid is promoted as UI-06, v1.5.) |
| B-05 | Strokes projected onto a world plane (sketch "on" a wall). |
| B-06 | Reference image import on its own layer. |
| B-07 | Exact inter-object hidden-line removal. |
| B-08 | Free-drawing → perspective-mismatch detection and correction (compare stroke directions to families). |
| B-09 | Exercise library and progression (Horizon → 2pt cube → vertical convergence → 3pt cube → multiple → heights → looking up/down → extreme → free composition). |
| B-10 | PWA install for desktop. |
| B-11 | Groups / compound objects (e.g. a building of boxes). |

