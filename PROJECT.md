# PROJECT.md — Virtual 2B1B Apartment (First-Person Furniture Editor)

> This document is the spec for Claude Code. Build the project described here from an empty folder.
> The owner can read code but is not a web developer — keep code clean, commented, and include clear run instructions.

---

## 1. Goal

A browser-based 3D model of a **2-bedroom, 1-bathroom (2B1B) apartment, ~75 m²**, explored in **first-person view** (like a game). The user can walk around and **rearrange the interior**: pick up furniture, move/rotate it, add new items from a library (e.g. a vase), delete items, change wall/floor colors and materials, and save the layout.

Everything (house + furniture) is generated in code with simple geometry — **no external 3D model files**.

---

## 2. Tech Stack

| Item | Choice |
|---|---|
| Build tool | **Vite** (vanilla JS, ES modules — no React) |
| 3D | **Three.js** (latest stable), `PointerLockControls` from `three/addons` |
| Language | JavaScript with JSDoc comments (no TypeScript needed) |
| UI | Plain HTML/CSS overlay on top of the canvas |
| Persistence | `localStorage` + JSON export/import |
| UI language | **English** |

Run commands must be: `npm install` → `npm run dev` → open the printed localhost URL. Put these in a short `README.md`.

---

## 3. Floor Plan (fixed, data-driven)

Coordinate system: meters. Origin = north-west exterior corner. **+X = east, +Z = south, +Y = up.**
Overall footprint **10.0 m (X) × 7.5 m (Z) = 75 m²**. Ceiling height **2.7 m**.
Exterior walls 0.2 m thick, interior walls 0.1 m thick (coordinates below are wall centerlines).

```
 x=0          x=4.0   x=6.2            x=10
z=0 +-----------+-------+----------------+
    |           |  BATH |                |
    |  MASTER   | 2.2x2.6               |
    |  BEDROOM  +--d----+   BEDROOM 2    |
    | 4.0x3.8   d  HALL d   3.8x3.8      |
z=3.8 +----------+       +----------------+
    |                                    |
    |  LIVING        DINING     KITCHEN  |
    |  (x0–4)        (x4–7)     (x7–10)  |
    |                                    |
z=7.5 +-------------------------[entry]----+
         (d = door; hall is open to living area on its south side)
```

| Room | Bounds (x / z) | Notes |
|---|---|---|
| Master Bedroom | x 0–4.0, z 0–3.8 | Window on north wall. Door on east wall (x=4.0) at z≈3.2, opening into hall |
| Bathroom | x 4.0–6.2, z 0–2.6 | Door on south wall (z=2.6) at x≈5.1, 0.8 m wide. Small high window on north wall |
| Hall | x 4.0–6.2, z 2.6–3.8 | No wall on its south side — open to living area |
| Bedroom 2 | x 6.2–10, z 0–3.8 | Window on north wall. Door on west wall (x=6.2) at z≈3.2 |
| Open Living / Dining / Kitchen | x 0–10, z 3.8–7.5 | Large window on south wall (living part), window on east wall (kitchen). Entry door on south wall at x≈8.5 |

- Doors: 0.9 m × 2.1 m (bathroom 0.8 m). Doors are **openings with a static door leaf left open** (no open/close interaction needed).
- Windows: sill 0.9 m, height 1.4 m; glass is a semi-transparent plane.
- **Store the plan as data** in `src/data/floorplan.js` (walls as line segments with thickness, openings as `{wallId, offset, width, height, sill}`, rooms as polygons with names). Walls are built from this data by extruding/subtracting openings — so the plan can be edited later without touching rendering code.
- Each room has its own floor mesh and its own wall faces so materials can be changed **per room**.

### Fixed fixtures (built-in, NOT movable, but collidable)
- **Kitchen** (x 7–10, z 3.8–7.5): L-shaped base cabinets with countertop along the east wall + part of the north wall, sink, cooktop, upper cabinets, fridge.
- **Bathroom**: toilet, vanity with sink + mirror, bathtub along the north wall.

