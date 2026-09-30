import type { Vec2 } from '../core/math/vec';

/** Normalized pointer input handed to tools (§8.6). */
export interface ToolInput {
  pp: Vec2;
  screen: Vec2;
  pointerType: 'mouse' | 'touch' | 'pen';
  pressure: number;
  buttons: number;
}

/** A tool: a small state machine idle → pressing → dragging → commit / cancel. */
export interface Tool {
  down(input: ToolInput): void;
  move(input: ToolInput): void;
  up(input: ToolInput): void;
  /** A gesture (second finger) or pointercancel took over: undo the tool's live change. */
  cancel(): void;
}

export const idleTool: Tool = { down() {}, move() {}, up() {}, cancel() {} };
