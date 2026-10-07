// Battlefield contract (sim-safe: pure data + pure functions, no THREE). Hero, crowd, story, HUD and camera only go
// through these exports.
//
// Map registry (seam): every battlefield is a definition in src/world/maps/<id>/map.js registered in MAPS below;
// setMap(id) makes it the active one (stages name their map, src/story/chapters.js). The exports are live bindings onto
// the active map (ES modules: importers always read the current value). Its grids are rasterised on first use and cached
// per map.
// Map definition: { id, name, zones [{ id, name, x, z, w, d | r }], grid [x0, z0, x1, z1], pieces, carve, propCarve?,
//   cut?(x, z, {s, h}), openWater?(x, z), wet?(x, z), route, gates { id: { rect, open, name } }, spawn { story, free },
//   freeAllies, stage (zone id for the title / select fighter stage), hq [x, z], hqName, minimap?(g, X, Y, ppm) /
//   minimapAfter?(g, X, Y, ppm) (hud.js overlays), plus optional extras its own render code reads through MAP }.
//   Render builders live in the world registry (world.js), not here.
//
// Units: metres, +Z = "up the field" (camera yaw 0 looks along +Z). Sim y everywhere is HEIGHT ABOVE GROUND:
// ground(x, z) is only added by the render side (hero view, crowd view, camera focus, HUD tags, vfx), so every sim
// height test (airborne, hitbox yMax, enemy reach) keeps working on a slope.
// Walkable ground is a union of authored pieces (rects, ellipses, width-varying paths) rasterised once at load into a
// distance field (≈ metres inside the edge, negative outside); clampWalk() pushes points up its gradient, so the edge
// is the visible wall, never an invisible circle. Heights come from the piece that owns the cell, on a 2 m grid shared
// with the floor mesh (src/world/kit/terrain.js).
// The crowd's spatial grid spans ±240 m (crowd.js): every map must fit inside it.
import { noise2, smooth, rectIn } from './mapkit.js';
import ARENA from './maps/arena/map.js';

export { noise2, smooth };

/** Every battlefield by id. New maps register with one import + one entry. */
export const MAPS = { arena: ARENA };
export const DEFAULT_MAP = 'arena';

// ---- live bindings onto the active map (setMap)
export let MAP, ROUTE, GATES, PIECE_IDS, TERRAIN;
let PIECES, CARVE, PROP_CARVE, GATE_LIST, ROUTE_S, GX0, GZ0, HS, HNX, HNZ, HGT, FIELD;

/** Zone record by id (undefined if unknown). */
export const zone = (id) => MAP.zones.find((q) => q.id === id);

/** Zone containing (x, z), or null (the ramp's upper bend belongs to none). */
export function zoneAt(x, z) {
  for (const q of MAP.zones) {
    if (q.r ? (x - q.x) ** 2 + (z - q.z) ** 2 <= q.r * q.r : Math.abs(x - q.x) <= q.w / 2 && Math.abs(z - q.z) <= q.d / 2) return q;
  }
  return null;
}

/** Render side: (x, z) lies under a solid set piece's cut-out (± pad m): no rock columns / boulders grow there. */
export const onProp = (x, z, pad = 1) => PROP_CARVE.some((r) => x > r[0] - pad && x < r[2] + pad && z > r[1] - pad && z < r[3] + pad);

/** Road point nearest (x, z): d = distance (m), s = its arc length (m), p = [x, z]. Returns a shared object. */
const _rn = { d: 0, s: 0, p: [0, 0] };
export function routeNear(x, z) {
  _rn.d = 1e9;
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const [ax, az] = ROUTE[i], [bx, bz] = ROUTE[i + 1], ex = bx - ax, ez = bz - az;
    const t = Math.min(1, Math.max(0, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez))), e = Math.hypot(x - ax - ex * t, z - az - ez * t);
    if (e < _rn.d) { _rn.d = e; _rn.s = ROUTE_S[i] + t * (ROUTE_S[i + 1] - ROUTE_S[i]); _rn.p[0] = ax + ex * t; _rn.p[1] = az + ez * t; }
  }
  return _rn;
}
/** Distance (m) from (x, z) to the main road. */
export const routeDist = (x, z) => routeNear(x, z).d;
/** Arc length (m) along the road of the road point nearest (x, z). */
export const routeS = (x, z) => routeNear(x, z).s;
/** Road point at arc length s (clamped to the road's ends). Returns a shared [x, z]. */
const _rp = [0, 0];
export function routeAt(s) {
  let i = 0;
  while (i < ROUTE.length - 2 && ROUTE_S[i + 1] < s) i++;
  const t = Math.min(1, Math.max(0, (s - ROUTE_S[i]) / (ROUTE_S[i + 1] - ROUTE_S[i])));
  _rp[0] = ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * t; _rp[1] = ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * t;
  return _rp;
}

