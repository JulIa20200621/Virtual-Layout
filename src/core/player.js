import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { PLAYER_START, isInsideApartment } from '../data/floorplan.js';
import { circleOverlapsBox } from './collision.js';

export const EYE_HEIGHT = 1.6;
export const PLAYER_RADIUS = 0.25;
export const PLAYER_HEIGHT = 1.75;
const WALK_SPEED = 2.2; // m/s
const RUN_SPEED = 4.5;

/**
 * First-person player: pointer lock, WASD movement and collision.
 *
 * Collision: the player is a circle (radius 0.25 m) in X/Z. It cannot overlap
 * walls, fixtures or furniture, and cannot leave the apartment. Movement is
 * resolved per axis so you slide along walls instead of sticking to them.
 */
export class Player {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLElement} domElement
   * @param {() => any[]} getColliders  returns all collision boxes for this frame
   */
  constructor(camera, domElement, getColliders) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, domElement);
    this.getColliders = getColliders;
    this.keys = new Set();
    this.radius = PLAYER_RADIUS;
    this.height = PLAYER_HEIGHT;
    this.enabled = true;

    camera.position.set(PLAYER_START.position[0], EYE_HEIGHT, PLAYER_START.position[1]);
    camera.rotation.set(0, THREE.MathUtils.degToRad(PLAYER_START.yawDegrees), 0, 'YXZ');

    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    this.controls.addEventListener('unlock', () => this.keys.clear());
  }

  /**
   * Read the browser's pointer-lock state directly. (PointerLockControls fires its
   * 'lock' event *before* updating its own isLocked flag, which caused stale UI.)
   */
  get isLocked() {
    return document.pointerLockElement === this.controls.domElement;
  }

  lock() {
    try {
      const result = this.controls.domElement.requestPointerLock?.();
      // Newer browsers return a promise that may reject (e.g. right after pressing Esc).
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch {
      /* ignore: the user can click again */
    }
  }

  unlock() {
    if (this.isLocked) this.controls.unlock();
  }

  /** Is the circle at (x, z) free of obstacles? */
  isFree(x, z, colliders, staticOnly = false) {
    if (!isInsideApartment(x, z)) return false;
    for (const c of colliders) {
      if (staticOnly && c.kind === 'item') continue;
      if (c.y0 >= this.height || c.y1 <= 0.15) continue; // above the head / flat (rugs)
      if (circleOverlapsBox(x, z, this.radius, c)) return false;
    }
    return true;
  }

  update(dt) {
    if (!this.isLocked || !this.enabled) return;
    const k = this.keys;
    let fwd = 0;
    let side = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) fwd += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) fwd -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) side += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) side -= 1;
    if (!fwd && !side) return;

    const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? RUN_SPEED : WALK_SPEED;
    // Forward direction on the floor plane
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const right = new THREE.Vector3(-dir.z, 0, dir.x);
    const move = dir.multiplyScalar(fwd).addScaledVector(right, side);
    move.normalize().multiplyScalar(speed * dt);

    const colliders = this.getColliders();
    const p = this.camera.position;
    // If we're somehow stuck inside furniture, let the player walk out (walls still block).
    const stuck = !this.isFree(p.x, p.z, colliders);
    if (this.isFree(p.x + move.x, p.z, colliders, stuck)) p.x += move.x;
    if (this.isFree(p.x, p.z + move.z, colliders, stuck)) p.z += move.z;
    p.y = EYE_HEIGHT;
  }
}

/** True when the key event comes from a text field (so typing doesn't move the player). */
export function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}
