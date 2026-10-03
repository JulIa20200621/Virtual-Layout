import * as THREE from 'three';
import { CATALOG_BY_ID } from '../data/catalog.js';
import { enableShadows } from './builders/helpers.js';

const DEG = Math.PI / 180;
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

/**
 * Item record (also the save/export format):
 * @typedef {{uid:string, catalogId:string, position:[number,number,number], rotationY:number, color?:string, parentUid?:string|null}} ItemRecord
 *   position = world coordinates, rotationY = world rotation in DEGREES.
 *
 * Runtime item:
 * @typedef {{uid:string, def:any, color:string, object:THREE.Group, visual:THREE.Group}} Item
 *   object = the item's group (children items are attached to it, so they move with it)
 *   visual = the meshes built by the catalog factory (only this item's own meshes)
 */

/**
 * Creates, removes and tracks furniture items.
 * The scene graph is the source of truth for transforms: an item standing on a
 * surface is a child of that surface's group.
 */
export class FurnitureManager {
  /** @param {THREE.Object3D} root  container for all furniture (identity transform) */
  constructor(root) {
    this.root = root;
    /** @type {Map<string, Item>} */
    this.items = new Map();
    this._uidCounter = 0;
  }

  newUid() {
    let uid;
    do {
      uid = `i${Date.now().toString(36).slice(-4)}${(this._uidCounter++).toString(36)}`;
    } while (this.items.has(uid));
    return uid;
  }

  get(uid) {
    return this.items.get(uid);
  }

  /** Find the item an Object3D belongs to (walks up the scene graph). */
  itemFromObject(obj) {
    while (obj) {
      if (obj.userData.itemUid) return this.items.get(obj.userData.itemUid) || null;
      obj = obj.parent;
    }
    return null;
  }

  /** @returns {Item|null} the item this item stands on. */
  parentOf(item) {
    return item.object.parent ? this.itemFromObject(item.object.parent) : null;
  }

  /** Direct child items (items standing on this one). */
  childrenOf(item) {
    return item.object.children.filter((c) => c.userData.itemUid).map((c) => this.items.get(c.userData.itemUid));
  }

  /** The item and everything standing on it, parents first. */
  subtree(item) {
    const out = [item];
    for (const child of this.childrenOf(item)) out.push(...this.subtree(child));
    return out;
  }

  /**
   * Create an item from a record and add it to the scene.
   * @param {ItemRecord} rec
   * @returns {Item|null}
   */
  create(rec) {
    const def = CATALOG_BY_ID[rec.catalogId];
    if (!def) {
      console.warn('Unknown catalog id', rec.catalogId);
      return null;
    }
    const uid = rec.uid && !this.items.has(rec.uid) ? rec.uid : this.newUid();
    const color = rec.color || def.defaultColor;
    const object = new THREE.Group();
    object.name = def.name;
    object.userData.itemUid = uid;
    const visual = enableShadows(def.build(color));
    visual.userData.isVisual = true;
    object.add(visual);
    // Lamp lights must not cast shadows (enableShadows only touches meshes).
    /** @type {Item} */
    const item = { uid, def, color, object, visual };
    this.items.set(uid, item);
    this.root.add(object);
    this.setTransform(uid, rec.position || [0, 0, 0], (rec.rotationY || 0) * DEG, rec.parentUid || null);
    return item;
  }

  /**
   * Remove an item and everything standing on it.
   * @returns {ItemRecord[]} records of the removed items (parents first), for undo
   */
  remove(uid) {
    const item = this.items.get(uid);
    if (!item) return [];
    const records = this.serializeTree(uid);
    for (const it of this.subtree(item)) this.items.delete(it.uid);
    item.object.removeFromParent();
    disposeObject(item.object);
    return records;
  }

  /** Remove everything. */
  clear() {
    for (const item of [...this.items.values()]) {
      if (this.items.has(item.uid) && !this.parentOf(item)) this.remove(item.uid);
    }
    this.items.clear();
  }

  /**
   * Set an item's world transform and parent.
   * @param {string} uid
   * @param {number[]|THREE.Vector3} position world position
   * @param {number} rotY world rotation (radians)
   * @param {string|null} parentUid
   */
  setTransform(uid, position, rotY, parentUid) {
    const item = this.items.get(uid);
    if (!item) return;
    const obj = item.object;
    this.root.attach(obj); // root has an identity transform → local = world
    if (Array.isArray(position)) obj.position.fromArray(position);
    else obj.position.copy(position);
    obj.rotation.set(0, rotY, 0);
    obj.updateMatrixWorld(true);
    const parent = parentUid ? this.items.get(parentUid) : null;
    if (parent && parent !== item) parent.object.attach(obj);
  }

  /** World position and world Y rotation (radians) of an item. */
  getWorldTransform(item) {
    item.object.updateWorldMatrix(true, false);
    item.object.getWorldPosition(_v);
    item.object.getWorldQuaternion(_q);
    const rotY = 2 * Math.atan2(_q.y, _q.w);
    return { position: _v.clone(), rotY };
  }

  /** Recolor the item's primary material(s). */
  setColor(uid, color) {
    const item = this.items.get(uid);
    if (!item) return;
    item.color = color;
    item.visual.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      // while ghosted the real materials are stored in userData.realMaterial
      const real = o.userData.realMaterial ? (Array.isArray(o.userData.realMaterial) ? o.userData.realMaterial : [o.userData.realMaterial]) : mats;
      for (const m of real) if (m.userData.isPrimary) m.color.set(color);
    });
  }

  /** @returns {ItemRecord} */
  serialize(uid) {
    const item = this.items.get(uid);
    const { position, rotY } = this.getWorldTransform(item);
    const parent = this.parentOf(item);
    const r3 = (n) => Math.round(n * 1000) / 1000;
    let deg = Math.round((rotY / DEG) * 100) / 100;
    if (deg <= -180) deg += 360;
    if (deg > 180) deg -= 360;
    return {
      uid: item.uid,
      catalogId: item.def.id,
      position: [r3(position.x), r3(position.y), r3(position.z)],
      rotationY: deg,
      color: item.color,
      parentUid: parent ? parent.uid : null,
    };
  }

  /** Records for an item and everything on it (parents first). */
  serializeTree(uid) {
    const item = this.items.get(uid);
    return item ? this.subtree(item).map((it) => this.serialize(it.uid)) : [];
  }

  /** All items, parents before children. */
  serializeAll() {
    const out = [];
    for (const item of this.items.values()) {
      if (!this.parentOf(item)) out.push(...this.serializeTree(item.uid));
    }
    return out;
  }

  /** Create many items; parents are created before their children. */
  createMany(records) {
    const pending = [...records];
    const created = new Set(this.items.keys());
    let guard = 0;
    while (pending.length && guard++ < 1000) {
      const idx = pending.findIndex((r) => !r.parentUid || created.has(r.parentUid) || !records.some((o) => o.uid === r.parentUid));
      const [rec] = pending.splice(idx === -1 ? 0 : idx, 1);
      const item = this.create(rec);
      if (item) created.add(item.uid);
    }
  }
}

/** Free GPU geometry for a removed object (textures/materials are small and may be shared). */
function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.isMesh) o.geometry?.dispose();
  });
}
