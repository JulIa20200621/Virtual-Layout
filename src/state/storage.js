/**
 * Persistence: auto-save to localStorage + JSON export / import.
 *
 * Layout JSON (version 1):
 * {
 *   "version": 1,
 *   "items": [{ "uid", "catalogId", "position": [x,y,z], "rotationY": degrees, "color", "parentUid" }],
 *   "materials": { "<roomId>": { "floor": "<presetId>", "wall": "#rrggbb" } },
 *   "timeOfDay": "day" | "night"
 * }
 */

const STORAGE_KEY = 'virtual-apartment-layout';
export const LAYOUT_VERSION = 1;

/** Save the layout to localStorage (silently ignores quota / privacy-mode errors). */
export function saveLocal(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch (err) {
    console.warn('Could not save layout', err);
  }
}

/** @returns the saved layout, or null if none / invalid. */
export function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return validateLayout(data) ? data : null;
  } catch {
    return null;
  }
}

/** Basic sanity check of a layout object. */
export function validateLayout(data) {
  return (
    data &&
    typeof data === 'object' &&
    data.version === LAYOUT_VERSION &&
    Array.isArray(data.items) &&
    data.items.every((it) => it && typeof it.catalogId === 'string' && Array.isArray(it.position) && it.position.length === 3)
  );
}

/** Download the layout as a .json file. */
export function exportJSON(layout) {
  const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  a.href = url;
  a.download = `apartment-layout-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Ask the user for a .json file and parse it.
 * @returns {Promise<any>} resolves with the layout, rejects with an Error on invalid input
 */
export function importJSON() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('No file selected'));
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result));
          if (!validateLayout(data)) throw new Error('Not a valid layout file (version 1)');
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsText(file);
    });
    input.click();
  });
}
