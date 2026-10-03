/**
 * Compact toolbar in the top-right corner (visible while the pointer is unlocked).
 * @param {Record<string, () => void>} actions
 */
export function createToolbar(actions) {
  const el = document.getElementById('toolbar');
  const buttons = [
    { id: 'library', label: 'Library', key: 'B' },
    { id: 'materials', label: 'Materials', key: 'M' },
    { id: 'daynight', label: 'Night', key: 'N' },
    'sep',
    { id: 'undo', label: 'Undo', key: 'Ctrl+Z' },
    { id: 'redo', label: 'Redo', key: 'Ctrl+Y' },
    'sep',
    { id: 'export', label: 'Export', key: 'JSON' },
    { id: 'import', label: 'Import', key: 'JSON' },
    { id: 'reset', label: 'Reset', key: 'default' },
    { id: 'help', label: 'Help', key: '?' },
  ];
  /** @type {Record<string, HTMLButtonElement>} */
  const byId = {};
  for (const b of buttons) {
    if (b === 'sep') {
      const s = document.createElement('div');
      s.className = 'sep';
      el.appendChild(s);
      continue;
    }
    const btn = document.createElement('button');
    btn.innerHTML = `<span class="label">${b.label}</span><span class="key">${b.key}</span>`;
    btn.title = `${b.label} (${b.key})`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      actions[b.id]?.();
      btn.blur();
    });
    el.appendChild(btn);
    byId[b.id] = btn;
  }
  // Clicks on the toolbar must not start pointer lock.
  el.addEventListener('mousedown', (e) => e.stopPropagation());

  return {
    /** Refresh enabled states and the day/night label. */
    update({ canUndo, canRedo, isNight }) {
      byId.undo.disabled = !canUndo;
      byId.redo.disabled = !canRedo;
      byId.daynight.querySelector('.label').textContent = isNight ? 'Day' : 'Night';
    },
  };
}
