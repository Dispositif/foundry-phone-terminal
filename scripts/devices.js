import { LOG_MAX, MASKED, MODULE_ID, SHEET_ID } from "./constants.js";
import { esc, maskedLabel, norm, randomEmail, randomNumber } from "./util.js";
import { t } from "./i18n.js";
/* -------------------------------------------- */
/*  Model: phones, contacts, history            */
/* -------------------------------------------- */

export function getPhoneData(item) {
  return item?.getFlag(MODULE_ID, "phone") ?? null;
}

/** Device models and what they can do. */
export const MODELS = {
  landline: { get label() { return t("Model.landline"); }, icon: "fa-phone", fixed: true, sms: false, callerId: false, attachments: false, ring: "ring-bell.wav" },
  mobile: { get label() { return t("Model.mobile"); }, icon: "fa-mobile-retro", sms: true, callerId: true, attachments: false, ring: "ring-mobile.wav" },
  smartphone: { get label() { return t("Model.smartphone"); }, icon: "fa-mobile-screen", sms: true, callerId: true, attachments: true, ring: "ring.wav" },
  computer: { get label() { return t("Model.computer"); }, icon: "fa-laptop", sms: true, mail: true, noCalls: true, callerId: true, attachments: true, notif: "mail.wav" },
  desktop: { get label() { return t("Model.desktop"); }, icon: "fa-desktop", fixed: true, sms: true, mail: true, noCalls: true, callerId: true, attachments: true, notif: "mail.wav" }
};

/** Can this device send messages? (emails do not depend on the texts setting) */
export function msgOn(phone) {
  const model = modelOf(phone);
  return model.mail ? true : smsOn() && model.sms;
}

export function isComputer(phone) {
  return !!modelOf(phone).mail;
}

/** Is there at least one device able to receive messages? (GM panel display) */
export function anyMessaging() {
  return smsOn() || allPhones().some((p) => isComputer(p.phone));
}

/**
 * Looks the GM can pick per device, and the models they fit.
 * Every created device stores a look: "default" = the model's look. An unknown look
 * (removed, renamed) or one that does not fit the model also falls back to the model's look.
 */
const SCREENS = ["mobile", "smartphone", "computer", "desktop"];
export const DEFAULT_THEME = "default";
export const THEMES = {
  modern: { models: ["landline"] },
  vintage: { models: ["landline"], skin: "landline" },
  federal: { models: ["computer", "desktop"] },
  console: { models: SCREENS },
  military: { models: SCREENS }
};
export const SKINS = [...Object.keys(MODELS), ...Object.keys(THEMES)];

export function themeFits(theme, model) {
  return !!THEMES[theme]?.models.includes(model);
}

/** Look a new device gets when none is chosen: a landline is modern unless "vintage" is picked. */
export function newTheme(model) {
  return model === "landline" ? "modern" : DEFAULT_THEME;
}

/** Look to store: the choice if it fits the model, otherwise "default". */
export function cleanTheme(theme, model) {
  return themeFits(theme, model) ? theme : DEFAULT_THEME;
}

/** Look to display: the chosen one if it fits, otherwise the model's look (fallback). */
export function skinOf(phone) {
  const model = MODELS[phone?.model] ? phone.model : "smartphone";
  // "default" keeps the model's look (rotary dial for a landline), so existing devices do not change.
  return themeFits(phone?.theme, model) ? THEMES[phone.theme].skin ?? phone.theme : model;
}

export function modelOf(phone) {
  return MODELS[phone?.model] ?? MODELS.smartphone;
}

export function isLandline(phone) {
  return phone?.model === "landline";
}

/** Device installed in a place (landline, terminal) rather than carried. */
export function isFixed(phone) {
  return !!modelOf(phone).fixed;
}

/**
 * Who holds the device: its carrier, or the agents on its scene if installed.
 * A world item (Items sidebar) is also held by the players the GM gave it to (Observer or more),
 * wherever they are: remote access to a shared terminal, a case file…
 */
export function holders(p, { activeOnly = false } = {}) {
  if (p.actor) return phoneUsers(p.actor, { activeOnly });
  const shared = sharedUsers(p.item).filter((u) => !activeOnly || u.active);
  if (!isFixed(p.phone)) return shared;
  const here = landlineUsers(p.phone);
  return [...here, ...shared.filter((u) => !here.includes(u))];
}

