> **Document:** OBJECTS requirements · **Version:** v1.3 (0.24.0, 2026-10-03) · **Location:** `docs/modules/objects/REQUIREMENTS.md` · **Part of:** CREATIVE (`docs/CREATIVE.md`)
>
> **Revisions:** v1.3 (0.24.0, 2026-10-03) — Phase 1a built (M1–M5): exact block and 2D cores, thirteen question types with intentional distractors, validation, Question Bank with permanent ids and versions, export (§A.13). · v1.2 (0.23.0, 2026-10-03) — M0 built: block viewport, isometric renderer, the module on the home screen (§A.12). · v1.1 (2026-10-03) — Design review decisions (Part A): blocks first (general solids in 1b, construction in 1c); 2D figures and their transformations in OBJECTS; question figures are isometric line drawings; exact correctness and option sameness; one gesture per meaning; difficulty and Question DNA merged; what an option is; milestones re-cut. · v1.0 (2026-10-03) — Phase 1 Product & Engineering Specification, as written by the developer (sections 0–93 below, unchanged except for "v1.1" notes).

# OBJECTS Module --- Phase 1 Product & Engineering Specification

> **Parent application:** CREATIVE\
> **Module:** OBJECTS\
> **Module id:** `objects`\
> **Phase:** 1 --- Studio / Question Authoring / Question Bank\
> **Status:** Implementation specification\
> **Primary target:** Android via the existing CREATIVE Capacitor
> application\
> **Primary user:** Educator / mentor / question designer\
> **Authoring domain:** 2D figures, block objects and (later) general 3D
> objects for visualisation and spatial-reasoning question authoring\
> **Document version:** v1.3\
> **Date:** 2026-10-03

------------------------------------------------------------------------

## 0. Purpose of this document

This document is the implementation specification for the **OBJECTS**
module inside CREATIVE.

It is deliberately written in the style and level of detail of the
existing CUBE requirements, while adapting the product to a general 3D
object-authoring domain.

The CUBE requirements were used for:

-   authoring workflow;
-   Studio → Question workflow;
-   Question Bank behaviour;
-   validation philosophy;
-   semantic data model;
-   versioning;
-   offline persistence;
-   touch-first interaction;
-   undo/redo;
-   autosave;
-   manual author override;
-   testing and definition-of-done structure.

The CUBE **content model is not reused**. OBJECTS is not a larger CUBE
and must not inherit cube-specific assumptions such as six faces, cube
nets, cube topology, or cube-specific distractor rules.

The main CREATIVE application document establishes that modules are
isolated plugins, use the existing application infrastructure, own their
data, and have their own requirements document. OBJECTS follows that
architecture.

------------------------------------------------------------------------

# A. v1.1 decisions (authoritative)

> v1.1 records the developer's decisions after the design review of
> v1.0 (2026-10-03). **Where this part and the v1.0 sections below
> differ, this part wins.** Sections affected below carry a
> "**v1.1:**" note pointing here.

## A.1 Decisions

| # | Decision | Effect |
| :-- | :-- | :-- |
| OB-D1 | **Blocks first.** Phase 1a builds objects from unit cubes (blocks) on an integer grid. | General solids (§9.1) move to Phase 1b, booleans and profile extrusion (§9.2, §9.3, §24, §25) to Phase 1c. |
| OB-D2 | **2D is part of OBJECTS.** Flat figures and their transformations are a second object kind in the same module. | New §A.4 (2D figures) and the 2D question families in §A.5. |
| OB-D3 | **Question figures are isometric line drawings.** | New §A.6 (test style); replaces the shaded presentation of §56 for question figures. |
| OB-D4 | Correctness, sameness of options and distractors are **exact** (computed from the model), never estimated. | Possible because of OB-D1; §64–§66 are implemented exactly for blocks and 2D figures. |
| OB-D5 | One gesture per meaning (resolves v1.0 conflicts). | §A.7 replaces the gesture rules of §18, §20 and §53. |
| OB-D6 | Difficulty (§38) and Question DNA (§41) are **one** record, mostly computed. | §A.8. |

## A.2 Phasing

``` text
Phase 1a  BLOCKS + 2D FIGURES     every question family below, end to end
Phase 1b  PRIMITIVE SOLIDS        cuboid, cylinder, cone, prism, pyramid,
                                  sphere, tube, frustum — placed and
                                  attached, no booleans
Phase 1c  CONSTRUCTION            add / subtract / intersect, profile →
                                  extrude (library chosen in an M0 spike,
                                  recorded in an ADR)
Phase 2   TEST                    placeholder (unchanged)
Phase 3   ANALYSIS                placeholder (unchanged)
```

The model is general from the start (an object is a list of parts; a
block assembly is one kind of part), so 1b and 1c add part kinds without
a schema break.

## A.3 Block objects (Phase 1a)

**Model.** A block object is a set of unit cells `(x, y, z)` (integers,
+X right, +Y up, +Z towards the viewer, right-handed — §13). Each block
has a stable id (`b-01` …) and may carry a colour or a mark on a face
for tracking questions. Limits: up to 6 × 6 × 6 cells, up to 30 blocks
(kept small so drawings stay readable on a phone).

**Building.** Tap a face of a block (or the floor grid) to add a block
there; tap a block with the Remove tool to take it away; drag to add a
row. Every new block is attached face-to-face by construction, so the
general snapping of §21 is not needed in 1a. Undo / redo, autosave as
§51–§52.

**Validity.** An object is valid when its blocks are face-connected
(one piece) and within the limits. "Floating" blocks are reported
("⚠ Block b-07 is not attached").

**Exact operations** (pure TypeScript, tested):

- the 24 rotations of the cube group, and mirror images (48 with
  reflections); rotations by 90° about X, Y, Z compose to any of them;
- **canonical form**: translate to the origin, take the smallest
  encoding over the 24 rotations → two objects are "the same object"
  exactly when their canonical forms match; with mirror allowed, over
  all 48;
- **views**: front, back, top, bottom, left, right as grid silhouettes
  (which cells of the view plane are covered), with depth for
  hidden-line drawings;
- **counts**: blocks, visible blocks from a view, hidden blocks;
- **cross-section**: the cells cut by an axis-aligned plane.

## A.4 2D figures (Phase 1a, OB-D2)

**Model.** A 2D figure is drawn on a square grid (default 6 × 6,
optionally 8 × 8): filled cells (a polyomino-like shape), plus optional
line segments between grid points, dots and small marks (a circle, a
triangle, an arrow) placed in cells — the asymmetric details that make
rotation and reflection questions meaningful. All coordinates are grid
integers; there is no free-hand drawing in 1a.

**Exact operations:** rotate 90° / 180° / 270°, reflect about the
vertical, horizontal and both diagonal axes (the 8 symmetries of the
square), translate; canonical form for sameness (rotation only, or
rotation + reflection, as the question says); fold a square sheet along
a middle or diagonal line and punch holes → unfolded hole pattern.

**Editor:** the same Studio step 1 with a flat grid (Konva or the same
renderer drawing 2D); tap cells to fill, tap a cell with a mark tool to
place a mark, drag between grid points for a line.

## A.5 Question families in Phase 1a

Each family has fixed stem wordings (editable) and an exact answer.

**3D (blocks)**

| Family | Stem example | Options are | Distractors (exact) |
| :-- | :-- | :-- | :-- |
| Rotate (mental rotation) | "Which object is the same as the one shown, only turned?" | 5 objects drawn isometrically | mirror image; one block moved; a different object with the same block count; the same object turned with one block added / removed |
| Rotate by a given turn | "The object is turned 90° about the vertical axis. Which shows the result?" | 5 drawings | wrong axis; wrong direction; 180° instead of 90°; mirror |
| Views (3D → 2D) | "Which is the view from the front / top / right?" | 5 grid views | view from another side; mirrored view; one cell wrong; a hidden block shown |
| Reconstruct (2D → 3D) | "Which object has these front, top and right views?" | 5 drawings | matches two views only; mirror; one block moved |
| Count / hidden blocks | "How many blocks are there?" / "How many cannot be seen?" | 5 numbers | ± 1, ± 2, visible count instead of total |
| Cross-section | "Which shape is the cut along the marked plane?" | 5 grid shapes | neighbouring plane; mirrored; rotated |
| Track | "The marked face is turned … where is the mark now?" | 5 drawings | mark on the opposite face; mark rotated; mirror |
| Assemble | "Which two pieces make this object?" | 5 pairs | a piece mirrored; a piece one block too big |

**2D (figures)**

| Family | Stem example | Options are | Distractors (exact) |
| :-- | :-- | :-- | :-- |
| Rotate | "Which figure is the shown figure turned 90° clockwise?" | 5 figures | anticlockwise; 180°; reflected; one mark moved |
| Reflect | "Which is the mirror image in the dashed line?" | 5 figures | reflected in the other axis; rotated instead; one cell wrong |
| Same figure | "Which figure is the same as the shown one, only turned?" | 5 figures | reflections (when "turned only") ; one cell / mark changed |
| Fold and punch | "The paper is folded as shown and punched. What does it look like unfolded?" | 5 hole patterns | holes not mirrored across the fold; one fold missed; extra hole |
| Translate / compound | "Turn 90° clockwise, then reflect in the vertical line." | 5 figures | steps in the wrong order; one step missed |

**Phase 1b / 1c** add the general-solid versions (§30) and the RELATE
family (above / below …), which is kept at low priority.

## A.6 Question figures: isometric line drawings (OB-D3)

- **3D figures** are drawn in **isometric projection** (no perspective),
  the same angle and scale for the stem and all five options, so no
  option is told apart by size or angle. Default view from the
  front-right-top; the author may pick another of the 8 isometric
  corners for the stem.
- **Line drawing:** black outlines of visible edges, uniform weight;
  hidden edges left out by default (author switch: dashed); faces
  white; no shading, shadows or lighting (they can give the answer
  away). Coloured faces or marks only where the question needs them
  (tracking).
