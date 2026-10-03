/**
 * Floor plan data for the 2B1B apartment (~75 m²).
 *
 * Coordinate system (meters):
 *   origin = north-west exterior corner, +X = east, +Z = south, +Y = up.
 *
 * Everything that describes the *shape* of the apartment lives here, so the
 * plan can be edited without touching any rendering code.
 *
 * Rules / conventions:
 *  - Walls are axis-aligned line segments (centerlines) with a thickness.
 *    Horizontal walls run west → east, vertical walls run north → south,
 *    so "start" is always the west / north end.
 *  - Exterior horizontal walls are extended by half the exterior thickness at
 *    both ends so the corners are filled. Interior walls run between the
 *    centerlines of the walls they touch.
 *  - Openings reference a wall by id. `offset` is the distance from the wall's
 *    start point to the CENTER of the opening.
 *  - Doors may define `swing`: which side (room direction) the open door leaf
 *    sits on, and which end of the opening the hinge is on.
 *  - Rooms are polygons (in X/Z) that tile the apartment up to wall centerlines.
 *    Each room gets its own floor mesh and its own wall faces/materials.
 */

/** Overall dimensions. */
export const PLAN = {
  width: 10.0, // X
  depth: 7.5, // Z
  ceilingHeight: 2.7,
  exteriorThickness: 0.2,
  interiorThickness: 0.1,
};

const EXT = PLAN.exteriorThickness;
const INT = PLAN.interiorThickness;
const HALF_EXT = EXT / 2;

/**
 * Walls as centerline segments.
 * @type {{id:string, start:[number,number], end:[number,number], thickness:number, exterior?:boolean}[]}
 */
export const WALLS = [
  // ── Exterior ────────────────────────────────────────────────
  { id: 'extNorth', start: [-HALF_EXT, 0], end: [10 + HALF_EXT, 0], thickness: EXT, exterior: true },
  { id: 'extSouth', start: [-HALF_EXT, 7.5], end: [10 + HALF_EXT, 7.5], thickness: EXT, exterior: true },
  { id: 'extWest', start: [0, HALF_EXT], end: [0, 7.5 - HALF_EXT], thickness: EXT, exterior: true },
  { id: 'extEast', start: [10, HALF_EXT], end: [10, 7.5 - HALF_EXT], thickness: EXT, exterior: true },

  // ── Interior ────────────────────────────────────────────────
  // Master bedroom east wall (also bathroom/hall west wall)
  { id: 'masterEast', start: [4.0, 0], end: [4.0, 3.8 + INT / 2], thickness: INT },
  // Bedroom 2 west wall (also bathroom/hall east wall)
  { id: 'bed2West', start: [6.2, 0], end: [6.2, 3.8 + INT / 2], thickness: INT },
  // Bathroom south wall (between bathroom and hall)
  { id: 'bathSouth', start: [4.0, 2.6], end: [6.2, 2.6], thickness: INT },
  // Master bedroom south wall (towards living)
  { id: 'masterSouth', start: [0, 3.8], end: [4.0, 3.8], thickness: INT },
  // Bedroom 2 south wall (towards kitchen)
  { id: 'bed2South', start: [6.2, 3.8], end: [10, 3.8], thickness: INT },
];

/**
 * Door and window openings.
 *  - offset: distance from wall start to the opening center (m)
 *  - sill:   bottom of the opening above the floor (0 for doors)
 *  - swing:  (doors only) { side: 'north'|'south'|'east'|'west', hinge: 'start'|'end' }
 * @type {{id:string, type:'door'|'window', wallId:string, offset:number, width:number, height:number, sill:number, swing?:{side:string, hinge:'start'|'end'}}[]}
 */
