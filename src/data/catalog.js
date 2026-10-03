import { buildDoubleBed, buildSingleBed, buildWardrobe, buildNightstand, buildDesk, buildDeskChair } from '../furniture/builders/bedroom.js';
import { buildSofa, buildArmchair, buildCoffeeTable, buildTVStand, buildDiningTable, buildDiningChair, buildBookshelf } from '../furniture/builders/living.js';
import {
  buildVase, buildSmallPlant, buildLargePlant, buildTableLamp, buildFloorLamp,
  buildRectRug, buildRoundRug, buildWallArtSmall, buildWallArtLarge,
} from '../furniture/builders/decor.js';

/**
 * Furniture catalog.
 *
 * Fields:
 *  - id, name, category
 *  - size {w, d, h}   footprint width (local X), depth (local Z), height — used for collisions
 *  - placement        'floor' | 'surface' | 'wall'
 *  - isSurface        small items can be placed on top
 *  - surfaceHeight    height of the top surface (when isSurface)
 *  - surfaceRect      optional {w, d, offsetZ}: usable part of the top (default: whole footprint)
 *  - layer            'rug' → may lie under other furniture
 *  - shape            'round' → drawn as a circle on the minimap
 *  - defaultColor     initial primary color
 *  - build(color)     factory returning a THREE.Group (origin = bottom center, front = +Z)
 *
 * To swap a primitive item for a GLB model later, only `build()` needs to change.
 */
export const CATALOG = [
  // ── Bedroom ──
  { id: 'doubleBed', name: 'Double Bed', category: 'Bedroom', size: { w: 1.6, d: 2.0, h: 1.0 }, placement: 'floor', defaultColor: '#cfc6b6', build: buildDoubleBed },
  { id: 'singleBed', name: 'Single Bed', category: 'Bedroom', size: { w: 0.9, d: 2.0, h: 1.0 }, placement: 'floor', defaultColor: '#a9b8a3', build: buildSingleBed },
  { id: 'wardrobe', name: 'Wardrobe', category: 'Bedroom', size: { w: 1.2, d: 0.6, h: 2.0 }, placement: 'floor', defaultColor: '#f4f1ea', build: buildWardrobe },
  { id: 'nightstand', name: 'Nightstand', category: 'Bedroom', size: { w: 0.45, d: 0.4, h: 0.5 }, placement: 'floor', isSurface: true, surfaceHeight: 0.5, defaultColor: '#e8e2d6', build: buildNightstand },
  { id: 'desk', name: 'Desk', category: 'Bedroom', size: { w: 1.2, d: 0.6, h: 0.75 }, placement: 'floor', isSurface: true, surfaceHeight: 0.75, defaultColor: '#c9a77c', build: buildDesk },
  { id: 'deskChair', name: 'Desk Chair', category: 'Bedroom', size: { w: 0.55, d: 0.55, h: 0.95 }, placement: 'floor', shape: 'round', defaultColor: '#8e918f', build: buildDeskChair },

  // ── Living / Dining ──
  { id: 'sofa', name: 'Sofa', category: 'Living & Dining', size: { w: 2.1, d: 0.9, h: 0.85 }, placement: 'floor', defaultColor: '#b9b9b4', build: buildSofa },
  { id: 'armchair', name: 'Armchair', category: 'Living & Dining', size: { w: 0.85, d: 0.85, h: 0.85 }, placement: 'floor', defaultColor: '#a9b8a3', build: buildArmchair },
  { id: 'coffeeTable', name: 'Coffee Table', category: 'Living & Dining', size: { w: 1.1, d: 0.6, h: 0.42 }, placement: 'floor', isSurface: true, surfaceHeight: 0.42, defaultColor: '#c9a77c', build: buildCoffeeTable },
  { id: 'tvStand', name: 'TV Stand', category: 'Living & Dining', size: { w: 1.6, d: 0.4, h: 1.3 }, placement: 'floor', isSurface: true, surfaceHeight: 0.5, surfaceRect: { w: 1.6, d: 0.2, offsetZ: 0.1 }, defaultColor: '#f4f1ea', build: buildTVStand },
  { id: 'diningTable', name: 'Dining Table', category: 'Living & Dining', size: { w: 1.4, d: 0.8, h: 0.75 }, placement: 'floor', isSurface: true, surfaceHeight: 0.75, defaultColor: '#c9a77c', build: buildDiningTable },
  { id: 'diningChair', name: 'Dining Chair', category: 'Living & Dining', size: { w: 0.45, d: 0.48, h: 0.85 }, placement: 'floor', defaultColor: '#e8e2d6', build: buildDiningChair },
  { id: 'bookshelf', name: 'Bookshelf', category: 'Living & Dining', size: { w: 0.8, d: 0.3, h: 1.8 }, placement: 'floor', defaultColor: '#f4f1ea', build: buildBookshelf },

  // ── Decor ──
  { id: 'vase', name: 'Vase with Flowers', category: 'Decor', size: { w: 0.18, d: 0.18, h: 0.55 }, placement: 'surface', shape: 'round', defaultColor: '#d9cbb5', build: buildVase },
  { id: 'smallPlant', name: 'Small Plant', category: 'Decor', size: { w: 0.22, d: 0.22, h: 0.4 }, placement: 'surface', shape: 'round', defaultColor: '#e8e2d6', build: buildSmallPlant },
  { id: 'largePlant', name: 'Large Plant', category: 'Decor', size: { w: 0.5, d: 0.5, h: 1.45 }, placement: 'floor', shape: 'round', defaultColor: '#d9cbb5', build: buildLargePlant },
  { id: 'tableLamp', name: 'Table Lamp', category: 'Decor', size: { w: 0.28, d: 0.28, h: 0.48 }, placement: 'surface', shape: 'round', defaultColor: '#f4f1ea', build: buildTableLamp },
  { id: 'floorLamp', name: 'Floor Lamp', category: 'Decor', size: { w: 0.4, d: 0.4, h: 1.6 }, placement: 'floor', shape: 'round', defaultColor: '#f4f1ea', build: buildFloorLamp },
  { id: 'rugRect', name: 'Rug (2.0 × 1.4)', category: 'Decor', size: { w: 2.0, d: 1.4, h: 0.012 }, placement: 'floor', layer: 'rug', defaultColor: '#e3d5bd', build: buildRectRug },
  { id: 'rugRound', name: 'Round Rug (Ø1.6)', category: 'Decor', size: { w: 1.6, d: 1.6, h: 0.012 }, placement: 'floor', layer: 'rug', shape: 'round', defaultColor: '#cfc6b6', build: buildRoundRug },
  { id: 'wallArtSmall', name: 'Wall Art (small)', category: 'Decor', size: { w: 0.5, d: 0.035, h: 0.7 }, placement: 'wall', defaultColor: '#c9a77c', build: buildWallArtSmall },
  { id: 'wallArtLarge', name: 'Wall Art (large)', category: 'Decor', size: { w: 1.0, d: 0.035, h: 0.7 }, placement: 'wall', defaultColor: '#3f3a36', build: buildWallArtLarge },
];

/** Lookup by id. */
export const CATALOG_BY_ID = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

/** Categories in display order. */
export const CATEGORIES = [...new Set(CATALOG.map((c) => c.category))];
