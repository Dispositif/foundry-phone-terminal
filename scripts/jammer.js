import { ApplicationV2, DialogV2, MODULE_ID, JAM_SRC, SOCKET } from "./constants.js";
import { allJammers, getPhoneData, holders, isJammer, isJamming, jammedScenes, skinOf } from "./devices.js";
import { senderHolds } from "./gm-actions.js";
import { esc, isActiveGM, playLocal } from "./util.js";
import { t } from "./i18n.js";
/* -------------------------------------------- */
/*  Jammer: a screenless device that cuts the   */
/*  mobile network and Wi-Fi on its scene       */
/* -------------------------------------------- */

/*
 * Stored on the device flag:
 *   jamming   switch position (the light blinks while true)
 *   jamScene  scene it was switched on in (the carrier's scene at that moment)
 *   jamFailed the GM made it fail: the light still blinks, the network stays up
 * The GM mirrors it on each scene as a separate "jammed" flag (players may not see
 * the jammer's carrier). The scene's own "dead zone" flag is never touched, so
 * switching the jammer off only gives back what the jammer took.
 */

/** Jammers held by the current player. */
export function myJammers() {
  return allJammers().filter((p) => holders(p).some((u) => u.id === game.user.id));
}

/** Jammers of the current player that are switched on (floating button). */
export function myActiveJammers() {
  return myJammers().filter((p) => p.phone.jamming);
}

/** Scene a jammer is switched on in: the player's own, or (GM) its carrier's. */
function sceneFor(item) {
  if (!game.user.isGM) return game.user.viewedScene ?? canvas?.scene?.id ?? null;
  const phone = getPhoneData(item);
  const actor = item.parent instanceof Actor ? item.parent : null;
  const users = holders({ item, phone, actor });
  return users.find((u) => u.active)?.viewedScene ?? users[0]?.viewedScene ?? canvas?.scene?.id ?? null;
}

/** Flips the switch. The owner writes it; otherwise the GM does it on the player's behalf. */
export function setJamming(item, on, { moved = false } = {}) {
  const phone = getPhoneData(item);
  if (!isJammer(phone) || !!phone.jamming === on) return;
  const patch = on ? { jamming: true, jamScene: sceneFor(item), jamFailed: false } : { jamming: false };
  if (on) jamSound();
  if (item.isOwner) return item.update(flagPatch(patch), { sptBy: game.user.id, sptJamMoved: moved });
  if (game.users.activeGM) game.socket.emit(SOCKET, { type: "jammer", itemUuid: item.uuid, on, moved, sceneId: patch.jamScene ?? null, userId: game.user.id });
}

/** GM: a player who does not own the item asks to flip its switch. */
export function onJammerRequest({ itemUuid, on, moved = false, sceneId, userId }) {
  const item = fromUuidSync(itemUuid);
  if (!isJammer(getPhoneData(item)) || !senderHolds(item, userId)) return;
  const patch = on ? { jamming: true, jamScene: sceneId, jamFailed: false } : { jamming: false };
  return item.update(flagPatch(patch), { sptBy: userId, sptJamMoved: moved });
}

/** Switching a jammer on: the whole table hears it (each with their own volume). */
function jamSound() {
  playLocal(JAM_SRC);
  game.socket.emit(SOCKET, { type: "jamSound" });
}

export function onJamSound() {
  playLocal(JAM_SRC);
}

function flagPatch(patch) {
  return Object.fromEntries(Object.entries(patch).map(([k, v]) => [`flags.${MODULE_ID}.phone.${k}`, v]));
}

/** GM: the jammer fails (or works again). Its light keeps blinking either way. */
export function setJamFailed(item, failed) {
  return item.update({ [`flags.${MODULE_ID}.phone.jamFailed`]: failed });
}

/** Who switched it: the carrier's name, otherwise the player's. */
function whoName(item, userId) {
  return item.parent instanceof Actor ? item.parent.name : game.users.get(userId)?.name ?? "?";
}

function sceneName(id) {
  return game.scenes.get(id)?.name ?? "?";
}

/* -------------------------------------------- */
/*  GM side                                     */
/* -------------------------------------------- */

const alerts = new Map(); // item uuid -> dialog "jammer switched on"

function closeAlert(uuid) {
  const d = alerts.get(uuid);
  alerts.delete(uuid);
  if (d?.rendered) d.close();
}

