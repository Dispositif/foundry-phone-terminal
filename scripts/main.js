/**
 * Phone & Terminal (soren-phone-terminal)
 * Storytelling tool: the GM is the network.
 * - Devices = items flagged by the module (number, name, mode, contacts, history).
 * - The GM calls / texts a device; players reply, write and call.
 * - Conversations per correspondent; the address book builds up in play (+ contacts given by the GM).
 * - Messages to another PC: delivered directly (copy to GM). To an NPC: land with the GM.
 * Target: Foundry VTT v13-v14 (ApplicationV2 / DialogV2 only).
 */

import { DIRECTORY_SAMPLE, LEGACY_IDS, MODULE_ID, SOCKET } from "./constants.js";
import { ensureDeviceItems, registerPhoneSheet } from "./item-sheet.js";
import { allPhones, createPhone, getLog, getPhoneData, isFixed, markPhone, phoneUsers, randomAddress } from "./devices.js";
import { transferPhone } from "./dialogs.js";
import { updateFab } from "./fab.js";
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
  game.settings.register(MODULE_ID, "smsEnabled", {
    name: "SPT.Settings.smsEnabled.name",
    hint: "SPT.Settings.smsEnabled.hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    onChange: () => rerenderAll()
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

/** Migrates data from former versions (devices and world settings). */
export async function migrateLegacy() {
  if (!isActiveGM()) return;
  const items = [...game.items, ...game.actors.contents.flatMap((a) => a.items.contents)];
  let n = 0;
  for (const item of items) {
    if (item._source.flags?.[MODULE_ID]?.phone) continue;
    const oldId = LEGACY_IDS.find((id) => item._source.flags?.[id]?.phone);
    if (!oldId) continue;
    await item.update({ [`flags.${MODULE_ID}.phone`]: item._source.flags[oldId].phone, [`flags.-=${oldId}`]: null });
    n++;
  }
  // World settings: migrated once, if the new module has none yet.
  try {
    const world = game.settings.storage.get("world");
    for (const key of ["smsEnabled", "floatingButton", "ringTimeout", "networkDown"]) {
      if (world.find((s) => s.key === `${MODULE_ID}.${key}`)) continue;
      for (const id of LEGACY_IDS) {
        const old = world.find((s) => s.key === `${id}.${key}`);
        if (!old) continue;
        let value = old.value;
        if (typeof value === "string") {
          try {
            value = JSON.parse(value);
          } catch {}
        }
        await game.settings.set(MODULE_ID, key, value);
        break;
      }
    }
  } catch (err) {
    console.warn(`${MODULE_ID} | could not migrate settings`, err);
  }
  if (n) ui.notifications.info(`📱 Phone & Terminal : ${t("Migrated", { n })}`);
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
    // Signal back for this device: deliver what was waiting.
    if (hook === "updateItem" && changes?.flags?.[MODULE_ID]?.phone?.noSignal === false && isActiveGM()) flushPending(item);
  });
}

