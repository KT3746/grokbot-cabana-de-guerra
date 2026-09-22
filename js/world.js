import { TILE, SCALE, hash2, irand, rand } from "./data.js?v=1.4.0";

export const T = {
  GRASS: 0,
  DIRT: 1,
  SOIL: 2,
  WATER: 3,
  FLOOR: 4,
  WALL: 5,
  DOOR: 6,
};

export function createWorld() {
  const cols = 44;
  const rows = 34;
  const tiles = new Uint8Array(cols * rows);
  const at = (x, y) => tiles[y * cols + x];
  const set = (x, y, v) => {
    if (x >= 0 && y >= 0 && x < cols && y < rows) tiles[y * cols + x] = v;
  };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const edge = x < 2 || y < 2 || x > cols - 3 || y > rows - 3;
      set(x, y, edge && hash2(x, y) > 0.35 ? T.WATER : T.GRASS);
    }
  }

  // Lago no canto
  for (let y = 3; y < 10; y++) {
    for (let x = cols - 12; x < cols - 3; x++) {
      const dx = x - (cols - 7.5);
      const dy = y - 6.2;
      if (dx * dx + dy * dy * 1.4 < 16) set(x, y, T.WATER);
    }
  }

  const cx = 21;
  const cy = 15;
  for (let y = cy; y < cy + 5; y++) {
    for (let x = cx; x < cx + 5; x++) {
      const wall = x === cx || x === cx + 4 || y === cy || y === cy + 4;
      set(x, y, wall ? T.WALL : T.FLOOR);
    }
  }
  set(cx + 2, cy + 4, T.DOOR);

  // Caminho de terra
  for (let y = cy + 5; y < cy + 11; y++) set(cx + 2, y, T.DIRT);
  for (let x = cx - 1; x < cx + 6; x++) set(x, cy + 10, T.DIRT);

  // Hortas
  const plots = [];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 4; j++) {
      const tx = cx - 6 + j;
      const ty = cy + 1 + i;
      set(tx, ty, T.SOIL);
      plots.push({ tx, ty, state: "empty", grow: 0 });
    }
  }

  const trees = [];
  const rocks = [];
  const veins = [];
  const used = new Set();
  const mark = (x, y) => used.add(`${x},${y}`);
  const free = (x, y) => {
    if (x < 3 || y < 3 || x > cols - 4 || y > rows - 4) return false;
    if (used.has(`${x},${y}`)) return false;
    const t = at(x, y);
    if (t !== T.GRASS && t !== T.DIRT) return false;
    const dx = x - (cx + 2);
    const dy = y - (cy + 2);
    if (dx * dx + dy * dy < 36) return false;
    return true;
  };

  const scatter = (n, put) => {
    let tries = 0;
    while (n > 0 && tries < 800) {
      tries++;
      const x = irand(3, cols - 4);
      const y = irand(3, rows - 4);
      if (!free(x, y)) continue;
      mark(x, y);
      put(x, y);
      n--;
    }
  };

  scatter(16, (x, y) => {
    trees.push({
      x: (x + 0.5) * TILE,
      y: (y + 0.5) * TILE,
      tx: x,
      ty: y,
      hp: 8,
      max: 8,
      stump: false,
    });
  });
  scatter(10, (x, y) => {
    rocks.push({
      x: (x + 0.5) * TILE,
      y: (y + 0.5) * TILE,
      tx: x,
      ty: y,
      hp: 6,
      max: 6,
      gone: false,
    });
  });
  scatter(4, (x, y) => {
    veins.push({
      x: (x + 0.5) * TILE,
      y: (y + 0.5) * TILE,
      tx: x,
      ty: y,
      hp: 10,
      max: 10,
      gone: false,
    });
  });

  const doorX = (cx + 2.5) * TILE;
  const doorY = (cy + 4.5) * TILE;

  return {
    cols,
    rows,
    w: cols * TILE,
    h: rows * TILE,
    tiles,
    plots,
    trees,
    rocks,
    veins,
    fences: [],
    torches: [],
    traps: [],
    cabin: {
      tx: cx,
      ty: cy,
      x: (cx + 2.5) * TILE,
      y: (cy + 2.5) * TILE,
      doorX,
      doorY,
      hp: 340,
      maxHp: 340,
    },
    at(x, y) {
      if (x < 0 || y < 0 || x >= cols || y >= rows) return T.WATER;
      return tiles[y * cols + x];
    },
    set,
  };
}

