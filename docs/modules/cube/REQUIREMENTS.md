> **Document:** CUBE requirements · **Version:** v1.3 (0.22.0, 2026-10-03) · **Location:** `docs/modules/cube/REQUIREMENTS.md` · **Part of:** CREATIVE (`docs/CREATIVE.md`)
>
> **Revisions:** v1.3 (0.22.0, 2026-10-03) — Phone layout: the board area takes the board's shape (no empty band), net status and Fit under the board, the properties clear of the phone's navigation bar (§62.11). · v1.2 (0.15.0, 2026-10-01) — Design-step rework after device testing (§62.10): 4 × 4 board, draw anywhere and trim to the faces, soft snap points, Fill tool, one Shape tool, image as a board-wide skin, New, 3D pop-up; full-width question cards; Question Bank details under each question, 10 a page; faces no longer move when artwork is dragged. · v1.1 (0.13.0, 2026-10-01) — Phase 1 built; §62 records what was built and the choices made where this specification leaves room. · v1.0 (2026-10-01) — Phase 1 Product & Engineering Specification, as written by the developer (§1–§61 below, unchanged).

# CUBE Module — Phase 1 Product & Engineering Specification

**Parent application:** CREATIVE  
**Module:** CUBE  
**Phase:** 1 — Studio / Question Authoring / Question Bank  
**Status:** Implementation specification  
**Primary target:** Android via the existing CREATIVE Capacitor application  
**Primary user:** Educator / mentor / question designer  
**Authoring domain:** Six-face single-sided cube spatial-visualisation questions

---

## 1. Executive Summary

CUBE is a specialized spatial-visualisation question-authoring module inside the existing **CREATIVE** application.

Its purpose is to let an educator visually construct, validate, classify, and permanently store high-quality six-face cube/net questions for spatial reasoning practice.

The Phase 1 workflow is:

```text
IDEA
  ↓
CREATE CUBE / NET
  ↓
DESIGN SIX FACES
  ↓
INSPECT LIVE 3D CUBE
  ↓
FRAME QUESTION
  ↓
GENERATE / EDIT 5 OPTIONS
  ↓
VALIDATE GEOMETRY + QUESTION
  ↓
COMMIT
  ↓
QUESTION BANK → Cube → Q_ID
```

The long-term value of CUBE is **not the drawing itself**. The important asset is the structured, machine-readable spatial model behind every question.

That model must preserve enough information to:

- reconstruct the question later,
- generate variants,
- explain the answer,
- classify difficulty,
- analyse student errors,
- support Phase 2 test delivery,
- support Phase 3 student analysis,
- and allow future AI systems to regenerate or study the question.

---

# 2. Product Vision

### CUBE should feel like:

**A simple visual design studio + interactive cube + intelligent question builder.**

It should **not** feel like:

- CAD software
- Blender
- Photoshop
- a complicated 3D editor
- a generic drawing application
- a programming tool

The desired experience is:

> **Direct, visual, precise, fast and almost self-explanatory.**

The user should be able to construct a sophisticated cube question without needing to understand the underlying mathematics.

---

# 3. Parent Application Context

CUBE is **not a standalone application**.

It is one module within:

```text
CREATIVE
│
├── PERSPECTIVE
│
├── CUBE
│
└── Future modules
```

PERSPECTIVE already establishes the application's technology, navigation, design language and interaction conventions.

CUBE must reuse existing CREATIVE/PERSPECTIVE infrastructure wherever practical.

### Do not:

- create a second application shell;
- introduce a new UI framework;
- duplicate existing infrastructure;
- redesign unrelated modules;
- migrate PERSPECTIVE;
- introduce React Native;
- introduce Flutter.

---

# 4. Rollout Strategy

CUBE has three planned phases.

## Phase 1 — STUDIO

**Implemented now.**

Everything from cube creation through committed question-bank item.

```text
Create
→ Design
→ Validate
→ Question
→ Options
→ Commit
→ Question Bank
```

## Phase 2 — TEST MANAGEMENT

**Placeholder only in Phase 1.**

Future scope:

- test creation
- question selection
- test delivery
- answer collection
- timing
- test attempts
- results

## Phase 3 — RESULT ANALYSIS ENGINE

**Placeholder only in Phase 1.**

Future scope:

- student performance
- error classification
- spatial skill analysis
- difficulty calibration
- timing analysis
- progression
- SWOT-style diagnostic reports
- adaptive practice

### Important

Phase 1 must **not implement Phase 2 or Phase 3 functionality**, but its data model must preserve the information required for them.

---

# 5. Technology Stack

Use the existing CREATIVE stack.

| Responsibility | Technology |
|---|---|
| Application/UI | React |
| Language/domain model | TypeScript |
| 2D Net Canvas | Konva |
| 3D Cube | Three.js / WebGL |
| Local persistence | SQLite via `@capacitor-community/sqlite` |
| Android bridge | Existing Capacitor architecture |
| Future AI | Provider-independent interface |

## Explicitly do NOT introduce

- React Native
- Flutter
- Skia
- Filament
- another application framework

The existing React + TypeScript + Konva architecture is intentional and should be preserved.

---

# 6. Core Architecture Principle

## THE CUBEMODEL IS THE SINGLE SOURCE OF TRUTH

This is a mandatory architectural principle.

```text
                       CubeModel
                          │
                 ┌────────┴────────┐
                 │                 │
               Konva            Three.js
              2D Net              3D
                 │                 │
                 └────────┬────────┘
                          │
                    Question Engine
                          │
                         JSON
                          │
                        SQLite
```

### Konva

Renders and edits the unfolded net.

### Three.js

Renders and manipulates the folded 3D cube.