export const OPENINGS = [
  // Doors (0.9 × 2.1 m, bathroom 0.8 m)
  { id: 'doorMaster', type: 'door', wallId: 'masterEast', offset: 3.2, width: 0.9, height: 2.1, sill: 0, swing: { side: 'west', hinge: 'end' } },
  { id: 'doorBed2', type: 'door', wallId: 'bed2West', offset: 3.2, width: 0.9, height: 2.1, sill: 0, swing: { side: 'east', hinge: 'end' } },
  { id: 'doorBath', type: 'door', wallId: 'bathSouth', offset: 1.1, width: 0.8, height: 2.1, sill: 0, swing: { side: 'north', hinge: 'end' } },
  { id: 'doorEntry', type: 'door', wallId: 'extSouth', offset: 8.5 + HALF_EXT, width: 0.9, height: 2.1, sill: 0, swing: { side: 'north', hinge: 'end' } },

  // Windows (sill 0.9 m, height 1.4 m unless noted)
  { id: 'winMaster', type: 'window', wallId: 'extNorth', offset: 2.0 + HALF_EXT, width: 1.4, height: 1.4, sill: 0.9 },
  { id: 'winBed2', type: 'window', wallId: 'extNorth', offset: 8.1 + HALF_EXT, width: 1.4, height: 1.4, sill: 0.9 },
  { id: 'winBath', type: 'window', wallId: 'extNorth', offset: 5.1 + HALF_EXT, width: 0.6, height: 0.5, sill: 1.7 }, // small high window
  { id: 'winLiving', type: 'window', wallId: 'extSouth', offset: 2.0 + HALF_EXT, width: 2.4, height: 1.4, sill: 0.9 }, // large living window
  { id: 'winKitchen', type: 'window', wallId: 'extEast', offset: 5.6 - HALF_EXT, width: 1.2, height: 1.1, sill: 1.1 }, // above the counter
];

/**
 * Rooms as polygons (X/Z), each with its own floor and wall material.
 * `defaultFloor` / `defaultWall` are the initial material choices.
 * @type {{id:string, name:string, polygon:[number,number][], defaultFloor:string, defaultWall:string}[]}
 */
export const ROOMS = [
  { id: 'masterBedroom', name: 'Master Bedroom', polygon: [[0, 0], [4, 0], [4, 3.8], [0, 3.8]], defaultFloor: 'lightOak', defaultWall: '#f5f2ec' },
  { id: 'bathroom', name: 'Bathroom', polygon: [[4, 0], [6.2, 0], [6.2, 2.6], [4, 2.6]], defaultFloor: 'greyTile', defaultWall: '#e9ebea' },
  { id: 'hall', name: 'Hall', polygon: [[4, 2.6], [6.2, 2.6], [6.2, 3.8], [4, 3.8]], defaultFloor: 'lightOak', defaultWall: '#f5f2ec' },
  { id: 'bedroom2', name: 'Bedroom 2', polygon: [[6.2, 0], [10, 0], [10, 3.8], [6.2, 3.8]], defaultFloor: 'lightOak', defaultWall: '#f5f2ec' },
  { id: 'living', name: 'Living', polygon: [[0, 3.8], [4, 3.8], [4, 7.5], [0, 7.5]], defaultFloor: 'lightOak', defaultWall: '#f5f2ec' },
  { id: 'dining', name: 'Dining', polygon: [[4, 3.8], [7, 3.8], [7, 7.5], [4, 7.5]], defaultFloor: 'lightOak', defaultWall: '#f5f2ec' },
  { id: 'kitchen', name: 'Kitchen', polygon: [[7, 3.8], [10, 3.8], [10, 7.5], [7, 7.5]], defaultFloor: 'greyTile', defaultWall: '#f5f2ec' },
];

/** Where the player starts: just inside the entry door, looking into the living room. */
export const PLAYER_START = { position: [8.3, 6.7], yawDegrees: 70 };

/**
 * Point-in-polygon test (ray casting). Points on an edge may count either way.
 * @param {number} x
 * @param {number} z
 * @param {[number,number][]} poly
 */
export function pointInPolygon(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    const intersect = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** @returns the room containing (x, z), or null when outside the apartment. */
export function roomAt(x, z) {
  return ROOMS.find((r) => pointInPolygon(x, z, r.polygon)) || null;
}

/** True when (x, z) is inside the apartment footprint (any room). */
export function isInsideApartment(x, z) {
  return roomAt(x, z) !== null;
}
