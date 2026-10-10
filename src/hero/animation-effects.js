/** Render-only jump/landing scale, using the selected fighter's own move timing. */
export function verticalScale(anim, jumpCharge) {
  let squash = 0;
  if (anim.id === 'air' && anim.t < 0.22) return 1 + 0.15 * (1 - anim.t / 0.22);
  if (anim.id === 'land') squash = 0.17 * (1 - anim.t) ** 2 - 0.05 * Math.sin(Math.PI * anim.t);
  else if (anim.id === 'jc' && jumpCharge) {
    const progress = (anim.t * jumpCharge.frames - jumpCharge.landFrame) / 10;
    if (progress >= 0 && progress < 1)
      squash = 0.22 * (1 - progress) ** 2 - 0.05 * Math.sin(Math.PI * progress);
  }
  return 1 - squash;
}

export function jumpChargeAuraActive(hero) {
  const move = hero.kit.moves.jc;
  return Boolean(
    move && hero.move === 'jc' && hero.moveT >= move.hang[0] - 3 && hero.moveT < move.plunge[0] + 2,
  );
}