### SQLite

Persists the semantic question model and assets.

### React

Provides the application and interaction layer.

### TypeScript

Owns the domain model and geometry/question logic.

**Neither Konva nor Three.js is allowed to become the authoritative representation of the cube.**

---

# 7. Cube Scope

Phase 1 supports only:

> **One standard cube consisting of six single-sided square faces.**

Do not support:

- Rubik's cubes
- multi-layer cubes
- cuboids
- rectangular boxes
- irregular solids
- multiple-cube assemblies
- dice mechanics

The geometry model must represent:

- 6 faces
- 12 edges
- 8 vertices
- 3 opposite-face pairs
- 4 adjacent faces per face

---

# 8. Core Spatial Rules

The geometry engine must understand at least these rules.

### Rule 1 — Six faces

A valid cube consists of six square faces.

### Rule 2 — One opposite face

Every face has exactly one opposite face.

### Rule 3 — Four adjacent faces

Every face has exactly four neighbours.

### Rule 4 — Opposite faces never touch

Two opposite faces cannot be visible together at one cube corner.

### Rule 5 — Three visible corner faces are mutually adjacent

Every ordinary cube corner contains three mutually adjacent faces.

### Rule 6 — Face artwork rotates with the face

Artwork must preserve physical orientation through folding.

### Rule 7 — Valid net must close without collision

The six squares must fold into six distinct cube faces.

### Rule 8 — Single-sided artwork

The source artwork is assumed to be on one side of the net.

---

# 9. CUBE Studio UX

The primary Studio workspace should contain three logical areas:

```text
┌─────────────────────────────────────────────────────────┐
│ CUBE STUDIO                                   Save      │
├───────────────┬───────────────────────────┬─────────────┤
│               │                           │             │
│    TOOLS      │       NET CANVAS          │  3D CUBE    │
│               │                           │             │
│               │                           │             │
│               │                           │             │
├───────────────┴───────────────────────────┴─────────────┤
│ Contextual properties / question controls               │
└─────────────────────────────────────────────────────────┘
```

The exact responsive layout may adapt to the available Android screen size.

The design should remain uncluttered.

---

# 10. Net Canvas

The Net Canvas is the main authoring surface.

It must support six square faces arranged in a valid or potentially valid net.

Example:

```text
        ┌─────┐
        │  A  │
        └─────┘
┌─────┬─────┬─────┬─────┐
│  B  │  C  │  D  │  E  │
└─────┴─────┴─────┴─────┘
        ┌─────┐
        │  F  │
        └─────┘
```

Each face is a semantic object, not merely a rectangle.

The canvas must support:

- pan
- zoom
- selection
- face selection
- artwork selection
- drag
- transform
- rotate
- resize
- snapping
- undo
- redo

---

# 11. Net Presets

Provide useful starting layouts.

Minimum suggested presets:

- Classic Cross
- Offset Cross
- Zig-Zag
- Long Strip
- Custom

Do not overwhelm the user with dozens of presets.

The user must be able to start from a preset and modify it.

---

# 12. Net Validation

A net is not valid merely because it contains six squares.

The geometry engine must determine whether the six faces can fold into a valid cube.

Validation should detect:

- fewer than six faces
- more than six faces
- overlapping faces
- disconnected faces
- invalid topology
- folding collisions
- duplicate resulting cube face
- impossible orientation

The UI should clearly indicate:

```text
✓ Valid cube net
```

or:

```text
⚠ Net cannot form a cube
```

with a concise explanation.

---

# 13. Face Editing

Each face should support:

### Basic appearance

- background colour
- transparency

### Drawing

- pen
- line
- rectangle
- circle/ellipse
- polygon
- arrow
- eraser

### Text

- text
- letters
- numbers
- simple symbols

### Images

- import from device/gallery
- paste image
- crop
- resize
- rotate
- move
- opacity

### Stamps

Provide reusable standard stamps:

- circle
- square
- triangle
- star
- heart
- arrows
- numbers
- letters
- geometric symbols

The stamp library should be extensible.

---

# 14. Artwork Model

Artwork should be represented semantically rather than flattened into a single bitmap.

Conceptually:

```text
ArtworkElement
│
├── Path
├── Image
├── Shape
├── Text
├── Stamp
└── Pattern
```

Each element should support properties such as:

- position
- scale
- rotation
- opacity
- z-index
- clipping
- transform

Prefer vector/semantic storage wherever practical.

Raster assets should remain supported.

---

# 15. Face-Local Coordinates

Artwork must use face-local coordinates rather than raw screen coordinates.

For example:

```json
{
  "face": "C",
  "x": 0.42,
  "y": 0.63,
  "rotation": 17
}
```

not:

```json
{
  "screenX": 483,
  "screenY": 217
}
```

This is essential for:

- resizing the canvas
- rendering the cube
- exporting
- reconstructing questions
- AI generation
- device independence

---

# 16. Continuous Pattern / Surface Skin

CUBE must support continuous artwork spanning multiple faces.

Example:

```text
        A
B       C       D
        F
```

A single graphic may span:

```text
A → C → D
```

The system must preserve the artwork as a surface-level object where possible.

Do not create unrelated copies of the same artwork merely because it crosses faces.

Conceptually:

```text
SurfacePattern
├── sourceAsset
├── affectedFaces[]
├── surfaceTransform
├── clipping
└── continuityMode
```

This enables the same pattern to be rendered correctly:

- on the unfolded net
- on the folded cube
- in answer options
- in exported images

---

# 17. Pattern Continuity

The system should be able to validate continuity across a shared edge.

For example:

```text
Face A
   │
   │ fold
   ▼
Face C
```

