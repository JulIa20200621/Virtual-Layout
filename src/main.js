/**
 * Virtual Apartment — entry point.
 * Wires together the scene, house, player, furniture, history, persistence and UI,
 * and runs the render loop.
 */
import './ui/styles.css';
import * as THREE from 'three';

import { createScene } from './core/scene.js';
import { Lighting } from './core/lighting.js';
import { Player, isTyping } from './core/player.js';
import { ROOMS, roomAt } from './data/floorplan.js';
import { DEFAULT_LAYOUT } from './data/defaultLayout.js';
import { RoomMaterials } from './house/materials.js';
import { buildHouse } from './house/buildHouse.js';
import { buildFixtures } from './house/fixtures.js';
import { buildSurroundings } from './house/surroundings.js';
import { FurnitureManager } from './furniture/FurnitureManager.js';
import { Placement } from './furniture/placement.js';
import { Interaction } from './furniture/interaction.js';
import { History, replaceStateCommand, materialCommand, colorCommand } from './state/history.js';
import { saveLocal, loadLocal, exportJSON, importJSON, LAYOUT_VERSION } from './state/storage.js';
import { Hud } from './ui/hud.js';
import { createToolbar } from './ui/toolbar.js';
import { LibraryPanel } from './ui/libraryPanel.js';
import { MaterialsPanel } from './ui/materialsPanel.js';
import { Minimap } from './ui/minimap.js';

// ─── Scene & house ─────────────────────────────────────────────────────────
const { renderer, scene, camera, render } = createScene(document.getElementById('app'));

const roomMaterials = new RoomMaterials(ROOMS);
const house = buildHouse(roomMaterials);
scene.add(house.group);
const fixtures = buildFixtures();
scene.add(fixtures.group);
scene.add(buildSurroundings());

/** Walls, door leaves and fixtures: never move. */
const staticColliders = [...house.colliders, ...fixtures.colliders];
/** Meshes that block the view ray (for aiming / hover). */
const solidMeshes = [...house.wallMeshes, ...fixtures.meshes];

const furnitureRoot = new THREE.Group();
furnitureRoot.name = 'furniture';
scene.add(furnitureRoot);
const manager = new FurnitureManager(furnitureRoot);
const lighting = new Lighting(scene, furnitureRoot);

// ─── Player, placement, interaction ────────────────────────────────────────
/** Everything the player bumps into this frame: static colliders + floor furniture. */
function playerColliders() {
  const list = staticColliders.slice();
  const heldUid = interaction.isHolding ? interaction.held.item.uid : null;
  for (const item of manager.items.values()) {
    if (item.uid === heldUid || item.def.layer === 'rug' || item.def.placement !== 'floor') continue;
    list.push({ ...placement.itemBox(item), kind: 'item' });
  }
  return list;
}

const player = new Player(camera, renderer.domElement, playerColliders);
const placement = new Placement({ manager, colliders: staticColliders, solidMeshes, camera, player });
const history = new History(100);
const hud = new Hud();
const interaction = new Interaction({
  manager, placement, history, scene, camera, solidMeshes, toast: (m) => hud.toast(m),
});

// ─── Layout state (save / load / reset / import) ───────────────────────────
function getLayoutState() {
  return { items: manager.serializeAll(), materials: roomMaterials.getState() };
}

function setLayoutState(state) {
  interaction.resetHover();
  manager.clear();
  manager.createMany(state.items || []);
  roomMaterials.setState(state.materials || {});
}

function fullLayout() {
  return { version: LAYOUT_VERSION, ...getLayoutState(), timeOfDay: lighting.isNight ? 'night' : 'day' };
}

function save() {
  saveLocal(fullLayout());
}

// Restore the last session, or load the default layout.
const saved = loadLocal();
setLayoutState(saved || { items: DEFAULT_LAYOUT.items, materials: {} });
lighting.setNight(saved?.timeOfDay === 'night', true);

// ─── UI ────────────────────────────────────────────────────────────────────
const minimap = new Minimap({ staticColliders, manager, placement, roomMaterials });
roomMaterials.onChange = () => minimap.invalidate();

const library = new LibraryPanel((catalogId) => {
  closePanels();
  interaction.startNew(catalogId);
  player.lock();
  updateMode();
});

