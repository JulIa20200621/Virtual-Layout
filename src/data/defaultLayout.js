/**
 * Default furniture layout, loaded on first visit and by "Reset to default".
 *
 * Same format as the saved / exported layout JSON:
 *  - position:  world coordinates [x, y, z] in meters (y = bottom of the item)
 *  - rotationY: degrees around the vertical axis (0 = item front faces +Z / south,
 *               90 = faces +X / east, -90 = faces −X / west, 180 = faces north)
 *  - parentUid: the surface item this item stands on (it moves with its parent)
 */
export const DEFAULT_LAYOUT = {
  version: 1,
  items: [
    // ── Master bedroom ──
    { uid: 'bed1', catalogId: 'doubleBed', position: [1.12, 0, 1.92], rotationY: 90 },
    { uid: 'ns1', catalogId: 'nightstand', position: [0.31, 0, 0.84], rotationY: 90 },
    { uid: 'ns2', catalogId: 'nightstand', position: [0.31, 0, 3.0], rotationY: 90 },
    { uid: 'lamp1', catalogId: 'tableLamp', position: [0.31, 0.5, 0.84], rotationY: 90, parentUid: 'ns1' },
    { uid: 'lamp2', catalogId: 'tableLamp', position: [0.31, 0.5, 3.0], rotationY: 90, parentUid: 'ns2' },
    { uid: 'wardrobe1', catalogId: 'wardrobe', position: [3.64, 0, 1.0], rotationY: -90 },

    // ── Bedroom 2 ──
    { uid: 'bed2', catalogId: 'singleBed', position: [8.89, 0, 0.58], rotationY: -90 },
    { uid: 'desk1', catalogId: 'desk', position: [6.56, 0, 1.3], rotationY: 90 },
    { uid: 'chair0', catalogId: 'deskChair', position: [7.2, 0, 1.3], rotationY: -90 },
    { uid: 'plant1', catalogId: 'smallPlant', position: [6.5, 0.75, 1.75], rotationY: 0, parentUid: 'desk1' },

    // ── Living ──
    { uid: 'rug1', catalogId: 'rugRect', position: [1.9, 0, 5.6], rotationY: 90 },
    { uid: 'sofa1', catalogId: 'sofa', position: [0.57, 0, 5.6], rotationY: 90 },
    { uid: 't1', catalogId: 'coffeeTable', position: [1.75, 0, 5.6], rotationY: 90 },
    { uid: 'tv1', catalogId: 'tvStand', position: [3.3, 0, 5.6], rotationY: -90 },
    { uid: 'flamp1', catalogId: 'floorLamp', position: [0.38, 0, 4.25], rotationY: 0 },
    { uid: 'bigPlant1', catalogId: 'largePlant', position: [3.62, 0, 7.05], rotationY: 0 },
    { uid: 'art1', catalogId: 'wallArtLarge', position: [0.121, 1.15, 5.6], rotationY: 90 },

    // ── Dining ──
    { uid: 'dt1', catalogId: 'diningTable', position: [5.5, 0, 5.6], rotationY: 0 },
    { uid: 'c1', catalogId: 'diningChair', position: [5.15, 0, 4.9], rotationY: 0 },
    { uid: 'c2', catalogId: 'diningChair', position: [5.85, 0, 4.9], rotationY: 0 },
    { uid: 'c3', catalogId: 'diningChair', position: [5.15, 0, 6.3], rotationY: 180 },
    { uid: 'c4', catalogId: 'diningChair', position: [5.85, 0, 6.3], rotationY: 180 },
    { uid: 'vase1', catalogId: 'vase', position: [5.5, 0.75, 5.6], rotationY: 0, parentUid: 'dt1' },
  ],
};