/** A player switched a jammer on: the network is already cut; the GM may make it fail. */
function alertOn(item, phone, userId) {
  closeAlert(item.uuid);
  const who = `<strong>${esc(whoName(item, userId))}</strong>`;
  const scene = `<strong>${esc(sceneName(phone.jamScene))}</strong>`;
  const dialog = new DialogV2({
    window: { title: t("Jammer.OnTitle"), icon: "fas fa-tower-broadcast" },
    classes: ["spt-jammer-alert"],
    position: { width: 420 },
    content: `<div class="spt-jammer-alert-body"><i class="fas fa-tower-broadcast"></i><div><p>${t("Jammer.OnBody", { who, scene })}</p><p class="hint">${t("Jammer.OnHint")}</p></div></div>`,
    buttons: [
      { action: "keep", label: t("Jammer.Keep"), icon: "fas fa-check", default: true },
      { action: "fail", label: t("Jammer.Fail"), icon: "fas fa-ban" }
    ],
    submit: (result) => {
      alerts.delete(item.uuid);
      if (result === "fail" && getPhoneData(item)?.jamming) setJamFailed(item, true);
    }
  });
  alerts.set(item.uuid, dialog);
  dialog.render({ force: true });
}

/** GM: each scene's "jammed" flag follows the jammers (the dead-zone hooks then deliver what was waiting). */
export async function syncJammedScenes() {
  if (!isActiveGM()) return;
  const jammed = jammedScenes();
  for (const scene of game.scenes) {
    const want = jammed.has(scene.id);
    if (!!scene.getFlag(MODULE_ID, "jammed") !== want) await scene.update({ [`flags.${MODULE_ID}.jammed`]: want });
  }
}

function onUpdate(item, changes, options, userId) {
  const ph = changes?.flags?.[MODULE_ID]?.phone;
  if (ph?.jamming === undefined && ph?.jamFailed === undefined && ph?.jamScene === undefined) return;
  const phone = getPhoneData(item);
  if (!isJammer(phone)) return;
  rerenderJammers();
  syncJammedScenes();
  if (!isActiveGM() || ph.jamming === undefined) return;
  const by = options?.sptBy ?? userId;
  const byGm = !!game.users.get(by)?.isGM;
  if (ph.jamming) {
    if (!byGm) alertOn(item, phone, by);
    return;
  }
  closeAlert(item.uuid);
  // Switched off: only worth telling if it was really cutting the network.
  if (phone.jamFailed || !phone.jamScene || (byGm && !options?.sptJamMoved)) return;
  const key = options?.sptJamMoved ? "Jammer.OffMoved" : "Jammer.Off";
  ui.notifications.info(t(key, { who: whoName(item, by), scene: sceneName(phone.jamScene) }));
}

function onDelete(item) {
  if (!isActiveGM()) return;
  const phone = getPhoneData(item);
  if (!isJammer(phone)) return;
  closeAlert(item.uuid);
  if (isJamming(phone)) syncJammedScenes();
}

/** A jammer dropped on another character arrives switched off. */
function onCreate(item) {
  if (!isActiveGM() || !getPhoneData(item)?.jamming || !isJammer(getPhoneData(item))) return;
  item.update({ [`flags.${MODULE_ID}.phone.jamming`]: false }, { sptBy: game.user.id });
}

/** The carrier changes scene: the jammer switches off by itself (a forgotten jammer would cut the next scene). */
function onUserMoved(user, changes) {
  if (!isActiveGM() || user.isGM || !("viewedScene" in changes)) return;
  for (const p of allJammers()) {
    if (!p.phone.jamming || p.phone.jamScene === changes.viewedScene) continue;
    if (!holders(p).some((u) => u.id === user.id)) continue;
    p.item.update({ [`flags.${MODULE_ID}.phone.jamming`]: false }, { sptBy: user.id, sptJamMoved: true });
  }
}

/**
 * Player side: the carrier's own screen shows another scene, so their jammer switches off.
 * Does not depend on the GM seeing the scene change.
 */
function onCanvasReady() {
  if (game.user.isGM) return;
  const sceneId = canvas?.scene?.id;
  if (!sceneId) return;
  for (const p of myJammers()) {
    if (p.phone.jamming && p.phone.jamScene && p.phone.jamScene !== sceneId) setJamming(p.item, false, { moved: true });
  }
}

export function registerJammerHooks() {
  Hooks.on("canvasReady", onCanvasReady);
  Hooks.on("updateItem", onUpdate);
  Hooks.on("deleteItem", onDelete);
  Hooks.on("createItem", onCreate);
  // A carrier deleted with its jammer on (its items get no delete hook).
  Hooks.on("deleteActor", () => syncJammedScenes());
  Hooks.once("ready", syncJammedScenes);
  Hooks.on("updateUser", onUserMoved);
}

