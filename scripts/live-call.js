import { ApplicationV2, HANGUP_SRC, MODULE_ID, SECURE_SRC, SOCKET } from "./constants.js";
import { getPhoneData, isFixed, patchLog } from "./devices.js";
import { esc, isActiveGM, isMasked, playLocal, rerenderAll } from "./util.js";
import { t } from "./i18n.js";
import { PlayerPhone } from "./player-phone.js";
import { failCall, hangUp } from "./ring.js";
import { outgoing } from "./player-calls.js";
/* -------------------------------------------- */
/*  Live call: once answered, the whole table   */
/*  sees who is on the phone (black window).    */
/* -------------------------------------------- */

export const liveCalls = new Map(); // callId -> { callId, a, b, since, ended? } (a = caller, b = callee, since = answer time, server clock)
const windows = new Map(); // callId -> LiveCallWindow
const ENDED_MS = 10000; // how long "Call ended" stays shown, with the stopped timer

/**
 * GM: one agent's end of the call.
 * name/img/sub: the agent, their device (and place for an installed one).
 * seen: how the other agent's device names them (contact or number), set by the caller of startLive.
 */
export function agentSide(item, userId) {
  const phone = getPhoneData(item);
  const user = game.users.get(userId);
  const actor = item?.parent instanceof Actor ? item.parent : user?.character ?? null;
  const place = isFixed(phone) ? game.scenes.get(phone.sceneId)?.name : null;
  const name = actor?.name ?? user?.name ?? "?";
  return { pc: true, compromised: !!phone?.compromised, secure: !!phone?.secure, name, img: actor?.img ?? null, sub: [phone?.label, place].filter(Boolean).join(", "), seen: name, number: String(phone?.number ?? ""), userIds: userId ? [userId] : [], itemUuid: item?.uuid ?? null };
}

/**
 * GM: the NPC end. seen = name on the agent's device, gm = name for the GM (NPC directory).
 * secure = the GM speaks for the NPC on a secure line.
 */
export function npcSide(number, seen, gm = seen, secure = false) {
  return { pc: false, number: String(number ?? ""), seen, gm, secure: !!secure, userIds: [], itemUuid: null };
}

/** A secure line: both ends are secure (encrypted) devices, or a secure NPC. */
export function secureLine(a, b) {
  return !!(a?.secure && b?.secure);
}

/** Server clock: the same on every client, so the timers agree (and survive a reload). */
const now = () => game.time?.serverTime ?? Date.now();

/** GM: the call was answered. Opens the window for everyone. */
export function startLive(callId, a, b) {
  const data = { callId, a, b, since: now(), secure: secureLine(a, b) };
  game.socket.emit(SOCKET, { type: "liveStart", ...data });
  openLive(data, { answered: true });
  saveLive();
}

/**
 * Calls in progress are kept in a hidden world setting, so a reload (player or GM)
 * finds them again: the call screen, the window, the hang-up button, the timer.
 */
function saveLive() {
  if (!isActiveGM()) return;
  const keep = {};
  for (const d of liveCalls.values()) if (!d.ended && !d.dialing) keep[d.callId] = { callId: d.callId, a: d.a, b: d.b, since: d.since, secure: !!d.secure };
  game.settings.set(MODULE_ID, "liveCalls", keep);
}

/** On load: reopens the calls in progress (more than an hour old: forgotten). */
export function restoreLive() {
  const stored = game.settings.get(MODULE_ID, "liveCalls") ?? {};
  let stale = false;
  for (const data of Object.values(stored)) {
    if (now() - data.since > 3600 * 1000) stale = true;
    else if (!liveCalls.has(data.callId)) openLive(data);
  }
  if (stale) saveLive();
}

/** A call in progress (or ringing, as far as this client knows): the network takes one call at a time. */
export function lineBusy({ ringing = false } = {}) {
  return [...liveCalls.values()].some((d) => !d.ended && (ringing || !d.dialing));
}

/** answered: the call was just picked up (not a reload), so a secure line beeps for the two ends. */
export function openLive(data, { answered = false } = {}) {
  data = { ...data, since: data.since ?? now() };
  delete data.type;
  liveCalls.set(data.callId, data);
  if (answered && data.secure && (game.user.isGM || mySide(data))) playLocal(SECURE_SRC);
  startTicker();
  // A spectator's window opened while it was ringing: now on the line.
  const dialWindow = windows.get(data.callId);
  if (dialWindow?.rendered) dialWindow.render();
  const item = onSmartphone(data);
  if (item) {
    // No window for an agent on the line with a smartphone or mobile (a stray one closes).
    const stray = windows.get(data.callId);
    windows.delete(data.callId);
    if (stray?.rendered) stray.close();
    // On a smartphone or mobile, the call shows on the device itself: open it (or bring it forward).
    const app = PlayerPhone.instance ?? new PlayerPhone();
    app._state.phoneUuid = item.uuid;
    app._skipRead = true;
    app.render({ force: true }).then(() => app.bringToFront?.());
  } else openWindow(data.callId);
  rerenderAll();
}

