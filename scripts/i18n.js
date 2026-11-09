import { MODULE_ID } from "./constants.js";

/* -------------------------------------------- */
/*  Langue du module (FR / EN)                  */
/* -------------------------------------------- */

const dicts = {};
let loading = null;

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

/** Charge les deux fichiers de langue (une seule fois). */
export function loadLanguages() {
  loading ??= Promise.all(
    ["fr", "en"].map(async (l) => {
      try {
        const res = await fetch(`modules/${MODULE_ID}/lang/${l}.json`);
        dicts[l] = flatten(await res.json());
      } catch (err) {
        console.warn(`${MODULE_ID} | lang/${l}.json`, err);
        dicts[l] = {};
      }
    })
  );
  return loading;
}

/** Langue choisie dans les réglages du module ; « auto » suit la langue de Foundry. */
export function currentLang() {
  let l = "auto";
  try {
    l = game.settings.get(MODULE_ID, "language");
  } catch {}
  if (!l || l === "auto") l = game.i18n?.lang ?? "en";
  return l.startsWith("fr") ? "fr" : "en";
}

/** Traduit une clé (préfixe SPT. facultatif), avec des variables {nom}. */
export function t(key, data = {}) {
  const k = key.startsWith("SPT.") ? key : `SPT.${key}`;
  const l = currentLang();
  let s = dicts[l]?.[k] ?? dicts.en?.[k] ?? dicts.fr?.[k];
  if (s === undefined) s = game.i18n?.has?.(k) ? game.i18n.localize(k) : k;
  return String(s).replace(/\{(\w+)\}/g, (m, n) => (n in data ? String(data[n]) : m));
}

/** Pluriel : clés « .one » et « .other » ; {n} = le nombre. */
export function tn(key, n, data = {}) {
  const one = currentLang() === "fr" ? n <= 1 : n === 1;
  return t(`${key}.${one ? "one" : "other"}`, { n, ...data });
}

/** Objet dont chaque propriété est traduite à la lecture. */
export function labels(prefix, keys) {
  const o = {};
  for (const k of keys) Object.defineProperty(o, k, { get: () => t(`${prefix}.${k}`), enumerable: true });
  return o;
}
