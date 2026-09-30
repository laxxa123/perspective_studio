# ADR-0002 — Rendering and pen-input baseline (M0 spike)

- **Status:** Accepted (M0 closed, 2026-09-30)
- **Requirements:** §16 M0, NFR-P-01, NFR-P-02, SK-02

## Context

The editor draws with Konva inside the Android WebView (Capacitor). Before
building on it, M0 measures on the developer's device whether it is fast
enough, and what pen input the WebView delivers.

## Method

The M0 app (0.2.0) is the spike (`src/ui/spike/`). It reports:

1. **Rendering** — 300 synthetic polylines (12 points each) in a Konva stage:
   - *Pan*: the stage moves every frame (transform only).
   - *Re-project*: every point of every line changes every frame through React
     (react-konva), standing in for a VP drag re-projecting all objects.
   Each runs 5 s; reports fps and frame-time p50 / p95 / worst.
2. **Pen input** — drawing on a Konva stage from raw pointer events: pointer
   types seen, pressure range, coalesced events per `pointermove` (and whether
   `getCoalescedEvents` exists), event rate, and time from an event to the next
   animation frame (a lower bound on input → ink latency).
3. Device: user agent, screen size, devicePixelRatio.

"Copy results" puts the report on the clipboard.

Reference run (headless desktop Chromium, not the target): pan 60 fps;
re-project 59 fps (p95 16.8 ms); pointer event → frame p50 11.6 ms.

## Results on the device

Developer's phone, measured with 0.3.0-build.3 on 2026-09-30: OPPO CPH2767,
Android 16, Android System WebView (Chrome 153), 364 × 801 CSS px at
devicePixelRatio 3.5, spike canvas 331 × 470 CSS px. Finger only (no stylus
tested).

| Measure | Finger | Stylus |
| :-- | :-- | :-- |
| Render pan | 75.2 fps · frame p50 11.2 ms · p95 16.7 ms · worst 18.2 ms | — |
| Render re-project (300 lines, all points change every frame) | 75.2 fps · p50 11.2 ms · p95 16.7 ms · worst 17.9 ms | — |
| Pointer types | touch | not tested |
| Pressure range | 1.00–1.00 (constant) | not tested |
| `getCoalescedEvents` | supported, 1.0 event per move | not tested |
| Event rate while drawing | ≈ 55 Hz (run 1) | not tested |
| Event → next frame p50 / p95 | 12.1–12.2 ms / 15.8 ms | not tested |

The 11.2 ms median frame shows a high-refresh display (≈ 90 Hz); the p95 at
16.7 ms means the occasional frame falls back to 60 Hz. The spike's
"event rate" of 9 Hz in a second run was a measuring error — it averaged over
the pauses between strokes — and is disregarded.

## Decision

- **Keep react-konva for the editor**, as planned (§9, §13). Re-projecting
  300 polylines through React every frame costs no more than a transform-only
  pan and stays well above the 60 fps target of NFR-P-01. The objects layer is
  re-derived and re-rendered through React; revisit only if M3 with 100–300
  boxes on the full-screen canvas misses NFR-P-01.
- **Pen input:** finger touch arrives within one frame. No pressure and no
  extra coalesced samples come from a finger. Pressure (SK-02) and palm
  rejection (§10.3) depend on a stylus, which was not measured; they are
  settled in the M6 spike.

## Consequences

- M2 builds on react-konva with fixed layers (§9) and `listening: false`,
  hit-testing in core / tools.
- NFR-P-01 and NFR-P-02 are re-checked on the device at the M3 and M6
  acceptance.
- The M0 spike screen is removed in M2 (its code lives in git history).
