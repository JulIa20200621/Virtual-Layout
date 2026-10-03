import * as THREE from 'three';
import { PLAN, isInsideApartment } from '../data/floorplan.js';
import { boxesOverlap, boxCorners, circleOverlapsBox, pointInBox } from '../core/collision.js';

/** Max distance (m) at which a held item can be placed. */
export const REACH = 4;
/** Grid step for positions (m). */
export const GRID = 0.1;
/** Rotation step (radians). */
export const ROT_STEP = THREE.MathUtils.degToRad(15);

const WALL_ART_MIN = 0.8;
const WALL_ART_MAX = 2.2;

const _normal = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _p = new THREE.Vector3();
const _center = new THREE.Vector2(0, 0);

const snap = (v, step = GRID) => Math.round(v / step) * step;

/**
 * Placement logic: where does the held item go, and is that spot valid?
 *
 * Validity rules (see PROJECT.md §6.2):
 *  - no intersection with walls / fixtures
 *  - no overlap with other furniture, except rugs (anything may stand on a rug)
 *    and a surface item with the surface it stands on
 *  - stays inside the apartment
 *  - doesn't overlap the player
 *  - surface items must fit within the surface; wall items must hang flat on a wall
 */
export class Placement {
  /**
   * @param {object} o
   * @param {import('./FurnitureManager.js').FurnitureManager} o.manager
   * @param {any[]} o.colliders   static collision boxes (walls, doors, fixtures)
   * @param {THREE.Object3D[]} o.solidMeshes  walls + fixtures (for aiming)
   * @param {THREE.Camera} o.camera
   * @param {{radius:number, height:number}} o.player
   */
  constructor({ manager, colliders, solidMeshes, camera, player }) {
    this.manager = manager;
    this.colliders = colliders;
    this.solidMeshes = solidMeshes;
    this.camera = camera;
    this.player = player;
    this.raycaster = new THREE.Raycaster();
    this.snapEnabled = true;
  }

  /** Collision box for a catalog definition at a world position / rotation. */
  defBox(def, pos, rotY) {
    return { cx: pos.x, cz: pos.z, hx: def.size.w / 2, hz: def.size.d / 2, rot: rotY, y0: pos.y, y1: pos.y + def.size.h };
  }

  /** Collision box of a placed item (from its current world transform). */
  itemBox(item) {
    const { position, rotY } = this.manager.getWorldTransform(item);
    return this.defBox(item.def, position, rotY);
  }

  /** Top surface of a surface item: { y, box } in world space, or null. */
  surfaceOf(item) {
    const def = item.def;
    if (!def.isSurface) return null;
    const { position, rotY } = this.manager.getWorldTransform(item);
    const rect = def.surfaceRect || { w: def.size.w, d: def.size.d, offsetZ: 0 };
    const off = rect.offsetZ || 0;
    const y = position.y + def.surfaceHeight;
    return {
      y,
      box: { cx: position.x + Math.sin(rotY) * off, cz: position.z + Math.cos(rotY) * off, hx: rect.w / 2, hz: rect.d / 2, rot: rotY, y0: y - 0.05, y1: y },
    };
  }

  /** Is `obj` the held object or inside it? */
  static isInside(obj, ancestor) {
    while (obj) {
      if (obj === ancestor) return true;
      obj = obj.parent;
    }
    return false;
  }

  /** Raycast from the screen center, ignoring the held item. */
  castFromCamera(heldObject) {
    this.raycaster.setFromCamera(_center, this.camera);
    this.raycaster.far = REACH;
    const targets = [...this.solidMeshes, this.manager.root];
    const hits = this.raycaster.intersectObjects(targets, true);
    return hits.filter((h) => !Placement.isInside(h.object, heldObject) && h.object.visible && h.object.isMesh);
  }

