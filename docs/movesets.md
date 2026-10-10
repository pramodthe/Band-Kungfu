# Fighter move tables

A fighter's kit supplies its move table. All timings use fixed 60 Hz simulation frames. Combat reads these tables; animated bones do not determine hit detection.

```text
move = {
  frames      total duration (the animation clip is the one with the move's id, anims/attacks.js)
  anim        clip timing (only for moves whose clip is not frame-keyed to this data in anims/attacks.js): [[frame, clipT, clip?], ...] piecewise linear from move frame to normalised clip time, so a
              move can hold a chamber, snap a strike and hold a finish pose without re-authoring the clip. `clip`
              carries over to later keys; two keys on the same frame = a cut (the renderer blends it like a new move).
              Without `anim` the clip plays linearly over `frames`.
  next        normal-attack follow-up, charge: charge-attack branch (C2..C6 hang off N1..N5)
  cancel      frame from which a buffered attack/charge (or jump) starts the next move — the beat of the string
  branch      N1–N5: frame from which a buffered charge starts the Cn branch — right after the strike, cutting the
              follow-through (DW8XL: N1 trail f163–166 → C2 flash f167, N2 f294–297 → C3 f299, N3 f53–56 → C4 f57)
  dodgeCancel frame from which dodge cancels the move (also during the wind-up, before the first active frame)
  lunge       [[f0, f1, metres, 'lin'?], ...] forward displacement along the facing, eased out (or linear)
  steer       frames at the start during which the hero may still turn toward the stick / soft-lock target
  armor       hyper armour vs officers too (grunt hits never flinch an attacking hero)
  air         performed in the air (hover: upward speed set on start so air strings hang), landFrame: on touchdown
              jump to this frame and hold landFrame-1 while still airborne (plunges, vaults)
  leap        [frame, vy] take off mid-move · hang [f0, f1] zero vertical speed · plunge [frame, vy] dive down
  hits: [{ f:[first,last] active frames (inclusive), shape:'arc'|'circle'|'line',
           arc: range, ang (total degrees), dir (degrees offset, + = left) · circle: range · line: len, width, off
           dmg, kb:'flinch'|'push'|'launch'|'blow'|'spin'|'slam', force (m/s horizontal), lift (m/s up),
           hitstop (frames), every (re-hit interval inside the window, 0 = once), yMax (air reach), heavy,
           pillars / rocks: count of gold light pillars / boulders the vfx raises when this heavy circle window opens,
           sweep: ±1 resolve the window in swing order (+1 right → left, −1 left → right; a circle starts at dir + 180°
           for −1): the sector grows from the start side over sweepN frames (default: the window), one hero hitstop }]
```

Each fighter defines its own `jc` timing, including the landing frame and aura window. Shared animation effects use the active kit's timing. `prepMoves` prepares derived move fields once when a table loads.