function openWindow(callId) {
  if (windows.get(callId)?.rendered) return;
  const app = new LiveCallWindow(callId);
  windows.set(callId, app);
  app.render({ force: true });
}

/** The smartphone or mobile this player is on the line with, if any (the call shows on its screen). */
function onSmartphone(data) {
  const mine = mySide(data);
  const item = mine?.itemUuid ? fromUuidSync(mine.itemUuid) : null;
  return ["smartphone", "mobile"].includes(getPhoneData(item)?.model) ? item : null;
}

/* Dialing: as soon as an agent calls, the rest of the table sees who is calling. */
const noDial = new Set(); // calls this player is called on: no spectator window

/** Spectators: an agent dials (the caller and the GM have their own windows). */
export function openDial({ callId, exclude = [], name, img }) {
  if (game.user.isGM || exclude.includes(game.user.id)) return;
  // A short wait: if this player is the one being called, their ring arrives first and no window opens.
  setTimeout(() => {
    if (noDial.has(callId) || ended.has(callId)) return;
    const a = { pc: true, name, img: img ?? null, userIds: [] };
    const known = liveCalls.get(callId);
    if (known?.dialing && !known.a?.pc) {
      // The other agent's phone already rings here: now we know who calls.
      known.a = a;
      windows.get(callId)?.render();
      return;
    }
    if (known) return;
    liveCalls.set(callId, { callId, a, b: null, dialing: true });
    openWindow(callId);
  }, 800);
}

/** Spectators: an agent's phone rings out loud (not in silent mode). Their portrait joins the window. */
export function openRinging({ callId, exclude = [], name, img }) {
  // The caller is not a spectator: their own device shows the call.
  if (game.user.isGM || exclude.includes(game.user.id) || noDial.has(callId) || outgoing?.callId === callId) return;
  const b = { pc: true, name, img: img ?? null, userIds: [] };
  const known = liveCalls.get(callId);
  if (known && !known.dialing) return;
  if (known) {
    known.b = b;
    known.ringing = true;
    windows.get(callId)?.render();
    return;
  }
  // Called by an NPC (the GM): an unknown caller.
  liveCalls.set(callId, { callId, a: UNKNOWN, b, dialing: true, ringing: true });
  openWindow(callId);
}

const UNKNOWN = { pc: false, seen: "", number: "", userIds: [] };

/** GM: the call window while it rings (calling as an NPC: hang-up button; between agents: "network unavailable"). */
export function openGmRing(callId, a, b) {
  liveCalls.set(callId, { callId, a, b, dialing: true, ringing: true, secure: secureLine(a, b) });
  openWindow(callId);
}

const ended = new Set(); // calls stopped before the spectator window opened

/** Not answered (or hung up while ringing): the spectator window closes. Answered: it stays, on the line. */
export function closeDial(callId) {
  if (!liveCalls.has(callId)) {
    ended.add(callId);
    setTimeout(() => ended.delete(callId), 5000);
  }
  if (!liveCalls.get(callId)?.dialing) return;
  liveCalls.delete(callId);
  const app = windows.get(callId);
  windows.delete(callId);
  if (app?.rendered) app.close();
}

/** This player's phone rings for this call: they are not a spectator of it. */
export function calledOn(callId) {
  noDial.add(callId);
  setTimeout(() => noDial.delete(callId), 600000);
  closeDial(callId);
}

/**
 * The player closed their smartphone during the call: the call window takes over,
 * so they do not forget they are still on the line.
 */
export function phoneClosed() {
  for (const data of liveCalls.values()) if (!data.ended && onSmartphone(data)) openWindow(data.callId);
}

function mySide(data) {
  return [data.a, data.b].find((s) => s?.userIds.includes(game.user.id)) ?? null;
}

/* Elapsed time since the answer, refreshed every second wherever it is shown. */
let ticker = null;
function startTicker() {
  if (ticker) return;
  ticker = setInterval(() => {
    if (!liveCalls.size) {
      clearInterval(ticker);
      ticker = null;
      return;
    }
    for (const el of document.querySelectorAll(".spt-live-timer[data-call]")) {
      const data = liveCalls.get(el.dataset.call);
      if (data && !data.ended) el.textContent = elapsed(data);
    }
  }, 1000);
}