A line crossing the edge must preserve the intended physical relationship.

The system must distinguish between:

- rotation
- translation
- mirror/reversal

Artwork must not be silently mirrored during folding.

---

# 18. Snap and Alignment

Support intuitive snapping:

- centre
- face edges
- corners
- centre lines
- 45°
- 90°
- neighbouring alignment

Snapping should be automatic and subtle.

Avoid exposing unnecessary technical configuration.

---

# 19. Gallery / Asset Import

Workflow:

```text
Gallery
  ↓
Select image
  ↓
Place on face
  ↓
Transform
  ↓
Crop / mask
  ↓
Commit
```

Imported assets must have stable internal asset IDs.

Do not store temporary device paths inside question JSON.

---

# 20. Live 3D Cube

Three.js renders a live cube corresponding to the current CubeModel.

Required interactions:

- drag to rotate
- pinch to zoom
- reset orientation
- smooth rotation
- standard views
- face selection
- face highlighting

Suggested standard views:

- front
- top
- right
- reset/isometric

---

# 21. Bidirectional Net ↔ Cube Synchronization

This is one of the most important features.

If the user selects Face C in the Net Canvas:

> Face C becomes highlighted in the 3D cube.

If the user selects Face C in the 3D cube:

> Face C becomes highlighted in the net.

Both are views of the same CubeModel.

Do not implement separate cube and net state.

---

# 22. Cube Geometry Engine

Implement a pure TypeScript spatial engine.

It should contain no dependencies on:

- React
- Konva
- Three.js
- SQLite

Responsibilities:

### Topology

- adjacency
- opposite faces
- edge relationships
- corner relationships

### Net validation

- valid net
- invalid net
- overlap
- disconnected layout
- folding collision

### Folding

- map net faces to cube faces
- calculate orientation
- calculate edge correspondence

### View

- visible faces
- orientation
- cube configuration

### Pattern

- artwork orientation
- face-local transformations
- seam continuity

This engine is the intellectual core of CUBE.

---

# 23. Question Types

Phase 1 must support two primary question formats.

## Type A — Cube → Net

Show:

- one cube OR two cube views

Provide:

- five net choices

Task:

> Select the correct net.

---

## Type B — Net → Cube

Show:

- one net OR two nets

Provide:

- five cube choices

Task:

> Select the correct cube.

The architecture should allow additional cube question types later without changing the underlying CubeModel.

---

# 24. Question Builder

Once the spatial object is satisfactory:

```text
CREATE QUESTION
```

The author chooses:

```text
Cube → Net
```

or:

```text
Net → Cube
```

The system creates the corresponding question structure.

---

# 25. Five Answer Options

Every Phase 1 question contains:

> **Exactly five answer options.**

Default answer model:

```text
1 correct
4 distractors
```

The system should make the correct answer explicit in the semantic model.

---

# 26. Distractor Engine

Distractors should be generated using meaningful spatial error rules.

Supported classes should include:

```text
D01 — Opposite-face violation
D02 — Wrong adjacency
D03 — Wrong corner relationship
D04 — Wrong orientation
D05 — Mirrored pattern
D06 — Rotated pattern
D07 — Invalid net
D08 — Broken pattern continuity
D09 — Wrong viewpoint
```

The generator should know which rule produced each distractor.

Example:

```json
{
  "option": 3,
  "type": "wrong_orientation",
  "rule": "ORIENTATION_02"
}
```

---

# 27. Manual Override

The author must be able to override automation.

Allow:

- replace option
- edit option
- reorder options
- set correct answer
- modify face artwork
- modify net
- change orientation
- change distractor type
- regenerate one option
- regenerate all options

The author always has final authority.

---

# 28. Automatic Question Construction

The Studio should eventually support:

```text
Generate Question
```

based on selected constraints.

Example:

```text
Question:
    Net → Cube

Topology:
    Medium

Orientation:
    Hard

Pattern:
    Continuous

Distractors:
    Orientation
    Mirror
    Adjacency
    Invalid net
```

The system generates a candidate question.

The user reviews it and can modify it manually.

---

# 29. Difficulty Model

Do not use a single scalar difficulty as the primary representation.

Store multiple dimensions.

Minimum:

```text
topology
adjacency
oppositeFaceReasoning
orientation
patternComplexity
transformationComplexity
distractorSimilarity
visualComplexity
```

Use a simple 1–5 scale:

```text
1 = low
2 = basic
3 = moderate
4 = difficult
5 = very difficult
```

A future engine may calculate overall difficulty from these dimensions.

---

# 30. Question DNA

Each question must contain machine-readable metadata describing its construction.

Example:

```json
{
  "family": "cube",
  "operation": "net_to_cube",
  "faceCount": 6,
  "optionCount": 5,

  "skills": {
    "topology": 2,
    "adjacency": 3,
    "orientation": 5,
    "patternContinuity": 4
  },

  "distractors": [
    "wrong_orientation",
    "mirror",
    "wrong_adjacency",
    "invalid_net"
  ]
}
```

This metadata is critical for future analysis.

---

# 31. Question Validation

Before commit, the system must validate:

## Spatial validity

- six faces
- valid net
- no collisions
- valid folding
- valid opposite relationships
- valid orientation

## Artwork

- assets exist
- transforms are valid
- no broken references

## Question

- correct answer exists
- exactly five options
- options render correctly
- intended distractor rules are satisfied
- no unintended second correct answer

## Metadata

- question type
- skills
- difficulty
- construction rules

Only a validated question can be committed.

---

# 32. Permanent Question ID

Every committed question receives an immutable ID.

Format:

```text
CUBE-Q-000001
CUBE-Q-000002
CUBE-Q-000003
```

