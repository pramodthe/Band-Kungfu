// Street clothes on the shared rig (content helper for the human fighters): body boxes per joint — tee or jacket, jeans
// or a dress — on the engine's joint extents (voxels, V = 2.5 cm), so the rig and its IK fit unchanged.
// outfit(o) → parts { hips, spine, chest, neck, upperArmR/L, foreArmR/L, handR/L, thighR/L, shinR/L, footR/L }.
//   o: top (torso colour), topD (seams / folds), sleeve, short (true: short sleeves, bare forearms), skin, glove,
//      trou (trousers / leggings colour; with `skirt`: the bare-leg colour), trouD, shoe, sole, laces, sock (colour: a sock
//      up the shin), hem (top hangs below the belt, voxels), slim (X scale of torso + arms), cuff (sleeve cuff colour),
//      belt (colour), skirt { c, trim, len } (a flared skirt from the waist, len voxels), collar { c, stripe, tie }
//      (a sailor collar: square flap on the back, V front, a neckerchief)
const B = (a, b, c, paint) => ({ a, b, c, paint });
const P = (a, b, c) => ({ a, b, c, paint: true });

export function outfit(o) {
  const J = o.top, JD = o.topD ?? J, S = o.sleeve ?? J, T = o.trou, TD = o.trouD ?? T, k = o.slim ?? 1, hem = o.hem ?? 2;
  const sx = (q) => ({ ...q, a: [Math.round(q.a[0] * k), q.a[1], q.a[2]], b: [Math.round(q.b[0] * k), q.b[1], q.b[2]] });
  const fold = (y) => (y % 4 === 0 ? JD : J);                                          // soft fabric folds
  const p = {
    hips: [B([-6, -5, -4], [6, 3, 4], T), B([-7, -1 - hem, -5], [7, 3, 5], (x, y) => (y === -1 - hem ? JD : J))],
    spine: [B([-5, -3, -4], [5, 8, 4], (x, y) => fold(y + 2))],
    chest: [B([-7, -2, -5], [7, 9, 5], (x, y) => fold(y)), B([-4, 8, -4], [4, 11, 4], JD), B([-3, 8, -3], [3, 12, 3], -1)],
    neck: [B([-2, -1, -2], [2, 3, 2], o.skin)],
  };
  if (o.belt != null) p.hips.push(B([-7, 1, -5], [7, 3, 5], o.belt), B([-1, 1, 5], [1, 3, 6], 0xb8bcc2));
  if (o.skirt) {
    const K = o.skirt, n = K.len ?? 11;
    p.hips = [B([-6, -5, -4], [6, 3, 4], K.c)];
    for (let t = 0; t < 3; t++) {                                                       // three flaring tiers, pleats
      const y1 = 3 - Math.round(t * (n + 4) / 3), y0 = 3 - Math.round((t + 1) * (n + 4) / 3), w = 7 + t, d = 5 + t;
      p.hips.push(B([-w, y0, -d], [w, y1, d], (x, y) => (t === 2 && y === y0 ? K.trim ?? K.c : (x + 40) % 4 === 0 ? JD : K.c)));
    }
    p.hips.push(B([-5, y0of(n) + 1, -3], [5, 0, 3], -1));                              // hollow under the skirt (legs swing free)
  }
  if (o.collar) {
    const C = o.collar;
    p.chest.push(B([-7, 3, -6], [7, 10, -5], C.c), P([-7, 3, -6], [7, 4, -5], C.stripe ?? 0xffffff),          // back flap
      B([-8, 7, -5], [8, 10, 5], C.c),                                                                        // over the shoulders
      B([-3, 8, -3], [3, 12, 3], -1),
      B([-5, 4, 5], [-2, 9, 6], C.c), B([2, 4, 5], [5, 9, 6], C.c), B([-3, 2, 5], [-1, 5, 6], C.c), B([1, 2, 5], [3, 5, 6], C.c),   // V front
      B([-1, -1, 5], [1, 3, 7], C.tie ?? 0xd0402a), B([-2, 2, 5], [2, 4, 7], C.tie ?? 0xd0402a));                // neckerchief knot + tail
  }
  for (const s of ['R', 'L']) {
    p['upperArm' + s] = o.short
      ? [B([-2, -12, -2], [2, 1, 2], o.skin), B([-3, -6, -3], [3, 1, 3], S), P([-3, -6, -3], [3, -5, 3], o.cuff ?? JD)]
      : [B([-2, -12, -2], [2, 1, 2], (x, y) => (y % 5 === 0 ? JD : S))];
    p['foreArm' + s] = o.short ? [B([-2, -11, -2], [3, 0, 3], o.skin)] : [B([-2, -11, -2], [3, 0, 3], S), B([-2, -2, -3], [3, 0, 3], o.cuff ?? JD)];
    p['hand' + s] = [B([-2, -2, -2], [2, 2, 2], o.glove ?? o.skin)];
    p['thigh' + s] = [B([-3, -18, -3], [4, 1, 4], o.skirt ? T : (x, y) => (y % 6 === 0 ? TD : T))];
    // under a skirt the top of each thigh wears a pleated underskirt: where a stride lifts the leg through the rigid
    // skirt it reads as the cloth swinging with it, not as a bare leg through the dress
    if (o.skirt) p['thigh' + s].push(B([-4, -(o.skirt.len ?? 11) + 2, -4], [5, 1, 5], (x, y) => ((x + 40) % 3 === 0 ? JD : o.skirt.c)));
    p['shin' + s] = [B([-2, -17, -2], [3, 0, 3], T)];
    if (o.sock != null) p['shin' + s].push(B([-2, -17, -2], [3, -4, 3], o.sock), P([-2, -5, -2], [3, -4, 3], o.sockD ?? o.sock));
    else if (!o.skirt) p['shin' + s].push(B([-3, -3, -3], [4, 0, 4], TD));
    p['foot' + s] = [B([-3, -3, -2], [3, 1, 6], o.shoe), B([-3, -3, -2], [3, -2, 7], o.sole ?? o.shoe), P([-1, 0, 2], [1, 1, 5], o.laces ?? o.sole ?? o.shoe)];
  }
  for (const j of ['chest', 'spine', 'upperArmR', 'upperArmL', 'foreArmR', 'foreArmL']) p[j] = p[j].map(sx);
  return p;
}
function y0of(n) { return 3 - (n + 4); }
