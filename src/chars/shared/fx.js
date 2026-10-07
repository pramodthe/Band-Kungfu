// Small pooled effects for the kits' views (render-only, additive, HDR colours so they bloom): ground rings, flat cones
// (sound blasts, camera flashes), beams (lasers, signal lines), spark bursts and rising glyph tiles. Spawn calls take
// world coordinates; update(dt) ages them (dt = sim time, so they hold still in hitstop and pause).
//   const fx = createFx(scene)
//   fx.ring({ x, z, y?, r0, r1, life, color: [r, g, b], a? })        a ring growing r0 → r1 (eased out), fading
//   fx.cone({ x, z, y?, yaw, range, ang (deg), life, color, a?, grow? })   a flat sector sweeping out to `range`
//   fx.beam({ from: [x, y, z], to: [x, y, z], w, life, color, a? })  a box beam between two points, thinning as it fades
//   fx.sparks({ x, y, z, n, speed, up, life, color, size? })          points blown outwards
//   fx.tiles({ x, z, r, n, life, color, size? })                     small square tiles rising from the floor in a disc
//   fx.update(dt) · fx.dispose()
import * as THREE from 'three';
import { vrng } from '../../core/rng.js';

const mat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  side: THREE.DoubleSide, fog: false });

export function createFx(scene, { rings = 14, cones = 8, beams = 10, points = 260, tiles = 90 } = {}) {
  const root = new THREE.Group();
  scene.add(root);
  const ringGeo = new THREE.RingGeometry(0.86, 1, 64, 1), beamGeo = new THREE.BoxGeometry(1, 1, 1);
  const pool = (n, make) => [...Array(n)].map(() => { const m = make(); m.visible = false; m.frustumCulled = false; m.renderOrder = 5; root.add(m); return { m, t: 0, life: 0 }; });
  const R = pool(rings, () => { const m = new THREE.Mesh(ringGeo, mat()); m.rotation.x = -Math.PI / 2; return m; });
  const coneGeos = {};
  const coneGeo = (ang) => coneGeos[ang] || (coneGeos[ang] = new THREE.CircleGeometry(1, 28, Math.PI / 2 - ang * Math.PI / 360, ang * Math.PI / 180));
  const C = pool(cones, () => { const m = new THREE.Mesh(coneGeo(60), mat()); m.rotation.order = 'YXZ'; return m; });
  const Bm = pool(beams, () => new THREE.Mesh(beamGeo, mat()));
  const free = (P) => P.find((e) => e.t >= e.life) || P.reduce((a, b) => (a.life - a.t < b.life - b.t ? a : b));
  const start = (e, o) => { Object.assign(e, o, { t: 0 }); e.m.visible = true; e.m.material.color.setRGB(...o.color); return e; };

  // sparks / tiles: one Points cloud each
  const cloud = (n, size) => {
    const pos = new Float32Array(n * 3).fill(-999), col = new Float32Array(n * 3), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false }));
    pts.frustumCulled = false; root.add(pts);
    return { n, pos, col, geo, pts, vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n), base: new Float32Array(n * 3), g: 0, k: 0 };
  };
  const SP = cloud(points, 0.12), TL = cloud(tiles, 0.26);
  SP.g = 7; TL.g = 0;
  const emitP = (Q, x, y, z, vx, vy, vz, life, color) => {
    const i = Q.k = (Q.k + 1) % Q.n;
    Q.pos[i * 3] = x; Q.pos[i * 3 + 1] = y; Q.pos[i * 3 + 2] = z;
    Q.vel[i * 3] = vx; Q.vel[i * 3 + 1] = vy; Q.vel[i * 3 + 2] = vz;
    Q.base[i * 3] = color[0]; Q.base[i * 3 + 1] = color[1]; Q.base[i * 3 + 2] = color[2];
    Q.life[i] = Q.max[i] = life;
  };
  const stepP = (Q, dt) => {
    let live = false;
    for (let i = 0; i < Q.n; i++) {
      if (Q.life[i] <= 0) continue;
      live = true; Q.life[i] -= dt;
      const k = Math.max(0, Q.life[i] / Q.max[i]);
      Q.vel[i * 3] *= 1 - 1.6 * dt; Q.vel[i * 3 + 2] *= 1 - 1.6 * dt; Q.vel[i * 3 + 1] -= Q.g * dt;
      for (let a = 0; a < 3; a++) { Q.pos[i * 3 + a] += Q.vel[i * 3 + a] * dt; Q.col[i * 3 + a] = Q.base[i * 3 + a] * k; }
      if (Q.life[i] <= 0) Q.pos[i * 3 + 1] = -999;
    }
    Q.pts.visible = live;
    if (live) { Q.geo.attributes.position.needsUpdate = true; Q.geo.attributes.color.needsUpdate = true; }
  };
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _m = new THREE.Matrix4();

  return {
    root,
    ring: (o) => start(free(R), { y: 0.1, a: 1, ...o }),
    cone(o) {
      const e = start(free(C), { y: 0.15, a: 0.8, grow: 0.5, ...o });
      e.m.geometry = coneGeo(Math.round(o.ang));
      e.m.rotation.set(-Math.PI / 2, o.yaw, 0);
      return e;
    },
    beam: (o) => start(free(Bm), { a: 1, ...o }),
    sparks({ x, y, z, n = 20, speed = 6, up = 4, life = 0.8, color }) {
      for (let i = 0; i < n; i++) {
        const a = vrng.range(0, Math.PI * 2), s = speed * vrng.range(0.4, 1);
        emitP(SP, x, y, z, Math.sin(a) * s, up * vrng.range(0.3, 1), Math.cos(a) * s, life * vrng.range(0.6, 1), color);
      }
    },
    tiles({ x, z, r, n = 16, life = 1.2, color, y = 0.2, rise = 2.2 }) {
      for (let i = 0; i < n; i++) {
        const a = vrng.range(0, Math.PI * 2), d = r * Math.sqrt(vrng.range(0, 1));
        emitP(TL, x + Math.sin(a) * d, y + vrng.range(0, 0.6), z + Math.cos(a) * d, 0, rise * vrng.range(0.5, 1.2), 0, life * vrng.range(0.6, 1), color);
      }
    },
    update(dt) {
      for (const e of R) {
        if (!e.m.visible) continue;
        e.t += dt;
        if (e.t >= e.life) { e.m.visible = false; continue; }
        const u = e.t / e.life, k = 1 - (1 - u) ** 3;
        e.m.position.set(e.x, e.y, e.z); e.m.scale.setScalar(e.r0 + (e.r1 - e.r0) * k); e.m.material.opacity = e.a * (1 - u * u);
      }
      for (const e of C) {
        if (!e.m.visible) continue;
        e.t += dt;
        if (e.t >= e.life) { e.m.visible = false; continue; }
        const u = e.t / e.life, k = e.grow + (1 - e.grow) * (1 - (1 - u) ** 3);
        e.m.position.set(e.x, e.y, e.z); e.m.scale.setScalar(e.range * k); e.m.material.opacity = e.a * (1 - u);
      }
      for (const e of Bm) {
        if (!e.m.visible) continue;
        e.t += dt;
        if (e.t >= e.life) { e.m.visible = false; continue; }
        const u = e.t / e.life;
        _a.set(...e.from); _b.set(...e.to);
        const L = Math.max(0.01, _a.distanceTo(_b)), w = e.w * (1 - u * 0.7);
        e.m.position.copy(_a).lerp(_b, 0.5);
        e.m.quaternion.setFromRotationMatrix(_m.lookAt(_a, _b, _up));
        e.m.scale.set(w, w, L); e.m.material.opacity = e.a * (1 - u);
      }
      stepP(SP, dt); stepP(TL, dt);
    },
    dispose() {
      scene.remove(root);
      root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      for (const k in coneGeos) coneGeos[k].dispose();
    },
  };
}
