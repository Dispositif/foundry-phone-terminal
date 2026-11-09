import { LOG_MAX, MASKED, MODULE_ID } from "./constants.js";
import { maskedLabel, norm } from "./util.js";
import { t } from "./i18n.js";
/* -------------------------------------------- */
/*  Modèle : téléphones, contacts, historique   */
/* -------------------------------------------- */

export function getPhoneData(item) {
  return item?.getFlag(MODULE_ID, "phone") ?? null;
}

/** Modèles de téléphone et ce qu'ils savent faire. */
export const MODELS = {
  landline: { get label() { return t("Model.landline"); }, icon: "fa-phone", fixed: true, sms: false, callerId: false, attachments: false, ring: "ring-bell.wav" },
  mobile: { get label() { return t("Model.mobile"); }, icon: "fa-mobile-retro", sms: true, callerId: true, attachments: false, ring: "ring-mobile.wav" },
  smartphone: { get label() { return t("Model.smartphone"); }, icon: "fa-mobile-screen", sms: true, callerId: true, attachments: true, ring: "ring.wav" },
  computer: { get label() { return t("Model.computer"); }, icon: "fa-laptop", sms: true, mail: true, noCalls: true, callerId: true, attachments: true, notif: "mail.wav" },
  desktop: { get label() { return t("Model.desktop"); }, icon: "fa-desktop", fixed: true, sms: true, mail: true, noCalls: true, callerId: true, attachments: true, notif: "mail.wav" }
};

/** Messages possibles sur cet appareil ? (les mails ne dépendent pas du réglage SMS) */
export function msgOn(phone) {
  const model = modelOf(phone);
  return model.mail ? true : smsOn() && model.sms;
}

export function isComputer(phone) {
  return !!modelOf(phone).mail;
}

/** Y a-t-il au moins un appareil pouvant recevoir des messages ? (affichage du panneau MJ) */
export function anyMessaging() {
  return smsOn() || allPhones().some((p) => isComputer(p.phone));
}

/**
 * Habillages au choix du MJ, par appareil, et les modèles auxquels ils conviennent.
 * Tout appareil créé porte un habillage : "default" = celui du modèle. Un habillage inconnu
 * (retiré, renommé) ou qui ne convient pas au modèle retombe aussi sur celui du modèle.
 */
const SCREENS = ["mobile", "smartphone", "computer", "desktop"];
export const DEFAULT_THEME = "default";
export const THEMES = {
  modern: { models: ["landline"] },
  federal: { models: ["computer", "desktop"] },
  console: { models: SCREENS },
  military: { models: SCREENS }
};
export const SKINS = [...Object.keys(MODELS), ...Object.keys(THEMES)];

export function themeFits(theme, model) {
  return !!THEMES[theme]?.models.includes(model);
}

/** Habillage à enregistrer : le choix s'il convient au modèle, sinon "default". */
export function cleanTheme(theme, model) {
  return themeFits(theme, model) ? theme : DEFAULT_THEME;
}

/** Habillage affiché : celui choisi s'il convient, sinon celui du modèle (repli). */
export function skinOf(phone) {
  const model = MODELS[phone?.model] ? phone.model : "smartphone";
  return themeFits(phone?.theme, model) ? phone.theme : model;
}

export function modelOf(phone) {
  return MODELS[phone?.model] ?? MODELS.smartphone;
}

export function isLandline(phone) {
  return phone?.model === "landline";
}

/** Appareil installé dans un lieu (fixe, poste de bureau) plutôt que porté. */
export function isFixed(phone) {
  return !!modelOf(phone).fixed;
}

/** Qui a l'appareil en main : les agents présents sur sa scène s'il est fixe, sinon son porteur. */
export function holders(p, { activeOnly = false } = {}) {
  return isFixed(p.phone) ? landlineUsers(p.phone) : phoneUsers(p.actor, { activeOnly });
}

/** Nom du porteur pour les messages MJ (le lieu pour un appareil fixe). */
export function holderName(item, phone) {
  if (isFixed(phone)) return `📍 ${game.scenes.get(phone.sceneId)?.name ?? t("NoPlace")}`;
  return item?.parent instanceof Actor ? item.parent.name : "?";
}

