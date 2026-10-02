// Brush panel (SKETCH §6, §8, §9): the brushes (the eraser is on the bar),
// five sizes, an opacity strip, the five recent colours (+ for more) and the
// two selection tools. Advanced parameters live in Settings.
import { Lasso, Plus, SlidersHorizontal, SquareDashed } from "lucide-react";
import { OPACITY_LEVELS, QUICK_COLOURS, SIZE_LEVELS } from "../core/presets";
import { ERASER, useSketchStore } from "../state/useSketchStore";

/** `rgba()` for a hex colour at an alpha. */
const tint = (hex: string, a: number) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
const CHECKER =
  "conic-gradient(#e2ded6 25%, #fff 0 50%, #e2ded6 0 75%, #fff 0)";
import { PresetIcon } from "./PresetIcon";

const st = useSketchStore.getState;

export function BrushPanel() {
  const presets = useSketchStore((s) => s.settings.presets);
  const presetId = useSketchStore((s) => s.presetId);
  const size = useSketchStore((s) => s.sizeLevel);
  const opacity = useSketchStore((s) => s.opacityLevel);
  const mode = useSketchStore((s) => s.mode);
  const color = useSketchStore((s) => s.color);
  const recent = useSketchStore((s) => s.recent);
  const erasing = presetId === ERASER;
  const five = [
    ...recent,
    ...QUICK_COLOURS.filter((c) => !recent.includes(c)),
  ].slice(0, 5);

  return (
    <div className="sk-panel" role="dialog" aria-label="Brush">
      <div className="sk-presets">
        {presets
          .filter((p) => p.id !== ERASER)
          .map((p) => (
            <button
              key={p.id}
              className={`sk-preset${p.id === presetId && mode === "draw" ? " on" : ""}`}
              onClick={() => (
                st().chooseBrush(p.id),
                st().set({ panel: "none" })
              )}
            >
              <PresetIcon id={p.id} />
              <span>{p.name}</span>
            </button>
          ))}
      </div>
      <div className="sk-row">
        <span className="sk-label">Size</span>
        <div className="sk-levels" role="radiogroup" aria-label="Size">
          {SIZE_LEVELS.map((_, i) => (
            <button
              key={i}
              role="radio"
              aria-checked={i === size}
              aria-label={`Size ${i + 1}`}
              className={`sk-level${i === size ? " on" : ""}`}
              onClick={() => st().set({ sizeLevel: i })}
            >
              <span
                style={{
                  width: 4 + i * 4,
                  height: 4 + i * 4,
                  background: "currentColor",
                }}
              />
            </button>
          ))}
        </div>
      </div>
      {!erasing && (
        <>
          <div className="sk-row">
            <span className="sk-label">Opacity</span>
            <div className="sk-opacity" role="radiogroup" aria-label="Opacity">
              {OPACITY_LEVELS.map((o, i) => (
                <button
                  key={i}
                  role="radio"
                  aria-checked={i === opacity}
                  aria-label={`Opacity ${Math.round(o * 100)}%`}
                  className={i === opacity ? "on" : ""}
                  style={{
                    backgroundImage: `linear-gradient(${tint(color, o)}, ${tint(color, o)}), ${CHECKER}`,
                    backgroundSize: "auto, 10px 10px",
                  }}
                  onClick={() => st().set({ opacityLevel: i })}
                />
              ))}
            </div>
          </div>
          <div className="sk-row">
            <span className="sk-label">Colour</span>
            <div className="sk-colours">
              {five.map((c) => (
                <button
                  key={c}
                  className={`sk-dot${c === color ? " on" : ""}`}
                  style={{ background: c }}
                  aria-label={`Colour ${c}`}
                  onClick={() => st().pickColor(c)}
                />
              ))}
              <button
                className="sk-dot more"
                aria-label="More colours"
                onClick={() => st().set({ panel: "color" })}
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </>
      )}
      <div className="sk-row sk-actions">
        <button
          className={`sk-chipbtn${mode === "rect" ? " on" : ""}`}
          onClick={() => st().set({ mode: "rect", panel: "none" })}
        >
          <SquareDashed size={18} /> Rectangle select
        </button>
        <button
          className={`sk-chipbtn${mode === "lasso" ? " on" : ""}`}
          onClick={() => st().set({ mode: "lasso", panel: "none" })}
        >
          <Lasso size={18} /> Lasso
        </button>
        <button
          className="sk-chipbtn"
          onClick={() =>
            st().set({ page: "settings", back: "editor", panel: "none" })
          }
          aria-label="Brush settings"
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>
    </div>
  );
}
