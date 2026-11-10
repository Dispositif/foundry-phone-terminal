/**
 * Phones & Computers (soren-phones-computers)
 * Storytelling tool: the GM is the network.
 * - Devices = items flagged by the module (number, name, mode, contacts, history).
 * - The GM calls / texts a device; players reply, write and call.
 * - Conversations per correspondent; the address book builds up in play (+ contacts given by the GM).
 * - Messages to another PC: delivered directly (copy to GM). To an NPC: land with the GM.
 * Target: Foundry VTT v13-v14 (ApplicationV2 / DialogV2 only).
 */

import { DIRECTORY_SAMPLE, LEGACY_IDS, MODULE_ID, SHEET_ID, SOCKET } from "./constants.js";
import { ensureDeviceItems, registerPhoneSheet } from "./item-sheet.js";
import { allPhones, createPhone, getLog, getPhoneData, isFixed, isPager, markPhone, phoneUsers, randomAddress } from "./devices.js";
import { openPager } from "./pager.js";
import { transferPhone } from "./dialogs.js";
import { myPhones, updateFab } from "./fab.js";
import { PhonePanel } from "./gm-panel.js";
import { registerEnrichers, runJournalLink } from "./journal-links.js";
import { flushAll, flushPending, grantAttachments, sendSms } from "./messages.js";
import { PlayerPhone } from "./player-phone.js";
import { hangUp, ring } from "./ring.js";
import { onSocket } from "./socket.js";
import { createDemo, removeDemo } from "./demo.js";
import { isActiveGM, norm, rerenderAll } from "./util.js";
import { loadLanguages, t, tn } from "./i18n.js";

// Both languages are loaded at startup ("Module language" setting).
loadLanguages();


/* -------------------------------------------- */
/*  Opening                                     */
/* -------------------------------------------- */

export function openPanel({ tab = null } = {}) {
  if (!game.user.isGM) return ui.notifications.warn(t("Warn.GmOnlyPanel"));
  const panel = PhonePanel.instance ?? new PhonePanel();
  if (tab) panel._state.tab = tab;
  panel.render({ force: true });
  return panel;
}

export function openPhone(phoneUuid = null) {
  if (!game.user.isGM) {
    // A pager has its own window, next to the phone.
    if (phoneUuid && isPager(getPhoneData(fromUuidSync(phoneUuid)))) return openPager(phoneUuid, { latest: true });
    const mine = myPhones();
    if (!phoneUuid && mine.length && mine.every((p) => isPager(p.phone))) return mine.map((p) => openPager(p.item.uuid));
  }
  const app = PlayerPhone.instance ?? new PlayerPhone();
  if (phoneUuid) {
    app._state.phoneUuid = phoneUuid;
    app._state.view = "list";
    app._skipRead = true;
  }
  app.render({ force: true });
  return app;
}

/* -------------------------------------------- */
/*  Initialization                              */
/* -------------------------------------------- */