const materialsPanel = new MaterialsPanel({
  roomMaterials,
  getCurrentRoomId: () => roomAt(camera.position.x, camera.position.z)?.id || null,
  getItemTarget: () => {
    const uid = interaction.isHolding ? interaction.held.item.uid : interaction.lastTargetUid;
    const item = uid ? manager.get(uid) : null;
    return item ? { uid: item.uid, name: item.def.name, color: item.color } : null;
  },
  onFloor: (roomId, presetId) => {
    const from = roomMaterials.get(roomId, 'floor');
    if (from !== presetId) history.execute(materialCommand(roomMaterials, roomId, 'floor', from, presetId));
  },
  onWall: (roomId, color) => {
    const from = roomMaterials.get(roomId, 'wall');
    if (from !== color) history.execute(materialCommand(roomMaterials, roomId, 'wall', from, color));
  },
  onItemColor: (uid, color) => {
    const item = manager.get(uid);
    if (item && item.color !== color) history.execute(colorCommand(manager, uid, item.color, color));
  },
});

const helpPanel = document.getElementById('help-panel');
const panels = {
  library,
  materials: materialsPanel,
  help: {
    get isOpen() {
      return !helpPanel.classList.contains('hidden');
    },
    open: () => helpPanel.classList.remove('hidden'),
    close: () => helpPanel.classList.add('hidden'),
  },
};

function anyPanelOpen() {
  return Object.values(panels).some((p) => p.isOpen);
}

function closePanels() {
  Object.values(panels).forEach((p) => p.isOpen && p.close());
  updateMode();
}

function togglePanel(name) {
  if (panels[name].isOpen) {
    closePanels();
    return;
  }
  if (name === 'library' && interaction.isHolding) interaction.cancel();
  closePanels();
  panels[name].open();
  player.unlock();
  updateMode();
}

// Close buttons inside panels
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) closePanels();
});

function undo() {
  if (interaction.isHolding) interaction.cancel();
  const cmd = history.undo();
  if (cmd) hud.toast(`Undo: ${cmd.label}`, 1200);
}

function redo() {
  if (interaction.isHolding) interaction.cancel();
  const cmd = history.redo();
  if (cmd) hud.toast(`Redo: ${cmd.label}`, 1200);
}

function toggleDayNight() {
  lighting.toggle();
  save();
  refreshToolbar();
}

function resetLayout() {
  if (interaction.isHolding) interaction.cancel();
  const next = { items: DEFAULT_LAYOUT.items, materials: roomMaterials.defaultState() };
  history.execute(replaceStateCommand(getLayoutState, setLayoutState, next, 'Reset'));
  hud.toast('Layout reset to default · Ctrl+Z to undo');
}

async function importLayout() {
  if (interaction.isHolding) interaction.cancel();
  try {
    const data = await importJSON();
    const next = { items: data.items, materials: data.materials || {} };
    history.execute(replaceStateCommand(getLayoutState, setLayoutState, next, 'Import'));
    if (data.timeOfDay) lighting.setNight(data.timeOfDay === 'night');
    save();
    hud.toast('Layout imported');
  } catch (err) {
    hud.toast(`Import failed: ${err.message}`, 3500);
  }
}

const toolbar = createToolbar({
  library: () => togglePanel('library'),
  materials: () => togglePanel('materials'),
  daynight: toggleDayNight,
  undo,
  redo,
  export: () => {
    exportJSON(fullLayout());
    hud.toast('Layout exported');
  },
  import: importLayout,
  reset: resetLayout,
  photo: enterPhotoMode,
  help: () => togglePanel('help'),
});

function refreshToolbar() {
  toolbar.update({ canUndo: history.canUndo(), canRedo: history.canRedo(), isNight: lighting.isNight });
}

// Every committed change: auto-save + refresh UI.
history.onChange = () => {
  interaction.resetHover();
  save();
  refreshToolbar();
  materialsPanel.refresh();
};
refreshToolbar();

// ─── Pointer lock & mouse ──────────────────────────────────────────────────
let started = false;
let photoMode = false;

