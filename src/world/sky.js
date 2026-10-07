// Atmosphere for an indoor arena: a plain distance haze that replaces three's fog chunk, so every fogged material (floor,
// racks, crowd, hero, debris) fades toward scene.fog.color with distance. No sun: the arena is lit by its own lamps.
// SUN_DIR / SUN_AZ stay exported for the engine modules that ask where the key light comes from (post.js atmosphere pass,
// the Special-attack cameras that avoid shooting straight into it): here it is the big floodlight bank over the far wall.
import * as THREE from 'three';

const KEY_ELEV = 0.5;
export const SUN_AZ = 0.314;
export const SUN_DIR = new THREE.Vector3(Math.sin(SUN_AZ) * Math.cos(KEY_ELEV), Math.sin(KEY_ELEV), Math.cos(SUN_AZ) * Math.cos(KEY_ELEV));

/**
 * Replace three's fog chunks (must run before any material compiles). THREE.Fog(color, near, far) now means: haze starts
 * at `near` metres and reaches 63 % after a further `far` metres. The curve is exp(-x^1.6), not exp(-x): the mid field
 * stays legible as silhouettes while the far wall still sinks into the dark.
 */
export function installHaze() {
  THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n\tvarying vec3 vFogDir;\n#endif';
  THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n\tvFogDir = transpose( mat3( viewMatrix ) ) * mvPosition.xyz;\n#endif';
  THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
    uniform vec3 fogColor; varying vec3 vFogDir;
    uniform float fogNear; uniform float fogFar;
  #endif`;
  THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
    float fogDist = length( vFogDir );
    float fogFactor = 1.0 - exp( - pow( max( fogDist - fogNear, 0.0 ) / fogFar, 1.6 ) );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
  #endif`;
}
