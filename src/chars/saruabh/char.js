// Saruabh — character entry (contract: src/chars/index.js).
import { SARUABH_KIT } from './kit.js';

// 20×20 portrait: sailor hat with a navy band, chestnut twin tails with red ribbons, big teal eyes, navy collar
const FACE = [
  '......WWWWWWWW......',
  '.....WWWWWWWWWW.....',
  '....NNNNNNNNNNNN....',
  '...HHHHHhHHHHhHHH...',
  '..RHHHhHHHHHHHHHHR..',
  '.RRHHHHHHhHHHHhHHRR.',
  '.HHHHSSHSSHSSHSSHHH.',
  '.HHHSSSSSSSSSSSSHHH.',
  '.HHHSEESSSSSSEESHHH.',
  '.HhHSEwSSSSSSEwSHhH.',
  '.HHHSIISSSSSSIISHHH.',
  '.HH.SSSSSSsSSSSS.HH.',
  '.Hh.SPSSSSsSSSPS.hH.',
  '.HH.sSSSSMMSSSSs.HH.',
  '.hH..sSSSSSSSSs..Hh.',
  '..H...ssSSSSss...H..',
  '...NNNNNssssNNNNN...',
  '.NNwwNNNNTTNNNNwwNN.',
  'NNNNNNNNTTTTNNNNNNNN',
  'WWWWWWWWWTTWWWWWWWWW',
];
const PAL = { W: '#f4f4f0', N: '#1f3a6e', w: '#ffffff', H: '#6a3a24', h: '#8a5232', R: '#d0402a', S: '#f6d2b4', s: '#d6a88a', E: '#1a1214', I: '#2a9a8a',
  P: '#f2a8a0', M: '#c0646a', T: '#d0402a' };

export const SARUABH = {
  id: 'saruabh',
  name: 'Saruabh', role: 'The Influencer', tag: 'SARUABH',
  motto: 'Every hit goes viral',
  weapon: 'Cellphone & Laptop',
  bio: ['Top of the class, top of the feed. A white sailor outfit, twin tails and two devices always at hand.',
    'The fastest hands in the bracket: phone in the right, laptop in the left, a new hit every third of a second.'],
  stats: { atk: 3, def: 2, speed: 5, range: 3 }, musou: { name: 'Viral Storm', desc: 'Six dash cuts, a spinning storm, then the burst.' }, accent: '#ff7eb6',
  lines: {
    intro: 'Smile! You\'re about to trend for all the wrong reasons.',
    musouEnd: 'Posted. Shared. Deleted. Next!',
    copy: ['Like and share', 'Going viral'],
  },
  portrait: { face: FACE, pal: PAL },
  kit: SARUABH_KIT,
};
