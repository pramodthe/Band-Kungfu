// Simulation tests use the same bundled Three.js math as the browser, without a renderer or another dependency.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') {
    return { url: new URL('../../vendor/three/three.module.js', import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
