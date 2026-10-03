import * as THREE from 'three';
import { ROT_STEP } from './placement.js';
import { addCommand, deleteCommand, moveCommand } from '../state/history.js';

const DEG = Math.PI / 180;
const HOVER_DISTANCE = 3;
const _center = new THREE.Vector2(0, 0);

/**
 * Pick / hold / place state machine.
 *
 *   idle ──click on item──▶ holding ──click (valid)──▶ idle   (Move / Add command)
 *                              │ R / right click ─────▶ idle   (restored, no history)
 *                              │ X / Delete ──────────▶ idle   (Delete command)
 *
 * While holding, the item itself becomes a translucent "ghost" that follows the
 * crosshair; it is green when the spot is valid and red when it isn't.
 */
export class Interaction {
  /**
   * @param {object} o
   * @param {import('./FurnitureManager.js').FurnitureManager} o.manager
   * @param {import('./placement.js').Placement} o.placement
   * @param {import('../state/history.js').History} o.history
   * @param {THREE.Scene} o.scene
   * @param {THREE.Camera} o.camera
   * @param {THREE.Object3D[]} o.solidMeshes  walls + fixtures (they hide items behind them)
   * @param {(msg:string) => void} o.toast
   */
  constructor({ manager, placement, history, scene, camera, solidMeshes, toast }) {
    this.manager = manager;
    this.placement = placement;
    this.history = history;
    this.camera = camera;
    this.solidMeshes = solidMeshes;
    this.toast = toast;
    this.raycaster = new THREE.Raycaster();

    /** @type {'idle'|'holding'} */
    this.state = 'idle';
    /** Item under the crosshair (idle state). */
    this.hover = null;
    /** Last item that was hovered or held (target for the color swatches). */
    this.lastTargetUid = null;
    /** Info about the held item. */
    this.held = null;

    this.ghostMat = new THREE.MeshStandardMaterial({
      color: '#5fd17a', emissive: '#2f8a46', emissiveIntensity: 0.5, transparent: true, opacity: 0.5, depthWrite: false, roughness: 0.6,
    });
    this.validColor = new THREE.Color('#5fd17a');
    this.invalidColor = new THREE.Color('#e5534b');

    // Subtle placement grid under the ghost
    this.grid = new THREE.GridHelper(2, 20, '#7a8a80', '#7a8a80');
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.35;
    this.grid.material.depthWrite = false;
    this.grid.visible = false;
    scene.add(this.grid);
  }

  get isHolding() {
    return this.state === 'holding';
  }

  // ─── Per-frame update ─────────────────────────────────────────────────

  /** @param {boolean} locked  is the pointer locked (player active)? */
  update(locked) {
    if (this.state === 'holding') {
      this.updateHeld();
      return;
    }
    this.setHover(locked ? this.findHover() : null);
  }

  /** Raycast for a movable item under the crosshair within reach. */
  findHover() {
    this.raycaster.setFromCamera(_center, this.camera);
    this.raycaster.far = HOVER_DISTANCE;
    const hits = this.raycaster.intersectObjects([...this.solidMeshes, this.manager.root], true);
    const first = hits.find((h) => h.object.isMesh && h.object.visible);
    return first ? this.manager.itemFromObject(first.object) : null;
  }

  setHover(item) {
    if (item === this.hover) return;
    if (this.hover) setHighlight(this.hover, false);
    this.hover = item;
    if (item) {
      setHighlight(item, true);
      this.lastTargetUid = item.uid;
    }
  }

  updateHeld() {
    const h = this.held;
    const item = h.item;
    const target = this.placement.computeTarget(item, h.rotY);
    item.object.position.copy(target.position);
    item.object.rotation.set(0, target.rotY, 0);
    item.object.updateMatrixWorld(true);
    const result = this.placement.validate(item, target);
    h.target = target;
    h.valid = result.valid;
    h.reason = result.reason;
    this.ghostMat.color.copy(result.valid ? this.validColor : this.invalidColor);
    this.ghostMat.emissive.copy(this.ghostMat.color).multiplyScalar(0.5);

    // Grid under floor / surface items
    if (item.def.placement !== 'wall') {
      this.grid.visible = this.placement.snapEnabled;
      this.grid.position.set(Math.round(target.position.x * 10) / 10, target.position.y + 0.004, Math.round(target.position.z * 10) / 10);
    } else {
      this.grid.visible = false;
    }
  }

  // ─── Actions ──────────────────────────────────────────────────────────

  /** Left click while the pointer is locked. */
  primaryAction() {
    if (this.state === 'holding') this.place();
    else if (this.hover) this.pickUp(this.hover);
  }

  pickUp(item) {
    const origin = this.manager.serialize(item.uid);
    this.setHover(null);
    const { rotY } = this.manager.getWorldTransform(item);
    this.manager.root.attach(item.object); // free it from the surface it stood on
    this.held = { item, isNew: false, origin, rotY, target: null, valid: false, reason: '' };
    this.state = 'holding';
    this.lastTargetUid = item.uid;
    setGhost(item, this.ghostMat, true);
    this.updateHeld();
  }

