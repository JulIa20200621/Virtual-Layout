/**
 * Heads-up display: crosshair, tooltip, hint bar, toasts, start / help screens.
 */

/** Controls cheat-sheet (shared by the start screen and the help panel). */
export const CONTROLS = [
  ['Click', 'Start walking (pointer lock)'],
  ['Mouse', 'Look around'],
  ['W A S D', 'Walk · hold Shift to walk faster'],
  ['Click', 'Pick up item / place held item'],
  ['Q  E', 'Rotate held item ∓15°'],
  ['R / Right click', 'Cancel move'],
  ['X / Delete', 'Delete item'],
  ['G', 'Toggle grid snapping'],
  ['B', 'Furniture library'],
  ['M', 'Materials (floors, walls, colors)'],
  ['N', 'Day / night'],
  ['P', 'Photo mode (no UI · click saves a picture · Esc exits)'],
  ['Ctrl+Z / Ctrl+Y', 'Undo / redo'],
  ['Esc', 'Release mouse · show menu'],
];

function renderCheats(el) {
  el.innerHTML = CONTROLS.map(
    ([keys, what]) => `<div>${keys.split(' / ').map((k) => `<kbd>${k}</kbd>`).join(' ')}</div><div>${what}</div>`,
  ).join('');
}

export class Hud {
  constructor() {
    this.tooltipEl = document.getElementById('tooltip');
    this.hintEl = document.getElementById('hint');
    this.toastEl = document.getElementById('toast');
    this.startEl = document.getElementById('start-screen');
    this.helpEl = document.getElementById('help-panel');
    this._toastTimer = 0;
    this._lastTooltip = null;
    this._lastHint = null;

    renderCheats(document.getElementById('start-cheats'));
    this.helpEl.innerHTML = `
      <div class="panel-header"><h2>Controls</h2><button class="close-btn" data-close>✕</button></div>
      <div class="cheats" id="help-cheats" style="margin-top:14px"></div>`;
    renderCheats(this.helpEl.querySelector('#help-cheats'));
  }

  setTooltip(text) {
    if (text === this._lastTooltip) return;
    this._lastTooltip = text;
    this.tooltipEl.textContent = text;
    this.tooltipEl.classList.toggle('visible', !!text);
  }

  setHint(text) {
    if (text === this._lastHint) return;
    this._lastHint = text;
    this.hintEl.textContent = text;
    this.hintEl.style.display = text ? '' : 'none';
  }

  toast(msg, ms = 2200) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('visible'), ms);
  }

  /** Reflect pointer-lock state with body classes (CSS shows/hides HUD parts). */
  setMode({ locked, started, panelOpen }) {
    document.body.classList.toggle('locked', locked);
    document.body.classList.toggle('paused', started && !locked && !panelOpen);
  }

  hideStart() {
    this.startEl.classList.add('hidden');
  }
}