/** Players given a world device item (Observer or more). */
export function sharedUsers(item) {
  if (!item || item.parent) return [];
  return game.users.filter((u) => !u.isGM && item.testUserPermission(u, "OBSERVER"));
}

/** Holder name for GM messages (the place for an installed device). */
export function holderName(item, phone) {
  if (isFixed(phone)) return `📍 ${game.scenes.get(phone.sceneId)?.name ?? t("NoPlace")}`;
  if (item?.parent instanceof Actor) return item.parent.name;
  return sharedUsers(item).length ? t("Gm.Shared") : "?";
}

/** An installed device rings for agents with a token on its scene (otherwise, players viewing it). */
export function landlineUsers(phone) {
  const scene = game.scenes.get(phone?.sceneId);
  if (!scene) return [];
  const players = game.users.filter((u) => !u.isGM && u.active);
  const actors = scene.tokens.map((t) => t.actor).filter(Boolean);
  const present = players.filter((u) => actors.some((a) => a.testUserPermission(u, "OWNER")));
  return present.length ? present : players.filter((u) => u.viewedScene === scene.id);
}

/** Texts enabled in this world? (disabled = phones from before texting) */
export function smsOn() {
  return game.settings.get(MODULE_ID, "smsEnabled");
}

/** Does the device have signal? (network cut, or no signal for this device) */
export function hasSignal(phone) {
  // An installed device does not depend on the mobile network: it always has a line.
  if (isFixed(phone)) return true;
  return !game.settings.get(MODULE_ID, "networkDown") && !phone?.noSignal;
}

/** All devices: items carried by actors + world items (held by nobody). */
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

/** Players who "hold" the device carried by this actor. */
export function phoneUsers(actor, { activeOnly = false } = {}) {
  if (!actor) return [];
  const players = game.users.filter((u) => !u.isGM);
  const assigned = players.filter((u) => u.character?.id === actor.id);
  const owners = players.filter((u) => actor.testUserPermission(u, "OWNER"));
  if (!activeOnly) return assigned.length ? assigned : owners;
  const assignedOn = assigned.filter((u) => u.active);
  return assignedOn.length ? assignedOn : owners.filter((u) => u.active);
}

export function phoneLabel({ item, actor, phone }) {
  if (isFixed(phone)) return `📍 ${game.scenes.get(phone.sceneId)?.name ?? t("NoPlace")} — ${phone.label} (${phone.number})`;
  const who = actor?.name ?? (sharedUsers(item).length ? t("Gm.Shared") : t("NoHolder"));
  return `${who} — ${phone.label} (${phone.number})`;
}

export function findContact(phone, str) {
  const s = norm(str);
  if (!s) return null;
  return (phone?.contacts ?? []).find((c) => norm(c.name) === s || (c.number && norm(c.number) === s)) ?? null;
}

/** Conversation key: the contact's number if any, otherwise its name, otherwise the raw input. */
export function keyFor(phone, str) {
  const c = findContact(phone, str);
  return c ? c.number || c.name : String(str ?? "").trim();
}

/** Display name for a key, as seen from this device. */
export function displayName(phone, key) {
  return findContact(phone, key)?.name ?? maskedLabel(key);
}

/** Do two keys point to the same conversation, as seen from this device? */
export function sameConv(phone, a, b) {
  return norm(keyFor(phone, a)) === norm(keyFor(phone, b));
}

/** Compatibility with v0.2 entries. */
export function normalizeEntry(e) {
  return { ...e, dir: e.dir ?? "in", with: e.with ?? e.from ?? MASKED };
}

export function getLog(phone, { includePending = false } = {}) {
  return (phone?.log ?? []).map(normalizeEntry).filter((e) => includePending || !e.pending);
}

/**
 * Write queue per device: each history change waits for the previous one
 * and re-reads the current state, so two simultaneous messages do not overwrite each other.
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

/** Keeps all prepared entries, and the LOG_MAX most recent of the others. */
export function trimLog(log) {
  let n = 0;
  return log.filter((e) => e.prep || ++n <= LOG_MAX);
}

/** Changes the history: fn gets an up-to-date copy and returns the new history (or null if nothing changes). */
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

/** Received message not yet read by the player. */
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

/** A device's conversations, sorted by activity (+ contacts without messages). */
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