export function tileAtWorld(world, px, py) {
  return world.at(Math.floor(px / TILE), Math.floor(py / TILE));
}

export function isWaterOrWall(world, px, py) {
  const t = tileAtWorld(world, px, py);
  return t === T.WATER || t === T.WALL;
}

export function circleHitsSolid(world, x, y, r, opts = {}) {
  const zombies = opts.forZombie;
  const minx = Math.floor((x - r) / TILE);
  const maxx = Math.floor((x + r) / TILE);
  const miny = Math.floor((y - r) / TILE);
  const maxy = Math.floor((y + r) / TILE);
  for (let ty = miny; ty <= maxy; ty++) {
    for (let tx = minx; tx <= maxx; tx++) {
      const t = world.at(tx, ty);
      let solid = t === T.WATER || t === T.WALL;
      if (zombies && t === T.DOOR) solid = true;
      if (!solid) continue;
      if (circleRect(x, y, r, tx * TILE, ty * TILE, TILE, TILE)) return true;
    }
  }
  for (const tr of world.trees) {
    if (tr.stump) continue;
    if (Math.hypot(x - tr.x, y - tr.y) < r + 12 * SCALE) return true;
  }
  for (const rk of world.rocks) {
    if (rk.gone) continue;
    if (Math.hypot(x - rk.x, y - rk.y) < r + 10 * SCALE) return true;
  }
  for (const v of world.veins) {
    if (v.gone) continue;
    if (Math.hypot(x - v.x, y - v.y) < r + 10 * SCALE) return true;
  }
  for (const f of world.fences) {
    if (f.hp <= 0) continue;
    if (circleRect(x, y, r, f.x - 14 * SCALE, f.y - 14 * SCALE, 28 * SCALE, 28 * SCALE)) return true;
  }
  return false;
}

export function circleRect(cx, cy, cr, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < cr * cr;
}

export function moveWithCollide(world, e, dx, dy, r, forZombie = false) {
  const opts = { forZombie };
  e.x += dx;
  if (circleHitsSolid(world, e.x, e.y, r, opts)) e.x -= dx;
  e.y += dy;
  if (circleHitsSolid(world, e.x, e.y, r, opts)) e.y -= dy;
  e.x = Math.max(r + 4, Math.min(world.w - r - 4, e.x));
  e.y = Math.max(r + 4, Math.min(world.h - r - 4, e.y));
}

export function nearestNode(list, x, y, pred, maxDist) {
  let best = null;
  let bd = maxDist;
  for (const it of list) {
    if (pred && !pred(it)) continue;
    const d = Math.hypot(it.x - x, it.y - y);
    if (d < bd) {
      bd = d;
      best = it;
    }
  }
  return best;
}

export function respawnMorning(world) {
  for (const t of world.trees) {
    if (t.stump && Math.random() < 0.75) {
      t.stump = false;
      t.hp = t.max;
    }
  }
  for (const r of world.rocks) {
    if (r.gone && Math.random() < 0.45) {
      r.gone = false;
      r.hp = r.max;
    }
  }
  for (const v of world.veins) {
    if (v.gone && Math.random() < 0.3) {
      v.gone = false;
      v.hp = v.max;
    }
  }
  for (const p of world.plots) {
    if (p.state === "growing") {
      p.state = "ready";
      p.grow = 1;
    }
  }
}

export function randomEdgeSpawn(world, opts = {}) {
  const m = TILE * 2.5;
  for (let i = 0; i < 60; i++) {
    const side = irand(0, 3);
    let x, y;
    if (side === 0) { x = rand(m, world.w - m); y = m; }
    else if (side === 1) { x = rand(m, world.w - m); y = world.h - m; }
    else if (side === 2) { x = m; y = rand(m, world.h - m); }
    else { x = world.w - m; y = rand(m, world.h - m); }
    const t = tileAtWorld(world, x, y);
    if (t === T.WATER || t === T.WALL || t === T.FLOOR) continue;
    if (circleHitsSolid(world, x, y, 12 * SCALE, { forZombie: true })) continue;
    if (opts.avoidX != null && Math.hypot(x - opts.avoidX, y - (opts.avoidY || 0)) < (opts.avoidR || 0)) continue;
    return { x, y };
  }
  return { x: world.w * 0.15, y: world.h * 0.15 };
}