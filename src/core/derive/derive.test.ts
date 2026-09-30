import { describe, expect, it } from 'vitest';
import { DEFAULT_PAPER } from '../document/paper';
import { DEFAULT_PERSPECTIVE as ps, setMode } from '../perspective';
import { allBounds, deriveScene } from './derive';

describe('derive (PS-02)', () => {
  it('renders paper, horizon, three VPs, anchor and the test box', () => {
    const m = deriveScene(ps, DEFAULT_PAPER);
    const roles = m.items.map((i) => i.role);
    expect(roles.filter((r) => r === 'vp')).toHaveLength(3);
    expect(roles).toContain('paper');
    expect(roles).toContain('horizon');
    expect(roles).toContain('anchor');
    expect(roles.filter((r) => r === 'edge')).toHaveLength(12);
    expect(new Set(m.items.map((i) => i.key)).size).toBe(m.items.length);
  });

  it('drops VP-V in 2pt', () => {
    const m = deriveScene(setMode(ps, '2pt'), DEFAULT_PAPER);
    expect(m.items.filter((i) => i.role === 'vp')).toHaveLength(2);
  });

  it('re-projects the test box when a VP moves', () => {
    const a = deriveScene(ps, DEFAULT_PAPER).items.find((i) => i.key === 'test-box:e0')!;
    const b = deriveScene({ ...ps, vpRightX: 2500 }, DEFAULT_PAPER).items.find((i) => i.key === 'test-box:e0')!;
    expect(b.points).not.toEqual(a.points);
  });

  it('bounds paper and all VPs for Fit all', () => {
    const r = allBounds(ps, DEFAULT_PAPER);
    expect(r.x).toBe(-700);
    expect(r.x + r.width).toBe(1900);
    expect(r.y + r.height).toBe(3200);
  });
});