  /** Create a new item from the library and hold it in front of the player. */
  startNew(catalogId) {
    if (this.state === 'holding') this.cancel();
    this.setHover(null);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const pos = this.camera.position.clone().addScaledVector(dir, 1.5);
    pos.y = 0;
    // Face the player, snapped to 15°
    const rotY = Math.round(Math.atan2(-dir.x, -dir.z) / ROT_STEP) * ROT_STEP;
    const item = this.manager.create({ catalogId, position: pos.toArray(), rotationY: rotY / DEG });
    if (!item) return;
    this.held = { item, isNew: true, origin: null, rotY, target: null, valid: false, reason: '' };
    this.state = 'holding';
    this.lastTargetUid = item.uid;
    setGhost(item, this.ghostMat, true);
    this.updateHeld();
  }

  place() {
    const h = this.held;
    if (!h) return;
    if (!h.valid) {
      this.toast(h.reason ? `Can't place here — ${h.reason}` : "Can't place here");
      return;
    }
    const item = h.item;
    const t = h.target;
    setGhost(item, this.ghostMat, false);
    this.manager.setTransform(item.uid, t.position, t.rotY, t.parentUid);
    if (h.isNew) {
      this.history.push(addCommand(this.manager, this.manager.serializeTree(item.uid)));
    } else {
      const to = this.manager.serialize(item.uid);
      const from = h.origin;
      const changed = to.parentUid !== from.parentUid || to.rotationY !== from.rotationY || to.position.some((v, i) => Math.abs(v - from.position[i]) > 1e-4);
      if (changed) this.history.push(moveCommand(this.manager, item.uid, from, to));
    }
    this.endHold();
  }

  /** Cancel holding: the item returns to where it was (new items disappear). No history entry. */
  cancel() {
    const h = this.held;
    if (!h) return;
    setGhost(h.item, this.ghostMat, false);
    if (h.isNew) this.manager.remove(h.item.uid);
    else this.manager.setTransform(h.item.uid, h.origin.position, h.origin.rotationY * DEG, h.origin.parentUid);
    this.endHold();
  }

  /** Delete the held item, or the item under the crosshair. */
  deleteTarget() {
    if (this.state === 'holding') {
      const h = this.held;
      if (h.isNew) {
        this.cancel();
        return;
      }
      const uid = h.item.uid;
      this.cancel(); // put it back first, so undo restores it at its original spot
      this.history.execute(deleteCommand(this.manager, uid));
      this.toast(`Deleted ${h.item.def.name} · Ctrl+Z to undo`);
    } else if (this.hover) {
      const item = this.hover;
      this.setHover(null);
      this.history.execute(deleteCommand(this.manager, item.uid));
      this.toast(`Deleted ${item.def.name} · Ctrl+Z to undo`);
    }
  }

  /** Q / E rotation (not for wall items, which align to the wall). */
  rotate(direction) {
    if (this.state !== 'holding' || this.held.item.def.placement === 'wall') return;
    this.held.rotY = Math.round((this.held.rotY + direction * ROT_STEP) / ROT_STEP) * ROT_STEP;
  }

  endHold() {
    this.held = null;
    this.state = 'idle';
    this.grid.visible = false;
  }

  /** Forget hover state (e.g. after undo removed the hovered item). */
  resetHover() {
    if (this.hover && this.manager.get(this.hover.uid) === this.hover) setHighlight(this.hover, false);
    this.hover = null;
  }

  /** Short label for the tooltip under the crosshair. */
  tooltip() {
    if (this.state === 'holding') {
      const h = this.held;
      return h.valid ? h.item.def.name : `${h.item.def.name} — ${h.reason || 'invalid spot'}`;
    }
    return this.hover ? `Click to pick up · ${this.hover.def.name}` : '';
  }

  /** Context controls for the hint bar. */
  hint() {
    if (this.state === 'holding') {
      const wall = this.held.item.def.placement === 'wall';
      const grid = `G grid: ${this.placement.snapEnabled ? 'on' : 'off'}`;
      return wall
        ? `Click place · R cancel · X delete · ${grid}`
        : `Click place · Q/E rotate · R cancel · X delete · ${grid}`;
    }
    if (this.hover) return 'Click pick up · X delete · M recolor';
    return `WASD move · Shift run · B library · M materials · N day/night · Esc menu`;
  }
}

// ─── Visual helpers ──────────────────────────────────────────────────────

/** Soft emissive tint on the item's own meshes. */
function setHighlight(item, on) {
  item.visual.traverse((o) => {
    if (!o.isMesh || o.userData.realMaterial) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m.emissive) continue;
      if (on) {
        if (m.userData.hlSaved) continue;
        m.userData.hlSaved = { color: m.emissive.getHex(), intensity: m.emissiveIntensity };
        m.emissive.set('#ffffff');
        m.emissiveIntensity = 0.16;
      } else if (m.userData.hlSaved) {
        m.emissive.setHex(m.userData.hlSaved.color);
        m.emissiveIntensity = m.userData.hlSaved.intensity;
        delete m.userData.hlSaved;
      }
    }
  });
}

/** Swap the item (and items standing on it) to / from the ghost material. */
function setGhost(item, ghostMat, on) {
  if (on) setHighlight(item, false);
  item.object.traverse((o) => {
    if (!o.isMesh) return;
    if (on) {
      if (o.userData.realMaterial) return;
      o.userData.realMaterial = o.material;
      o.userData.realCastShadow = o.castShadow;
      o.material = ghostMat;
      o.castShadow = false;
      o.renderOrder = 5;
    } else if (o.userData.realMaterial) {
      o.material = o.userData.realMaterial;
      o.castShadow = o.userData.realCastShadow;
      o.renderOrder = 0;
      delete o.userData.realMaterial;
      delete o.userData.realCastShadow;
    }
  });
}

