// Connector — character entry (contract: src/chars/index.js).
import { CONNECTOR_KIT } from './kit.js';

// 20×20 portrait: an aqua oval, three hairs, two big eyes, a very large grin, two orange hands
const FACE = [
  '......K..K..K.......',
  '......K..K..K.......',
  '.......K.K.K........',
  '......LLLLLLL.......',
  '....LLLLLLLLLLL.....',
  '...LLGGLLLLLLLLL....',
  '..JJGGJJJJJJJJJJJ...',
  '..JKKKKJJJJKKKKJJ...',
  '.JJKWWKKJJKKWWKJJJ..',
  '.JJKWEEKJJKEEWKJJJ..',
  '.JJKWEEKJJKEEWKJJJ..',
  '.JJKKKKJJJJKKKKJJJ..',
  'OOJJJJJJJJJJJJJJJOO.',
  'OOJMJJJJJJJJJJMJJOO.',
  'OOJMMTTTTTTTTMMJJOO.',
  '.JJJMMMMMMMMMMJJJJ..',
  '.DDJJMMPPPPMMJJDDD..',
  '..DDDJJJJJJJJJDDD...',
  '...DDDDDDDDDDDDD....',
  '....OOO.....OOO.....',
];
const PAL = { K: '#16181c', L: '#9af2ff', G: '#eaffff', J: '#3fcfe8', D: '#1b86b4', W: '#ffffff', E: '#10131a', O: '#ff8a1e', M: '#4a0f1e', T: '#fff6e6', P: '#ff6f8a' };

export const CONNECTOR = {
  id: 'connector',
  name: 'Connector', role: 'The Copycat', tag: 'CONNECTOR',
  motto: 'Plugs into anything, copies everything',
  weapon: 'Itself',
  bio: ['Nobody knows what it is: an oval of jelly with three hairs, two big eyes, one very large mouth and two little orange balls for hands.',
    'It copies what it sees — Arick\'s scream, Vlad\'s flash — splits into three, spins, hops, and blows itself up a hundred times bigger.'],
  stats: { atk: 4, def: 4, speed: 4, range: 3 }, musou: { name: 'Giga Connect', desc: 'Inflates to 100× its size: three giant hops, a giant spin, the belly flop.' }, accent: '#3fcfe8',
  lines: {
    intro: 'Connecting… connection established. Bloop!',
    musouEnd: 'Pffff… back to pocket size.',
    copy: ['Copy and paste', 'One hundred times'],
  },
  portrait: { face: FACE, pal: PAL },
  kit: CONNECTOR_KIT,
};