/** Le fixe sonne pour les agents dont un jeton est sur sa scène (à défaut, les joueurs qui la regardent). */
export function landlineUsers(phone) {
  const scene = game.scenes.get(phone?.sceneId);
  if (!scene) return [];
  const players = game.users.filter((u) => !u.isGM && u.active);
  const actors = scene.tokens.map((t) => t.actor).filter(Boolean);
  const present = players.filter((u) => actors.some((a) => a.testUserPermission(u, "OWNER")));
  return present.length ? present : players.filter((u) => u.viewedScene === scene.id);
}

/** SMS activés pour ce monde ? (désactivés = téléphones d'avant les SMS) */
export function smsOn() {
  return game.settings.get(MODULE_ID, "smsEnabled");
}

/** Le téléphone capte-t-il ? (coupure générale ou zone sans réseau pour ce téléphone) */
export function hasSignal(phone) {
  // Un fixe ne dépend pas du réseau mobile : seule une ligne coupée l'empêche de fonctionner.
  if (isFixed(phone)) return !phone.noSignal;
  return !game.settings.get(MODULE_ID, "networkDown") && !phone?.noSignal;
}

/** Tous les téléphones : objets portés par des acteurs + objets du monde (abandonnés). */
export function allPhones() {
  const out = [];
  const push = (item) => {
    const phone = getPhoneData(item);
    if (phone) out.push({ item, phone, actor: item.parent instanceof Actor ? item.parent : null });
  };
  for (const actor of game.actors) for (const item of actor.items) push(item);
  for (const item of game.items) push(item);
  return out;
}

export function phonesByNumber(number) {
  const n = norm(number);
  if (!n) return [];
  return allPhones().filter((p) => norm(p.phone.number) === n);
}

/** Joueurs qui « tiennent » le téléphone porté par cet acteur. */
export function phoneUsers(actor, { activeOnly = false } = {}) {
  if (!actor) return [];
  const players = game.users.filter((u) => !u.isGM);
  const assigned = players.filter((u) => u.character?.id === actor.id);
  const owners = players.filter((u) => actor.testUserPermission(u, "OWNER"));
  if (!activeOnly) return assigned.length ? assigned : owners;
  const assignedOn = assigned.filter((u) => u.active);
  return assignedOn.length ? assignedOn : owners.filter((u) => u.active);
}

export function phoneLabel({ actor, phone }) {
  if (isFixed(phone)) return `📍 ${game.scenes.get(phone.sceneId)?.name ?? t("NoPlace")} — ${phone.label} (${phone.number})`;
  return `${actor?.name ?? t("NoHolder")} — ${phone.label} (${phone.number})`;
}

export function findContact(phone, str) {
  const s = norm(str);
  if (!s) return null;
  return (phone?.contacts ?? []).find((c) => norm(c.name) === s || (c.number && norm(c.number) === s)) ?? null;
}

/** Clé de conversation : le numéro du contact s'il en a un, sinon son nom, sinon la saisie brute. */
export function keyFor(phone, str) {
  const c = findContact(phone, str);
  return c ? c.number || c.name : String(str ?? "").trim();
}

/** Nom affiché pour une clé, vu depuis ce téléphone. */
export function displayName(phone, key) {
  return findContact(phone, key)?.name ?? maskedLabel(key);
}

/** Deux clés désignent-elles la même conversation, vu depuis ce téléphone ? */
export function sameConv(phone, a, b) {
  return norm(keyFor(phone, a)) === norm(keyFor(phone, b));
}

/** Compatibilité avec les entrées de la v0.2. */
export function normalizeEntry(e) {
  return { ...e, dir: e.dir ?? "in", with: e.with ?? e.from ?? MASKED };
}

export function getLog(phone, { includePending = false } = {}) {
  return (phone?.log ?? []).map(normalizeEntry).filter((e) => includePending || !e.pending);
}

/**
 * File d'écriture par appareil : chaque modification de l'historique attend la précédente
 * et relit l'état à jour, pour que deux messages simultanés ne s'écrasent pas.
 */
