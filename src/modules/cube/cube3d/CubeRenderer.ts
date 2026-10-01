// The live 3D cube (CUBE §20): Three.js renders the folded CubeModel; it owns
// no semantic state. Faces are planes placed from the folding engine's frames,
// textured with the same SVG the figures use. World is Z-up; Three is Y-up:
// (x, y, z) → (x, z, −y).
import * as THREE from 'three';
import type { FaceId } from '../model/CubeModel';
import type { V3 } from '../geometry/CubeGeometry';
import { cross } from '../geometry/CubeGeometry';
import type { CubeState } from '../geometry/FoldingEngine';

const toThree = (v: V3) => new THREE.Vector3(v[0], v[2], -v[1]);

export type StandardView = 'iso' | 'front' | 'top' | 'right';

const VIEW_DIR: Record<StandardView, { dir: THREE.Vector3; up: THREE.Vector3 }> = {
  iso: { dir: toThree([1, -1, 1]).normalize(), up: new THREE.Vector3(0, 1, 0) },
  front: { dir: toThree([0, -1, 0]), up: new THREE.Vector3(0, 1, 0) },
  top: { dir: toThree([0, 0, 1]), up: toThree([0, 1, 0]) },
  right: { dir: toThree([1, 0, 0]), up: new THREE.Vector3(0, 1, 0) },
};

/** The cube orientation that turns `dir` toward the camera (+Z) with `up` up. */
function orientationFor(v: StandardView): THREE.Quaternion {
  const m = new THREE.Matrix4().lookAt(VIEW_DIR[v].dir, new THREE.Vector3(0, 0, 0), VIEW_DIR[v].up);
  return new THREE.Quaternion().setFromRotationMatrix(m).invert();
}

export class CubeRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  private cube = new THREE.Group();
  private faces = new Map<FaceId, THREE.Mesh>();
  private outline: THREE.LineSegments;
  private target = orientationFor('iso');
  private distance = 4.2;
  private raf = 0;
  private dirty = true;
  private highlighted: FaceId | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.camera.position.set(0, 0, this.distance);
    this.cube.quaternion.copy(this.target);
    this.scene.add(this.cube);
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
    this.outline = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x212529 }));
    this.cube.add(this.outline);
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    loop();
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  /** Places the six faces from the folded cube; textures by face. */
  setCube(state: CubeState | null, textures: Partial<Record<FaceId, HTMLCanvasElement>>) {
    for (const m of this.faces.values()) {
      this.cube.remove(m);
      m.geometry.dispose();
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.map?.dispose();
      mat.dispose();
    }
    this.faces.clear();
    this.outline.visible = !!state;
    if (!state) {
      this.dirty = true;
      return;
    }
    for (const f of Object.keys(state) as FaceId[]) {
      const { n, x } = state[f];
      const y = cross(x, n);
      // Face corner O = centre + n/2 − x/2 − y/2 (cube centred on the origin).
      const o = (k: 0 | 1 | 2) => n[k] / 2 - x[k] / 2 - y[k] / 2;
      const O: V3 = [o(0), o(1), o(2)];
      const P = (u: number, v: number): V3 => [O[0] + u * x[0] + v * y[0], O[1] + u * x[1] + v * y[1], O[2] + u * x[2] + v * y[2]];
      const corners = [P(0, 0), P(1, 0), P(1, 1), P(0, 1)].map(toThree);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap((c) => [c.x, c.y, c.z]), 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
      g.setIndex([0, 2, 1, 0, 3, 2]);
      g.computeVertexNormals();
      // Make the face point outward whatever the winding.
      const normal = toThree(n);
      if (new THREE.Vector3().fromBufferAttribute(g.getAttribute('normal') as THREE.BufferAttribute, 0).dot(normal) < 0) {
        g.setIndex([0, 1, 2, 0, 2, 3]);
        g.computeVertexNormals();
      }
      const canvasTex = textures[f];
      const map = canvasTex ? new THREE.CanvasTexture(canvasTex) : null;
      if (map) map.colorSpace = THREE.SRGBColorSpace;
      // Unlit, so face colours stay true; shade() darkens faces turned away from the viewer.
      const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map, color: 0xffffff, side: THREE.FrontSide }));
      mesh.userData.face = f;
      mesh.userData.normal = normal;
      this.faces.set(f, mesh);
      this.cube.add(mesh);
    }
    this.highlight(this.highlighted);
  }

  highlight(f: FaceId | null) {
    this.highlighted = f;
    this.dirty = true;
  }

  /** Turns the cube by a screen drag (radians per pixel applied by the caller). */
  rotateBy(dx: number, dy: number) {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(dy, dx, 0, 'XYZ'));
    this.cube.quaternion.premultiply(q);
    this.target.copy(this.cube.quaternion);
    this.dirty = true;
  }

  zoomBy(factor: number) {
    this.distance = Math.min(9, Math.max(2.2, this.distance * factor));
    this.dirty = true;
  }

  /** Smoothly turns to a standard view (CUBE §20). */
  show(v: StandardView) {
    this.target = orientationFor(v);
    if (v === 'iso') this.distance = 4.2;
    this.dirty = true;
  }

  /** The face under a canvas point (CSS px), for face selection. */
  pick(px: number, py: number, w: number, h: number): FaceId | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((px / w) * 2 - 1, -(py / h) * 2 + 1), this.camera);
    const hit = ray.intersectObjects([...this.faces.values()])[0];
    return (hit?.object.userData.face as FaceId | undefined) ?? null;
  }

  private tick() {
    const q = this.cube.quaternion;
    const animating = q.angleTo(this.target) > 1e-4 || Math.abs(this.camera.position.z - this.distance) > 1e-3;
    if (animating) {
      q.slerp(this.target, 0.18);
      this.camera.position.z += (this.distance - this.camera.position.z) * 0.2;
    }
    if (animating || this.dirty) {
      this.shade();
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
  }

  /** Brightness by how squarely a face looks at the viewer; the selected face is tinted. */
  private shade() {
    const toViewer = new THREE.Vector3(0, 0, 1);
    for (const [id, m] of this.faces) {
      const n = (m.userData.normal as THREE.Vector3).clone().applyQuaternion(this.cube.quaternion);
      const k = 0.72 + 0.28 * Math.max(0, n.dot(toViewer));
      const c = (m.material as THREE.MeshBasicMaterial).color;
      if (id === this.highlighted) c.setRGB(0.7 * k, 0.82 * k, 1 * k);
      else c.setRGB(k, k, k);
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.setCube(null, {});
    this.renderer.dispose();
  }
}
