// Schema 1 → 2 (ADR-0006): the stored perspective system becomes the eye it
// describes. An invalid system is repaired first (§6.3), as loading did.
import { clampPerspective, violations } from '../../perspective/validity';
import type { PerspectiveSystem } from '../../perspective/types';
import { eyeFromPerspective } from '../../perspective/view';
import type { Migration } from './index';

export const eyeMigration: Migration = {
  from: 1,
  description: 'perspective system → eye',
  migrate(doc) {
    const { perspective, ...rest } = doc as { perspective?: PerspectiveSystem } & Record<string, unknown>;
    if (!perspective || typeof perspective !== 'object') throw new Error('Invalid document: no perspective.');
    if (violations(perspective).includes('NaN')) throw new Error('Invalid document: perspective has non-finite values.');
    return { ...rest, eye: eyeFromPerspective(clampPerspective(perspective)) };
  },
};
