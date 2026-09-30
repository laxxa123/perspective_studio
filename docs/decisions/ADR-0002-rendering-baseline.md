# ADR-0002 — Rendering and pen-input baseline (M0 spike)

- **Status:** Proposed — waiting for the device measurements (M0)
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

| Measure | Finger | Stylus |
| :-- | :-- | :-- |
| Device / WebView | _pending_ | |
| Render pan: fps, p95 | _pending_ | |
| Render re-project: fps, p95 | _pending_ | |
| Pointer types | _pending_ | _pending_ |
| Pressure range | _pending_ | _pending_ |
| Coalesced events / move | _pending_ | _pending_ |
| Event rate | _pending_ | _pending_ |
| Event → frame p50 / p95 | _pending_ | _pending_ |

## Decision

_To be written from the results:_ keep react-konva for the editor as planned,
or change the rendering approach (e.g. imperative Konva nodes for the objects
layer) if re-project misses the NFR-P-01 budget; whether pressure and coalesced
events are available for M6.

## Consequences

_To be written._
