// Crowd skins + lieutenant / boss models registry (content for the crowd view's hook, src/crowd/view.js header). The
// stage picks skins with `skin: { foe, ally }` (story/chapters.js); officers with `model: key` in their OFF entry. New
// skins / models register here with one import + one entry.
import { REDGUARD, BLUEGUARD } from './skins.js';
import { SENTINEL, CRANE, OX, VIPER, DRAGON, DRAGON_UNMASKED, ECHO } from './models.js';

export const SKINS = { redguard: REDGUARD, blueguard: BLUEGUARD };
export const OFFICER_MODELS = { sentinel: SENTINEL, crane: CRANE, ox: OX, viper: VIPER, dragon: DRAGON, dragon_unmasked: DRAGON_UNMASKED, echo: ECHO };