/** "MM:SS" (or "H:MM:SS") since the answer; stopped once the call has ended. */
export function elapsed(data) {
  if (data.ended) return data.ended.time;
  return clock(Math.max(0, Math.floor((now() - data.since) / 1000)));
}

export function clock(s) {
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function timerHtml(data) {
  return `<span class="spt-live-timer" data-call="${esc(data.callId)}">${elapsed(data)}</span>`;
}

/** Status line: on the line (green, running timer), or ended / cut off (stopped timer). */
export function statusHtml(data) {
  // Secure line: shown to the two ends and the GM (the rest of the table cannot tell).
  const secure = data.secure && (game.user.isGM || mySide(data)) ? ` <span class="spt-live-secure" title="${t("Secure.LineHint")}"><i class="fas fa-shield-halved"></i> ${t("Secure.Line")}</span>` : "";
  if (data.dialing) return `<span class="spt-live-state dialing"><i class="fas fa-circle"></i> ${t(data.ringing ? "Call.Ringing" : "Call.Calling")}</span>${secure}`;
  // A cut line looks like a plain hang-up to the players: only the GM knows.
  const cut = data.ended?.reason === "cut" && game.user.isGM;
  const label = !data.ended ? t("Live.OnLine") : cut ? t("Live.Cut") : t("Live.Ended");
  return `<span class="spt-live-state ${data.ended ? `ended ${cut ? "cut" : ""}` : ""}"><i class="fas fa-circle"></i> ${label}</span> ${timerHtml(data)}${secure}`;
}

/**
 * Ends the call for everyone. reason = "hangup" (an agent, or the GM for the NPC)
 * or "cut" (the GM cuts the line: network failure, an enemy who controls the network).
 */
export function hangUpLive(callId, reason = "hangup") {
  if (!liveCalls.get(callId) || liveCalls.get(callId).ended) return;
  game.socket.emit(SOCKET, { type: "liveEnd", callId, reason });
  endLive(callId, reason);
}

export function endLive(callId, reason = "hangup") {
  const data = liveCalls.get(callId);
  if (!data || data.ended) return;
  // Stays shown for a moment, timer stopped, in the windows still open and on the device screens.
  data.ended = { reason, time: elapsed({ ...data, ended: null }) };
  // GM: the call's duration goes into the devices' history (GM calls list).
  if (isActiveGM()) {
    const dur = Math.round((now() - data.since) / 1000);
    for (const side of [data.a, data.b]) {
      const item = side?.itemUuid ? fromUuidSync(side.itemUuid) : null;
      if (item) patchLog(item, (e) => e.call === callId && e.result === "answer", { dur });
    }
  }
  saveLive();
  // The agents on the line and the GM hear the hang-up fully, the rest of the table softer.
  playLocal(HANGUP_SRC, { gain: game.user.isGM || mySide(data) ? 1 : 0.7 });
  const app = windows.get(callId);
  if (app?.rendered) app.render();
  rerenderAll();
  setTimeout(() => {
    liveCalls.delete(callId);
    windows.delete(callId);
    if (app?.rendered) app.close();
    rerenderAll();
  }, ENDED_MS);
}

/** The call this player is (or just was) on with this device, if any. */
export function liveOn(itemUuid) {
  for (const data of liveCalls.values()) {
    if (data.ended && data.dismissed) continue;
    const side = [data.a, data.b].find((s) => s?.itemUuid && s.itemUuid === itemUuid && s.userIds.includes(game.user.id));
    if (side) return data;
  }
  return null;
}

/** "Call ended" on the device screen: the player closes it before it goes by itself. */
export function dismissEnded(callId) {
  const data = liveCalls.get(callId);
  if (!data?.ended) return;
  data.dismissed = true;
  rerenderAll();
}

/** The other end, as this player's device shows it: { name, img, sub, pc }. */
export function otherEnd(data) {
  const other = mySide(data) === data.a ? data.b : data.a;
  return display(data, other);
}

/** What this client shows for one end of the call. */
function display(data, side) {
  const user = game.user;
  const mine = mySide(data);
  const number = (name) => (isMasked(side.number) || side.number === name ? "" : side.number);
  if (user.isGM) return side.pc ? { name: side.name, img: side.img, sub: side.sub, pc: true, compromised: side.compromised } : { name: side.gm, sub: number(side.gm) };
  // On the line: the other end as their own device names it (contact, otherwise number), with the face if it is an agent.
  if (mine) return { name: side.seen, img: side.pc ? side.img : null, sub: number(side.seen), pc: side.pc };
  // The rest of the table hears one side only: an NPC stays unknown.
  return side.pc ? { name: side.name, img: side.img, pc: true } : { name: t("Live.Unknown") };
}

class LiveCallWindow extends ApplicationV2 {
  constructor(callId) {
    super({ id: `spt-live-${callId}` });
    this.callId = callId;
  }

  static DEFAULT_OPTIONS = {
    classes: ["spt-live"],
    window: { title: "SPT.Live.Title", icon: "fas fa-phone" },
    position: { width: 480 },
    actions: {
      hangup: function () {
        // GM, while it rings: cancels the call. On the line: hangs up for everyone.
        if (liveCalls.get(this.callId)?.dialing) hangUp(this.callId);
        else hangUpLive(this.callId);
      },
      cut: function () { hangUpLive(this.callId, "cut"); },
      netFail: function () { failCall(this.callId); },
      dismiss: function () { this.close(); }
    }
  };

  async _renderHTML() {
    const data = liveCalls.get(this.callId);
    if (!data) return "";
    const mine = mySide(data);
    const person = (side, ringing = false) => {
      const d = display(data, side);
      const face = d.pc && d.img ? `<div class="spt-live-face" style="background-image:url('${esc(d.img)}')"></div>` : `<div class="spt-live-face unknown"><i class="fas fa-user"></i></div>`;
      // GM only: a compromised device on the line (tapped, known to the enemy).
      const warn = d.compromised ? `<div class="spt-live-warn"><i class="fas fa-triangle-exclamation"></i> ${t("Live.Tapped")}</div>` : "";
      return `<div class="spt-live-person ${d.pc ? "pc" : ""} ${ringing ? "ringing" : ""}">${face}<div class="spt-live-name">${esc(d.name)}</div>${d.sub ? `<div class="spt-live-sub">${esc(d.sub)}</div>` : ""}${warn}</div>`;
    };
    // The agents on the line hang up; the GM hangs up for the NPC and can cut the line.
    // The rest of the table only watches: the window's cross is enough to close it.
    if (data.dialing) {
      // While it rings: who calls and whose phone rings (unknown until known).
      // The GM hangs up for the NPC; between agents, the network can fail (the caller gets a network error).
      const between = data.a?.pc && data.b?.pc;
      const gmButton = between
        ? `<button type="button" class="spt-live-netfail" data-action="netFail" title="${t("Live.NetFailHint")}"><i class="fas fa-skull"></i> ${t("Live.NetFail")}</button>`
        : `<button type="button" class="spt-live-hangup" data-action="hangup"><i class="fas fa-phone-slash"></i> ${t("Call.HangUp")}</button>`;
      const hang = game.user.isGM ? `<div class="spt-live-buttons">${gmButton}</div>` : "";
      return `<div class="spt-live-body dialing">
        <div class="spt-live-icon"><i class="fas fa-phone-volume"></i></div>
        <div class="spt-live-status">${statusHtml(data)}</div>
        <div class="spt-live-duo">${person(data.a ?? UNKNOWN)}<span class="spt-live-link"></span>${person(data.b ?? UNKNOWN, !!data.ringing && !!data.b?.pc)}</div>
        ${hang}
      </div>`;
    }
    const npc = !data.a.pc || !data.b.pc;
    const buttons = [];
    if (mine || (game.user.isGM && npc)) buttons.push(`<button type="button" class="spt-live-hangup" data-action="hangup"><i class="fas fa-phone-slash"></i> ${t("Call.HangUp")}</button>`);
    if (game.user.isGM) buttons.push(`<button type="button" class="spt-live-cut" data-action="cut" title="${t("Live.CutHint")}"><i class="fas fa-skull"></i> ${t("Live.CutLine")}</button>`);
    const button = buttons.length && !data.ended ? `<div class="spt-live-buttons">${buttons.join("")}</div>` : "";
    // The agent on the line knows who they play: only the other end.
    const duo = mine ? person(mine === data.a ? data.b : data.a) : `${person(data.a)}<span class="spt-live-link"></span>${person(data.b)}`;
    // Players only learn the line went dead; the skull stays the GM's.
    const icon = !data.ended ? "fa-phone-volume" : data.ended.reason === "cut" && game.user.isGM ? "fa-skull" : "fa-phone-slash";
    // Once ended, a click anywhere closes it (it also closes by itself).
    return `<div class="spt-live-body ${data.ended ? "ended" : ""}" ${data.ended ? `data-action="dismiss"` : ""}>
        <div class="spt-live-icon"><i class="fas ${icon}"></i></div>
        <div class="spt-live-status">${statusHtml(data)}</div>
        <div class="spt-live-duo">${duo}</div>
        ${button}
      </div>`;
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }

  _onClose(options) {
    super._onClose(options);
    if (windows.get(this.callId) === this) windows.delete(this.callId);
  }
}
