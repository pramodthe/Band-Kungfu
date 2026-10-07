// Secondary motion for the fighters (render-only): verlet spring chains (src/hero/secondary.js chain: hair, straps, cloth
// tails) anchored to rig joints, with the body's sphere colliders and the wind. Visual state only — never touches the sim.
// createChains(scene, rig, mat) → { add(joint, chainOpts), reset(), update(dt) → t (s) }
import * as THREE from 'three';
import { chain } from '../../hero/secondary.js';
import { HV } from '../../hero/model.js';

export function createChains(scene, rig, mat) {
  const j = rig.joints, chains = [];
  const cols = {};
  for (const k of ['head', 'chest', 'hips', 'thighL', 'thighR', 'kneeL', 'kneeR']) cols[k] = { c: new THREE.Vector3(), r: 0 };
  const setCol = (k, joint, x, y, z, r) => { cols[k].c.set(x, y, z).applyMatrix4(joint.matrixWorld); cols[k].r = r; };
  const back = new THREE.Vector3(), _bq = new THREE.Quaternion();
  let t = 0;
  return {
    add(joint, o) { const c = chain(scene, o.mat || mat, joint, o); chains.push(c); return c; },
    reset() { for (const c of chains) c.reset(); },
    update(dt) {
      t += dt;
      j.root.updateMatrixWorld(true);
      setCol('head', j.head, 0, 7 * HV, 0, 7.4 * HV);
      setCol('chest', j.chest, 0, 0.08, 0, 0.19);
      setCol('hips', j.hips, 0, -0.06, 0, 0.155);
      for (const s of ['L', 'R']) {
        setCol('thigh' + s, j['thigh' + s], 0, -0.22, 0, 0.095);
        setCol('knee' + s, j['shin' + s], 0, -0.02, 0, 0.09);
      }
      back.set(0, 0.15, -1).applyQuaternion(j.root.getWorldQuaternion(_bq));
      for (const c of chains) c.update(dt, t, cols, back);
      return t;
    },
  };
}
