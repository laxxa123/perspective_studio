import type { Vec2 } from '../core/math/vec';

/** Normalized pointer input handed to tools (§8.6). */
export interface ToolInput {
  pp: Vec2;
  screen: Vec2;
  pointerType: 'mouse' | 'touch' | 'pen';
  pressure: number;
  buttons: number;
  shift: boolean;
  /** Screen px → pp. */
  pxToPp: number;
}

/** A tool: a small state machine idle → pressing → dragging → commit / cancel. */
export interface Tool {
  down(input: ToolInput): void;
  move(input: ToolInput): void;
  up(input: ToolInput): void;
  /** A gesture (second finger) or pointercancel took over: undo the tool's live change. */
  cancel(): void;
  /** Palm rejection: when true, single-finger touch pans instead of reaching the tool. */
  touchPans?(): boolean;
}

export const idleTool: Tool = { down() {}, move() {}, up() {}, cancel() {} };

/** Movement below this (screen px) is a tap, not a drag. */
export const TAP_SLOP_PX = 6;
/** Hold this long without moving for a long press (context menu, §10.3). */
export const LONG_PRESS_MS = 500;
