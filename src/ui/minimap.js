import * as THREE from 'three';
import { PLAN, ROOMS } from '../data/floorplan.js';
import { boxCorners } from '../core/collision.js';

/** Approximate floor colors for the minimap. */
const FLOOR_COLORS = {
  lightOak: '#e6d6bb',
  walnut: '#a88a70',
  greyTile: '#cfcfcb',
  whiteMarble: '#f1f0ed',
  concrete: '#c9c7c2',
};

/**
 * Top-down minimap (2D canvas — cheaper than a second WebGL render).
 * Shows walls, room names, fixtures, furniture footprints and the player arrow.
 */
export class Minimap {
  /**
   * @param {object} o
   * @param {any[]} o.staticColliders walls, doors and fixtures (collision boxes)
   * @param {import('../furniture/FurnitureManager.js').FurnitureManager} o.manager
   * @param {import('../furniture/placement.js').Placement} o.placement
   * @param {import('../house/materials.js').RoomMaterials} o.roomMaterials
   */
  constructor({ staticColliders, manager, placement, roomMaterials }) {
    this.canvas = document.getElementById('minimap');
    this.colliders = staticColliders;
    this.manager = manager;
    this.placement = placement;
    this.roomMaterials = roomMaterials;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = 220;
    const cssH = 176;
    this.canvas.width = cssW * this.dpr;
    this.canvas.height = cssH * this.dpr;
    this.ctx = this.canvas.getContext('2d');
    const pad = 12;
    this.scale = Math.min((cssW - 2 * pad) / PLAN.width, (cssH - 2 * pad) / PLAN.depth);
    this.offX = (cssW - PLAN.width * this.scale) / 2;
    this.offY = (cssH - PLAN.depth * this.scale) / 2;
    this.staticLayer = document.createElement('canvas');
    this.staticLayer.width = this.canvas.width;
    this.staticLayer.height = this.canvas.height;
    this.dirty = true;
    this._dir = new THREE.Vector3();
  }

  /** World (x, z) → canvas pixels (CSS units). */
  px(x, z) {
    return [this.offX + x * this.scale, this.offY + z * this.scale];
  }

  /** Mark the static layer (floors / walls) for redraw, e.g. after a material change. */
  invalidate() {
    this.dirty = true;
  }

  polygon(ctx, pts) {
    ctx.beginPath();
    pts.forEach(([x, z], i) => {
      const [px, py] = this.px(x, z);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
  }

  drawStatic() {
    const ctx = this.staticLayer.getContext('2d');
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const room of ROOMS) {
      this.polygon(ctx, room.polygon);
      ctx.fillStyle = FLOOR_COLORS[this.roomMaterials.get(room.id, 'floor')] || '#eee';
      ctx.fill();
    }
    for (const c of this.colliders) {
      this.polygon(ctx, boxCorners(c));
      if (c.kind === 'wall') ctx.fillStyle = c.y0 > 0.5 ? 'rgba(80,78,72,0.25)' : '#55524c';
      else if (c.kind === 'door') ctx.fillStyle = '#b8b2a6';
      else ctx.fillStyle = c.y0 > 1 ? 'rgba(150,145,135,0.35)' : '#bdb7ab';
      ctx.fill();
    }
    this.dirty = false;
  }

  /** Room names, drawn above the furniture with a light halo so they stay readable. */
  drawLabels(ctx) {
    ctx.font = '600 7.5px Inter, Segoe UI, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.fillStyle = 'rgba(50,48,44,0.9)';
    for (const room of ROOMS) {
      const xs = room.polygon.map((p) => p[0]);
      const zs = room.polygon.map((p) => p[1]);
      const [px, py] = this.px((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2);
      ctx.strokeText(room.name, px, py);
      ctx.fillText(room.name, px, py);
    }
  }

  /** Draw a frame. */
  draw(camera, heldUid) {
    if (this.dirty) this.drawStatic();
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.staticLayer, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Furniture: rugs first, then floor items, then wall items and things on surfaces.
    const items = [...this.manager.items.values()];
    const order = (it) => (it.def.layer === 'rug' ? 0 : it.def.placement === 'floor' ? 1 : 2);
    items.sort((a, b) => order(a) - order(b));
    for (const item of items) {
      const b = this.placement.itemBox(item);
      const held = item.uid === heldUid;
      if (item.def.layer === 'rug') ctx.fillStyle = 'rgba(160,150,130,0.35)';
      else if (held) ctx.fillStyle = 'rgba(95,209,122,0.75)';
      else ctx.fillStyle = item.def.placement === 'floor' ? 'rgba(127,145,131,0.85)' : 'rgba(201,167,124,0.95)';
      if (item.def.shape === 'round') {
        const [px, py] = this.px(b.cx, b.cz);
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1.5, b.hx * this.scale), 0, Math.PI * 2);
        ctx.fill();
      } else {
        this.polygon(ctx, boxCorners(b));
        ctx.fill();
      }
    }

    this.drawLabels(ctx);

    // Player arrow
    camera.getWorldDirection(this._dir);
    const ang = Math.atan2(this._dir.z, this._dir.x);
    const [px, py] = this.px(camera.position.x, camera.position.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, 5);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-5, -5);
    ctx.closePath();
    ctx.fillStyle = '#e0614f';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }
}