Fixed fixtures act as valid surfaces for small items (e.g. a vase can go on the kitchen counter).

---

## 4. Visual Style

**Clean Scandinavian (Nordic)**: light oak floors, white/off-white walls, soft neutral furniture (beige, light grey, muted sage, warm wood), soft shadows.

- `MeshStandardMaterial` everywhere; `renderer.shadowMap` with `PCFSoftShadowMap`; sRGB output; ACES tone mapping.
- Lighting: hemisphere light + directional "sun" through the windows + a few ceiling point lights.
- Furniture is assembled from boxes, cylinders, spheres etc. but should be **recognizable and reasonably proportioned** (e.g. a bed has frame, mattress, pillows, headboard; a vase is a lathe/cylinder with a few green "stems").
- Exterior: light grey ground plane and a sky-colored background.

---

## 5. Controls (First-Person)

| Input | Action |
|---|---|
| Click canvas | Enter pointer lock (start walking) |
| Mouse | Look around |
| W A S D | Walk; **Shift** to walk faster |
| Esc | Release pointer lock (shows menu / UI) |
| Left click (looking at movable item) | **Pick up** item |
| Left click (while holding) | **Place** item (only if placement is valid) |
| Q / E | Rotate held item −15° / +15° |
| R or Right click (while holding) | Cancel → item returns to where it was picked up |
| Delete / X (looking at or holding item) | Delete item |
| B | Open furniture library |
| M | Open materials panel |
| N | Toggle day / night |
| Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) | Undo / Redo |

- Player: eye height 1.6 m, capsule radius ~0.25 m. **Player collides with walls, fixtures and furniture** (cannot walk through them); can pass through door openings. Start position: just inside the entry door, facing into the living room.
- A small **crosshair** in screen center. When the crosshair is on a movable item within ~3 m, **highlight it** (outline or emissive tint) and show a tooltip like `Click to pick up · Sofa`.
- When panels (library/materials) open, exit pointer lock; when closed, re-lock on next click.

---

## 6. Furniture Interaction (core feature)

### 6.1 Pick up & move
- Picking up turns the item into a semi-transparent **ghost preview** that follows the crosshair: raycast from camera center against floors / support surfaces / walls; ghost sits at the hit point (max reach ~4 m).
- Ghost is **green when placement is valid, red when invalid**. Clicking on red does nothing.

### 6.2 Placement rules
Each furniture definition has a `placement` type:

| Type | Rule | Examples |
|---|---|---|
| `floor` | Sits on the floor (y = 0). | bed, sofa, wardrobe, table, rug |
| `surface` | Small item. Sits on the **top surface** of any item/fixture flagged `isSurface: true` if the crosshair is on it; otherwise on the floor. Must fit within the surface footprint. | vase, table lamp, small plant |
| `wall` | Snaps flat against the wall face the crosshair hits; rotation auto-aligns to the wall normal; height follows the crosshair (clamped 0.8–2.2 m). Q/E disabled. | wall art |

**Surfaces** (`isSurface: true`): coffee table, dining table, nightstand, desk, TV stand, kitchen counter, bathroom vanity. Items stacked on a surface are **children of that surface**: moving the table moves the vase with it; deleting the table deletes items on it (single undo step).

**Collision / validity** (use oriented bounding boxes in XZ + height range; keep it simple and robust):
- Item must not intersect walls or fixed fixtures.
- Item must not overlap other furniture, **except**: rugs (`layer: "rug"`) can be under anything, and `surface` items on top of their parent.
- Item must stay inside the apartment interior (not outside, not inside a wall).
- Item must not overlap the player capsule.

**Grid snapping** (always on, toggle with **G**): position snaps to **0.1 m**, rotation to **15°**. Show a subtle grid on the floor under the ghost while holding.

### 6.3 Add & delete
- Furniture library panel (key **B**): grid of items grouped by category, each with a name and a small auto-generated thumbnail (render the item once to an offscreen canvas) or an icon. Clicking an item closes the panel and puts a new instance **directly into the "holding" state** in front of the player.
- Delete removes the item (and its children); undoable.

---

## 7. Furniture Library (all built from primitives)

