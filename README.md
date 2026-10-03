# Virtual Apartment

A browser-based 3D model of a 2-bedroom, 1-bathroom apartment (~75 m²) that you explore in first person. You can walk around and rearrange the interior: pick up and move furniture, add items from a library, change floors and wall colors, and save your layout.

Everything (the house and all furniture) is generated in code from simple shapes. There are no 3D model files.

Built with [Vite](https://vitejs.dev/) and [Three.js](https://threejs.org/), in plain JavaScript.

## Run it locally

You need [Node.js](https://nodejs.org/) 18 or newer.

```bash
npm install
npm run dev
```

Open the `http://localhost:5173` URL that it prints, then click **Click to start**.

Other commands:

| Command | What it does |
|---|---|
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |

## Controls

| Input | Action |
|---|---|
| Click | Start walking (locks the mouse) |
| Mouse | Look around |
| W A S D | Walk (hold **Shift** to go faster) |
| Left click on an item | Pick it up |
| Left click while holding | Place it (only when the ghost is green) |
| Q / E | Rotate the held item −15° / +15° |
| R or right click | Cancel (the item goes back to where it was) |
| X or Delete | Delete the item you're looking at or holding |
| G | Toggle grid snapping (0.1 m / 15°) |
| B | Furniture library |
| M | Materials (per-room floor and walls, furniture color) |
| N | Day / night |
| P | Photo mode: hides all UI; click saves a PNG, Esc exits |
| Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) | Undo / redo |
| Esc | Release the mouse and show the toolbar |

Small items (vase, small plant, table lamp) can be placed on tables, nightstands, the desk, the TV stand, the kitchen counter and the bathroom vanity. They move with whatever they stand on. Wall art snaps flat onto walls.

Your layout auto-saves in the browser (`localStorage`). Use **Export** and **Import** in the toolbar to save it to or load it from a JSON file. **Reset** restores the default layout, and you can undo a reset.

## Project structure

```
index.html              page shell (HUD + panel containers)
src/
  main.js               wires everything together; render loop; keyboard & mouse
  core/
    scene.js            renderer, scene, camera, resize
    lighting.js         sun, hemisphere, ceiling lights, day/night blend, lamp lights
    player.js           pointer lock, WASD movement, collision
    collision.js        oriented-box helpers shared by player & placement
  house/
    buildHouse.js       walls / windows / doors / floors / ceiling from floorplan data
    fixtures.js         kitchen & bathroom fixtures (fixed, collidable)
    materials.js        procedural textures (canvas) + per-room materials
  furniture/
    FurnitureManager.js create / delete / move items; stacking (parent/child)
    interaction.js      hover, pick up, ghost, place, rotate, cancel, delete
    placement.js        where the held item goes + validity rules + snapping
    builders/           one file per category; each item built from primitives
  data/
    floorplan.js        walls, openings, rooms (edit the plan here)
    catalog.js          furniture definitions (size, placement type, builder)
    defaultLayout.js    furniture layout on first visit / reset
  state/
    history.js          undo/redo (command pattern) + commands
    storage.js          localStorage, JSON export / import
  ui/                   HUD, toolbar, library, materials panel, minimap, CSS
```

### Common changes

- **Change the floor plan:** edit `src/data/floorplan.js`. Walls are line segments, openings reference a wall by id, and rooms are polygons. You don't need to touch any rendering code.
- **Add a furniture item:** write a `build(color)` function in `src/furniture/builders/` that returns a `THREE.Group` (origin at the bottom center, front facing +Z). Then add an entry to `src/data/catalog.js`.
- **Use a GLB model instead:** only that item's `build()` function needs to change.
- **Change the default furniture:** edit `src/data/defaultLayout.js`. Positions are in meters and `rotationY` is in degrees.

## Layout JSON format

```json
{
  "version": 1,
  "items": [
    { "uid": "vase1", "catalogId": "vase", "position": [5.5, 0.75, 5.6], "rotationY": 0,
      "color": "#d9cbb5", "parentUid": "dt1" }
  ],
  "materials": { "masterBedroom": { "floor": "walnut", "wall": "#b7c4b0" } },
  "timeOfDay": "day"
}
```

`position` is in world coordinates (meters; origin at the north-west corner, +X east, +Z south, y = bottom of the item). `rotationY` is in degrees.

## Deployment (Vercel)

This is a static Vite site. Import the GitHub repository in Vercel. Vercel detects Vite automatically:

- Build command: `npm run build`
- Output directory: `dist`

You don't need any environment variables.