The ID must never change.

---

# 33. Versioning

A question may be edited after creation.

Do not overwrite historical versions.

Example:

```text
CUBE-Q-000127
    v1
    v2
    v3
```

A future test attempt must reference the exact question version used.

This guarantees reproducibility.

---

# 34. Canonical Question JSON

The JSON is the authoritative portable representation.

Example structure:

```json
{
  "schema": "creative.cube.question.v1",

  "questionId": "CUBE-Q-000127",
  "version": 1,

  "spatialModel": {},

  "presentation": {
    "type": "net_to_cube",
    "optionCount": 5
  },

  "difficulty": {},

  "rules": [],

  "answer": {},

  "explanation": {},

  "assets": []
}
```

The exact schema may evolve, but it must be versioned.

---

# 35. AI Reconstruction Requirement

The JSON must contain enough semantic information for a future AI to reconstruct the question without relying on a screenshot.

AI must be able to understand:

- cube topology
- face identities
- net layout
- artwork
- orientation
- question type
- options
- correct answer
- distractor logic
- difficulty
- explanation

Images are presentation assets.

The semantic model is authoritative.

---

# 36. Explanation Model

Store machine-readable reasoning for the answer.

Example:

```json
{
  "correctOption": 3,
  "reasoning": [
    {
      "rule": "adjacency",
      "statement": "A and C are adjacent."
    },
    {
      "rule": "opposition",
      "statement": "B is opposite E."
    },
    {
      "rule": "orientation",
      "statement": "The line rotates correctly across the fold."
    }
  ]
}
```

This allows future systems to generate:

- short explanations
- detailed explanations
- student-specific explanations
- AI tutoring explanations

---

# 37. Question Bank

After commit:

```text
Question Bank
└── Cube
    ├── CUBE-Q-000001
    ├── CUBE-Q-000002
    ├── CUBE-Q-000003
    └── ...
```

Minimum Phase 1 operations:

- search
- filter
- preview
- edit
- duplicate
- generate variant
- view metadata
- view versions

Useful filters:

- question type
- difficulty
- skill
- pattern type
- distractor type
- date
- ID

---

# 38. Duplicate and Variant

Support:

### Duplicate

Creates a new independent question.

### Generate Variant

Preserves the same skill profile while changing visual content.

Possible changes:

- symbols
- colours
- patterns
- net arrangement
- artwork
- distractors

The purpose is to prevent simple memorisation.

---

# 39. Database

Use:

`@capacitor-community/sqlite`

CUBE may initially use:

```text
cube.db
```

Keep the persistence behind a repository/data-access layer.

Suggested logical tables:

```text
cube_questions
cube_question_versions
cube_assets

-- placeholders for future phases
cube_tests
cube_attempts
cube_responses
cube_analysis
```

Phase 1 primarily implements the first three.

---

# 40. Repository Layer

React components must not execute SQL directly.

Use:

```text
UI
 ↓
Cube Services
 ↓
Repository
 ↓
SQLite
```

Example:

```text
QuestionRepository
├── create()
├── update()
├── get()
├── list()
├── duplicate()
└── version()
```

This makes the persistence layer replaceable later.

---

# 41. Offline First

Phase 1 must work fully offline.

The user must be able to:

- create questions
- edit questions
- save questions
- browse the question bank
- generate previews
- validate geometry

without an internet connection.

AI is optional future functionality and must not be required for core authoring.

---

# 42. Autosave

Draft work must be autosaved locally.

Prevent loss caused by:

- app closure
- navigation
- crash
- Android memory pressure
- accidental interruption

Use unobtrusive status such as:

```text
Saved
Saving…
```

---

# 43. Undo / Redo

Undo/redo is mandatory for the authoring canvas.

It should cover:

- drawing
- deleting
- moving
- resizing
- rotation
- colour changes
- image changes
- pattern changes
- face changes

---

# 44. Touch-first Interaction

The application is intended for Android.

Support:

- tap
- drag
- pinch zoom
- pan
- rotate
- two-finger canvas navigation where appropriate

Touch targets must be sufficiently large.

Do not design tiny desktop-style controls.

Mouse/keyboard support may also be retained for desktop development/use.

---

# 45. UX Principles

### Direct manipulation

If an object looks movable, drag it.

### Contextual controls

Show properties relevant to the selected object.

### Minimal dialogs

Prefer inline controls.

### Immediate feedback

Selections, snapping, validation and errors should be visible immediately.

### No unnecessary modes

Avoid complicated hidden states.

### Fast recovery

Undo, reset and clear should always be accessible.

---

# 46. Visual Design

The interface should be:

- modern
- minimal
- calm
- precise
- spacious
- visually clear

Target design language:

> **Figma / Apple Freeform / modern educational studio**

Avoid:

> CAD / Blender / Photoshop complexity.

The cube and artwork should visually dominate the UI.

---

# 47. Export

Phase 1 should support:

### Preview

PNG

### Artwork

PNG and SVG where appropriate

### Question

Structured JSON

### Future package

A question package can eventually contain:

```text
CUBE-Q-000127/
├── question.json
├── assets/
└── preview/
```

---

# 48. Phase 2 Placeholder

Navigation should expose:

```text
CUBE
├── Studio
├── Test
└── Analysis
```

Test page should be a simple placeholder.

Example:

> **Test Management**  
> Phase 2

Do not implement test functionality in Phase 1.

---

# 49. Phase 3 Placeholder

Analysis page should be a simple placeholder.

Example:

> **Result Analysis**  
> Phase 3

Do not implement analytics in Phase 1.

---

# 50. Future Student Data Contract