let _s = 0, _h = 0, _o = 0;                   // evalPieces out: inside value, height, owner index
const _cut = { s: 0, h: 0 };
function evalPieces(x, z) {
  _s = -1e9;
  for (let k = 0; k < PIECES.length; k++) {
    const p = PIECES[k];
    let s, h = 0;
    if (p.rect) s = rectIn(p.rect, x, z);
    else if (p.ell) { const [cx, cz, rx, rz] = p.ell; s = (1 - Math.hypot((x - cx) / rx, (z - cz) / rz)) * Math.min(rx, rz); }
    else {
      s = -1e9;
      const P = p.path;
      for (let i = 0; i < P.length - 1; i++) {
        const [ax, az, aw, ah] = P[i], [bx, bz, bw, bh] = P[i + 1];
        const ex = bx - ax, ez = bz - az, t = Math.min(1, Math.max(0, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez)));
        const v = aw + (bw - aw) * t - Math.hypot(x - ax - ex * t, z - az - ez * t);
        if (v > s) { s = v; h = ah + (bh - ah) * t; }
      }
    }
    if (p.edge) s += p.edge * (noise2(x * 0.09 + k * 31, z * 0.09, 40 + k) - 0.5) * 2;
    if (s > _s) { _s = s; _o = k; _h = p.rect || p.ell ? (typeof p.h === 'function' ? p.h(x, z) : p.h) : h; }
  }
  for (const r of CARVE) _s = Math.min(_s, -rectIn(r, x, z));
  if (MAP.cut) { _cut.s = _s; _cut.h = _h; MAP.cut(x, z, _cut); _s = _cut.s; _h = _cut.h; }   // a map's own cut through its walk field
}

// ---------------------------------------------------------------- grids (built once per map, deterministic)
// One 2 m grid: walk inside value FIELD (bilinear: the edge lands within ≈ 0.1 m), height HGT, owner piece OWN.
function buildGrids(def) {
  const [x0, z0, x1, z1] = def.grid, hs = 2, nx = (x1 - x0) / hs + 1, nz = (z1 - z0) / hs + 1;
  const hgt = new Float32Array(nx * nz), own = new Uint8Array(nx * nz), field = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { evalPieces(x0 + i * hs, z0 + j * hs); hgt[i + j * nx] = _h; own[i + j * nx] = _o; field[i + j * nx] = _s; }
  // seams where two pieces meet at slightly different heights: two passes of a masked blur (only neighbours within
  // 1.5 m of the cell join in), so path feet fan into their plateaus while retaining walls between levels stay sharp
  const tmp = new Float32Array(hgt.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const c = hgt[i + j * nx];
      let s = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const v = hgt[ii + jj * nx];
        if (Math.abs(v - c) < 1.5) { s += v; n++; }
      }
      tmp[i + j * nx] = s / n;
    }
    hgt.set(tmp);
  }
  /** Render-side read-only view of the terrain grid (terrain mesh, cliffs, minimap). in: walk inside value (m). */
  return { x0, z0, x1, z1, step: hs, nx, nz, h: hgt, own, in: field };
}
const CACHE = {};

/** Make map `id` the active battlefield (no-op if it already is). Returns its definition. Sim: battle start only. */
export function setMap(id) {
  const def = MAPS[id] || MAPS[DEFAULT_MAP];
  if (MAP === def) return def;
  MAP = def;
  PIECES = def.pieces; CARVE = def.carve || []; PROP_CARVE = def.propCarve || [];
  PIECE_IDS = PIECES.map((p) => p.id);
  ROUTE = def.route;
  ROUTE_S = ROUTE.map(() => 0);
  for (let i = 1; i < ROUTE.length; i++) ROUTE_S[i] = ROUTE_S[i - 1] + Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1]);
  GATES = def.gates; GATE_LIST = Object.values(GATES);
  TERRAIN = CACHE[def.id] || (CACHE[def.id] = buildGrids(def));
  ({ x0: GX0, z0: GZ0, step: HS, nx: HNX, nz: HNZ, h: HGT, in: FIELD } = TERRAIN);
  return def;
}
setMap(DEFAULT_MAP);

