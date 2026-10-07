// Fighter model assembly on the shared rig (src/hero/rig.js): one voxel mesh per joint from box lists (src/hero/model.js
// vox: exposed faces + baked ambient occlusion), the fighter material (camera fill + rim, heroLook), and the kit's
// extras (weapon, props) through add().
import * as THREE from 'three';
import { vox, V, HV, heroLook } from '../../hero/model.js';

export const B = (a, b, c, paint) => ({ a, b, c, paint });
export const Pt = (a, b, c) => ({ a, b, c, paint: true });
const mirror = (q) => ({ ...q, a: [1 - q.b[0], q.a[1], q.a[2]], b: [1 - q.a[0], q.b[1], q.b[2]] });
/** Head boxes are authored on one side; both(...) adds the mirror image (head grid: x −4 … 5, off −0.5). */
export const both = (...qs) => qs.flatMap((q) => [q, mirror(q)]);
export const hex = (s) => parseInt(s.slice(1), 16);

/** The fighters' material: vertex-coloured, flat-shaded, with the hero fill + rim light. */
export const fighterMaterial = (o = {}, fill = 0.4, rim = 0.9) => heroLook(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.92, 0.92, 0.92),
  vertexColors: true, roughness: 0.7, metalness: 0.05, flatShading: true, ...o }), fill, rim);

/** Meshes `parts` ({ joint: boxes }) and the head boxes onto the rig, one mesh per joint.
 *  → { meshes, add(parent, geo, name, material?) } (add: the kit's weapon and extras, into the same meshes table). */
export function buildBody(rig, mat, parts, headBoxes) {
  const meshes = {};
  const add = (parent, geo, name, m = mat) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    meshes[name] = mesh;
    return mesh;
  };
  for (const [joint, boxes] of Object.entries(parts)) {
    const odd = /foreArm|thigh|shin/.test(joint);                    // odd-width parts: centre them
    add(rig.joints[joint], vox(boxes, V, { off: odd ? [-0.5, 0, -0.5] : [0, 0, 0] }), joint);
  }
  if (headBoxes) add(rig.joints.head, vox(headBoxes, HV, { off: [-0.5, 0, 0], jitter: 0.04 }), 'head');
  return { meshes, add };
}