/* -------------------------------------------- */
/*  Window: no screen, a light, a switch, a dial */
/* -------------------------------------------- */

// Fake dial position per jammer (this browser only: it does nothing).
const dials = new Map();

export class JammerWindow extends ApplicationV2 {
  static windows = new Map(); // item uuid -> window

  static DEFAULT_OPTIONS = {
    classes: ["spt-player-phone", "spt-jammer-window", "spt-framed"],
    window: { title: "Jammer", icon: "fas fa-tower-broadcast", resizable: false },
    position: { width: 200, height: "auto" },
    actions: {
      toggle: function () {
        const item = this.item;
        if (item) setJamming(item, !getPhoneData(item)?.jamming);
      },
      dial: function (event, target) {
        const a = ((dials.get(this.uuid) ?? 0) + 45) % 360;
        dials.set(this.uuid, a);
        target.style.setProperty("--spt-dial", `${a}deg`);
      },
      fail: function () {
        const item = this.item;
        if (item) setJamFailed(item, !getPhoneData(item)?.jamFailed);
      }
    }
  };

  constructor(uuid, options = {}) {
    super({ ...options, id: `spt-jammer-${uuid.replace(/[^\w-]/g, "-")}` });
    this.uuid = uuid;
  }

  get item() {
    return fromUuidSync(this.uuid);
  }

  get title() {
    return getPhoneData(this.item)?.label ?? t("Model.jammer");
  }

  /** GM only: what the jammer is really doing. */
  _gmStatus(phone) {
    if (!game.user.isGM) return "";
    let text = t("Jammer.StatusOff");
    let btn = "";
    if (phone.jamming && phone.jamFailed) {
      text = t("Jammer.StatusFailed");
      btn = `<button type="button" data-action="fail">${t("Jammer.Repair")}</button>`;
    } else if (phone.jamming) {
      text = t("Jammer.StatusOn", { scene: esc(sceneName(phone.jamScene)) });
      btn = `<button type="button" data-action="fail">${t("Jammer.Fail")}</button>`;
    }
    return `<div class="spt-jammer-gm">${text}${btn}</div>`;
  }

  async _renderHTML() {
    const phone = getPhoneData(this.item);
    if (!phone) return `<div class="spt-jammer"></div>`;
    const on = !!phone.jamming;
    const dial = dials.get(this.uuid) ?? 0;
    return `<div class="spt-jammer ${on ? "on" : ""}">
        <div class="spt-jammer-grille" aria-hidden="true"></div>
        <div class="spt-jammer-row">
          <span class="spt-jammer-led ${on ? "on" : ""}" aria-hidden="true"></span>
          <span class="spt-jammer-sw"><button type="button" class="spt-jammer-switch ${on ? "on" : ""}" data-action="toggle" aria-pressed="${on}" title="${on ? t("Jammer.TurnOff") : t("Jammer.TurnOn")}" aria-label="${on ? t("Jammer.TurnOff") : t("Jammer.TurnOn")}"><span></span></button>OFF · ON</span>
          <button type="button" class="spt-jammer-dial" data-action="dial" style="--spt-dial: ${dial}deg" title="${t("Jammer.Dial")}" aria-label="${t("Jammer.Dial")}"></button>
        </div>
        ${this._gmStatus(phone)}
      </div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const content = this.element.querySelector(".window-content");
    if (content && !this.element.querySelector(".spt-jammer-antennas")) {
      content.insertAdjacentHTML("beforebegin", `<span class="spt-frame-deco spt-jammer-antennas"><i></i><i></i><i></i></span>`);
    }
    // Neon look (Cyberpunk): black body, magenta edge, cyan details.
    const phone = getPhoneData(this.item);
    this.element.classList.toggle("spt-jammer-neon", !!phone && skinOf(phone) === "neon");
  }

  _onClose(options) {
    super._onClose?.(options);
    JammerWindow.windows.delete(this.uuid);
  }
}

/** Opens (or brings forward) a jammer's window. */
export function openJammer(uuid) {
  if (!uuid || !isJammer(getPhoneData(fromUuidSync(uuid)))) return null;
  let w = JammerWindow.windows.get(uuid);
  if (!w) {
    w = new JammerWindow(uuid);
    JammerWindow.windows.set(uuid, w);
  }
  w.render({ force: true });
  if (w.rendered) w.bringToFront?.();
  return w;
}

export function rerenderJammers() {
  for (const w of JammerWindow.windows.values()) if (w.rendered) w.render();
}