/** Index of the grid node nearest (x, z) (no bounds check). */
export const node = (x, z) => Math.round((x - GX0) / HS) + Math.round((z - GZ0) / HS) * HNX;

function bilerp(g, nx, nz, s, x, z) {
  let fx = (x - GX0) / s, fz = (z - GZ0) / s;
  fx = Math.min(nx - 1.001, Math.max(0, fx)); fz = Math.min(nz - 1.001, Math.max(0, fz));
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = i + j * nx;
  return (g[k] * (1 - u) + g[k + 1] * u) * (1 - v) + (g[k + nx] * (1 - u) + g[k + nx + 1] * u) * v;
}

/** Walk inside value (m, < 0 outside) ignoring gates — render side (minimap, dressing placement). */
export const walkIn = (x, z) => bilerp(FIELD, HNX, HNZ, HS, x, z);

/** Terrain height (m) at (x, z): render-side offset only (see header). Bilinear on the 2 m grid. */
export const ground = (x, z) => bilerp(HGT, HNX, HNZ, HS, x, z);

// ---------------------------------------------------------------- gates (sim state: set from story.reset / step)
// A closed gate is a thin rect cut out of the walkable area, wider than the corridor it spans, so anyone caught in
// it is pushed out through its nearest long face (never sideways into the corridor wall). Render: the map's world
// builder swings / collapses / burns it when a gate opens. All open by default; spawnPoint() (battle start) resets
// them, so the story closes what it needs in its reset().
/** Open / close a gate of the active map by id (the arena: 'shutterA' | 'shutterB'). Sim: story.reset / step only. */
export function setGate(id, open) { if (GATES[id]) GATES[id].open = !!open; }

function walkD(x, z) {
  let d = bilerp(FIELD, HNX, HNZ, HS, x, z);
  for (const g of GATE_LIST) if (!g.open) { const o = -rectIn(g.rect, x, z); if (o < d) d = o; }
  return d;
}

/** Keep a sim position on walkable ground, `pad` metres clear of the edge / closed gates (negative pad: allowed that
 *  far outside). Returns a shared [x, z] (copy it if you keep it). Newton steps up the distance field's gradient. */
const _out = [0, 0], E = 0.5;
export function clampWalk(x, z, pad = 0) {
  for (let k = 0; k < 8; k++) {
    const d = walkD(x, z);
    if (d >= pad) break;
    const gx = walkD(x + E, z) - walkD(x - E, z), gz = walkD(x, z + E) - walkD(x, z - E), g2 = gx * gx + gz * gz;
    if (g2 < 1e-6) { x += 0.37; continue; }                                  // flat spot (medial axis of a cut): nudge
    // step along the unit gradient by the deficit, ≤ 3 m per iteration: a Newton step (deficit / |∇d|) blew up to tens
    // of metres where the field is nearly flat (thin closed gates, river banks) and teleported soldiers across the map
    const s = Math.min(pad - d + 0.01, 3) / Math.sqrt(g2);
    x += gx * s; z += gz * s;
  }
  _out[0] = x; _out[1] = z;
  return _out;
}

/** Arrows (sim): true where a closed gate (≤ 4 m), a wall, a palisade or a cliff (≤ 6 m) stands at (x, z) at height y
 *  above ground. Open water off the walk field (the map's openWater: the Han River's pools) never blocks. */
export function blocksArrow(x, z, y) {
  if (y > 6) return false;
  if (y < 4) for (const g of GATE_LIST) if (!g.open && rectIn(g.rect, x, z) > -0.3) return true;
  return walkIn(x, z) < -0.6 && !(MAP.openWater && MAP.openWater(x, z));
}

/** Where the hero starts on the active map: { x, z, yaw, tilt } (tilt: camera pitch offset, rad). Battle start: also
 *  resets every gate to open. */
export function spawnPoint(mode) {
  for (const g of GATE_LIST) g.open = true;
  return { ...(mode === 'story' ? MAP.spawn.story : MAP.spawn.free) };
}