Hooks.once("init", () => {
  registerEnrichers();
  registerPhoneSheet();
  // Templates: {{spt "Key" var=value}} and {{sptn "Key" n}} use the module's texts (module language).
  Handlebars.registerHelper("spt", (key, options) => t(key, options?.hash ?? {}));
  Handlebars.registerHelper("sptn", (key, n) => tn(key, n));
  // Setting labels follow Foundry's language (translated by Foundry from lang/*.json).
  game.settings.register(MODULE_ID, "language", {
    name: "SPT.Settings.language.name",
    hint: "SPT.Settings.language.hint",
    scope: "world",
    config: true,
    type: String,
    choices: { auto: "SPT.Settings.language.auto", fr: "Français", en: "English" },
    default: "auto",
    requiresReload: true
  });
  game.settings.register(MODULE_ID, "volume", {
    name: "SPT.Settings.volume.name",
    hint: "SPT.Settings.volume.hint",
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0, max: 1, step: 0.05 },
    default: 0.8
  });
  game.settings.register(MODULE_ID, "ringTimeout", {
    name: "SPT.Settings.ringTimeout.name",
    hint: "SPT.Settings.ringTimeout.hint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 0, max: 120, step: 5 },
    default: 60
  });
  game.settings.register(MODULE_ID, "floatingButton", {
    name: "SPT.Settings.floatingButton.name",
    hint: "SPT.Settings.floatingButton.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => updateFab()
  });
  game.settings.register(MODULE_ID, "numberPrefix", {
    name: "SPT.Settings.numberPrefix.name",
    hint: "SPT.Settings.numberPrefix.hint",
    scope: "world",
    config: true,
    type: String,
    default: "555-"
  });
  game.settings.register(MODULE_ID, "directory", {
    scope: "world",
    config: false,
    type: String,
    default: DIRECTORY_SAMPLE,
    onChange: () => rerenderAll()
  });
  game.settings.register(MODULE_ID, "gmFloatingButton", {
    name: "SPT.Settings.gmFloatingButton.name",
    hint: "SPT.Settings.gmFloatingButton.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => updateFab()
  });
  game.settings.register(MODULE_ID, "networkDown", {
    scope: "world",
    config: false,
    type: Boolean,
    default: false,
    onChange: (down) => {
      rerenderAll();
      if (!down && isActiveGM()) flushAll();
    }
  });
  game.keybindings.register(MODULE_ID, "openPhone", {
    name: "SPT.Settings.keybinding",
    editable: [{ key: "KeyP", modifiers: ["Control", "Shift"] }],
    onDown: () => {
      if (game.user.isGM) openPanel();
      else openPhone();
      return true;
    }
  });
});

// Button in the "Tokens" toolbar (object structure of controls, v13+).
Hooks.on("getSceneControlButtons", (controls) => {
  const tokens = controls.tokens ?? controls.token;
  if (!tokens?.tools) return;
  tokens.tools.sptPhone = {
    name: "sptPhone",
    title: game.user.isGM ? t("Gm.PanelTitle") : t("MyPhone"),
    icon: game.user.isGM ? "fas fa-tower-cell" : "fas fa-phone",
    order: Object.keys(tokens.tools).length,
    button: true,
    visible: true,
    onChange: () => (game.user.isGM ? openPanel() : openPhone())
  };
});

/** Migrates data from former module ids: device flags, item sheet, world and client settings. */
export async function migrateLegacy() {
  // Client settings (language, volume): each user's browser, once.
  for (const [key, cfg] of game.settings.settings) {
    if (cfg.namespace !== MODULE_ID || cfg.scope !== "client") continue;
    try {
      if (localStorage.getItem(key) !== null) continue;
      for (const id of LEGACY_IDS) {
        const old = localStorage.getItem(`${id}.${cfg.key}`);
        if (old === null) continue;
        localStorage.setItem(key, old);
        break;
      }
    } catch {}
  }
  if (!isActiveGM()) return;
  const items = [...game.items, ...game.actors.contents.flatMap((a) => a.items.contents)];
  let n = 0;
  for (const item of items) {
    if (item._source.flags?.[MODULE_ID]?.phone) continue;
    const oldId = LEGACY_IDS.find((id) => item._source.flags?.[id]?.phone);
    if (!oldId) continue;
    // Moves the whole flag scope (phone, desc, demo), the device sheet and the model icon if they were the old module's.
    const patch = { [`flags.${MODULE_ID}`]: item._source.flags[oldId], [`flags.-=${oldId}`]: null };
    if (item._source.flags?.core?.sheetClass === `${oldId}.PhoneSheet`) patch["flags.core.sheetClass"] = SHEET_ID;
    if (item._source.img?.startsWith(`modules/${oldId}/`)) patch.img = item._source.img.replace(`modules/${oldId}/`, `modules/${MODULE_ID}/`);
    await item.update(patch);
    n++;
  }
  // World settings: migrated once, if the new module has none yet.
  let moved = 0;
  try {
    const world = game.settings.storage.get("world");
    for (const [, cfg] of game.settings.settings) {
      if (cfg.namespace !== MODULE_ID || cfg.scope !== "world") continue;
      if (world.find((s) => s.key === `${MODULE_ID}.${cfg.key}`)) continue;
      for (const id of LEGACY_IDS) {
        const old = world.find((s) => s.key === `${id}.${cfg.key}`);
        if (!old) continue;
        let value = old.value;
        if (typeof value === "string") {
          try {
            value = JSON.parse(value);
          } catch {}
        }
        await game.settings.set(MODULE_ID, cfg.key, value);
        moved++;
        break;
      }
    }
  } catch (err) {
    console.warn(`${MODULE_ID} | could not migrate settings`, err);
  }
  const oldActive = LEGACY_IDS.some((id) => game.modules.get(id)?.active);
  // Only GMs coming from the former module see this: a fresh install has nothing to migrate.
  if (n || moved || oldActive) renamedNotice(n, oldActive);
}

