import { ROOMS } from '../data/floorplan.js';
import { FLOOR_PRESETS, WALL_SWATCHES, FURNITURE_SWATCHES, getFloorPreviewURL } from '../house/materials.js';

/**
 * Materials panel (key M): per-room floor & wall materials, plus the color of the
 * currently held / targeted furniture item.
 */
export class MaterialsPanel {
  /**
   * @param {object} o
   * @param {import('../house/materials.js').RoomMaterials} o.roomMaterials
   * @param {() => string|null} o.getCurrentRoomId     room the player stands in
   * @param {() => {uid:string, name:string, color:string}|null} o.getItemTarget
   * @param {(roomId:string, presetId:string) => void} o.onFloor
   * @param {(roomId:string, color:string) => void} o.onWall
   * @param {(uid:string, color:string) => void} o.onItemColor
   */
  constructor(o) {
    this.o = o;
    this.el = document.getElementById('materials-panel');
    this.roomId = ROOMS[0].id;
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  open() {
    this.roomId = this.o.getCurrentRoomId() || this.roomId;
    this.render();
    this.el.classList.remove('hidden');
  }

  close() {
    this.el.classList.add('hidden');
  }

  /** Re-render if open (e.g. after undo). */
  refresh() {
    if (this.isOpen) this.render();
  }

  render() {
    const rm = this.o.roomMaterials;
    const floor = rm.get(this.roomId, 'floor');
    const wall = rm.get(this.roomId, 'wall');
    const target = this.o.getItemTarget();
    const here = this.o.getCurrentRoomId();

    this.el.innerHTML = `
      <div class="panel-header"><h2>Materials</h2><button class="close-btn" data-close>✕</button></div>
      <div class="row">
        <select id="mat-room">${ROOMS.map((r) => `<option value="${r.id}" ${r.id === this.roomId ? 'selected' : ''}>${r.name}</option>`).join('')}</select>
        <button class="soft-btn" id="mat-here" ${here ? '' : 'disabled'}>Use the room I'm standing in</button>
      </div>

      <h3>Floor</h3>
      <div class="row">
        ${Object.entries(FLOOR_PRESETS).map(([id, p]) => `
          <button class="floor-opt ${id === floor ? 'active' : ''}" data-floor="${id}">
            <img src="${getFloorPreviewURL(id)}" alt="" /><span>${p.name}</span>
          </button>`).join('')}
      </div>

      <h3>Walls</h3>
      <div class="row">
        ${WALL_SWATCHES.map((s) => `
          <button class="swatch ${s.color.toLowerCase() === String(wall).toLowerCase() ? 'active' : ''}" data-wall="${s.color}">
            <span class="chip" style="background:${s.color}"></span>${s.name}
          </button>`).join('')}
        <label class="swatch" title="Custom color"><input type="color" id="mat-wall-custom" value="${wall}" />Custom</label>
      </div>

      <h3>Furniture color</h3>
      ${target ? `
        <p class="muted" style="margin:0 0 8px">${target.name}</p>
        <div class="row">
          ${FURNITURE_SWATCHES.map((c) => `
            <button class="swatch small ${c.toLowerCase() === String(target.color).toLowerCase() ? 'active' : ''}" data-item-color="${c}" title="${c}">
              <span class="chip" style="background:${c}"></span>
            </button>`).join('')}
          <input type="color" id="mat-item-custom" value="${target.color}" title="Custom color" />
        </div>`
        : `<p class="muted" style="margin:0">Look at an item (or hold one) before opening this panel to recolor it.</p>`}
    `;

    this.el.querySelector('#mat-room').addEventListener('change', (e) => {
      this.roomId = e.target.value;
      this.render();
    });
    this.el.querySelector('#mat-here').addEventListener('click', () => {
      this.roomId = this.o.getCurrentRoomId() || this.roomId;
      this.render();
    });
    this.el.querySelectorAll('[data-floor]').forEach((b) =>
      b.addEventListener('click', () => {
        this.o.onFloor(this.roomId, b.dataset.floor);
        this.render();
      }),
    );
    this.el.querySelectorAll('[data-wall]').forEach((b) =>
      b.addEventListener('click', () => {
        this.o.onWall(this.roomId, b.dataset.wall);
        this.render();
      }),
    );
    this.el.querySelector('#mat-wall-custom').addEventListener('change', (e) => {
      this.o.onWall(this.roomId, e.target.value);
      this.render();
    });
    if (target) {
      this.el.querySelectorAll('[data-item-color]').forEach((b) =>
        b.addEventListener('click', () => {
          this.o.onItemColor(target.uid, b.dataset.itemColor);
          this.render();
        }),
      );
      this.el.querySelector('#mat-item-custom').addEventListener('change', (e) => {
        this.o.onItemColor(target.uid, e.target.value);
        this.render();
      });
    }
  }
}