Although Phase 2 is not implemented, the Phase 1 question model must eventually support a response record such as:

```json
{
  "testId": "...",
  "attemptId": "...",
  "questionId": "CUBE-Q-000127",
  "questionVersion": 2,
  "selectedOption": 4,
  "correctOption": 3,
  "correct": false,
  "timeTakenMs": 18400,
  "timestamp": "...",
  "confidence": null
}
```

The question itself must remain independent from these attempt records.

---

# 51. Important Separation: Question vs Attempt

A question is a permanent knowledge asset.

An attempt is a student event.

Do not mix them.

Correct conceptual structure:

```text
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

Never put student responses inside the canonical question object.

---

# 52. Future Analysis Compatibility

Question metadata should make future analysis possible.

For example:

```text
Question
│
├── topology = 2
├── adjacency = 3
├── orientation = 5
├── continuity = 4
└── distractor = mirror
```

Later:

```text
Student Response
       ↓
Question DNA
       ↓
Error Pattern
       ↓
Skill Profile
```

This is why Question DNA is required in Phase 1.

---

# 53. Recommended Folder Structure

Adapt this to the conventions already established by PERSPECTIVE.

Suggested structure:

```text
src/modules/cube/

├── CubeModule.tsx
│
├── components/
│   ├── CubeStudio.tsx
│   ├── NetCanvas.tsx
│   ├── Cube3DViewer.tsx
│   ├── ToolBar.tsx
│   ├── PropertiesPanel.tsx
│   ├── QuestionBuilder.tsx
│   ├── OptionEditor.tsx
│   ├── ValidationPanel.tsx
│   └── QuestionBank.tsx
│
├── model/
│   ├── CubeModel.ts
│   ├── FaceModel.ts
│   ├── NetModel.ts
│   ├── ArtworkModel.ts
│   └── QuestionModel.ts
│
├── geometry/
│   ├── CubeGeometry.ts
│   ├── NetValidator.ts
│   ├── FoldingEngine.ts
│   ├── Adjacency.ts
│   ├── Orientation.ts
│   └── PatternContinuity.ts
│
├── question/
│   ├── QuestionEngine.ts
│   ├── DistractorEngine.ts
│   ├── DifficultyEngine.ts
│   ├── QuestionValidator.ts
│   └── QuestionDNA.ts
│
├── canvas/
│   ├── NetRenderer.ts
│   ├── FaceRenderer.ts
│   ├── ArtworkRenderer.ts
│   └── Interaction.ts
│
├── cube3d/
│   ├── CubeRenderer.ts
│   ├── CubeMaterials.ts
│   └── CubeInteraction.ts
│
├── database/
│   ├── CubeDatabase.ts
│   ├── QuestionRepository.ts
│   └── AssetRepository.ts
│
├── types/
│
└── index.ts
```

The exact folder structure must follow the existing CREATIVE conventions where they differ.

---

# 54. Implementation Instructions for Claude

Before modifying code, Claude must inspect the existing CREATIVE/PERSPECTIVE implementation.

Inspect:

1. project structure
2. routing
3. module conventions
4. existing Konva implementation
5. SQLite implementation
6. asset management
7. styling/design system
8. reusable components
9. Capacitor configuration
10. build/deployment process

Then implement CUBE using those established patterns.

Do not create parallel infrastructure unless the existing architecture genuinely cannot support the requirement.

---

# 55. Claude Must Not

Do NOT:

- create a standalone CUBE application
- migrate CUBE to Flutter
- migrate CUBE to React Native
- introduce Skia
- introduce Filament
- replace Konva
- replace Three.js
- redesign PERSPECTIVE
- modify unrelated CREATIVE modules
- create a second application shell
- put cube mathematics inside React components
- use AI as the authority for geometric validity
- store only screenshots as questions
- hard-code question IDs
- couple semantic question data to screen coordinates
- execute SQLite queries directly from React components
- implement Phase 2 prematurely
- implement Phase 3 prematurely

---

# 56. Claude Should

Claude should:

1. Reuse CREATIVE/PERSPECTIVE infrastructure.
2. Create CUBE under `src/modules/cube/`.
3. Build the semantic CubeModel first.
4. Build the geometry engine independently.
5. Build the Net Canvas around the model.
6. Build the Three.js cube around the same model.
7. Implement bidirectional face selection.
8. Implement question construction.
9. Implement intentional distractors.
10. Implement validation.
11. Implement permanent IDs and versioning.
12. Persist questions through a repository layer.
13. Make the system offline-first.
14. Add autosave and undo/redo.
15. Add Phase 2/3 navigation placeholders only.

---

# 57. Definition of Done — Phase 1

Phase 1 is complete when a user can perform this entire workflow:

```text
1. Open CREATIVE
        ↓
2. Open CUBE
        ↓
3. Create/select a cube net
        ↓
4. Edit all six faces
        ↓
5. Draw artwork
        ↓
6. Import images
        ↓
7. Use stamps and colours
        ↓
8. Create continuous patterns
        ↓
9. Rotate/inspect live 3D cube
        ↓
10. Select corresponding faces in either view
        ↓
11. Validate the cube
        ↓
12. Choose:
       Cube → Net
       OR
       Net → Cube
        ↓
13. Create 5 options
        ↓
14. Generate/edit distractors
        ↓
15. Select correct answer
        ↓
16. Define difficulty/skill metadata
        ↓
17. Validate question
        ↓
18. Commit
        ↓
19. Generate permanent CUBE-Q-ID
        ↓
20. Save to Question Bank → Cube
        ↓
21. Close/reopen app
        ↓
