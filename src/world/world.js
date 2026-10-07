// World registry + manager (render-only). Each map's render builder (src/world/maps/<id>/world.js) is registered in
// WORLDS by map id; createWorld() keeps the active map's world built under one root group and swaps it when the active
// map (src/world/map.js setMap) changes — sync() at battle start (main.js), under the loading card. A builder is
// (scene, root) → { fires, update(dt, focus, game), dispose? }: it adds everything to root (lights included) and may set
// scene.fog / scene.background; the manager disposes root's geometry / materials / textures on a swap.
import * as THREE from 'three';
import { installHaze } from './sky.js';
import { MAP } from './map.js';
import { buildArena } from './maps/arena/world.js';

/** Render builders by map id. New maps register with one import + one entry. */
export const WORLDS = { arena: buildArena };

installHaze();
// the sun's shadow fades out over the outer 20 % of its box instead of cutting off: soldiers and props at the box edge
// no longer pop a shadow on / off as the hero moves (must patch before any material compiles)
const SHADOW_BOX = 34;
{
  const RET = '\t\t\treturn mix( 1.0, shadow, shadowIntensity );\n\t\t}\n\t#elif defined( SHADOWMAP_TYPE_VSM )';
  const src = THREE.ShaderChunk.shadowmap_pars_fragment;
  if (src.includes(RET)) THREE.ShaderChunk.shadowmap_pars_fragment = src.replace(RET, RET.replace('\t\t\treturn',
    '\t\t\tshadow = mix( shadow, 1.0, smoothstep( 0.8, 0.98, max( abs( shadowCoord.x - 0.5 ), abs( shadowCoord.y - 0.5 ) ) * 2.0 ) );\n\t\t\treturn'));
}

export function createWorld(scene) {
  let id = null, root = null, cur = null;
  const w = {
    fires: [],
    /** Build the active map's world if it is not the one on screen (drops the old one). Returns true on a swap. */
    sync() {
      if (id === MAP.id) return false;
      if (root) {
        cur.dispose?.();
        scene.remove(root);
        root.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          for (const m of [].concat(o.material || [])) { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); }
        });
      }
      id = MAP.id; root = new THREE.Group(); root.name = 'world-' + id; scene.add(root);
      cur = (WORLDS[id] || WORLDS.arena)(scene, root);
      w.fires = cur.fires;
      return true;
    },
    update(dt, focus, game) { cur.update(dt, focus, game); },
  };
  w.sync();
  return w;
}
