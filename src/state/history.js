/**
 * Undo / redo with the command pattern.
 * Every change is a command object with do() and undo().
 *
 * @typedef {{label?:string, do:() => void, undo:() => void}} Command
 */
export class History {
  constructor(limit = 100) {
    this.limit = limit;
    /** @type {Command[]} */
    this.undoStack = [];
    /** @type {Command[]} */
    this.redoStack = [];
    /** Called after every change (auto-save, UI refresh). */
    this.onChange = () => {};
  }

  /** Run a command and record it. */
  execute(cmd) {
    cmd.do();
    this.push(cmd);
  }

  /** Record a command whose effect has ALREADY been applied. */
  push(cmd) {
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
    this.onChange(cmd);
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (!cmd) return null;
    cmd.undo();
    this.redoStack.push(cmd);
    this.onChange(cmd);
    return cmd;
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (!cmd) return null;
    cmd.do();
    this.undoStack.push(cmd);
    this.onChange(cmd);
    return cmd;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.onChange(null);
  }
}

// ─── Commands ────────────────────────────────────────────────────────────

const DEG = Math.PI / 180;

/** Add items (records include the new item and anything on it). */
export function addCommand(manager, records) {
  return {
    label: 'Add',
    do: () => manager.createMany(records),
    undo: () => manager.remove(records[0].uid),
  };
}

/** Delete an item and everything standing on it (one undo step). */
export function deleteCommand(manager, uid) {
  let records = manager.serializeTree(uid);
  return {
    label: 'Delete',
    do: () => {
      records = manager.serializeTree(uid);
      manager.remove(uid);
    },
    undo: () => manager.createMany(records),
  };
}

/**
 * Move / rotate / re-parent an item.
 * `from` and `to` are { position:[x,y,z], rotationY (deg), parentUid }.
 */
export function moveCommand(manager, uid, from, to) {
  const apply = (t) => manager.setTransform(uid, t.position, t.rotationY * DEG, t.parentUid);
  return {
    label: 'Move',
    do: () => apply(to),
    undo: () => apply(from),
  };
}

/** Change a room's floor preset or wall color. */
export function materialCommand(roomMaterials, roomId, kind, from, to) {
  return {
    label: 'Material',
    do: () => roomMaterials.set(roomId, kind, to),
    undo: () => roomMaterials.set(roomId, kind, from),
  };
}

/** Change a furniture item's color. */
export function colorCommand(manager, uid, from, to) {
  return {
    label: 'Color',
    do: () => manager.setColor(uid, to),
    undo: () => manager.setColor(uid, from),
  };
}

/**
 * Replace the whole layout (items + materials). Used by Reset and Import.
 * @param {() => any} getState   returns the current {items, materials}
 * @param {(s:any) => void} setState
 */
export function replaceStateCommand(getState, setState, next, label = 'Reset') {
  const prev = getState();
  return {
    label,
    do: () => setState(next),
    undo: () => setState(prev),
  };
}