22. Question remains reconstructable
```

---

# 58. Quality Gates

Before considering Phase 1 complete, verify:

### Geometry

- [ ] All six-face cube nets behave correctly.
- [ ] Opposite-face relationships are correct.
- [ ] Adjacency relationships are correct.
- [ ] Folding is deterministic.
- [ ] Invalid nets are rejected.
- [ ] Artwork orientation survives folding.
- [ ] Continuous patterns render correctly.

### Canvas

- [ ] Touch interaction is smooth.
- [ ] Drawing is responsive.
- [ ] Images transform correctly.
- [ ] Snapping works.
- [ ] Undo/redo works.
- [ ] Autosave works.

### 3D

- [ ] Cube rotates smoothly.
- [ ] Face selection synchronizes with net.
- [ ] Net changes immediately update cube.
- [ ] Cube changes immediately update semantic selection.

### Question engine

- [ ] Five options are supported.
- [ ] Correct answer is deterministic.
- [ ] Distractors are intentional.
- [ ] Question validation detects ambiguity.
- [ ] Difficulty metadata is saved.
- [ ] Question DNA is saved.

### Persistence

- [ ] Questions survive app restart.
- [ ] Assets remain linked.
- [ ] Question IDs are permanent.
- [ ] Versions are preserved.
- [ ] JSON can reconstruct the question.

### Architecture

- [ ] Geometry engine is UI-independent.
- [ ] Konva does not own semantic state.
- [ ] Three.js does not own semantic state.
- [ ] UI does not execute SQL directly.
- [ ] Phase 2 and Phase 3 remain placeholders.

---

# 59. Most Important Architectural Rule

> ## The CubeModel is the source of truth.
>
> **React** orchestrates the interface.  
> **Konva** renders the unfolded net.  
> **Three.js** renders the folded cube.  
> **TypeScript** owns the spatial and question logic.  
> **SQLite** persists the data.  
> **The Question JSON** is the portable semantic representation.

If any rendering technology is replaced in the future, the underlying question data, cube mathematics, question IDs, versions and student history must remain usable.

---

# 60. Product Success Criterion

The success of Phase 1 is not:

> “Can we draw a cube?”

It is:

> **Can an educator create a visually sophisticated, geometrically valid, machine-readable six-face cube question in a few minutes, with five defensible answer choices, commit it permanently to the question bank, and later reconstruct exactly what was created?**

If yes, Phase 1 has achieved its purpose.

---

# 61. Long-Term Direction

The intended evolution is:

```text
                    CUBE
                     │
        ┌────────────┼────────────┐
        │            │            │
      STUDIO        TEST       ANALYSIS
        │            │            │
      CREATE       DELIVER       STUDY
        │            │            │
        └────────────┼────────────┘
                     │
             SPATIAL KNOWLEDGE
                     │
          ┌──────────┴──────────┐
          │                     │
     QUESTION BANK        STUDENT MODEL
