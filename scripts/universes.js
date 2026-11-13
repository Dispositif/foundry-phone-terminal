import { MODULE_ID } from "./constants.js";
/* -------------------------------------------- */
/*  Universes: era or genre of the world        */
/* -------------------------------------------- */

/**
 * One entry per universe. Keys are stable (stored in the world setting); visible names
 * live in the language files ("UniverseName.<key>"), so they can be renamed freely.
 *
 * models:       device models offered when creating a device (null = all).
 * themes:       looks offered per model; the first one is the default look.
 *               "standard" = the model's own look. A model not listed keeps every look.
 * defaultModel: device created for a character when a player is called or texted.
 *
 * Vocabulary: the language files may override any key under "Universe.<key>.<same key>".
 */
export const UNIVERSES = {
  all: { models: null, themes: {}, defaultModel: "smartphone" },
  retro: {
    models: ["landline", "pager", "mobile", "computer", "desktop"],
    themes: {
      landline: ["modern", "vintage"],
      mobile: ["standard"],
      pager: ["standard"],
      computer: ["console", "standard"],
      desktop: ["console", "standard", "military", "federal"]
    },
    defaultModel: "mobile"
  },
  modern: {
    models: ["smartphone", "mobile", "pager", "computer", "desktop", "landline"],
    themes: {
      smartphone: ["standard", "military"],
      mobile: ["standard"],
      pager: ["standard"],
      computer: ["standard", "federal", "military", "console"],
      desktop: ["standard", "federal", "military", "console"],
      landline: ["modern", "vintage"]
    },
    defaultModel: "smartphone"
  },
  cyberpunk: {
    models: ["smartphone", "computer", "desktop", "pager", "landline"],
    themes: {
      smartphone: ["neon", "glitch", "military"],
      computer: ["neon", "glitch", "console"],
      desktop: ["neon", "glitch", "console", "military"],
      pager: ["standard"],
      landline: ["modern"]
    },
    defaultModel: "smartphone"
  }
};

/** Key of the world's universe ("all" before the settings are ready, or if unknown). */
export function universeKey() {
  let key = "all";
  try {
    key = game.settings.get(MODULE_ID, "universe");
  } catch {}
  return UNIVERSES[key] ? key : "all";
}

export function universe() {
  return UNIVERSES[universeKey()];
}

/** Can a new device of this model be created in this universe? */
export function modelAllowed(model) {
  const models = universe().models;
  return !models || models.includes(model);
}