  /**
   * Compute where the held item should go this frame.
   * @param {import('./FurnitureManager.js').Item} held
   * @param {number} rotY desired rotation (floor / surface items)
   * @returns {{position:THREE.Vector3, rotY:number, parentUid:string|null, surface:any, onWall:boolean}}
   */
  computeTarget(held, rotY) {
    const def = held.def;
    const hits = this.castFromCamera(held.object);
    const first = hits[0] || null;
    _origin.copy(this.raycaster.ray.origin);
    _dir.copy(this.raycaster.ray.direction);

    if (def.placement === 'wall') return this.wallTarget(def, first);

    if (def.placement === 'surface' && first && this.hitNormalUp(first)) {
      const surf = this.surfaceFromHit(first);
      if (surf) {
        const x = this.snapEnabled ? snap(first.point.x) : first.point.x;
        const z = this.snapEnabled ? snap(first.point.z) : first.point.z;
        return { position: new THREE.Vector3(x, surf.y, z), rotY, parentUid: surf.ownerUid, surface: surf, onWall: false };
      }
    }
    return this.floorTarget(rotY, hits);
  }

  hitNormalUp(hit) {
    if (!hit.face) return false;
    _normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    return _normal.y > 0.7;
  }

  /** If the hit is on top of a surface (fixture or surface item), describe that surface. */
  surfaceFromHit(hit) {
    if (hit.object.userData.surface) {
      const s = hit.object.userData.surface;
      return { y: s.y, box: s.box, ownerUid: null };
    }
    const item = this.manager.itemFromObject(hit.object);
    if (item && item.def.isSurface) {
      const s = this.surfaceOf(item);
      if (s && Math.abs(hit.point.y - s.y) < 0.05) return { ...s, ownerUid: item.uid };
    }
    return null;
  }

  /** Floor placement: where the view ray meets the floor, stopped by walls/fixtures. */
  floorTarget(rotY, hits) {
    let dist = REACH;
    if (_dir.y < -1e-4) dist = Math.min(REACH, -_origin.y / _dir.y);
    _p.copy(_origin).addScaledVector(_dir, dist);
    // Walls and fixtures block the view ray; furniture does not (so you can aim past a chair).
    const blocker = hits.find((h) => h.object.userData.isWall || h.object.userData.isFixture);
    if (blocker && blocker.distance < dist) {
      _p.copy(_origin).addScaledVector(_dir, Math.max(0, blocker.distance - 0.05));
    }
    let x = _p.x;
    let z = _p.z;
    if (this.snapEnabled) {
      x = snap(x);
      z = snap(z);
    }
    return { position: new THREE.Vector3(x, 0, z), rotY, parentUid: null, surface: null, onWall: false };
  }

  /** Wall placement: flat against the wall face under the crosshair. */
  wallTarget(def, hit) {
    if (hit && hit.object.userData.isWall && !hit.object.userData.isDoor && hit.face) {
      _normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
      if (Math.abs(_normal.y) < 0.3) {
        _normal.y = 0;
        _normal.normalize();
        const along = Math.abs(_normal.x) > 0.5 ? 'z' : 'x';
        const maxCenter = PLAN.ceilingHeight - 0.03 - def.size.h / 2;
        let cy = THREE.MathUtils.clamp(hit.point.y, WALL_ART_MIN, Math.min(WALL_ART_MAX, maxCenter));
        const pos = hit.point.clone().addScaledVector(_normal, def.size.d / 2 + 0.003);
        if (this.snapEnabled) {
          pos[along] = snap(pos[along]);
          cy = THREE.MathUtils.clamp(snap(cy), WALL_ART_MIN, Math.min(WALL_ART_MAX, maxCenter));
        }
        pos.y = cy - def.size.h / 2;
        const rotY = Math.atan2(_normal.x, _normal.z);
        return { position: pos, rotY, parentUid: null, surface: null, onWall: true, wallNormal: _normal.clone() };
      }
    }
    // Not looking at a wall: float in front of the player (always invalid).
    const d = hit ? hit.distance - 0.1 : 2;
    const pos = _origin.clone().addScaledVector(_dir, Math.max(0.5, d));
    pos.y -= def.size.h / 2;
    const rotY = Math.atan2(-_dir.x, -_dir.z);
    return { position: pos, rotY, parentUid: null, surface: null, onWall: false, wallNormal: null };
  }