```

Phase 1 creates the **spatial knowledge foundation**.

Phase 2 creates the **student response dataset**.

Phase 3 turns both into a **spatial-visualisation learning and diagnostic system**.

---

# 62. As built in 0.13.0 (Phase 1)

Choices made where this specification leaves room, and known limits. Code: `src/modules/cube/`.

## 62.1 Architecture

- **Folders.** `model/` (CubeModel, QuestionModel, JSON schema, stamps, pure edits), `geometry/` (CubeGeometry, FoldingEngine, NetValidator, NetShapes, Orientation, PatternContinuity), `question/` (QuestionEngine, DistractorEngine, QuestionValidator, VariantEngine, seeded Random), `render/` (SVG renderer, rasterising), `canvas/` (gesture → element helpers), `cube3d/` (Three.js renderer), `database/` (tables, repositories, native SQLite driver, IndexedDB fallback), `services/` (CubeService), `state/` (zustand store), `components/` (React), `CubeModule.tsx`, `index.ts`.
- **Single source of truth (§6, §59).** Only the CubeModel and the Question are stored; Konva and Three.js render them. Lint (`eslint.config.js`, elements `cube-core` and `cube`) makes `model/ geometry/ question/ render/` pure — no React, Konva, Three.js, Capacitor, SQLite, DOM — and forbids CUBE from importing PERSPECTIVE.
- **Lazy module.** CUBE (with Three.js, ~160 kB gzip) is a separate chunk loaded when its tile is opened; PERSPECTIVE's start-up is unchanged.

## 62.2 Geometry engine (§7, §8, §12, §22)

- The net lies on z = 0; folding walks the cells breadth-first, each fold a 90° hinge (frames P, U, V, N). Each face gets a side (±X, ±Y, ±Z) and its own x / y axes; a face's artwork frame is its cell frame turned by the cell's `turns` (Rule 6). Folding is a rigid motion — no face is ever mirrored (property-tested on all 11 nets × random turns).
- **Nets.** All 35 hexominoes are enumerated; exactly 11 fold (tested). Validation reports: too few / too many faces, duplicate or missing face, off-grid, overlap, disconnected, collision (two faces on one side, e.g. a 2 × 2 block).
- **Cube state, views.** 24 proper rotations; a *view* is the top / front / right faces seen from the corner (1, −1, 1), each with on-screen quarter turns and a mirrored flag. Two figures "look the same" up to each face's rotational symmetry (blank faces: any turn; faces with artwork: none, unless the author sets "Looks the same when turned"); mirroring is invisible on blank faces.
- **Unfold.** Any cube can be laid out on any of the 11 nets in any orientation, keeping artwork orientation (round-trip tested).

## 62.3 Artwork (§13–§19)

- Elements: `path` (pen, line, arrow, rectangle, ellipse, regular polygon), `stamp` (14 shapes, `model/Stamps.ts`, extensible; letters / digits are text stamps), `text`, `image`. Geometry in element-local units, placed by a face-local transform (centre x, y, rotation, scale) — never screen coordinates (§15).
- **Surface patterns (§16, §17).** An element that crosses a fold becomes one `SurfacePattern`: the source element, its anchor face, and a face-local fragment per covered face (clipped to that face). No copies. Moving it re-anchors it on the face it was dragged on. `continuityKept()` checks whether a cube keeps every pattern's faces in their relative place and orientation (used by D08).
- **Images (§19, v1.2).** Picked from the gallery (Image tool) or pasted; scaled to ≤ 1024 px; stored once under a stable id `asset-<uuid>` in `cube_assets`; elements reference the id. A new picture is laid over the **whole board as a skin** (faint outside the faces, solid over them); the author moves, scales and turns it, then **Done** trims it to the faces — one surface pattern across every face it covers (Cancel drops it). Afterwards it moves / scales / turns with the transformer like any element; opacity. (Crop fractions are still read from older drafts; the crop sliders are gone.)
- **Drawing on the board (v1.2).** Pen and shapes may start anywhere on the board; the drawing belongs to the face under its middle (else the nearest face) and everything outside the faces is trimmed by the faces' clips. A drawing entirely on the bare board is refused with a notice.
- **Snapping (§18, v1.2).** Each face shows **soft snap points** (a 5 × 5 grid: edges, quarters, centre) while Select, Shape, Text or Stamp is active. Shape corners, stamp and text taps and element moves are pulled onto a point within 0.07 face units, so placements and sizes repeat; stamps and text come in S / M / L (0.25 / 0.4 / 0.6 of a face). Rotation snaps to 45° steps; lines and arrows to 45°.
- **Fill tool (v1.2):** tap a face to fill it — white (clears) and four tones (light grey, black, red, blue). The same colours in the face properties.
- Face properties: colour, transparency, symmetry; turn a face on the net; clear.

## 62.4 Studio UX (§9–§11, §20, §21, §43–§46)

- Tabs: **Studio · Question Bank · Test · Analysis** (Test / Analysis: Phase 2 / Phase 3 placeholders only). Studio has two steps: **1 · Design cube**, **2 · Question**.
- Tools (v1.2): **New** (a blank cube; the previous one is one Undo away), Undo, Redo, **3D** (pop-up) · Select, Net, Pen, **Shape** (line, arrow, rectangle, ellipse, polygon — chosen below the board), Text, Stamp, Image, **Fill**, Eraser. Phone: two rows of tools, the board, properties below (page scrolls). Wide screens: tools left, board centre, properties right.
- Net canvas (v1.2): the net sits on an always-visible **4 × 4 hairline board** (larger only for a net that does not fit, e.g. a loaded 2 × 5 variant); **Fit** fits the board. Tap a face to select it, tap an element to select it (transformer handles: move, scale, rotate). **Faces move only with the Net tool**, to board cells (dropping on a face swaps them); dragging artwork never moves a face. Presets Classic cross, Offset cross, Zig-zag, Long strip; Custom = any arrangement. Older drafts are moved to the board's top-left corner on load. Validity shown live ("✓ Valid cube net" / "⚠ Net cannot form a cube — reason"); offending faces outlined red. Two-finger pinch / pan, wheel zoom.
- 3D cube (v1.2: a pop-up from the 3D tool in Design; not shown in Question): drag to turn, pinch / wheel to zoom, Reset (corner view), Front, Top, Right; tap a face to select it.
- Question step (v1.2): the builder uses the full width (option cards two per row on a phone). Faces are unlit (true colours) and shaded by how squarely they face the viewer; the selected face is tinted. Selection is one value in the store, shown by both views (§21).
- Undo / redo: 100 steps covering every model change; a drag is one step. Keyboard Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y on desktop.
- Autosave (§42): 0.8 s after any change and when the app goes to the background; "Saving… / Saved" in the header; the draft (model, question, editing state) is restored on reopen.

## 62.5 Questions (§23–§36)

- **Types.** Net → Cube (stem: the authored net, or 2 nets — the second another valid net of the same cube) and Cube → Net (stem: one corner view, or 2 views showing all six faces). Options are cube views or nets respectively; exactly five.
- **Correctness (§31).** Net → Cube: an option is correct iff the authored cube shows that view from some direction. Cube → Net: iff the net folds and shows every stem view. Every option is checked; a second correct option, a wrong key, duplicates and wrong option kinds are errors. Generation is seeded (reproducible).
- **Distractors (§26).** D01 opposite faces touching · D02 wrong neighbours (swapped faces) · D03 wrong corner (the third face replaced by its opposite) · D04 face turned a quarter · D05 mirrored face · D06 face upside down · D07 net that cannot fold (cube → net only) · D08 pattern broken across a fold · D09 wrong cyclic order of the corner (net → cube only). Each option records `code`, `type`, `rule` (e.g. `ORIENTATION_01`) and a one-line note. Requested rules are used first, others fill in when a rule cannot apply (e.g. D05 on blank faces).
- **Overrides (§27).** Mark correct, regenerate one option (also the correct one), change its distractor type, edit an option's faces / turns / mirroring, reorder; regenerate all.
- **Difficulty (§29).** Eight 1–5 dimensions with suggested values (net shape, opposite-face distractors, oriented faces, patterns, turns in the answer, subtle distractors, element count); the author adjusts them.
- **DNA (§30)** and **explanation (§36)** are recomputed after every change: opposite pairs, the answer's corner / net, orientation and continuity statements, and one statement per distractor.
- **IDs and versions (§32, §33).** `CUBE-Q-000001…` from a stored counter (never reused). Editing a bank question and committing adds a version; earlier versions are never overwritten. "Save as a new question instead" detaches the edit.
- **JSON (§34, §35).** `schema: creative.cube.question.v1`, validated with zod on every read; it carries the full CubeModel, stem, options, answer, difficulty, DNA, rules, explanation and asset ids.

## 62.6 Question Bank (§37, §38, §47)

- Search (id, title); filters: type, skill ≥ level, distractor type, has patterns; newest first; **10 questions a page** with previous / next (v1.2).
- Tapping a question opens its details **right under it** (tap again to close).
- Preview (a question sheet: prompt, stem, five numbered options), answer and distractors, versions (tap to view one), metadata (difficulty, DNA, rules, answer, explanation).
- Edit (opens it in the Studio; commit = new version), Duplicate (new id), Variant (same skill profile: artwork reshuffled across faces when there are no patterns, palette colours permuted, another of the 11 nets, fresh distractors of the same kinds; opens in the Studio for review), export **PNG** (question sheet) and **JSON** (canonical question).

## 62.7 Persistence (§39–§41)

- Android: `@capacitor-community/sqlite`, database `cube` (file `cubeSQLite.db`), tables `cube_meta` (schema version, id counter), `cube_questions`, `cube_question_versions`, `cube_assets`, `cube_drafts`. Phase 2 / 3 tables (`cube_tests`, `cube_attempts`, `cube_responses`, `cube_analysis`) are **not** created yet; they come with Phase 2 through a schema migration (`cube_meta.schema_version`).
- Browser / desktop development: the same tables in IndexedDB (`creative-cube`), because the native plugin is not available there. Both backends sit behind `CubeTables`; repositories (`QuestionRepository`, `AssetRepository`, `DraftRepository`) are the only access path; components never run SQL (§40). Both backends pass the same tests (SQLite via `node:sqlite`).
- Fully offline (§41).

## 62.8 Known limits

- Two nets as a Net → Cube stem show the same cube twice (no "two different nets" puzzle type yet).
- Polygon = regular polygon with 3–8 sides (drag to size).
- The "Generate question by constraints" form of §28 is the type / stem / distractor selection plus the difficulty sliders; topology / orientation targets are not used to search for a net yet.
- Export of a question *package* folder (§47 future) is not built; JSON and PNG are.
- Device checklist: `docs/modules/cube/checklists/P1.md`.

## 62.9 Conflict review (v1.1)

| Topic | Resolution |
| :-- | :-- |
| §5 "SQLite via @capacitor-community/sqlite" vs a browser build (no native plugin) | SQLite on Android; IndexedDB in the browser behind the same tables interface, for development only. |
| §39 "cube.db" | The plugin names the file `cubeSQLite.db` for database `cube`. |
| §39 placeholder tables | Not created in Phase 1 (§4: no Phase 2 functionality); added by migration in Phase 2. |
| §11 "Custom" preset | Any arrangement made with the Net tool is custom; there is no separate Custom button. |
| §13 "crop" for images | Fraction sliders (x, y, w, h) instead of a crop handle. |
| CREATIVE.md CR-OD-1 (how CUBE joins) | In-app module on the existing web stack, as this specification's §3 and §5 require (no React Native / Skia / Filament). |

## 62.10 Design rework (v1.2, release 0.15.0)

From device testing of 0.13.0. Covered in §62.3, §62.4 and §62.6 above; in short:

| Asked | Built |
| :-- | :-- |
| A New icon that clears the work in progress | **New** in the tool bar: a blank cube (cross net); the question and edit state are cleared; Undo restores the previous cube. |
| Always show a 4 × 4 hairline grid; Fit fits it | The board (§62.4). Faces move between its cells with Net only. |
| Shapes hard to place at a repeatable size; soft snap points per face | 5 × 5 soft snap points shown on every face; shape corners, stamps, text and moves snap; S / M / L stamp and text sizes. |
| Pen anywhere on the grid, trimmed to the faces | Pen and shapes start anywhere on the board; off-face parts are trimmed. |
| Colour fill for faces (4 colours) | **Fill** tool: white + four tones. |
| Picture as a full-grid skin, adjusted before trimming | Image skin with Done / Cancel (§62.3). |
| Faces displaced while manipulating shapes | Fixed: an element's drag events bubbled to its face, which took the element's position as its new cell. Element drags now stop at the element, and a face only moves on its own drag with the Net tool. |
| 3D rotation in Design as a pop-up; none in Question | 3D tool → pop-up; removed from the Question step. |
| Full screen for question cards | The builder spans the width. |
| Bank: details under each question, or 10 at a time | Both: details open under the question; 10 a page. |
| Avoid usability bloat | The five shape tools became one Shape tool (two rows of tools on a phone instead of three); crop sliders removed (the skin replaces them); snap points appear only with tools that place things. |

The CubeModel and question JSON are unchanged (`creative.cube.model.v1`, `creative.cube.question.v1`).

## 62.11 Phone layout (v1.3, release 0.22.0)

From device use: the board area was a fixed 60 % of the screen height,
leaving an empty band under the 4 × 4 board, and the properties ("Start
from …") ended against the phone's navigation bar, so touches there hit the
system buttons.
- On a phone the board area **takes the board's shape** (4 × 4 → square,
  capped at 64 % of the height); the net status ("✓ Valid cube net") and
  **Fit** sit in a slim strip **under** the board instead of over it.
- The properties follow directly below and the page keeps a margin above
  the phone's navigation bar (safe-area inset + 16 px).
- Wide screens (≥ 900 px) are unchanged: tools · board · properties side by
  side, the board filling its column.
