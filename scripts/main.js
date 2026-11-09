/**
 * Phone & Terminal (soren-phone-terminal)
 * Outil narratif : le MJ est le réseau.
 * - Téléphones = objets marqués par le module (numéro, nom, mode, contacts, historique).
 * - Le MJ appelle / écrit à un téléphone ; les joueurs répondent, écrivent et appellent.
 * - Conversations par correspondant ; le carnet se construit en jouant (+ contacts donnés par le MJ).
 * - Messages vers un autre PJ : livrés directement (copie MJ). Vers un PNJ : arrivent chez le MJ.
 * Cible : Foundry VTT v13-v14 (ApplicationV2 / DialogV2 uniquement).
 */

import { LEGACY_IDS, MODULE_ID, SOCKET } from "./constants.js";
import { allPhones, createPhone, getPhoneData, markPhone } from "./devices.js";
import { transferPhone } from "./dialogs.js";
import { updateFab } from "./fab.js";
import { PhonePanel } from "./gm-panel.js";
import { registerEnrichers, runJournalLink } from "./journal-links.js";
import { flushAll, flushPending, sendSms } from "./messages.js";
import { PlayerPhone } from "./player-phone.js";
import { hangUp, ring } from "./ring.js";
import { onSocket } from "./socket.js";
import { createDemo, removeDemo } from "./demo.js";
import { isActiveGM, rerenderAll } from "./util.js";
import { loadLanguages, t } from "./i18n.js";

// Les deux langues sont chargées dès le démarrage (réglage « Langue du module »).
loadLanguages();


/* -------------------------------------------- */
/*  Ouverture                                   */
/* -------------------------------------------- */

export function openPanel() {
  if (!game.user.isGM) return ui.notifications.warn(t("Warn.GmOnlyPanel"));
  const panel = PhonePanel.instance ?? new PhonePanel();
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
/*  Initialisation                              */
/* -------------------------------------------- */

Hooks.once("init", () => {
  registerEnrichers();
  // Les libellés des réglages suivent la langue de Foundry (traduits par Foundry depuis lang/*.json).
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
    default: 30
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

// Bouton dans la barre d'outils « Jetons » (structure objet des contrôles, v13+).
Hooks.on("getSceneControlButtons", (controls) => {
  const tokens = controls.tokens ?? controls.token;
  if (!tokens?.tools) return;
  tokens.tools.sptPhone = {
    name: "sptPhone",
    title: game.user.isGM ? t("Gm.PanelTitle") : t("MyPhone"),
    icon: "fas fa-mobile-screen",
    order: Object.keys(tokens.tools).length,
    button: true,
    visible: true,
    onChange: () => (game.user.isGM ? openPanel() : openPhone())
  };
});

/** Reprend les données des anciennes versions (appareils et réglages du monde). */
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
  // Réglages du monde : repris une seule fois, si le nouveau module n'en a pas encore.
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
  migrateLegacy();
  updateFab();
  game.modules.get(MODULE_ID).api = { openPanel, openPhone, ring, hangUp, sendSms, allPhones, createPhone, markPhone, transferPhone, demo: createDemo, removeDemo };
});

Hooks.on("userConnected", rerenderAll);
// Présence sur une scène : qui voit les appareils fixes (terminal).
for (const hook of ["createToken", "deleteToken", "canvasReady"]) Hooks.on(hook, () => rerenderAll());
Hooks.on("updateUser", (user, changes) => {
  if (user.isSelf && "character" in changes) updateFab();
  if ("viewedScene" in changes) rerenderAll();
});
for (const hook of ["createItem", "updateItem", "deleteItem"]) {
  Hooks.on(hook, (item, changes) => {
    const touched = hook === "updateItem" ? changes?.flags?.[MODULE_ID] !== undefined : !!getPhoneData(item);
    if (touched) rerenderAll();
    // Réseau rétabli pour ce téléphone : on livre ce qui attendait.
    if (hook === "updateItem" && changes?.flags?.[MODULE_ID]?.phone?.noSignal === false && isActiveGM()) flushPending(item);
  });
}