- **2D figures and views** are drawn on a light grid with black filled
  cells / lines and the same line weight.
- The figures are produced by a **pure renderer from the model** (vector
  paths → SVG; PNG from the SVG), so the preview, the export and the
  Question Bank thumbnails are identical and reproducible. Three.js is
  used only for the interactive authoring viewport (rotate to inspect);
  it never produces question figures.
- **Distinguishable (§64):** two options must have different canonical
  forms under the question's sameness rule **and** different drawings
  (the drawings are compared as vector paths, not pixels). A distractor
  that draws identically to another option is replaced.

## A.7 Gestures (OB-D5, replaces §18, §20 pinch / rotate, §53)

- One finger on empty space: turn the camera (3D) — on the 2D grid:
  nothing (no accidental moves).
- Two fingers: pan and zoom the view. **Pinch never scales an object.**
- Tap: add a block / fill a cell (Build tools) or select (Select tool).
- Turning the whole object in Build: the ⟳ X / Y / Z buttons (90° steps).
- Sizes are integers in 1a; in 1b, part sizes change with handles or
  numbers, never with pinch.

## A.8 Question record: difficulty = DNA (OB-D6)

One `profile` record replaces `difficulty` (§38) and `questionDNA`
(§41). Computed fields: block count, cells in the figure, number of
turns and axes in the transformation, hidden blocks from the stem view,
mirror distractor present, distractor closeness (fewest cells that
differ between the answer and any distractor). Author field: overall
difficulty 1–5 (prefilled from the computed fields, editable).

## A.9 What an option is

An option is **data**, never a free image: an object or figure (a block
set / a 2D figure), or a view of one, or a number — with the drawing
made by the renderer of §A.6. The correct option is computed from the
stem object and the authored transformation; each distractor records the
rule that made it (§35 classes, e.g. `D03 mirror`, `D04 moved block`).
The author may replace an option by editing it in the same editor; the
engine then re-checks that exactly one option is correct.

## A.10 Milestones (replace §76–§81)

| Milestone | Scope | Acceptance |
| :-- | :-- | :-- |
| M0 | Three.js block viewport on the phone (turn, zoom, tap to add / remove); isometric SVG renderer prototype | Smooth on the developer's phone; drawings crisp at option size |
| M1 | Pure core: block and 2D models, symmetries, canonical forms, views, counts, cross-sections, fold-and-punch; property tests | Exact sameness: a turned copy matches, a mirror does not (unless allowed) |
| M2 | Studio step 1: build blocks / draw 2D figures, undo, autosave | A useful object built entirely on the phone |
| M3 | Studio step 2: the Phase 1a families, generated options, exact validation, manual override, preview | Every family produces a valid five-option question |
| M4 | Question Bank (as CUBE): IDs `OBJECTS-Q-######`, versions, search / filters, export JSON / SVG / PNG | Survives restart; edit makes a new version |
| M5 | Device polish (§82) | Device checklist passes |
| 1b / 1c | General solids, then construction (each with its own M0) | Own acceptance per §78–§79 |

## A.11 Integration notes

- Register in `src/suite/modules.ts` with art; CREATIVE.md §4 / §5 rows;
  an ADR for the module (as ADR-0008 for CUBE). No new dependency in 1a
  (Three.js, Konva, SQLite are already in the app); 1c's boolean library
  needs its own ADR.
- Reuse CUBE's Question Bank screens and repository pattern where they
  fit; OBJECTS keeps its own database `objects.db` and its own code.
- Phone layout from the start (lessons from CUBE and SKETCH): the
  viewport takes the object's space with no empty band, nothing against
  the phone's navigation bar, one floating tool bar, properties in a
  small sheet.
- Requirement IDs: `OB-` prefix (decisions `OB-D#`).

## A.12 M0 built (v1.2, release 0.23.0)

What the M0 device spike contains (ADR-0012):
- **Home tile** "Objects" opens the module (Android back returns home).
- **3D viewport** (Three.js, `render/BlockScene.ts`): light grey blocks with
  dark edges on a floor grid. One finger turns the camera, two fingers pan
  and zoom (pinch never changes the object); the view frames the object
  for any screen shape.