Each item = one entry in `src/data/catalog.js` with: `id`, `name`, `category`, `size {w,d,h}` (meters), `placement`, `isSurface`, `surfaceHeight`, `defaultColor`, `build()` factory returning a `THREE.Group`.

**Bedroom**
- Double Bed (1.6 × 2.0 × 1.0 headboard)
- Single Bed (0.9 × 2.0)
- Wardrobe (1.2 × 0.6 × 2.0)
- Nightstand (0.45 × 0.4 × 0.5) — surface
- Desk (1.2 × 0.6 × 0.75) — surface
- Desk Chair

**Living / Dining**
- 3-Seat Sofa (2.1 × 0.9 × 0.85)
- Armchair
- Coffee Table (1.1 × 0.6 × 0.42) — surface
- TV Stand (1.6 × 0.4 × 0.5) — surface, with a TV on top (TV is part of the item)
- Dining Table (1.4 × 0.8 × 0.75) — surface
- Dining Chair
- Bookshelf (0.8 × 0.3 × 1.8)

**Decor**
- Vase with flowers (`surface`)
- Potted Plant — small (`surface`) and large floor plant (`floor`)
- Table Lamp (`surface`) — emits light at night
- Floor Lamp (`floor`) — emits light at night
- Rug — rectangular 2.0 × 1.4 and round Ø1.6 (`floor`, `layer: "rug"`, ~1 cm high)
- Wall Art — 2 sizes (`wall`), canvas with a simple abstract procedural pattern

### Default layout
Pre-furnish the apartment sensibly on first load (double bed + 2 nightstands + wardrobe in master; single bed + desk + chair in bedroom 2; sofa, coffee table, rug, TV stand in living; dining table + 4 chairs in dining; a vase on the dining table; one wall art in living). Store this in `src/data/defaultLayout.js`. Provide a **"Reset to default"** button.

---

## 8. Materials Panel (key M)

- Select a **room** (dropdown or "use the room I'm standing in").
- Floor: Light Oak, Walnut, Grey Tile, White Marble, Concrete — procedurally generated textures via `CanvasTexture` (wood planks, tile grid, etc.), no image files.
- Walls: color swatches (Warm White, Soft Grey, Sage, Dusty Pink, Pale Blue, Sand) + a custom color picker.
- Optionally: change the color of the currently held/targeted furniture item (swatches).
- Material changes are part of saved layout and undo history.

---

## 9. Extra Features

