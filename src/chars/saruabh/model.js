// Voxel Saruabh on the shared rig: a girl in a white sailor-style dress — navy square collar with a white stripe, a red
// neckerchief, a pleated skirt with a navy hem, white knee socks, navy shoes — chestnut twin tails under a small sailor
// hat. Weapons (dual-wield rig): right = her phone on a selfie stick (weapon joint, 0.75 m), left = her laptop (weaponL),
// swung closed like a paddle; on the moves in OPEN (and the Overclock storm) it is shown open, screen blazing
// (render-only swap). Secondary (render-only): the twin tails, and the open / closed swap.
import * as THREE from 'three';
import { vox, HV } from '../../hero/model.js';
import { shade } from '../../core/voxel.js';
import { outfit } from '../shared/outfit.js';
import { B, Pt, both, hex, fighterMaterial, buildBody } from '../shared/body.js';
import { createChains } from '../shared/chains.js';

export const NC = {
  dress: hex('#f4f4f0'), dressD: hex('#d8dce4'), navy: hex('#1f3a6e'), red: hex('#d0402a'), skin: hex('#f6d2b4'), hair: hex('#6a3a24'), hairH: hex('#8a5232'),
  sock: hex('#ffffff'), shoe: hex('#1a2a4e'), eye: 0x1a1214, iris: hex('#2a9a8a'), lip: 0xd07a78, blush: hex('#f2a8a0'),
  grip: hex('#ff7eb6'), steel: hex('#c9ced6'), dark: hex('#1a1c22'), screen: hex('#7ff0ff'),
};

export function head() {
  const hair = (x, y, z) => ((x * 3 + z + 40) % 5 === 0 ? NC.hairH : NC.hair);
  return [
    B([-3, 1, -3], [4, 10, 3], NC.skin),                              // skull
    B([-3, 0, 2], [4, 8, 4], NC.skin),                                // face
    ...both(Pt([-3, 4, 3], [-1, 7, 4], NC.eye)), ...both(Pt([-2, 4, 3], [-1, 6, 4], NC.iris)), ...both(Pt([-3, 6, 3], [-2, 7, 4], 0xffffff)),   // big eyes
    ...both(Pt([-3, 7, 3], [-1, 8, 4], NC.hair)),                     // brows
    ...both(Pt([-3, 3, 3], [-2, 4, 4], NC.blush)),                    // blush
    Pt([0, 2, 3], [1, 3, 4], NC.lip),                                 // mouth
    B([-4, 4, -4], [5, 12, 1], hair),                                 // hair: back, sides, crown
    B([-4, 10, -4], [5, 12, 4], hair),                                // top
    B([-4, 8, 3], [5, 11, 5], (x, y, z) => (y === 8 && (x + 8) % 2 === 0 ? null : hair(x, y, z))),   // fringe
    ...both(B([-4, 1, 0], [-3, 9, 3], hair)),                         // side locks to the jaw
    ...both(B([-6, 8, -3], [-4, 11, 0], NC.red)),                     // ribbons at the roots of the tails
    // sailor hat: a white crown with a navy band, sat back on the head
    B([-4, 12, -5], [5, 13, 4], NC.navy), B([-3, 13, -4], [4, 15, 3], NC.dress), B([-4, 15, -5], [5, 16, 4], NC.dress),
  ];
}