export const writeQueues = new Map();
export function withItemLock(item, fn) {
  const key = item.uuid;
  const run = (writeQueues.get(key) ?? Promise.resolve()).then(fn, fn);
  const tail = run.catch((err) => console.error(`${MODULE_ID} |`, err));
  writeQueues.set(key, tail);
  tail.then(() => writeQueues.get(key) === tail && writeQueues.delete(key));
  return run;
}

/** Garde toutes les entrées préparées, et les LOG_MAX plus récentes des autres. */
export function trimLog(log) {
  let n = 0;
  return log.filter((e) => e.prep || ++n <= LOG_MAX);
}

/** Modifie l'historique : fn reçoit une copie à jour et renvoie le nouvel historique (ou null si rien ne change). */
export function mutateLog(item, fn) {
  if (!item) return Promise.resolve();
  return withItemLock(item, async () => {
    const phone = getPhoneData(item);
    if (!phone) return;
    const next = fn([...(phone.log ?? [])], phone);
    if (next) await item.update({ [`flags.${MODULE_ID}.phone.log`]: trimLog(next) });
  });
}

export function addLog(item, entry) {
  return mutateLog(item, (log) => [{ id: foundry.utils.randomID(), t: Date.now(), ...entry }, ...log]);
}

/** Message reçu pas encore lu par le joueur. */
export function isUnread(e) {
  return e.dir === "in" && e.kind === "sms" && e.read === false;
}

export function unreadCount(phone) {
  return getLog(phone).filter(isUnread).length;
}

export function markRead(item, key) {
  const phone = getPhoneData(item);
  return patchLog(item, (e) => isUnread(e) && sameConv(phone, e.with, key), { read: true });
}

export function patchLog(item, predicate, patch) {
  return mutateLog(item, (log) => {
    let changed = false;
    const next = log.map((e) => {
      if (!predicate(normalizeEntry(e))) return e;
      changed = true;
      return { ...e, ...patch };
    });
    return changed ? next : null;
  });
}

/** Conversations d'un téléphone, triées par activité (+ contacts sans message). */
export function conversations(phone) {
  const map = new Map();
  for (const e of getLog(phone)) {
    const key = keyFor(phone, e.with);
    const k = norm(key);
    if (!map.has(k)) map.set(k, { key, entries: [], unread: 0 });
    const conv = map.get(k);
    conv.entries.push(e);
    if (isUnread(e)) conv.unread++;
  }
  for (const c of phone.contacts ?? []) {
    const key = c.number || c.name;
    if (!map.has(norm(key))) map.set(norm(key), { key, entries: [], unread: 0 });
  }
  return [...map.values()].sort((a, b) => (b.entries[0]?.t ?? 0) - (a.entries[0]?.t ?? 0));
}

export function pickItemType() {
  const types = (game.documentTypes?.Item ?? Object.keys(CONFIG.Item.typeLabels ?? {})).filter((t) => t !== "base");
  return types.find((t) => /equip|gear|item|stuff|objet|possession|inventory/i.test(t)) ?? types[0];
}

export async function createPhone(actor, { label, number, model = "smartphone", sceneId = null, theme = null }) {
  const options = actor ? { parent: actor } : {};
  return Item.create(
    {
      name: label,
      type: pickItemType(),
      img: "icons/svg/item-bag.svg",
      flags: { [MODULE_ID]: { phone: { label, number, model, sceneId, theme: cleanTheme(theme, model), mode: "on", contacts: [], log: [] } } }
    },
    options
  );
}

export async function markPhone(item, { label, number, model, sceneId, theme }) {
  const prev = getPhoneData(item) ?? { mode: "on", contacts: [], log: [] };
  const next = { ...prev, label, number };
  if (model) next.model = model;
  if (sceneId !== undefined) next.sceneId = sceneId;
  if (theme !== undefined || !next.theme) next.theme = cleanTheme(theme ?? next.theme, next.model ?? "smartphone");
  return item.update({ [`flags.${MODULE_ID}.phone`]: next });
}

export async function unmarkPhone(item) {
  return item.unsetFlag(MODULE_ID, "phone");
}