- **Building:** with **Add** (cube icon), tap the floor or a block face to
  add a block there; a new block must touch the object face to face ("Add
  next to a block"); limits 6 × 6 × 6 and 30 blocks, with a message when
  reached. With **Remove** (eraser icon), tap a block. **⟳ X / Y / Z** turn
  the whole object a quarter (it stays on the floor). Undo / redo, **Fit**,
  **Clear** (undoable). The status shows the block count and "✓ One piece"
  or "⚠ Not in one piece" (removing can split it).
- **Isometric drawings** (`core/iso.ts`, pure SVG): the object as every
  question will show it — front-right-top corner, black outlines, white
  faces, no shading — at question size, option size and small, updating
  as you build.
- The object is kept on the device as you work (localStorage draft
  `creative.objects.draft.v0`, until the M4 database).
- Core (`core/blocks.ts`, `core/iso.ts`) is unit-tested (limits,
  attachment, one-piece check, quarter turns, four turns = identity,
  drawing faces and bounds).

Device checklist: `docs/modules/objects/checklists/M0.md`.

## A.13 Phase 1a built (v1.3, release 0.24.0)

**Studio · 1 · Build** — 3D / 2D switch; undo / redo (every build and
question change), New object; the draft is saved as you work
(`objects_drafts`, 0.5 s after a change and when the app goes to the
background) and comes back on return.
- *3D blocks*: as M0, plus **Mark** (tint one block for Track; it turns
  with the object). The status says how many blocks the drawing hides.
  Starter object: seven blocks, all visible.
- *2D figure*: 6 × 6 or 8 × 8 grid; **Fill** squares, **Dots**, **Arrows**
  (tap again to turn), **Erase**, Clear. (Free line segments of §A.4 are
  left for later; dots and arrows give the asymmetry turns and mirror
  images need.)

**Studio · 2 · Question** — type chips for the object kind, the type's
settings, the editable wording, the stem figure(s), five options, the
difficulty (computed, the author may set 1–5), the check, and **New
options / Preview / Commit** (when editing: **Commit vN+1** and **Save as
new question**). Each option: number, ✓ on the correct one, its rule, and
↑ ↓ (reorder), ↻ (another wrong option of the same kind), ✎ (edit it in
the same editor: blocks, squares, holes or a number). The correct option
is always computed (OB-D4); there is no "set correct" switch.

| Type (3D) | Settings | Correct | Wrong answers (rule) |
| :-- | :-- | :-- | :-- |
| Same object | — | the object turned (24 turns, not the stem's own drawing) | mirror image (D03, when it differs), one block moved (D04), added (D07), missing (D06) |
| Turn | axis (upright / left–right / front–back), 90° / 180° / 90° back | exact turned cells | other axis, other direction, 180° (D01); mirror (D03); one block moved (D04) |
| View | side (6) | covered squares from that side | other sides (D02), mirrored (D03), turned (D01), one square wrong (D10) |
| From views | — (stem: front, top, right) | any object with those three views | matches two views only (D10), one block moved (D04), mirror (D03) |
| Count | all / hidden blocks | the count | only the visible ones (D06), ±1, ±2, +3 (D06 / D07) |
| Cut | level / front–back / left–right, layer | the cut squares (layer shaded in the stem) | other layers (D11), mirrored (D03), turned (D01), whole view (D10), one square wrong (D11) |
| Track | axis, turn (the marked block) | turned object, mark carried | mark on another block (D08), turned the wrong way (D01) |
| Pieces | — | two pieces (each shown turned) that fill the object | one piece mirrored (D03), a block moved (D04), a block too big / small (D07 / D06) |

| Type (2D) | Settings | Correct | Wrong answers |
| :-- | :-- | :-- | :-- |
| Turn | 90° ↻, 180°, 90° ↺ | exact | other turns (D01), reflections (D03), arrow wrong (D12), one square moved (D04) |
| Mirror | │ — ╲ ╱ line | exact | other lines (D03), turns (D01), arrow wrong (D12), one square moved (D04) |
| Same figure | — | the figure turned (anywhere on the grid) | mirror images (D03), arrow wrong (D12), one square moved (D04) |
| Two steps | first, then (any of the 7) | both steps in order | other order (D01), one step only (D06), wrong line (D03), arrow wrong (D12) |
| Fold & punch | sheet 4 / 6 / 8; folds (½ across, ½ down, diagonal last); tap the folded sheet to punch | every fold opened, holes mirrored | one fold not opened, only the punched holes (D06), wrong line (D03), moved (D04), a hole missing / extra (D06 / D07) |

**Rules the engine enforces** (so a question has exactly one answer and
every option can be read): the object is one piece; for Same object,
Turn, From views and Track every block is visible in the drawing (also
after the chosen turn); Count needs every block resting on another or on
the floor; Pieces needs at least four blocks; folds must be possible and
holes inside the folded sheet. Validation (§64) also checks exactly five
options, exactly one correct, no two options the same answer or the same
drawing (shading included), no option with hidden blocks, and a wording.
"⚠ Question needs attention" lists the reasons.

**Question record** (`creative.objects.question.v1`, checked when read):
source (blocks, marked block, figure, fold), type and settings, wording,
five options (each the item as data, its rule and a note), the correct
index, the seed (same input + seed → the same question), the profile
(size, hidden blocks, steps, mirror distractor, difficulty and whether
the author set it — §A.8) and the explanation.

**Question Bank** — SQLite `objects` on Android (IndexedDB in a browser):
`objects_questions`, `objects_question_versions`, `objects_drafts`,
`objects_meta` (schema version 1, the id counter). Ids
`OBJECTS-Q-000001`… are never reused; an edit commits a new version and
the earlier ones stay. The list (newest first) has search (id, type,
wording) and filters (3D / 2D, type); a row opens the author sheet, the
profile, the versions (tap one to see it) and **Edit** (latest version),
**Duplicate** (new id), **Variant** (the same object and settings with
new options, opened in Studio to review), **PNG / SVG / JSON**.

**Preview / export** — the sheet from the committed asset: Student (no
answer) or Author (✓, rules, explanation); PNG, SVG and the canonical JSON
through the share sheet.

**Test** and **Analysis** show their Phase 2 / Phase 3 placeholders.
Android back: a dialog → Question → Build → other pages → home.

Not in 1a (kept for later, as §A.2): RELATE questions, dashed hidden
edges, free 2D line segments, general solids (1b) and construction (1c).

Device checklist: `docs/modules/objects/checklists/P1a.md`.

------------------------------------------------------------------------

# 1. Executive Summary

OBJECTS is a specialized **3D spatial-object question-authoring module**
inside the existing **CREATIVE** application.

Its purpose is to let an author:

1.  construct a spatial object from simple semantic parts;
2.  position, rotate, scale and attach those parts;
3.  inspect the object from multiple viewpoints;
4.  create transformations and spatial relationships;
5.  frame a spatial-reasoning question;
6.  generate and edit answer options;
7.  validate the geometry and question;
8.  permanently store the question in the Question Bank.

OBJECTS is an **authoring tool**.

It is **not a learning application**.

The questions produced by OBJECTS may subsequently be used for
spatial-reasoning learning/practice elsewhere in CREATIVE, but OBJECTS
Phase 1 does not implement:

-   student learning paths;
-   adaptive learning;
-   student skill progression;
-   student error analysis;
-   student attempts;
-   test delivery;
-   learning analytics;
-   tutoring;
-   curriculum management.

The authoring workflow is:

``` text
IDEA
  ↓
BUILD OBJECT
  ↓
INSPECT / TRANSFORM
  ↓
FRAME QUESTION
  ↓
GENERATE / EDIT OPTIONS
  ↓
VALIDATE GEOMETRY + QUESTION
  ↓
COMMIT
  ↓
QUESTION BANK → OBJECTS-Q-ID
```

The important asset is **not the rendered 3D image**.

The important asset is the structured, machine-readable **ObjectModel +
QuestionModel** behind it.

That model must preserve enough semantic information to:

-   reconstruct the object later;
-   reconstruct the question later;
-   reproduce the authored transformations;
-   generate valid answer options;
-   generate variants;
-   explain the authored answer;
-   classify question characteristics;
-   support future test delivery;
-   support future result analysis;
-   allow future AI systems to inspect or regenerate the question.

------------------------------------------------------------------------

# 2. Product Vision

## OBJECTS should feel like

> **A simple visual object-design studio + interactive 3D workspace +
> intelligent spatial-question builder.**

It should feel:

-   direct;
-   visual;
-   precise;
-   fast;
-   calm;
-   discoverable;
-   touch-first;
-   almost self-explanatory.

The author should be able to construct sophisticated spatial objects
without needing to understand 3D graphics programming, mesh topology,
matrices, or CAD terminology.

## OBJECTS should not feel like

-   CAD software;
-   Blender;
-   Maya;
-   a mechanical engineering package;
-   a complicated mesh editor;
-   a programming tool;
-   a full architectural modeller;
-   a generic 3D game editor.

The goal is **spatial-question authoring**, not general-purpose 3D
modelling.

------------------------------------------------------------------------

# 3. Product Boundary

The most important product boundary is:

``` text
OBJECTS
    creates
        ↓
SPATIAL QUESTION ASSET
    consumed later by
        ↓
learning / practice / test systems
```

OBJECTS owns the creation of the question asset.

It does not own the student's learning experience.

## Phase 1 owns

-   object construction;
-   object editing;
-   object transformation;
-   spatial inspection;
-   question construction;
-   option generation;
-   distractor generation;
-   question validation;
-   question metadata;
-   permanent IDs;
-   versions;
-   Question Bank;
-   preview;
-   export;
-   local persistence.

## Phase 1 does not own

-   test creation;
-   test delivery;
-   answer collection;
-   student attempts;
-   result analysis;
-   adaptive practice;
-   student dashboards.

------------------------------------------------------------------------

# 4. Parent Application Context

OBJECTS is not a standalone application.

It is a module within:

``` text
CREATIVE
│
├── PERSPECTIVE
├── CUBE
├── OBJECTS
├── PUBLISH
├── SKETCH
└── Future modules
```

The parent CREATIVE document establishes that:

-   the app is a private, offline, single-user Android application;
-   modules are plugins;
-   each module owns its code and data;
-   modules are lazy-loaded;
-   modules do not import one another;
-   shared capabilities belong in shared infrastructure;
-   new modules must reuse CREATIVE infrastructure wherever practical.

OBJECTS must follow those rules.

## Do not

-   create a second application shell;
-   introduce a new UI framework;
-   create a standalone OBJECTS app;
-   duplicate CREATIVE infrastructure;
-   redesign PERSPECTIVE;
-   redesign CUBE;
-   introduce React Native;
-   introduce Flutter;
-   introduce a second application architecture.

------------------------------------------------------------------------

# 5. Integration

## 5.1 Module registration

Register OBJECTS in:

``` text
src/suite/modules.ts
```

with:

``` text
id: "objects"
title: "Objects"
entry: OBJECTS module entry
version: module release version
```

The home screen should not require structural changes beyond adding the
module registration/art.

## 5.2 Code location

Use:

``` text
src/modules/objects/
```

Suggested high-level structure:

``` text
src/modules/objects/

├── index.ts
├── ObjectsModule.tsx
│
├── core/
│   ├── model/
│   ├── geometry/
│   ├── construction/
│   ├── transforms/
│   ├── questions/
│   ├── validation/
│   └── variants/
│
├── services/
├── repository/
│
├── components/
│   ├── ObjectsStudio.tsx
│   ├── ObjectViewport.tsx
│   ├── OrthographicView.tsx
│   ├── ObjectToolbar.tsx
│   ├── PropertiesPanel.tsx
│   ├── ConstructionTree.tsx
│   ├── QuestionStudio.tsx
│   ├── QuestionBank.tsx
│   ├── QuestionPreview.tsx
│   ├── TestPlaceholder.tsx
│   └── AnalysisPlaceholder.tsx
│
├── render/
│   ├── three/
│   └── konva/
│
├── storage/
├── assets/
└── styles/
```

The exact file structure may be adjusted to match existing CREATIVE
conventions, but the semantic core must remain independent of React,
Three.js, Konva and SQLite.

------------------------------------------------------------------------

# 6. Rollout Strategy

OBJECTS follows the same three-stage product structure used by CUBE.

## Phase 1 --- STUDIO

Implemented now.

Scope:

``` text
Build
→ Inspect
→ Transform
→ Question
→ Options
→ Validate
→ Commit
→ Question Bank
```

## Phase 2 --- TEST MANAGEMENT

**Placeholder only in Phase 1.**

Future scope:

-   test creation;
-   question selection;
-   test delivery;
-   answer collection;
-   timing;
-   attempts;
-   results.

## Phase 3 --- RESULT ANALYSIS

**Placeholder only in Phase 1.**

Future scope:

-   student performance;
-   response analysis;
-   error classification;
-   difficulty calibration;
-   timing analysis;
-   progression;
-   reports;
-   adaptive practice.

### Important

Phase 1 must **not implement Phase 2 or Phase 3**.

However, the question data model must preserve the information required
for those future systems.

------------------------------------------------------------------------

# 7. Technology Stack

Use the existing CREATIVE web/application stack.

  Responsibility                  Technology
  ------------------------------- ------------------------------------------
  Application/UI                  React
  Language/domain model           TypeScript
  3D rendering                    Three.js / WebGL
  2D profile / auxiliary canvas   Konva where required
  Local persistence               SQLite via `@capacitor-community/sqlite`
  Android bridge                  Existing Capacitor architecture
  Future AI                       Provider-independent interface

## Explicitly do not introduce

-   React Native;
-   Flutter;
-   Skia as a replacement application/rendering architecture;
-   Filament;
-   a second application framework;
-   a second persistence system for OBJECTS.

Three.js is a **renderer**, not the source of truth.

Konva is a **2D interaction/rendering surface**, not the source of
truth.

SQLite is **persistence**, not the source of truth at runtime.

TypeScript domain models are authoritative.

------------------------------------------------------------------------

# 8. Core Architecture Principle

## THE OBJECTMODEL IS THE SINGLE SOURCE OF TRUTH

Mandatory architecture:

``` text
                         ObjectModel
                              │
             ┌────────────────┼────────────────┐
             │                │                │
          Three.js          Konva          Question Engine
            3D             2D profile            │
             │                │                   │
             └────────────────┴──────────────────┘
                              │
                             JSON
                              │
                           SQLite
```

The rendered mesh is derived from the ObjectModel.

The object viewport is derived from the ObjectModel.

The question is derived from the ObjectModel plus QuestionModel.

The Question Bank persists the semantic model.

## Never make these authoritative

-   Three.js scene graph;
-   Three.js mesh;
-   screen coordinates;
-   canvas coordinates;
-   screenshots;
-   generated PNGs;
-   arbitrary transform matrices without semantic dimensions;
-   DOM state.

------------------------------------------------------------------------

# 9. OBJECTS Scope --- Phase 1

OBJECTS Phase 1 supports a controlled set of spatial construction
operations.

The purpose is to create objects suitable for spatial-reasoning
questions, not arbitrary industrial CAD models.

## 9.1 Primitive solids

> **v1.1:** Phase 1a is blocks and 2D figures (§A.3, §A.4); these primitives are Phase 1b.


Minimum primitives:

-   Cube;
-   Cuboid;
-   Sphere;
-   Cylinder;
-   Cone;
-   Tube;
-   Prism;
-   Pyramid;
-   Frustum.

The implementation may expose a smaller initial subset during M0/M1 if
the geometry engine cannot reliably support all primitives, but the
architecture must allow the complete Phase 1 set.

## 9.2 Construction operations

> **v1.1:** Phase 1c (§A.2). In 1a, adding / removing blocks covers add and subtract.


Minimum operations:

``` text
ADD
SUBTRACT
INTERSECT
```

These correspond internally to boolean/CSG operations.

The user interface should use the simple terms:

> Add\
> Subtract\
> Intersect

rather than exposing technical CSG terminology.

## 9.3 Profile construction

> **v1.1:** Phase 1c (§A.2).


Support:

``` text
2D PROFILE
    ↓
EXTRUDE
    ↓
SOLID
```

A profile may be:

-   polygonal;
-   freeform path where supported;
-   composed of simple geometric segments.

Profile extrusion must remain semantic.

Do not flatten the result into an unexplained mesh.

------------------------------------------------------------------------

# 10. Explicit Phase 1 Non-Goals

Do not implement a full CAD system.

Out of scope:

-   fillet;
-   chamfer;
-   loft;
-   sweep;
-   shell;
-   complex parametric constraints;
-   engineering drawings;
-   manufacturing features;
-   tolerances;
-   GD&T;
-   mesh sculpting;
-   UV editing;
-   rigging;
-   animation;
-   materials/shaders as a modelling system;
-   physics simulation;
-   realistic lighting authoring.

A feature belongs in OBJECTS Phase 1 only if it contributes directly to
creating a useful spatial-reasoning question.

------------------------------------------------------------------------

# 11. Semantic Object Construction

Every object must have a semantic identity.

Conceptually:

``` text
ObjectModel
│
├── primitives[]
├── constructionTree
├── transforms
├── attachments[]
├── features[]
├── profiles[]
├── spatialRelations[]
└── presentation
```

A primitive is not merely a mesh.

Example:

``` json
{
  "id": "part-01",
  "type": "cuboid",
  "dimensions": {
    "width": 40,
    "height": 80,
    "depth": 40
  },
  "transform": {
    "position": [0, 40, 0],
    "rotation": [0, 0, 0]
  }
}
```

A cylinder:

``` json
{
  "id": "part-02",
  "type": "cylinder",
  "dimensions": {
    "radius": 20,
    "height": 60
  }
}
```

Do not reduce semantic dimensions to arbitrary scale values such as
`scale = 1.73`.

Store meaningful dimensions.

------------------------------------------------------------------------

# 12. Construction Tree

The construction history must be represented.

Example:

``` text
OBJECT
│
├── Base: Cuboid
│
├── ADD
│   └── Cylinder
│
├── SUBTRACT
│   └── Cylinder
│
├── ADD
│   └── Cone
│
└── SUBTRACT
    └── Sphere
```

Conceptual data:

``` json
{
  "constructionTree": {
    "operation": "subtract",
    "base": "feature-03",
    "tool": "primitive-07"
  }
}
```

The tree is important because question generation may need to know:

-   which part was added;
-   which part was removed;
-   which feature is cylindrical;
-   which feature is a hole;
-   which feature sits on a surface;
-   which feature can be tracked through a transformation.

------------------------------------------------------------------------

# 13. Coordinate System and Units

OBJECTS must use a consistent world coordinate system.

Recommended convention:

``` text
+X = right
+Y = up
+Z = depth / forward
```

Use a right-handed coordinate system consistently across:

-   ObjectModel;
-   Three.js;
-   question generation;
-   exports;
-   validation.

The authoring model should use **logical units**, not physical
engineering units.

The UI may display dimensions as simple values unless a future
requirement explicitly introduces physical units.

------------------------------------------------------------------------

# 14. OBJECTS Studio UX

The main Studio should have a small number of logical areas.

Conceptually:

``` text
┌──────────────────────────────────────────┐
│ OBJECTS                         ✓ Saved   │
├──────────────────────────────────────────┤
│ Studio    Question Bank    Test Analysis │
├──────────────────────────────────────────┤
│ 1 · Build Object    2 · Question         │
├──────────────────────────────────────────┤
│                                          │
│              3D VIEWPORT                 │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│ contextual controls / properties         │
└──────────────────────────────────────────┘
```

The exact phone layout may adapt to available screen size.

The visual object must dominate the screen.

Do not create a permanent CAD-style multi-panel desktop interface on the
phone.

------------------------------------------------------------------------

# 15. Studio Workflow

The Studio has two authoring steps:

``` text
1 · BUILD OBJECT
2 · QUESTION
```

## Step 1 --- Build Object

The author:

``` text
New
↓
Add primitives
↓
Move / rotate / scale
↓
Snap / attach
↓
Add / subtract / intersect
↓
Inspect
↓
Modify
↓
Validate
```

## Step 2 --- Question

The author:

``` text
Select question operation
↓
Set viewpoint / transformation / relationship
↓
Generate question
↓
Generate five options
↓
Edit options
↓
Validate
↓
Commit
```

The author must be able to move back from Question to Build without
losing work.

------------------------------------------------------------------------

# 16. Primary 3D Viewport

The 3D perspective viewport is the primary workspace.

It must support:

-   rotate camera;
-   pan camera;
-   pinch zoom;
-   object selection;
-   object movement;
-   object rotation;
-   object scaling;
-   face/surface selection;
-   feature highlighting;
-   snap preview;
-   reset view.

The author should understand the object spatially in the 3D viewport.

------------------------------------------------------------------------

# 17. Orthographic Views

Do **not** make permanent Top / Front / Side viewports the primary
interface.

Primary mode:

``` text
3D Perspective
```

Compact view controls:

``` text
[ 3D ] [ TOP ] [ FRONT ] [ RIGHT ]
```

Tapping an orthographic view temporarily changes the active viewport.

Additional standard views:

-   Left;
-   Back;
-   Bottom.

Optional:

``` text
[ Show 3 Views ]
```

may temporarily create:

``` text
┌──────────┬──────────┐
│   TOP    │  FRONT   │
├──────────┼──────────┤
│  RIGHT   │    3D    │
└──────────┴──────────┘
```

This is an authoring aid, not a permanent CAD layout.

### Design rule

> **3D for understanding. Orthographic for precision.**

------------------------------------------------------------------------

# 18. Camera vs Object Interaction

> **v1.1:** Gestures are settled in §A.7 (pinch never scales an object).


The interaction model must avoid accidental camera movement.

Recommended rule:

### In 3D perspective

-   drag empty space → rotate camera;
-   pinch → zoom;
-   two-finger drag → pan;
-   tap object → select;
-   drag selected object → move;
-   transform handles → transform selected object.

### In orthographic view

Dragging a selected object constrains movement to the active plane
unless the author explicitly selects another axis.

The author must always be able to recover using Undo.

------------------------------------------------------------------------

# 19. Object Selection

Selection must be visually obvious.

Selected objects may show:

-   subtle outline;
-   bounding box;
-   transform handles;
-   contextual properties.

Do not show all handles permanently.

Selection state should not alter the semantic object.

------------------------------------------------------------------------

# 20. Transformations

> **v1.1:** In 1a objects turn in 90° steps (§A.7); pinch-to-scale is dropped.


Every supported primitive should support:

-   move;
-   rotate;
-   scale.

## Move

Direct manipulation:

``` text
Select
→ drag
→ snap if applicable
→ release
```

## Rotate

Support:

-   direct rotation gesture where practical;
-   rotation handles;
-   contextual numeric angle controls.

Provide useful angular snapping such as 0°, 45°, 90°, 135°, 180°, 270°.

## Scale

Default:

``` text
pinch / corner handle
→ uniform scale
```

For precision:

``` text
Properties
→ Width
→ Height
→ Depth
```

For non-uniform scaling:

``` text
axis / face handle
→ change one dimension
```

The semantic model must store resulting dimensions.

------------------------------------------------------------------------

# 21. Surface Snapping

> **v1.1:** Not needed in 1a (blocks attach face to face by construction); Phase 1b.


Surface snapping is a core Phase 1 interaction.

When an object is moved toward another object, the system should
recognize useful spatial relationships.

Minimum snap relationships:

-   face → face;
-   face → edge;
-   face → corner;
-   centre → centre;
-   axis → axis;
-   circular face → planar face;
-   primitive → primitive surface;
-   profile → surface.

The system should:

1.  detect the candidate target;
2.  highlight the target subtly;
3.  align the object using the target surface normal;
4.  preview the result;
5.  commit the snap on release.

Example:

``` json
{
  "object": "cylinder-02",
  "attachment": {
    "target": "cuboid-01.topFace",
    "alignment": "surface_normal",
    "position": "center"
  }
}
```

This attachment must be semantic.

Do not store only the final screen coordinates.

------------------------------------------------------------------------

# 22. Snap On / Off

Provide a simple contextual control:

``` text
[ SNAP ✓ ]
```

or:

``` text
[ SNAP ]
```

Snap behaviour should be helpful by default.

Free placement must remain possible.

Do not expose a large technical snap-configuration dialog in Phase 1.

------------------------------------------------------------------------

# 23. Add Primitive Workflow

Recommended interaction:

``` text
Add
 ↓
Cube
Cuboid
Sphere
Cylinder
Cone
Tube
Prism
Pyramid
Frustum
```

Selecting a primitive should place a sensible default object into the
scene.

The object should immediately be selectable and editable.

Avoid forcing the author through a modal dimension dialog before the
object appears.

After placement:

``` text
Dimensions
Position
Rotation
```

can be edited contextually.

------------------------------------------------------------------------

# 24. Boolean Workflow

Boolean operations should be direct.

Example:

``` text
Select base object
+
Select tool object
↓
[ ADD ] [ SUBTRACT ] [ INTERSECT ]
```

The resulting construction must remain represented semantically.

The system should detect invalid operations and provide concise
feedback.

Example:

``` text
✓ Subtract completed
```

or:

``` text
⚠ Cannot subtract: objects do not intersect
```

Do not silently produce an empty or invalid result.

------------------------------------------------------------------------

# 25. Profile → Extrude Workflow

A profile editor may use Konva.

Workflow:

``` text
PROFILE
↓
Draw / edit profile
↓
Confirm
↓
Set extrusion depth
↓
ADD or SUBTRACT
↓
SOLID
```

The profile must remain available as semantic source data.

Do not only save the resulting mesh.

------------------------------------------------------------------------

# 26. Construction Tree UI

A compact construction tree should be available when useful.

Example:

``` text
OBJECT
│
├─ Cuboid
├─ ADD
│   └─ Cylinder
├─ SUBTRACT
│   └─ Cylinder
└─ ADD
    └─ Cone
```

The tree should support:

-   select feature;
-   hide/show feature;
-   edit feature;
-   delete feature;
-   rename feature.

Reordering is allowed only where semantically safe.

The tree is an authoring aid, not a mandatory workflow.

Do not make the user manage the tree for simple objects.

------------------------------------------------------------------------

# 27. Contextual Properties

Properties should appear only when relevant.

For a cuboid:

``` text
CUBOID

Width       40
Height      80
Depth       40

Position
X            0
Y           40
Z            0

Rotation
X            0°
Y            0°
Z            0°
```

For a cylinder:

``` text
CYLINDER

Radius      20
Height      60
```

For an attachment:

``` text
ATTACHED TO
Cuboid · Top Face

Alignment
Surface Normal

Position
Centre
```

Properties should be inline or in a compact contextual panel.

Avoid modal property dialogs where possible.

------------------------------------------------------------------------

# 28. Object Validation

The geometry engine must validate the semantic object.

Minimum validation should detect:

-   invalid dimensions;
-   zero/negative dimensions;
-   invalid primitive parameters;
-   broken references;
-   invalid attachments;
-   impossible construction operations;
-   failed boolean operations;
-   invalid profile;
-   unsupported or invalid resulting geometry where relevant;
-   unresolved construction dependency.

The UI should provide concise status:

``` text
✓ Valid object
```

or:

``` text
⚠ Object needs attention
```

with the specific issue.

------------------------------------------------------------------------

# 29. Object View / Inspection

The author must be able to inspect:

-   exterior shape;
-   visible/hidden features;
-   surface relationships;
-   feature orientation;
-   feature positions;
-   object from standard views;
-   object from arbitrary camera angles.

Inspection must not modify the object.

The author should be able to reset the camera without resetting the
object.

------------------------------------------------------------------------

# 30. Spatial Question Operations

> **v1.1:** Phase 1a families, including 2D, are in §A.5.


OBJECTS should begin question construction from the **spatial operation
being tested**, not merely from a generic "object → question" button.

Phase 1 question families:

## TRANSFORM

-   rotate;
-   translate;
-   reflect;
-   scale;
-   compound transformation.

## PROJECT

-   3D → 2D view;
-   2D → 3D reconstruction;
-   front/top/right view;
-   silhouette;
-   cross-section.

## CONSTRUCT

-   assemble;
-   decompose;
-   add feature;
-   subtract feature;
-   reconstruct object.

## RELATE

-   above / below;
-   front / behind;
-   left / right;
-   inside / outside;
-   adjacent;
-   aligned;
-   near / far;
-   attached / detached.

## TRACK

-   feature movement;
-   surface movement;
-   orientation change;
-   hidden → visible;
-   visible → hidden.

These are **authoring/question categories**, not a student learning
progression.

------------------------------------------------------------------------

# 31. Question Builder

Once the object is satisfactory:

``` text
CREATE QUESTION
```

The author chooses a question operation.

Example:

``` text
WHAT SHOULD THE QUESTION TEST?

TRANSFORM
  Rotate
  Translate
  Reflect
  Scale

PROJECT
  3D → 2D
  2D → 3D
  Orthographic
  Silhouette
  Cross-section

CONSTRUCT
  Assemble
  Decompose
  Add
  Subtract

RELATE
  Spatial relationship

TRACK
  Feature movement
  Orientation
  Visibility
```

The question builder then creates an appropriate question structure from
the same ObjectModel.

------------------------------------------------------------------------

# 32. One Object → Many Questions

The architecture must support multiple questions from one semantic
object.

For example:

``` text
Object A
│
├── Question 1 — rotate
├── Question 2 — front view
├── Question 3 — hidden feature
├── Question 4 — cross-section
├── Question 5 — feature movement
└── Question 6 — spatial relationship
```

The object should not need to be rebuilt for every question.

Question assets may reference a frozen object state/version.

------------------------------------------------------------------------

# 33. Question Presentation

The question model should distinguish:

``` text
SPATIAL MODEL
+
QUESTION OPERATION
+
PRESENTATION
+
OPTIONS
+
ANSWER
+
METADATA
```

Example:

``` json
{
  "presentation": {
    "type": "rotate_object",
    "optionCount": 5
  }
}
```

The presentation layer must not modify the underlying semantic object.

------------------------------------------------------------------------

# 34. Answer Options

> **v1.1:** What an option is: §A.9.


Phase 1 follows the CUBE authoring convention of **five options**:

``` text
1 correct
4 distractors
```

Every committed OBJECTS question must have exactly five options.

The correct answer must be explicit in the semantic model.

Example:

``` json
{
  "answer": {
    "correctOption": 3
  }
}
```

------------------------------------------------------------------------

# 35. Distractor Engine

> **v1.1:** Phase 1a distractors per family: §A.5; each records its rule (§A.9).


Distractors must represent intentional spatial mistakes, not random
wrong images.

Initial generic distractor classes:

``` text
D01 — Wrong rotation
D02 — Wrong viewpoint
D03 — Mirrored result
D04 — Wrong translation / position
D05 — Wrong scale
D06 — Feature omitted
D07 — Feature added
D08 — Feature on wrong surface
D09 — Wrong spatial relationship
D10 — Incorrect projection
D11 — Incorrect cross-section
D12 — Feature orientation reversed
```

Only applicable distractors should be used.

Each option should record:

``` json
{
  "option": 3,
  "type": "wrong_orientation",
  "rule": "ORIENTATION_02",
  "note": "Feature rotated in the wrong direction"
}
```

Do not generate meaningless distractors.

------------------------------------------------------------------------

# 36. Manual Author Override

The author always has final authority.

Allow:

-   replace option;
-   edit option;
-   reorder options;
-   set correct answer;
-   regenerate one option;
-   regenerate all options;
-   change distractor type;
-   change transformation;
-   change viewpoint;
-   modify question wording;
-   modify object;
-   change question metadata.

Automation must never prevent manual correction.

------------------------------------------------------------------------

# 37. Deterministic Question Generation

Generated questions must be reproducible.

Where generation uses randomness, store a seed.

Conceptually:

``` json
{
  "generation": {
    "method": "seeded",
    "seed": 18374621
  }
}
```

The same semantic input + seed should reproduce the same generated
candidate.

------------------------------------------------------------------------

# 38. Difficulty Metadata

> **v1.1:** Merged with §41 into one mostly computed `profile` record (§A.8).


OBJECTS should not reduce difficulty to one number.

Store multiple characteristics.

Suggested dimensions:

``` text
objectComplexity
primitiveCount
constructionComplexity
transformationComplexity
viewpointComplexity
featureComplexity
occlusion
relationshipComplexity
distractorSimilarity
visualComplexity
```

Use a simple 1--5 scale where applicable:

``` text
1 = low
5 = high
```

The author may adjust the metadata.

This metadata describes the authored question. It is not a student
performance score.

------------------------------------------------------------------------

# 39. Question Metadata

Minimum metadata:

``` text
question type
object type
operation
difficulty dimensions
feature count
transformation
viewpoint
distractor types
construction method
creation date
modified date
author
version
```

Metadata must remain machine-readable.

------------------------------------------------------------------------

# 40. Question Explanation Model

Store machine-readable reasoning for the correct answer.

Example:

``` json
{
  "correctOption": 3,
  "reasoning": [
    {
      "rule": "rotation",
      "statement": "The object is rotated 90 degrees around the vertical axis."
    },
    {
      "rule": "featureTracking",
      "statement": "The cylindrical feature remains attached to the same face."
    }
  ]
}
```

This is an authoring asset.

It enables future systems to produce explanations without
reverse-engineering a screenshot.

------------------------------------------------------------------------

# 41. Question DNA

> **v1.1:** See §A.8.


OBJECTS should store a compact machine-readable description of the
question.

Example:

``` json
{
  "questionDNA": {
    "objectComplexity": 3,
    "primitiveCount": 5,
    "transformation": "rotate",
    "transformationComplexity": 3,
    "viewpointComplexity": 4,
    "featureComplexity": 3,
    "occlusion": 2,
    "distractorSimilarity": 4
  }
}
```

Question DNA is for classification and future analysis.

It is not a student profile.

------------------------------------------------------------------------

# 42. Permanent Question ID

Every committed question receives an immutable ID.

Format:

``` text
OBJECTS-Q-000001
OBJECTS-Q-000002
OBJECTS-Q-000003
```

The ID must never change.

IDs must be generated from a stored counter or equivalent collision-safe
local mechanism.

Never hard-code question IDs.

Never reuse deleted IDs.

------------------------------------------------------------------------

# 43. Versioning

A committed question may be edited.

Historical versions must not be overwritten.

Example:

``` text
OBJECTS-Q-000127
    v1
    v2
    v3
```

A future test must be able to reference the exact question version used.

Editing a committed question and committing changes creates a new
version.

Provide:

``` text
Save as new question
```

when the author wants to create a new independent question instead.

------------------------------------------------------------------------

# 44. Canonical Question JSON

The canonical JSON is the portable semantic representation.

Example:

``` json
{
  "schema": "creative.objects.question.v1",

  "questionId": "OBJECTS-Q-000127",
  "version": 1,

  "objectModel": {},

  "presentation": {
    "type": "rotate_object",
    "optionCount": 5
  },

  "difficulty": {},

  "questionDNA": {},

  "rules": [],

  "answer": {},

  "explanation": {},

  "options": [],

  "assets": []
}
```

The schema must be versioned.

Validate the canonical object when reading it.

Do not rely on screenshots to reconstruct a question.

------------------------------------------------------------------------

# 45. AI Reconstruction Requirement

The semantic JSON must contain enough information for a future AI system
to understand the authored question without relying on a screenshot.

It must be possible to recover:

-   primitive types;
-   dimensions;
-   transforms;
-   construction operations;
-   attachments;
-   profiles;
-   object topology/features where applicable;
-   question type;
-   viewpoint;
-   transformation;
-   options;
-   correct answer;
-   distractor logic;
-   difficulty metadata;
-   explanation;
-   assets.

Images are presentation assets.

The semantic model is authoritative.

------------------------------------------------------------------------

# 46. Question Bank

After commit:

``` text
Question Bank
└── Objects
    ├── OBJECTS-Q-000001
    ├── OBJECTS-Q-000002
    ├── OBJECTS-Q-000003
    └── ...
```

Minimum Phase 1 operations:

-   search;
-   filter;
-   preview;
-   edit;
-   duplicate;
-   generate variant;
-   view metadata;
-   view versions;
-   export.

Suggested filters:

-   question type;
-   object type;
-   operation;
-   difficulty;
-   distractor type;
-   feature count;
-   date;
-   ID.

Use compact question cards.

Example:

``` text
OBJECTS-Q-000127   Rotate Object       v2 · 3 Oct 2026
OBJECTS-Q-000126   Front View          v1 · 3 Oct 2026
OBJECTS-Q-000125   Feature Tracking    v3 · 2 Oct 2026
```

Tapping a question should open its details inline or in a compact detail
surface, following the established CUBE Question Bank interaction
pattern.

------------------------------------------------------------------------

# 47. Duplicate and Variant

## Duplicate

Creates a new independent question with a new ID.

## Generate Variant

Creates a new candidate using the same general question characteristics
while changing suitable visual variables.

Possible changes:

-   primitive dimensions;
-   feature position;
-   feature orientation;
-   colours;
-   object proportions;
-   transformation;
-   viewpoint;
-   distractors.

A variant must remain geometrically valid.

It opens in Studio for author review before commitment.

------------------------------------------------------------------------

# 48. Database

Use:

``` text
@capacitor-community/sqlite
```

Suggested database:

``` text
objects.db
```

Keep persistence behind a repository/data-access layer.

Suggested logical tables:

``` text
objects_questions
objects_question_versions
objects_assets
objects_drafts

-- future placeholders only
objects_tests
objects_attempts
objects_responses
objects_analysis
```

Phase 1 primarily implements:

``` text
objects_questions
objects_question_versions
objects_assets
objects_drafts
```

------------------------------------------------------------------------

# 49. Repository Layer

React components must never execute SQL directly.

Architecture:

``` text
UI
 ↓
Objects Services
 ↓
Repository
 ↓
SQLite
```

Suggested interfaces:

``` text
QuestionRepository
├── create()
├── update()
├── get()
├── list()
├── search()
├── duplicate()
├── variant()
└── version()

DraftRepository
├── save()
├── load()
├── delete()
└── recover()
```

This keeps storage replaceable and testable.

------------------------------------------------------------------------

# 50. Offline First

Phase 1 must work fully offline.

The author must be able to:

-   create objects;
-   edit objects;
-   save drafts;
-   create questions;
-   generate options;
-   validate geometry;
-   browse Question Bank;
-   preview questions;
-   export questions.

without an internet connection.

AI must not be required for core authoring.

------------------------------------------------------------------------

# 51. Autosave

Draft work must be autosaved locally.

Protect against:

-   app closure;
-   navigation;
-   crash;
-   Android memory pressure;
-   accidental interruption.

Use unobtrusive status:

``` text
✓ Saved
Saving…
```

A recovered draft must preserve the semantic model, not merely a
screenshot.

------------------------------------------------------------------------

# 52. Undo / Redo

Undo/redo is mandatory.

It must cover at minimum:

-   create primitive;
-   delete primitive;
-   move;
-   rotate;
-   scale;
-   attachment;
-   snap;
-   boolean operation;
-   profile editing;
-   extrusion;
-   property changes;
-   object visibility;
-   question changes;
-   option changes.

Undo must operate on semantic state where practical.

Do not implement undo only as a Three.js scene snapshot if this causes
divergence from the ObjectModel.

------------------------------------------------------------------------

# 53. Touch-First Interaction

OBJECTS is intended for Android.

Support:

-   tap;
-   drag;
-   pinch zoom;
-   pan;
-   two-finger camera navigation;
-   rotation gesture where appropriate;
-   large touch targets.

Do not design tiny desktop-style controls.

Mouse/keyboard support may remain available for development and desktop
browser use.

------------------------------------------------------------------------

# 54. UX Principles

## Direct manipulation

If something looks movable, drag it.

## Contextual controls

Show properties relevant to the selected object.

## Minimal dialogs

Prefer inline controls.

## Immediate feedback

Selections, snapping, transformations, validation and errors should be
visible immediately.

## No unnecessary modes

Avoid hidden modes.

## Fast recovery

Undo, redo, reset and clear must remain easy to access.

## Visual-first

The 3D object should dominate the interface.

## Precision without complexity

Use direct manipulation for speed and contextual numeric properties for
precision.

------------------------------------------------------------------------

# 55. Visual Design

OBJECTS should follow CREATIVE design tokens and established module
conventions.

Target qualities:

-   modern;
-   minimal;
-   calm;
-   precise;
-   spacious;
-   visually clear.

Avoid:

-   CAD-style dense panels;
-   technical engineering dashboards;
-   excessive property fields;
-   permanent multi-viewport clutter;
-   tiny controls.

The object is the hero.

------------------------------------------------------------------------

# 56. Object Presentation / Materials

> **v1.1:** Question figures are isometric line drawings from a pure renderer (§A.6); this section applies to the authoring viewport only.


Phase 1 should keep rendering visually simple.

Support only enough presentation to distinguish geometry clearly:

-   base colour;
-   feature highlighting;
-   selection;
-   subtle shadows;
-   clear edges where useful;
-   transparent/hidden-state indication where required.

Do not build a material-authoring system.

The rendered object is for spatial comprehension and question
presentation.

------------------------------------------------------------------------

# 57. Question Preview

Provide a question-sheet preview before commitment.

The preview should show:

-   prompt/stem;
-   authored object/view;
-   five numbered options;
-   correct answer for author mode;
-   distractor classification;
-   relevant metadata.

Preview must use the same semantic question asset that will be
committed.

------------------------------------------------------------------------

# 58. Export

Phase 1 should support:

### Preview

PNG.

### Question

Structured JSON.

### Object / visual asset

PNG and SVG where a 2D representation is applicable.

### Future package

Conceptually:

``` text
OBJECTS-Q-000127/
├── question.json
├── assets/
└── preview/
```

Use stable internal asset IDs.

Do not store temporary device paths inside canonical question JSON.

------------------------------------------------------------------------

# 59. Asset Management

Assets may include:

-   profile data;
-   raster reference images where permitted;
-   generated previews;
-   question thumbnails.

Every imported asset receives a stable internal ID.

Avoid embedding large duplicate assets into every question version.

Assets must remain independently addressable.

------------------------------------------------------------------------

# 60. Geometry Engine

Implement a pure TypeScript spatial engine.

It must have no dependency on:

-   React;
-   Three.js;
-   Konva;
-   SQLite.

Responsibilities:

### Primitive geometry

-   create primitive definitions;
-   validate parameters;
-   derive geometry.

### Transformations

-   translate;
-   rotate;
-   scale;
-   coordinate conversion.

### Construction

-   add;
-   subtract;
-   intersect;
-   extrude.

### Attachments

-   surface;
-   edge;
-   corner;
-   axis;
-   centre.

### Spatial relationships

-   above/below;
-   front/behind;
-   left/right;
-   inside/outside;
-   attached;
-   aligned;
-   adjacency where geometrically meaningful.

### Projection

-   front;
-   back;
-   top;
-   bottom;
-   left;
-   right;
-   arbitrary view;
-   silhouette;
-   cross-section where supported.

### Validation

-   parameter validity;
-   construction validity;
-   attachment validity;
-   boolean validity;
-   supported geometry constraints.

This engine is the intellectual core of OBJECTS.

------------------------------------------------------------------------

# 61. Geometry Renderer Separation

Three.js should:

-   render ObjectModel geometry;
-   render selection;
-   render handles;
-   render guides;
-   render camera;
-   support direct manipulation.

Three.js must not own the authoritative object state.

When a Three.js interaction occurs:

``` text
gesture
 ↓
interaction service
 ↓
ObjectModel mutation
 ↓
validation
 ↓
Three.js re-render
```

Not:

``` text
gesture
 ↓
mutate Three.js mesh
 ↓
try to reconstruct ObjectModel
```

------------------------------------------------------------------------

# 62. Orthographic Renderer

Orthographic views must use the same ObjectModel.

The same object must produce:

``` text
3D
TOP
FRONT
RIGHT
LEFT
BACK
BOTTOM
```

There must be no separate geometry representation for each viewport.

------------------------------------------------------------------------

# 63. Surface and Feature Identity

Features that may become question subjects must have stable semantic
IDs.

Example:

``` text
feature-01 = base cuboid
feature-02 = cylindrical hole
feature-03 = top cone
feature-04 = side notch
```

A question can therefore refer to:

``` json
{
  "targetFeature": "feature-03"
}
```

rather than a screen coordinate.

This is essential for:

-   feature tracking;
-   visibility questions;
-   transformation questions;
-   variant generation;
-   future explanation.

------------------------------------------------------------------------

# 64. Question Validation

> **v1.1:** "Distinguishable" is defined in §A.6; correctness is exact (OB-D4).


A question may be committed only if all applicable validations pass.

## Object

-   valid dimensions;
-   valid construction;
-   valid attachments;
-   valid geometry;
-   no broken references.

## Question

-   question type is defined;
-   source object is valid;
-   transformation/viewpoint is valid;
-   exactly five options exist;
-   exactly one correct answer exists;
-   every option is valid;
-   options are visually distinguishable where required;
-   no unintended second correct answer exists;
-   intended distractor rules are satisfied;
-   metadata is complete.

UI should clearly show:

``` text
✓ Ready to commit
```

or:

``` text
⚠ Question needs attention
```

with concise reasons.

------------------------------------------------------------------------

# 65. Correctness Engine

Correctness must be determined by deterministic geometry/question logic.

Do not use AI to decide whether an option is geometrically correct.

For example, for a rotation question:

``` text
source ObjectModel
+
authored transformation
=
expected result
```

An option is correct only if its semantic representation matches the
expected result under the question's defined equivalence rules.

Equivalent camera orientations must be normalized before comparison
where appropriate.

------------------------------------------------------------------------

# 66. Option Equivalence

The engine must distinguish between:

-   genuinely different objects;
-   same object viewed from a different camera;
-   equivalent rotations;
-   mirrored objects;
-   reversed feature orientation;
-   visually similar but semantically different constructions.

Question-specific equivalence rules must be explicit.

Never rely only on pixel comparison.

------------------------------------------------------------------------

# 67. Question Generation

The Studio may provide:

``` text
Generate Question
```

based on author-selected constraints.

Example:

``` text
Question:
    Rotate Object

Object complexity:
    3

Transformation:
    90° rotation

View:
    Front → Right

Distractors:
    Wrong rotation
    Mirror
    Wrong feature orientation
    Wrong viewpoint
```

The system generates a candidate.

The author reviews it.

The author may modify it.

Only the author commits it.

------------------------------------------------------------------------

# 68. Manual Question Editing

The author must be able to override generated content.

The system must never treat generated output as final.

Minimum controls:

``` text
Edit
Regenerate
Duplicate
Set Correct
Reorder
Change Distractor
Modify Object
Modify View
Modify Stem
```

------------------------------------------------------------------------

# 69. Question / Attempt Separation

The question is a permanent knowledge asset.

A student attempt is a future event.

Correct conceptual structure:

``` text
QUESTION BANK
    │
    └── Q_ID + VERSION
             ↑
             │
TEST
    │
    └── ATTEMPT
             │
             └── RESPONSE
```

Do not store student responses inside the canonical question object.

------------------------------------------------------------------------

# 70. Future Student Data Contract

Phase 1 does not implement attempts, but the question model must be
compatible with a future record such as:

``` json
{
  "testId": "...",
  "attemptId": "...",
  "questionId": "OBJECTS-Q-000127",
  "questionVersion": 2,
  "selectedOption": 4,
  "correctOption": 3,
  "correct": false,
  "timeTakenMs": 18400,
  "timestamp": "..."
}
```

The exact future contract may evolve.

The key requirement is that a future response can identify the exact
immutable question version.

------------------------------------------------------------------------

# 71. Phase 2 Placeholder

The module navigation should expose:

``` text
OBJECTS
├── Studio
├── Question Bank
├── Test
└── Analysis
```

Test should display only a placeholder.

Example:

> **Test Management**\
> Phase 2

Do not implement:

-   test creation;
-   test selection;
-   test delivery;
-   timing;
-   attempts;
-   answer collection.

------------------------------------------------------------------------

# 72. Phase 3 Placeholder

Analysis should display only a placeholder.

Example:

> **Result Analysis**\
> Phase 3

Do not implement:

-   student analytics;
-   error classification;
-   performance dashboards;
-   skill analysis;
-   adaptive practice.

------------------------------------------------------------------------

# 73. Data Migration

The database schema must be versioned.

Any future schema change must use a migration.

Do not silently discard old question versions.

Canonical JSON should also carry a schema version:

``` text
creative.objects.question.v1
```

A future schema version must provide a migration or explicit
compatibility strategy.

------------------------------------------------------------------------

# 74. Privacy and Permissions

OBJECTS should require no network permission for Phase 1 authoring.

The module should work without an account.

Imported assets remain local unless the user explicitly exports/shares
them.

No telemetry is required for Phase 1.

------------------------------------------------------------------------

# 75. Performance Targets

The primary target is the developer's Android phone.

Phase 1 should target:

-   responsive object manipulation;
-   smooth camera rotation;
-   smooth pinch zoom;
-   no visible lag during normal primitive manipulation;
-   fast question preview;
-   fast local save;
-   no unnecessary full-scene reconstruction after every UI interaction.

Large or pathological models may be constrained.

The module should prefer a smaller number of semantically meaningful
features over arbitrary mesh complexity.

------------------------------------------------------------------------

# 76. M0 --- Device / Rendering Spike

> **v1.1:** Milestones are re-cut in §A.10; §76–§81 describe the general-solid phases (1b / 1c).


Before building the complete Studio, prove the risky technology.

M0 must demonstrate:

``` text
React
  ↓
Three.js
  ↓
Android
  ↓
Create primitive
  ↓
Select
  ↓
Move
  ↓
Rotate
  ↓
Scale
  ↓
Camera rotate
  ↓
Pinch zoom
  ↓
Orthographic view
```

Also test:

-   Android GPU compatibility;
-   touch precision;
-   WebGL stability;
-   scene performance;
-   Three.js integration with existing CREATIVE build.

If boolean CSG or profile extrusion requires an additional library,
resolve and document that dependency during M0 before committing to the
implementation.

------------------------------------------------------------------------

# 77. M1 --- Semantic Object Core

Implement:

-   ObjectModel;
-   primitive definitions;
-   dimensions;
-   transforms;
-   feature IDs;
-   construction tree;
-   validation;
-   serialization;
-   deterministic tests.

No polished UI is required beyond a minimal test harness.

Acceptance:

> A semantic object can be created, modified, serialized, deserialized
> and reconstructed without React, Three.js or SQLite.

------------------------------------------------------------------------

# 78. M2 --- Object Studio

Implement:

-   3D viewport;
-   primitive creation;
-   selection;
-   move;
-   rotate;
-   scale;
-   orthographic views;
-   contextual properties;
-   undo/redo;
-   autosave.

Acceptance:

> An author can create and manipulate a useful multi-feature spatial
> object entirely on Android.

------------------------------------------------------------------------

# 79. M3 --- Construction System

Implement:

-   surface snapping;
-   attachments;
-   add;
-   subtract;
-   intersect;
-   construction tree;
-   profile/extrusion where included in the initial implementation
    scope.

Acceptance:

> An author can construct a semantically meaningful composite object and
> reopen it without loss of construction information.

------------------------------------------------------------------------

# 80. M4 --- Question Studio

Implement:

-   question operation selection;
-   transformations;
-   viewpoints;
-   question presentation;
-   five options;
-   deterministic correctness;
-   distractor engine;
-   manual override;
-   question validation.

Acceptance:

> An author can convert a valid object into a complete spatial-reasoning
> question and manually control the generated options.

------------------------------------------------------------------------

# 81. M5 --- Question Bank

Implement:

-   permanent IDs;
-   versions;
-   SQLite repository;
-   search;
-   filters;
-   preview;
-   edit;
-   duplicate;
-   variant;
-   metadata;
-   export.

Acceptance:

> A committed question survives app restart, remains reconstructable and
> can be edited into a new version without overwriting its history.

------------------------------------------------------------------------

# 82. M6 --- Device Polish

Perform actual Android testing.

Verify:

-   phone navigation-bar clearance;
-   no controls hidden behind system UI;
-   object viewport occupies available space;
-   contextual controls remain reachable;
-   touch targets are usable;
-   keyboard does not break the question editor;
-   save status is visible;
-   no unexpected scroll conflicts;
-   camera gestures do not accidentally edit objects.

------------------------------------------------------------------------

# 83. Testing Strategy

Testing must be layered.

## 83.1 Domain unit tests

Test:

-   primitive construction;
-   dimensions;
-   transformations;
-   coordinate conversion;
-   attachments;
-   snapping calculations;
-   boolean operation contracts;
-   profile validation;
-   projection;
-   spatial relationships;
-   question correctness;
-   option equivalence;
-   distractor rules.

## 83.2 Property / invariant tests

Where practical:

``` text
serialize(deserialize(model)) == canonical(model)
```

and:

``` text
apply(undo(state)) == previousState
```

Geometry transformations should preserve expected invariants.

## 83.3 Repository tests

Test:

-   create;
-   read;
-   update;
-   list;
-   search;
-   version;
-   duplicate;
-   migration;
-   recovery.

## 83.4 UI tests

Test:

-   module entry;
-   Studio navigation;
-   object selection;
-   manipulation;
-   orthographic view switching;
-   question creation;
-   option editing;
-   commit;
-   Question Bank;
-   reopen.

## 83.5 Device tests

At minimum test on the developer's Android device.

------------------------------------------------------------------------

# 84. Device Checklist

### Entry

-   [ ] OBJECTS opens from CREATIVE.
-   [ ] Back returns to CREATIVE.
-   [ ] Android back behaves predictably.

### Studio

-   [ ] 3D viewport is usable.
-   [ ] Object does not sit behind navigation bar.
-   [ ] Toolbar remains reachable.
-   [ ] Contextual properties remain reachable.
-   [ ] Camera gestures work.
-   [ ] Object gestures work.

### Geometry

-   [ ] Primitive creation works.
-   [ ] Move works.
-   [ ] Rotate works.
-   [ ] Scale works.
-   [ ] Snap works.
-   [ ] Boolean operations work.
-   [ ] Invalid operations are reported.

### Question

-   [ ] Question operation can be selected.
-   [ ] Correct answer is deterministic.
-   [ ] Five options render.
-   [ ] Distractors are intentional.
-   [ ] Manual override works.
-   [ ] Validation catches invalid questions.

### Persistence

-   [ ] Autosave works.
-   [ ] Close/reopen preserves draft.
-   [ ] Committed question remains available.
-   [ ] Version history remains intact.

### Question Bank

-   [ ] Search works.
-   [ ] Filters work.
-   [ ] Preview works.
-   [ ] Edit works.
-   [ ] Duplicate works.
-   [ ] Variant works.
-   [ ] Export works.

------------------------------------------------------------------------

# 85. Quality Gates

Before Phase 1 is considered complete:

## Geometry

-   [ ] Semantic ObjectModel is authoritative.
-   [ ] Primitive dimensions are preserved.
-   [ ] Transformations are deterministic.
-   [ ] Attachments are semantic.
-   [ ] Snapping is reliable.
-   [ ] Boolean operations are validated.
-   [ ] Orthographic projections use the same model.
-   [ ] Invalid objects are rejected.

## Studio

-   [ ] Direct manipulation works.
-   [ ] Contextual controls work.
-   [ ] Undo/redo works.
-   [ ] Autosave works.
-   [ ] 3D viewport is responsive.
-   [ ] Touch targets are appropriate.
-   [ ] No unnecessary modes exist.

## Question Engine

-   [ ] Question types are semantic.
-   [ ] Exactly five options are stored.
-   [ ] Exactly one correct answer is enforced.
-   [ ] Distractors are intentional.
-   [ ] Correctness is deterministic.
-   [ ] Manual override works.
-   [ ] Question validation works.

## Persistence

-   [ ] Permanent IDs are generated.
-   [ ] Versions are preserved.
-   [ ] Canonical JSON is valid.
-   [ ] Repository layer is used.
-   [ ] SQLite persists data.
-   [ ] Draft recovery works.

## Question Bank

-   [ ] Search works.
-   [ ] Filtering works.
-   [ ] Preview works.
-   [ ] Edit creates a new version.
-   [ ] Duplicate creates a new ID.
-   [ ] Variant creates a new candidate.
-   [ ] Metadata is visible.

------------------------------------------------------------------------

# 86. Definition of Done --- Phase 1

Phase 1 is complete when an author can perform this complete workflow:

``` text
1. Open CREATIVE
        ↓
2. Open OBJECTS
        ↓
3. Open Studio
        ↓
4. Create a new object
        ↓
5. Add primitives
        ↓
6. Move / rotate / scale them
        ↓
7. Snap features to surfaces
        ↓
8. Add / subtract / intersect features
        ↓
9. Inspect the object in 3D
        ↓
10. Inspect TOP / FRONT / RIGHT views
        ↓
11. Validate the object
        ↓
12. Choose a spatial question operation
        ↓
13. Define transformation / viewpoint / relationship
        ↓
14. Generate five options
        ↓
15. Edit / regenerate distractors
        ↓
16. Select correct answer
        ↓
17. Define question metadata
        ↓
18. Validate question
        ↓
19. Commit
        ↓
20. Generate permanent OBJECTS-Q-ID
        ↓
21. Save to Question Bank
        ↓
22. Close / reopen app
        ↓
23. Question remains reconstructable
```

------------------------------------------------------------------------

# 87. Claude Must Not

Claude must not:

-   create a standalone OBJECTS application;
-   create a second application shell;
-   migrate OBJECTS to Flutter;
-   migrate OBJECTS to React Native;
-   replace the existing CREATIVE stack;
-   redesign unrelated modules;
-   make Three.js the source of truth;
-   make Konva the source of truth;
-   store questions only as screenshots;
-   store geometry only as arbitrary mesh data;
-   couple semantic geometry to screen coordinates;
-   put geometry mathematics inside React components;
-   execute SQLite directly from React components;
-   use AI as the authority for geometric correctness;
-   implement Test functionality;
-   implement Analysis functionality;
-   implement student learning features;
-   implement adaptive learning;
-   invent CAD features merely because the 3D engine can support them.

------------------------------------------------------------------------

# 88. Claude Should

Claude should:

1.  Read `docs/CREATIVE.md` before implementation.
2.  Read this OBJECTS requirements document before implementation.
3.  Inspect existing PERSPECTIVE/CUBE patterns before creating
    infrastructure.
4.  Reuse CREATIVE design tokens and navigation.
5.  Create OBJECTS under `src/modules/objects/`.
6.  Build the semantic ObjectModel first.
7.  Build the pure TypeScript geometry engine independently.
8.  Prove Three.js Android behaviour in M0.
9.  Build the 3D viewport around ObjectModel.
10. Build temporary orthographic views from the same ObjectModel.
11. Implement direct manipulation.
12. Implement semantic surface snapping.
13. Implement construction history.
14. Implement question construction.
15. Implement deterministic correctness.
16. Implement intentional distractors.
17. Implement manual author override.
18. Implement permanent IDs and versions.
19. Persist through a repository layer.
20. Make the module offline-first.
21. Implement autosave and undo/redo.
22. Add Test and Analysis placeholders only.
23. Test on the actual Android device throughout development.
24. Keep the UI visually simple even when the underlying geometry engine
    is sophisticated.

------------------------------------------------------------------------

# 89. Suggested Core TypeScript Model

The exact implementation may differ, but the semantic architecture
should resemble:

``` ts
interface ObjectModel {
  schema: string;
  objectId: string;

  primitives: Primitive[];
  constructionTree: ConstructionNode[];

  features: Feature[];
  attachments: Attachment[];

  profiles: Profile[];

  transforms: TransformState;

  spatialRelations: SpatialRelation[];

  presentation: ObjectPresentation;
}
```

Question:

``` ts
interface ObjectQuestion {
  schema: string;

  questionId: string;
  version: number;

  objectModel: ObjectModel;

  presentation: QuestionPresentation;

  options: QuestionOption[];

  answer: AnswerModel;

  difficulty: DifficultyModel;

  questionDNA: QuestionDNA;

  rules: QuestionRule[];

  explanation: ExplanationModel;

  assets: AssetReference[];
}
```

These interfaces are conceptual requirements, not permission to weaken
the semantic model.

------------------------------------------------------------------------

# 90. Architectural Decision Summary

The following decisions are intentional:

  Decision             Requirement
  -------------------- -----------------------------------------
  Module               `objects`
  App                  Existing CREATIVE
  UI                   React
  Language             TypeScript
  3D                   Three.js / WebGL
  2D profile           Konva where needed
  Persistence          SQLite via Capacitor
  Primary viewport     3D perspective
  Precision views      Temporary orthographic
  Geometry authority   ObjectModel
  Question authority   semantic QuestionModel
  Construction         primitives + booleans + profile/extrude
  Snapping             semantic surface snapping
  Scaling              direct + numeric dimensions
  Question options     exactly 5
  Question ID          `OBJECTS-Q-######`
  Versioning           immutable history
  Offline              required
  Autosave             required
  Undo/redo            required
  Test                 placeholder
  Analysis             placeholder
  Student learning     out of scope

------------------------------------------------------------------------

# 91. Design Review --- Why this is not CUBE with more shapes

The CUBE workflow is deliberately inherited:

``` text
Studio
 → Build
 → Question
 → Validate
 → Commit
 → Question Bank
```

But the underlying authoring model is fundamentally different.

CUBE is based on:

``` text
Net ↔ Cube
Six faces
Folding
Cube topology
```

OBJECTS is based on:

``` text
Primitives
+
Construction
+
Spatial relationships
+
Transformations
+
Views
+
Feature identity
```

Therefore:

``` text
CUBE
    semantic CubeModel
          ↓
    net / 3D cube
          ↓
    cube question

OBJECTS
    semantic ObjectModel
          ↓
    3D / orthographic views
          ↓
    spatial question
```

The authoring experience should feel related because it belongs to the
same CREATIVE family.

The geometry and question engine must remain independent because the
domains are different.

------------------------------------------------------------------------

# 92. Final Product Principle

The module should optimize for one question:

> **Can an author quickly construct a precise spatial object and turn it
> into a high-quality spatial-reasoning question?**

Not:

> Can the application become a general-purpose 3D modeller?

The desired experience is:

``` text
SEE
  ↓
BUILD
  ↓
MANIPULATE
  ↓
INSPECT
  ↓
QUESTION
  ↓
VALIDATE
  ↓
SAVE
```

The interface should remain simple because the **semantic engine
underneath is doing the hard work**.

------------------------------------------------------------------------

# 93. Changelog

## v1.3 --- 2026-10-03

Phase 1a built (§A.13).

## v1.2 --- 2026-10-03

M0 built (§A.12, ADR-0012).

## v1.1 --- 2026-10-03

Design review decisions recorded in Part A (OB-D1 … OB-D6): blocks
first, 2D figures included, isometric line drawings, exact correctness,
gestures, merged difficulty / DNA, options as data, milestones re-cut.

## v1.0 --- 2026-10-03

Initial Phase 1 Product & Engineering Specification.

Established:

-   OBJECTS as a CREATIVE authoring module;
-   Build → Question → Validate → Commit workflow;
-   semantic ObjectModel as single source of truth;
-   primitive + boolean + profile/extrude construction;
-   direct 3D manipulation;
-   temporary orthographic views;
-   semantic surface snapping;
-   contextual dimensions and transforms;
-   construction tree;
-   spatial question families;
-   five-option question model;
-   deterministic distractors and correctness;
-   manual author override;
-   permanent IDs and versions;
-   Question Bank;
-   SQLite persistence;
-   offline-first operation;
-   autosave;
-   undo/redo;
-   Test and Analysis placeholders;
-   Android device testing and milestone structure.