/** Item icon for each model (shipped with the module, always available). */
export const modelImg = (model) => `modules/${MODULE_ID}/icons/${MODELS[model] ? model : "smartphone"}.svg`;

/** Is the item image a default one (Foundry's or ours) that can be replaced? */
export function isDefaultImg(img, type) {
  if (!img || img === "icons/svg/item-bag.svg" || img === Item.DEFAULT_ICON || img.startsWith(`modules/${MODULE_ID}/icons/`)) return true;
  return !!type && img === Item.getDefaultArtwork?.({ type })?.img;
}

/** Item description field for this system (string or { value }), or null. */
function descriptionPath(item) {
  const d = item.system?.description;
  if (typeof d === "string") return "system.description";
  if (typeof d?.value === "string") return "system.description.value";
  return null;
}

/** Short device description: "Smartphone · 555-0142". */
export function deviceDescription(phone) {
  return `<p>${esc(modelOf(phone).label)} · ${esc(phone.number ?? "")}</p>`;
}

/**
 * Fields to set on a device item, without overwriting a GM choice: "device" sheet,
 * model icon, and description (only if empty or written by the module).
 */
export function deviceItemPatch(item, phone) {
  const patch = {};
  const model = phone.model ?? "smartphone";
  if (item.getFlag("core", "sheetClass") === undefined) patch["flags.core.sheetClass"] = SHEET_ID;
  if (isDefaultImg(item.img, item.type) && item.img !== modelImg(model)) patch.img = modelImg(model);
  const path = descriptionPath(item);
  if (path) {
    const current = foundry.utils.getProperty(item, path) ?? "";
    const auto = deviceDescription(phone);
    const ours = item.getFlag(MODULE_ID, "desc");
    if ((!current.trim() || current === ours) && current !== auto) {
      patch[path] = auto;
      patch[`flags.${MODULE_ID}.desc`] = auto;
    }
  }
  return patch;
}

/** Random number for the model: an email address for a laptop or a terminal. */
export function randomAddress(model) {
  return MODELS[model]?.mail ? randomEmail() : randomNumber();
}

export function pickItemType() {
  const types = (game.documentTypes?.Item ?? Object.keys(CONFIG.Item.typeLabels ?? {})).filter((t) => t !== "base");
  return types.find((t) => /equip|gear|item|stuff|objet|possession|inventory/i.test(t)) ?? types[0];
}

export async function createPhone(actor, { label, number, model = "smartphone", sceneId = null, theme = null }) {
  const options = actor ? { parent: actor, spt: true } : { spt: true };
  const item = await Item.create(
    {
      name: label,
      type: pickItemType(),
      img: modelImg(model),
      flags: {
        core: { sheetClass: SHEET_ID },
        [MODULE_ID]: { phone: { label, number, model, sceneId, theme: cleanTheme(theme ?? newTheme(model), model), mode: "on", contacts: [], log: [] } }
      }
    },
    options
  );
  const patch = item ? deviceItemPatch(item, getPhoneData(item)) : {};
  if (Object.keys(patch).length) await item.update(patch);
  return item;
}

export async function markPhone(item, { label, number, model, sceneId, theme }) {
  const prev = getPhoneData(item) ?? { mode: "on", contacts: [], log: [] };
  const next = { ...prev, label, number };
  if (model) next.model = model;
  if (sceneId !== undefined) next.sceneId = sceneId;
  if (theme !== undefined || !next.theme) next.theme = cleanTheme(theme ?? next.theme, next.model ?? "smartphone");
  const patch = deviceItemPatch(item, next);
  // Device and item share one name.
  if (label && item.name !== label) patch.name = label;
  // Changing the model changes the item image too.
  if (prev.model && next.model !== prev.model) patch.img = modelImg(next.model);
  return item.update({ [`flags.${MODULE_ID}.phone`]: next, ...patch });
}

export async function unmarkPhone(item) {
  // The item becomes an ordinary item again, with the system sheet.
  const patch = item.getFlag("core", "sheetClass") === SHEET_ID ? { "flags.core.-=sheetClass": null } : {};
  if (item.img?.startsWith(`modules/${MODULE_ID}/icons/`)) patch.img = Item.DEFAULT_ICON;
  return item.update({ [`flags.${MODULE_ID}.-=phone`]: null, ...patch });
}

