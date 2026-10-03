// CREATIVE's module registry (CREATIVE.md §3): one entry per home-screen tile.
// A module is a plugin: it brings its own art, title and entry point and is
// added here with one line. Modules without an entry point show "Coming soon".
import cube from './art/cube.png';
import more from './art/more.png';
import objects from './art/objects.png';
import perspective from './art/perspective.png';
import publish from './art/publish.png';
import sensitivity from './art/sensitivity.png';
import sequence from './art/sequence.png';
import sketch from './art/sketch.png';
import studio from './art/studio.png';
import toolbox from './art/toolbox.png';

export interface SuiteModule {
  id: string;
  title: string;
  /** Tile illustration. */
  art: string;
  /** The module's own version (CREATIVE.md §5); null until it ships. */
  version: string | null;
  /** The screen the module opens on; null = not built yet ("Coming soon"). */
  entry: 'perspective' | 'cube' | 'sketch' | 'publish' | 'objects' | null;
}

export const MODULES: SuiteModule[] = [
  { id: 'studio', title: 'Studio', art: studio, version: null, entry: null },
  { id: 'cube', title: 'Cube', art: cube, version: '0.22.0', entry: 'cube' },
  { id: 'objects', title: 'Objects', art: objects, version: '0.24.0', entry: 'objects' },
  { id: 'perspective', title: 'Perspective', art: perspective, version: '0.12.0', entry: 'perspective' },
  { id: 'publish', title: 'Publish', art: publish, version: '0.21.0', entry: 'publish' },
  { id: 'sketch', title: 'Sketch', art: sketch, version: '0.21.0', entry: 'sketch' },
  { id: 'sequence', title: 'Sequence', art: sequence, version: null, entry: null },
  { id: 'sensitivity', title: 'Sensitivity', art: sensitivity, version: null, entry: null },
  { id: 'toolbox', title: 'Toolbox', art: toolbox, version: null, entry: null },
  { id: 'more', title: 'More', art: more, version: null, entry: null },
];