### 9.1 Day / Night (key N, plus a UI toggle)
- **Day**: bright sky background, strong sun through windows, ceiling lights off.
- **Night**: dark blue sky, sun off, dim ambient, ceiling lights on (warm), and every **Table Lamp / Floor Lamp emits a warm `PointLight`**. Limit active shadow-casting lights for performance (e.g. lamps don't cast shadows).
- Smooth transition (~1 s) is nice-to-have.

### 9.2 Minimap
- Bottom-right corner, ~200 px, top-down 2D view drawn on a `<canvas>` (2D context — cheaper than a second WebGL render).
- Shows walls, room names, furniture footprints (simple rectangles/circles), and the **player as an arrow** showing facing direction. Updates every frame.

### 9.3 Undo / Redo
- **Command pattern**: every change (add, delete, move/rotate, material change, reset) is a command with `do()` / `undo()`. Undo stack ≥ 50 steps. Picking up and then cancelling creates no history entry.

### 9.4 Save / Load
- **Auto-save** to `localStorage` after every committed change; restore on page load.
- Buttons: **Export JSON** (download file), **Import JSON** (file picker), **Reset to default**.
- Layout JSON format (versioned):
```json
{
  "version": 1,
  "items": [
    { "uid": "a1", "catalogId": "vase", "position": [3.2, 0.75, 5.1], "rotationY": 0,
      "color": "#d9cbb5", "parentUid": "t1" }
  ],
  "materials": { "masterBedroom": { "floor": "lightOak", "wall": "#f5f2ec" } },
  "timeOfDay": "day"
}
```

---

## 10. UI Overlay

- Start screen: title "Virtual Apartment", short controls cheat-sheet, "Click to start".
- Persistent HUD: crosshair, minimap, small hint bar at bottom showing context controls (e.g. while holding: `Click place · Q/E rotate · R cancel · X delete`).
- Top-right compact toolbar (visible when pointer is unlocked): Library, Materials, Day/Night, Undo, Redo, Export, Import, Reset, Help.
- Clean Nordic UI style: white semi-transparent panels, rounded corners, a neutral sans-serif font, subtle shadows.

---

## 11. Suggested Project Structure

```
/
├─ index.html
├─ package.json
├─ README.md
└─ src/
   ├─ main.js                 # bootstraps everything, render loop
   ├─ core/
   │  ├─ scene.js             # renderer, scene, camera, resize
   │  ├─ lighting.js          # sun, ambient, ceiling lights, day/night
   │  └─ player.js            # pointer lock, WASD, collision
   ├─ house/
   │  ├─ buildHouse.js        # walls/floors/ceilings/openings from floorplan data
   │  ├─ fixtures.js          # kitchen & bathroom fixed fixtures
   │  └─ materials.js         # procedural textures & material presets
   ├─ furniture/
   │  ├─ FurnitureManager.js  # create/delete items, parent/child stacking
   │  ├─ interaction.js       # raycast, highlight, pick/hold/place state machine
   │  ├─ placement.js         # validity checks, snapping, surface/wall logic
   │  └─ builders/            # one file per category: bedroom.js, living.js, decor.js
   ├─ data/
   │  ├─ floorplan.js
   │  ├─ catalog.js
   │  └─ defaultLayout.js
   ├─ state/
   │  ├─ history.js           # undo/redo command stack
   │  └─ storage.js           # localStorage + JSON import/export
   └─ ui/
      ├─ hud.js, minimap.js, libraryPanel.js, materialsPanel.js, toolbar.js
      └─ styles.css
```

Keep modules small and focused. Separate **data** (floor plan, catalog, layout) from **rendering/logic** so items and the plan can be extended later — and so primitive-built furniture could later be swapped for GLB models by changing only the `build()` factory.

---

## 12. Milestones (build in this order; make each runnable before moving on)

1. **Scaffold**: Vite + Three.js, empty scene, renderer, resize handling.
2. **House**: walls with door/window openings, floors, ceilings, lighting & shadows from `floorplan.js`.
3. **Player**: pointer-lock first-person movement with wall collision; start screen.
4. **Fixtures**: kitchen & bathroom fixed fixtures.
5. **Furniture**: catalog + builders for all items; default layout loaded.
6. **Interaction**: crosshair highlight, pick up / ghost / place / rotate / cancel / delete.
7. **Placement rules**: collisions, grid snap, surface stacking (parent/child), wall art snapping.
8. **Library panel**: add new items.
9. **Undo/redo + save/load + export/import + reset.**
10. **Materials panel.**
11. **Day/night + lamp lights.**
12. **Minimap**, HUD hints, polish, README.

---

## 13. Acceptance Criteria

- `npm install && npm run dev` works with no errors in the console.
- I can walk through every room via the doors, and cannot walk through walls or furniture.
- I can look at the sofa, click to pick it up, rotate it with Q/E, see red when it overlaps a wall or another item, and place it somewhere valid.
- I can open the library, add a **vase**, and place it **on the dining table**; moving the table carries the vase with it.
- I can hang wall art on any wall; it stays flat against the wall.
- I can change the master bedroom floor to walnut and walls to sage.
- Ctrl+Z / Ctrl+Y correctly undo/redo all of the above.
- Refreshing the page keeps my layout; Export → Reset → Import restores it.
- Night mode turns on ceiling lights and lamp lights.
- The minimap shows the plan, furniture, and my position/direction.
- Runs smoothly (~60 fps) on a normal laptop in Chrome.

## 14. Out of Scope (for now)

VR headset support, mobile/touch controls, opening/closing doors, uploading a 2D plan image to auto-generate 3D, external GLB models, multiplayer, wall editing.