  /**
   * Validate the held item at its CURRENT transform (apply the target first).
   * Children standing on the held item are checked too.
   * @returns {{valid:boolean, reason:string}}
   */
  validate(held, target) {
    const def = held.def;
    const heldSet = new Set(this.manager.subtree(held).map((i) => i.uid));
    const others = [...this.manager.items.values()].filter((i) => !heldSet.has(i.uid));
    const otherBoxes = others.map((i) => ({ item: i, box: this.itemBox(i) }));

    if (def.placement === 'wall') {
      if (!target.onWall) return { valid: false, reason: 'Aim at a wall' };
      const box = this.itemBox(held);
      if (this.colliders.some((c) => boxesOverlap(box, c))) return { valid: false, reason: 'Blocked' };
      if (!this.isBackedByWall(held, target.wallNormal)) return { valid: false, reason: 'Needs a solid wall' };
      for (const o of otherBoxes) {
        if (o.item.def.layer === 'rug') continue;
        if (boxesOverlap(box, o.box)) return { valid: false, reason: `Overlaps ${o.item.def.name}` };
      }
      return { valid: true, reason: '' };
    }

    // Check the held item and everything standing on it.
    for (const item of this.manager.subtree(held)) {
      const box = this.itemBox(item);
      const isRoot = item === held;
      const parentUid = isRoot ? target.parentUid : held.uid;

      if (!boxCorners(box).every(([x, z]) => isInsideApartment(x, z))) return { valid: false, reason: 'Outside the apartment' };
      for (const c of this.colliders) {
        if (boxesOverlap(box, c)) return { valid: false, reason: c.kind === 'fixture' ? 'Blocked by fixture' : 'Overlaps a wall' };
      }
      if (item.def.layer !== 'rug') {
        for (const o of otherBoxes) {
          if (o.item.def.layer === 'rug') continue;
          if (o.item.uid === parentUid) continue; // standing on it
          if (boxesOverlap(box, o.box)) return { valid: false, reason: `Overlaps ${o.item.def.name}` };
        }
      }
      if (box.y0 < this.player.height && circleOverlapsBox(this.camera.position.x, this.camera.position.z, this.player.radius, box)) {
        return { valid: false, reason: 'Too close to you' };
      }
    }

    if (target.surface) {
      const box = this.itemBox(held);
      if (!boxCorners(box).every(([x, z]) => pointInBox(x, z, target.surface.box, 0.005))) return { valid: false, reason: "Doesn't fit on the surface" };
    }
    return { valid: true, reason: '' };
  }

  /** Cast short rays from the back of a wall item into the wall: all must hit a wall. */
  isBackedByWall(held, normal) {
    const def = held.def;
    const { position, rotY } = this.manager.getWorldTransform(held);
    const tx = Math.cos(rotY); // local +X in world
    const tz = -Math.sin(rotY);
    const ray = new THREE.Raycaster();
    ray.far = 0.08;
    const back = -def.size.d / 2;
    for (const sx of [-1, 1]) {
      for (const sy of [0.05, def.size.h - 0.05]) {
        const lx = sx * (def.size.w / 2 - 0.03);
        const o = new THREE.Vector3(
          position.x + tx * lx + normal.x * (back + 0.02),
          position.y + sy,
          position.z + tz * lx + normal.z * (back + 0.02),
        );
        ray.set(o, normal.clone().negate());
        const hit = ray.intersectObjects(this.solidMeshes, false)[0];
        if (!hit || !hit.object.userData.isWall || hit.object.userData.isDoor) return false;
      }
    }
    return true;
  }
}
