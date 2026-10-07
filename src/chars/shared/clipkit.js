// Frame-keyed attack clips with baked, planted feet — the authoring method of src/hero/anims/attacks.js (read its header),
// lifted out of Zhao Yun's module so every kit can use it on its own move table. createClipKit(MOVES, ENTRY):
//   clipF(id, keys)      keys [frame, spec, ease]: body keys → the pose clip (P() over `base`); fL / fR = ground spots in
//                        move-start coords ([x, y, z, pitch°, yaw°]); ft(frame, fL, fR) = a feet-only key. The feet are
//                        baked per sim frame: a grounded foot holds its spot while the lunge carries the root and `spin`
//                        turns the body over it; an authored slide becomes a lifted step.
//   bakeFeet(id, keys, entry)   the same bake for a move that borrows another clip (moves.js `anim`) → { feet(t, out), exit }
//   ft, hit(id, k) → [first, last] active frames, endFeet(id), BUILT (clips by id; exit feet for the next move of a string)
// ENTRY: { moveId: previous move id } — a clip starts on the feet the previous move of its string left at its cancel frame.
import { P, clip, sampleClip, STANCE, CH, POSE_SIZE } from '../../hero/rig.js';
import { lungeAt } from '../../hero/moveset.js';

const D2R = Math.PI / 180;
const CONTACT = 0.12, HOLD = 0.035, STILL = 0.004, STEP_MIN = 3, STEP_MAX = 10;
const hd = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** One foot's per-frame track → planted track (upstream plantFoot, unchanged). */
function plantFoot(W, busy) {
  const n = W.length, O = W.map((r) => r.slice());
  let anc = null;
  for (let f = 0; f < n;) {
    const w = W[f];
    if (w[1] >= CONTACT) { anc = null; f++; continue; }
    if (!anc || hd(w, anc) <= HOLD || (busy(f) && f < n - STEP_MIN - 1)) {
      anc = anc || w; O[f][0] = anc[0]; O[f][1] = anc[1]; O[f][2] = anc[2]; f++; continue;
    }
    const a = f - 1;
    let g = f;
    while (g - a < STEP_MAX && g + 1 < n && W[g + 1][1] < CONTACT && hd(W[g + 1], W[g]) > STILL) g++;
    g = Math.min(n - 1, Math.max(g, a + STEP_MIN));
    const B = W[g], d = hd(B, anc), lift = Math.min(0.24, Math.max(0.07, 0.45 * d));
    for (let k = f; k <= g; k++) {
      const u = (k - a) / (g - a), s = u * u * (3 - 2 * u), h = 4 * u * (1 - u);
      O[k][0] = anc[0] + (B[0] - anc[0]) * s; O[k][2] = anc[2] + (B[2] - anc[2]) * s;
      O[k][1] = Math.max(W[k][1], anc[1] + (B[1] - anc[1]) * s + lift * h);
      O[k][3] = W[k][3] - 0.3 * h;
    }
    anc = B[1] < CONTACT ? B : null; f = g + 1;
  }
  return O;
}

export function createClipKit(MOVES, ENTRY = {}, base = STANCE) {
  const ST = base, BUILT = {};
  const endFeet = (id) => {
    const d = lungeAt(MOVES[id], MOVES[id].frames), fwd = (v) => v.map((x, i) => (i === 2 ? x + d : x));
    return { fL: fwd(ST.footL), fR: fwd(ST.footR) };
  };
  const fdeg = (v, yaw) => [v[0], v[1], v[2], v[3] || 0, v[4] == null ? yaw : v[4]];
  function bakeFeet(id, keys, entry) {
    const F = MOVES[id].frames;
    const tracks = [['fL', CH.footL, ST.footL, ST.footL[4], 0], ['fR', CH.footR, ST.footR, ST.footR[4], 1]].map(([k, ch, st, yaw, j]) => {
      const fk = keys.filter(([f, s]) => s[k] && f > 0).map(([f, s]) => [f, fdeg(s[k], yaw)]);
      if (!fk.length || fk[fk.length - 1][0] < F) fk.push([F, fdeg(endFeet(id)[k], yaw)]);
      const tk = [[0, entry ? entry[j] : st], ...fk].map(([f, v]) => [Math.min(1, f / F), P({ [k === 'fL' ? 'footL' : 'footR']: v }, ST), 'lin']);
      const tc = clip(tk, false, true), p = new Float32Array(POSE_SIZE), W = [];
      for (let f = 0; f <= F; f++) { sampleClip(tc, f / F, p); W.push(Array.from(p.subarray(ch, ch + 5))); }
      return W;
    });
    const OL = plantFoot(tracks[0], (f) => tracks[1][f][1] >= CONTACT);
    const OR = plantFoot(tracks[1], (f) => OL[f][1] >= CONTACT);
    const dip = new Float32Array(F + 1), K = [1, 0.75, 0.4, 0.15];
    for (const O of [OL, OR]) for (let f = 1; f <= F; f++) {
      if (O[f - 1][1] < CONTACT || O[f][1] >= CONTACT) continue;
      const v = Math.min(1, (O[f - 1][1] - O[f][1]) / 0.06);
      K.forEach((w, k) => { if (f + k <= F) dip[f + k] = Math.min(dip[f + k], -0.04 * v * w); });
    }
    const tab = new Float32Array((F + 1) * 10);
    [OL, OR].forEach((O, j) => O.forEach((r, f) => { r[2] -= lungeAt(MOVES[id], f); tab.set(r, f * 10 + j * 5); }));
    const feet = (t, out) => {
      const x = Math.min(F, Math.max(0, t * F)), i = Math.min(F - 1, Math.floor(x)), u = x - i;
      for (let j = 0; j < 10; j++) out[CH.footL + j] = tab[i * 10 + j] + (tab[i * 10 + 10 + j] - tab[i * 10 + j]) * u;
      out[CH.hips + 1] += dip[i] + (dip[i + 1] - dip[i]) * u;
      out[CH.plant] = 1;
    };
    const row = (f, j) => { const r = tab.subarray(f * 10 + j * 5, f * 10 + j * 5 + 5); return [r[0], r[1], r[2], r[3] / D2R, r[4] / D2R]; };
    const c = Math.min(F, MOVES[id].cancel);
    return { feet, tab, exit: [row(c, 0), row(c, 1)] };
  }
  function clipF(id, keys) {
    const F = MOVES[id].frames, prev = BUILT[ENTRY[id]];
    keys = keys.slice().sort((a, b) => a[0] - b[0]);
    const c = clip(keys.filter(([, s]) => !s.feet).map(([f, spec, e]) => [Math.min(1, f / F), P({ ...spec, plant: 1 }, ST), e]), false, true);
    Object.assign(c, bakeFeet(id, keys, prev && prev.exit));
    BUILT[id] = c;
    return c;
  }
  const ft = (f, fL, fR) => [f, { feet: 1, fL, fR }];
  const hit = (id, i = 0) => MOVES[id].hits[i].f;
  return { clipF, bakeFeet, ft, hit, endFeet, BUILT };
}