// ---------------------------------------------------------------- weapons (weapon space: +Z along the shaft from the grip)
const U = 0.015;                                                     // weapon voxel (m)
function stickGeo() {
  return vox([
    B([-1, -1, -8], [1, 1, 8], NC.grip), B([-1, -2, -10], [1, 1, -8], shade(NC.grip, 0.8)),          // grip + cap
    B([-1, -1, 8], [1, 1, 46], (x, y, z) => (z % 12 === 0 ? shade(NC.steel, 0.7) : NC.steel)),       // telescopic shaft
    B([-2, -5, 45], [2, 5, 48], NC.dark),                                                           // clamp
    B([-7, -4, 48], [7, 4, 50], NC.dark),                                                           // the phone, landscape
    Pt([-6, -3, 48], [6, 3, 49], NC.screen),                                                        // screen (faces her)
    Pt([4, 1, 49], [6, 3, 50], 0x4a5664), Pt([3, 2, 49], [4, 3, 50], 0xffffff),                      // lens + flash (face the enemy)
  ], U, { jitter: 0.03, ao: 0.2 });
}
const laptopClosed = () => vox([
  B([-8, -1, 1], [8, 1, 24], (x, y, z) => (z === 1 ? shade(NC.steel, 0.6) : x === -8 || x === 7 || z === 23 ? shade(NC.steel, 0.85) : NC.steel)),
  Pt([-3, 0, 10], [3, 1, 14], NC.screen),                             // a lit panel on the lid (no logo)
], U, { jitter: 0.03, ao: 0.2 });
const laptopOpen = () => vox([
  B([-8, -1, 1], [8, 0, 24], NC.steel), Pt([-6, -1, 4], [6, 0, 18], NC.dark),          // base + keys
  B([-9, -1, 1], [-8, 15, 24], shade(NC.steel, 0.9)),                                  // lid, up on its hinge
], U, { jitter: 0.03, ao: 0.2 });
export const PHONE = { tip: 0.78 };
/** Moves that show the laptop open (render-only), and the Overclock's open frames. */
export const OPEN = { n3: [6, 30], c1: [6, 50], c4: [6, 50], c6: [6, 76], jc: [30, 50] };
export const MUSOU_OPEN = [112, 174];

export function createAnaModel(rig) {
  const mat = fighterMaterial({ roughness: 0.6 });
  const parts = outfit({ top: NC.dress, topD: NC.dressD, short: true, cuff: NC.navy, skin: NC.skin, trou: NC.skin, shoe: NC.shoe, sole: 0x0e1628, laces: NC.dress,
    sock: NC.sock, sockD: NC.navy, slim: 0.9, skirt: { c: NC.dress, trim: NC.navy, len: 11 }, collar: { c: NC.navy, stripe: 0xffffff, tie: NC.red } });
  const { meshes, add } = buildBody(rig, mat, parts, head());
  const wm = fighterMaterial({ roughness: 0.45, metalness: 0.2 }, 0.3, 0.8);
  add(rig.joints.weapon, stickGeo(), 'stick', wm);
  const closed = add(rig.joints.weaponL, laptopClosed(), 'laptop', wm), open = add(rig.joints.weaponL, laptopOpen(), 'laptopOpen', wm);
  // the blazing screen: an unlit bright panel on the inside of the lid
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.2, 0.31), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 3.0, 3.4) }));
  screen.position.set(-8 * U + 0.006, 0.115, 12.5 * U); open.add(screen);
  open.visible = false;
  rig.laptop = { closed, open };
  return { meshes, material: mat };
}

// ---------------------------------------------------------------- secondary: twin tails, the laptop swap
const tailSeg = (i) => { const w = i < 2 ? 2 : 1; return vox([B([-w, -6, -w], [w, 0, w], (x, y, z) => ((x + z + y + 40) % 4 === 0 ? NC.hairH : NC.hair))], 0.018, { jitter: 0.04, ao: 0.2 }); };

/** Is the laptop open this render frame? (hero: the sim hero the battle view passes; the Overclock window from musouT) */
function isOpen(h) {
  if (!h) return false;
  if (h.state === 'musou') { const t = (h.musouT || 0) * 200; return t >= MUSOU_OPEN[0] && t < MUSOU_OPEN[1]; }
  const w = h.state === 'attack' && OPEN[h.move];
  return !!w && h.moveT >= w[0] && h.moveT < w[1];
}

export function createAnaSecondary(scene, rig, mat, hero) {
  const chains = createChains(scene, rig, mat), j = rig.joints;
  for (const sx of [-1, 1]) chains.add(j.head, { anchor: [sx * 5 * HV, 9 * HV, -2 * HV], rest: [sx * 0.35, -1, -0.25], n: 6, len: 0.085, stiff: 0.04, drag: 0.07,
    wind: 1.6, cone: 110, sway: 0.5, seg: tailSeg, hit: ['head', ['chest', 0.03]] });
  return {
    reset() { chains.reset(); },
    update(dt) {
      chains.update(dt);
      const L = rig.laptop, o = isOpen(hero);
      if (L && L.open.visible !== o) { L.open.visible = o; L.closed.visible = !o; }
    },
  };
}
