// The authoring viewport (OBJECTS §A.3, §A.7): Three.js draws the block
// object; it owns no state — the block list comes from the module and taps
// come back as cells. One finger turns the camera, two fingers pan and zoom.
import * as THREE from 'three';
import { MAX_EXTENT, type Blocks, type Cell } from '../core/blocks';

export type Hit = { kind: 'block'; cell: Cell; normal: Cell } | { kind: 'floor'; cell: Cell };

const BLOCK = 0xf1f3f5;
const EDGE = 0x212529;
const FLOOR = MAX_EXTENT + 4;

export class BlockScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
  private group = new THREE.Group();
  private floor: THREE.Mesh;
  private boxGeo = new THREE.BoxGeometry(1, 1, 1);
  private edgeGeo = new THREE.EdgesGeometry(this.boxGeo);
  private boxMat = new THREE.MeshLambertMaterial({ color: BLOCK, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  private edgeMat = new THREE.LineBasicMaterial({ color: EDGE });
  /** Orbit: angles (radians) and distance around a target. */
  private theta = Math.PI / 4;
  private phi = 1.0;
  private dist = 14;
  private target = new THREE.Vector3(1.5, 0.5, 1.5);
  private raf = 0;
  private dirty = true;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb0b4b8, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(4, 9, 6);
    this.scene.add(sun);
    // The floor: a grid of cells centred under the object, catching taps.
    const grid = new THREE.GridHelper(FLOOR, FLOOR, 0xadb5bd, 0xdee2e6);
    grid.position.set(FLOOR / 2 - 2, 0, FLOOR / 2 - 2);
    this.scene.add(grid);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR, FLOOR), new THREE.MeshBasicMaterial({ visible: false }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.copy(grid.position);
    this.scene.add(this.floor);
    this.scene.add(this.group);
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (!this.dirty) return;
      this.dirty = false;
      this.place();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  /** Shows the blocks (rebuilt each time: at most 30). */
  setBlocks(b: Blocks) {
    for (const o of [...this.group.children]) this.group.remove(o);
    for (const c of b) {
      const m = new THREE.Mesh(this.boxGeo, this.boxMat);
      m.position.set(c[0] + 0.5, c[1] + 0.5, c[2] + 0.5);
      m.userData.cell = c;
      m.add(new THREE.LineSegments(this.edgeGeo, this.edgeMat));
      this.group.add(m);
    }
    this.dirty = true;
  }

  /** Centres the orbit on the object and moves back until it fits the view (any aspect). */
  frame(b: Blocks) {
    let radius = 3;
    if (b.length) {
      const lo = [Infinity, Infinity, Infinity];
      const hi = [-Infinity, -Infinity, -Infinity];
      for (const c of b)
        for (let i = 0; i < 3; i++) {
          lo[i] = Math.min(lo[i], c[i]);
          hi[i] = Math.max(hi[i], c[i] + 1);
        }
      this.target.set((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
      radius = Math.max(2, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2 + 0.5);
    }
    const v = (this.camera.fov * Math.PI) / 180;
    const h = 2 * Math.atan(Math.tan(v / 2) * this.camera.aspect);
    this.dist = Math.min(40, (radius / Math.sin(Math.min(v, h) / 2)) * 1.05);
    this.theta = Math.PI / 4;
    this.phi = 1.0;
    this.dirty = true;
  }

  orbit(dx: number, dy: number) {
    this.theta -= dx;
    this.phi = Math.min(Math.PI / 2 - 0.05, Math.max(0.12, this.phi - dy));
    this.dirty = true;
  }

  zoom(factor: number) {
    this.dist = Math.min(40, Math.max(4, this.dist * factor));
    this.dirty = true;
  }

  /** Pans by a screen drag (CSS px) in the camera's plane. */
  pan(dx: number, dy: number, h: number) {
    const k = (2 * this.dist * Math.tan((this.camera.fov * Math.PI) / 360)) / Math.max(1, h);
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
    this.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
    this.dirty = true;
  }

  /** What is under a canvas point (CSS px): a block face or a floor cell. */
  hit(px: number, py: number, w: number, h: number): Hit | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((px / w) * 2 - 1, -(py / h) * 2 + 1), this.camera);
    const hits = ray.intersectObjects([...this.group.children, this.floor], false);
    const first = hits[0];
    if (!first) return null;
    if (first.object === this.floor) return { kind: 'floor', cell: [Math.floor(first.point.x), 0, Math.floor(first.point.z)] };
    const n = first.face!.normal;
    return { kind: 'block', cell: first.object.userData.cell as Cell, normal: [Math.round(n.x), Math.round(n.y), Math.round(n.z)] };
  }

  private place() {
    const s = Math.sin(this.phi);
    this.camera.position.set(this.target.x + this.dist * s * Math.sin(this.theta), this.target.y + this.dist * Math.cos(this.phi), this.target.z + this.dist * s * Math.cos(this.theta));
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.boxGeo.dispose();
    this.edgeGeo.dispose();
    this.boxMat.dispose();
    this.edgeMat.dispose();
    this.renderer.dispose();
  }
}