/** Tells the GM the module was renamed, what was recovered, and what to do with the old one. */
function renamedNotice(n, oldActive) {
  const lines = [t("Renamed.Body"), n ? t("Migrated", { n }) : "", oldActive ? `<strong>${t("Renamed.Disable")}</strong>` : t("Renamed.Uninstall")];
  foundry.applications.api.DialogV2.prompt({
    window: { title: t("Renamed.Title"), icon: "fas fa-mobile-screen" },
    content: lines.filter(Boolean).map((l) => `<p>${l}</p>`).join(""),
    ok: { label: t("Renamed.Ok") }
  }).catch(() => {});
}

Hooks.once("ready", async () => {
  game.socket.on(SOCKET, onSocket);
  await loadLanguages();
  document.body.addEventListener("click", (ev) => {
    const link = ev.target.closest?.("a.spt-link");
    if (!link || !game.user.isGM) return;
    ev.preventDefault();
    ev.stopPropagation();
    runJournalLink(link.dataset);
  });
  await migrateLegacy();
  if (game.user === game.users.activeGM) ensureDeviceItems();
  updateFab();
  game.modules.get(MODULE_ID).api = { openPanel, openPhone, ring, hangUp, sendSms, allPhones, createPhone, markPhone, transferPhone, demo: createDemo, removeDemo };
});

Hooks.on("userConnected", rerenderAll);
// Renaming the item also renames the device: they share one name.
Hooks.on("preUpdateItem", (item, changes) => {
  const phone = getPhoneData(item);
  if (!phone || typeof changes.name !== "string") return;
  foundry.utils.setProperty(changes, `flags.${MODULE_ID}.phone.label`, changes.name);
});
// Presence on a scene: who sees installed devices (terminal).
for (const hook of ["createToken", "deleteToken", "canvasReady"]) Hooks.on(hook, () => rerenderAll());
Hooks.on("updateUser", (user, changes) => {
  if (user.isSelf && "character" in changes) updateFab();
  if ("viewedScene" in changes) rerenderAll();
});
/**
 * A carried device exists only once. Dragged onto another character (Foundry copies it),
 * it changes hands with its history: the old copy is removed. Duplicated in place,
 * the copy becomes a new device with its own number. Installed devices are not affected.
 */
Hooks.on("createItem", async (item, options) => {
  if (options?.spt || !isActiveGM()) return;
  const phone = getPhoneData(item);
  if (!phone || isFixed(phone)) return;
  const twins = allPhones().filter((p) => p.item !== item && !isFixed(p.phone) && norm(p.phone.number) === norm(phone.number));
  if (!twins.length) return;
  if (twins.some((p) => p.item.parent === item.parent)) {
    await item.update({ [`flags.${MODULE_ID}.phone`]: { ...phone, number: randomAddress(phone.model), log: [], contacts: [] } });
    return;
  }
  for (const p of twins) await p.item.delete();
  const atts = getLog(phone, { includePending: true }).map((e) => e.att).filter(Boolean);
  if (item.parent instanceof Actor && atts.length) await grantAttachments(atts, phoneUsers(item.parent));
});

for (const hook of ["createItem", "updateItem", "deleteItem"]) {
  Hooks.on(hook, (item, changes) => {
    // Ownership counts too: giving a world device to players gives them access.
    const touched = hook === "updateItem" ? changes?.flags?.[MODULE_ID] !== undefined || (!!changes?.ownership && !!getPhoneData(item)) : !!getPhoneData(item);
    if (touched) rerenderAll();
    // Signal back, or switched back on: deliver what was waiting.
    const ph = changes?.flags?.[MODULE_ID]?.phone;
    if (hook === "updateItem" && isActiveGM() && (ph?.noSignal === false || (ph?.mode && ph.mode !== "off"))) flushPending(item);
  });
}