function updateMode() {
  hud.setMode({ locked: player.isLocked, started, panelOpen: anyPanelOpen() });
  document.body.classList.toggle('photo', photoMode);
}

// ─── Photo mode: hide all UI, keep walking / looking; click saves a picture, Esc exits ───
function enterPhotoMode() {
  if (photoMode) return;
  if (interaction.isHolding) interaction.cancel();
  interaction.resetHover();
  closePanels();
  photoMode = true;
  hud.hideStart();
  started = true;
  if (!player.isLocked) player.lock();
  updateMode();
  hud.toast('Photo mode · click to save a picture · Esc to exit', 2500);
}

function exitPhotoMode() {
  if (!photoMode) return;
  photoMode = false;
  updateMode();
}

function takePhoto() {
  render(); // render right before reading the canvas
  const url = renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `apartment-photo-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
  a.click();
  const flash = document.getElementById('photo-flash');
  flash.classList.remove('go');
  void flash.offsetWidth; // restart the CSS animation
  flash.classList.add('go');
}

player.controls.addEventListener('lock', () => {
  started = true;
  hud.hideStart();
  closePanels();
  updateMode();
});
player.controls.addEventListener('unlock', () => {
  // Esc releases the mouse (the browser handles it), which also ends photo mode.
  if (photoMode) exitPhotoMode();
  updateMode();
});

document.getElementById('start-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  player.lock();
});

renderer.domElement.addEventListener('click', () => {
  if (player.isLocked) return;
  if (anyPanelOpen()) closePanels();
  else player.lock();
});

document.addEventListener('mousedown', (e) => {
  if (!player.isLocked) return;
  if (photoMode) {
    if (e.button === 0) takePhoto();
    return;
  }
  if (e.button === 0) interaction.primaryAction();
  else if (e.button === 2) interaction.cancel();
});
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ─── Keyboard ─────────────────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (isTyping(e)) return;
  const ctrl = e.ctrlKey || e.metaKey;

  // In photo mode only Esc (exit), N (day/night) and P (toggle) do anything.
  if (photoMode) {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      exitPhotoMode();
      player.unlock();
    } else if (e.code === 'KeyN') toggleDayNight();
    return;
  }

  if (ctrl && e.code === 'KeyZ') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
    return;
  }
  if (ctrl && e.code === 'KeyY') {
    e.preventDefault();
    redo();
    return;
  }
  if (ctrl) return;

  switch (e.code) {
    case 'Escape':
      if (anyPanelOpen()) closePanels();
      break;
    case 'KeyB':
      togglePanel('library');
      break;
    case 'KeyM':
      togglePanel('materials');
      break;
    case 'KeyN':
      toggleDayNight();
      break;
    case 'KeyP':
      enterPhotoMode();
      break;
    case 'KeyQ':
      interaction.rotate(-1);
      break;
    case 'KeyE':
      interaction.rotate(1);
      break;
    case 'KeyR':
      interaction.cancel();
      break;
    case 'KeyX':
    case 'Delete':
      interaction.deleteTarget();
      break;
    case 'KeyG':
      placement.snapEnabled = !placement.snapEnabled;
      hud.toast(`Grid snapping ${placement.snapEnabled ? 'on' : 'off'}`, 1200);
      break;
    default:
  }
});

// ─── Render loop ──────────────────────────────────────────────────────────
const timer = new THREE.Timer();

renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(timer.getDelta(), 0.05);
  player.update(dt);
  interaction.update(player.isLocked && !photoMode);
  lighting.update(dt);

  if (photoMode) {
    hud.setTooltip('');
    hud.setHint('');
  } else if (player.isLocked) {
    hud.setTooltip(interaction.tooltip());
    hud.setHint(interaction.hint());
  } else {
    hud.setTooltip('');
    hud.setHint(started ? 'Click to resume · B library · M materials · N day/night · Ctrl+Z undo' : '');
  }
  if (!photoMode) minimap.draw(camera, interaction.isHolding ? interaction.held.item.uid : null);
  render();
});

// Handy for debugging in the browser console.
window.app = { scene, camera, manager, history, roomMaterials, lighting, interaction, placement, materialsPanel, togglePanel, resetLayout, enterPhotoMode, exitPhotoMode };
