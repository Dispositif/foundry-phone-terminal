import { MASKED, MODULE_ID, RESULT_LABELS, SOCKET } from "./constants.js";
import { addLog, defaultDeviceFor, displayName, findContact, getPhoneData, hasSignal, holders, isFixed, isLandline, keyFor, modelOf, npcNumber, phoneLabel, phonesByNumber, skinOf, modeOf } from "./devices.js";
import { maskedLabel, rerenderAll } from "./util.js";
import { t } from "./i18n.js";
import { agentSide, closeDial, lineBusy, npcSide, openGmRing, startLive } from "./live-call.js";
import { gmIncoming } from "./gm-actions.js";
/* -------------------------------------------- */
/*  Calls ringing at players                    */
/* -------------------------------------------- */

// callId -> { caller, label, open: Map<userId, itemUuid|null>, origin, lastResult }
export const pendingCalls = new Map();

/**
 * Rings a device (target = "phone:<number>") or a player ("user:<id>").
 * origin = { userId, itemUuid, callId, key, name } when the call comes from another PC.
 */
/** The network takes one call at a time: one ringing or in progress, anywhere. */
export function networkBusy() {
  return pendingCalls.size > 0 || gmIncoming.size > 0 || lineBusy();
}

export async function ring(target, { caller = MASKED, origin = null, callId = foundry.utils.randomID() } = {}) {
  if (!game.user.isGM) return ui.notifications.warn(t("Warn.GmOnlyCall"));
  // GM calling while another call rings or is in progress: the network is busy.
  if (!origin && networkBusy()) return ui.notifications.warn(t("Warn.NetworkBusy"));
  const [kind, value] = String(target).split(/:(.*)/s);
  const timeout = game.settings.get(MODULE_ID, "ringTimeout");
  // A directory name rings as its number, so the agent's own contact name shows on their device.
  const call = { caller, from: npcNumber(caller), label: value, open: new Map(), origin, lastResult: "nobody" };

  const emitRing = (userId, extra) => {
    call.open.set(userId, extra.itemUuid ?? null);
    game.socket.emit(SOCKET, { type: "ring", targetUserId: userId, callId, timeout, ...extra });
  };

  if (kind === "user") {
    const user = game.users.get(value);
    if (!user) return ui.notifications.warn(t("Warn.PlayerNotFound"));
    // The player's character phone (created with the default model if needed) rings like any device.
    const p = await defaultDeviceFor(user);
    if (p) return ring(`phone:${p.phone.number}`, { caller, origin, callId });
    // No assigned character to carry a phone: nothing rings.
    return ui.notifications.warn(t("Warn.NoCharacter", { name: user.name }));
  } else {
    const phones = phonesByNumber(value).filter((p) => p.item.uuid !== origin?.itemUuid);
    if (!phones.length) {
      if (origin) return finishOrigin(origin, "unassigned");
      return ui.notifications.warn(t("Warn.NoDevice", { value }));
    }
    for (const p of phones) {
      const mode = modeOf(p.phone);
      const users = holders(p, { activeOnly: true });
      if (modelOf(p.phone).noCalls) {
        call.lastResult = "unassigned";
        if (!origin) ui.notifications.warn(`💻 ${phoneLabel(p)} : ${t(modelOf(p.phone).mail ? "Warn.ComputerNoCalls" : "Warn.NoCalls")}`);
        continue;
      }
      const result = !hasSignal(p.phone) ? "nosignal" : mode === "off" ? "off" : !users.length ? "nobody" : null;
      if (result) {
        call.lastResult = result;
        if (!origin) {
          ui.notifications.warn(`📱 ${phoneLabel(p)} : ${RESULT_LABELS[result]}.`);
        }
        // Without signal, the missed call only shows when signal returns.
        addLog(p.item, { kind: "call", call: callId, dir: "in", with: keyFor(p.phone, call.from), result: "missed", read: false, pending: result === "nosignal" || result === "off" });
        continue;
      }
      for (const u of users) {
        const model = modelOf(p.phone);
        emitRing(u.id, {
          caller: modelOf(p.phone).callerId ? displayName(p.phone, call.from) : null,
          callerNumber: landlineNumber(p, call.from),
          callerImg: knownCallerFace(p, call.from, origin),
          itemUuid: p.item.uuid,
          phoneLabel: isLandline(p.phone) && game.scenes.get(p.phone.sceneId) ? `${p.phone.label} (${game.scenes.get(p.phone.sceneId).name})` : p.phone.label,
          silent: mode === "silent",
          ringSrc: model.ring
        });
      }
      // Narration: every other player hears a carried phone ring (ring mode only), softer.
      if (mode === "on" && !isFixed(p.phone) && p.actor) {
        call.nearby = true;
        game.socket.emit(SOCKET, { type: "ringNearby", callId, exclude: users.map((u) => u.id), name: p.actor.name, img: p.actor.img, ringSrc: modelOf(p.phone).ring, timeout });
      }
    }
  }

  if (!call.open.size) {
    if (origin) finishOrigin(origin, { nosignal: "unreachable", off: "voicemail", unassigned: "unassigned" }[call.lastResult] ?? "noanswer");
    return;
  }
  pendingCalls.set(callId, call);
  // GM: the call window while it rings. As an NPC: the NPC and the agent called (hang-up button).
  // Between agents: who calls whom ("network unavailable" button).
  const [userId, itemUuid] = call.open.entries().next().value;
  const from = origin ? agentSide(fromUuidSync(origin.itemUuid), origin.userId) : npcSide(call.from, "", maskedLabel(caller));
  openGmRing(callId, from, agentSide(fromUuidSync(itemUuid), userId));
  rerenderAll();
  return callId;
}

export function hangUp(callId, { notifyOrigin = true } = {}) {
  const call = pendingCalls.get(callId);
  if (!call) return;
  pendingCalls.delete(callId);
  stopNearby(call, callId);
  closeDial(callId);
  const logged = new Set();
  for (const [userId, itemUuid] of call.open) {
    game.socket.emit(SOCKET, { type: "cancel", targetUserId: userId, callId });
    if (itemUuid && !logged.has(itemUuid)) {
      logged.add(itemUuid);
      const item = fromUuidSync(itemUuid);
      if (item) addLog(item, { kind: "call", call: callId, dir: "in", with: keyFor(getPhoneData(item), call.from), result: "missed", read: false });
    }
  }
  if (call.origin && notifyOrigin) finishOrigin(call.origin, "noanswer");
  if (!call.origin) ui.notifications.info(`📱 ${t("Info.CallInterrupted")}`);
  rerenderAll();
}

/** GM, between agents while it rings: the network fails. The caller gets a network error, the callee a missed call. */
export function failCall(callId) {
  const origin = pendingCalls.get(callId)?.origin;
  if (!origin) return;
  hangUp(callId, { notifyOrigin: false });
  finishOrigin(origin, "neterror");
}

export function hangUpAll() {
  for (const callId of [...pendingCalls.keys()]) hangUp(callId);
}

export function onResponse({ callId, result, userId }) {
  const call = pendingCalls.get(callId);
  if (!call) return; // call placed by another GM
  const itemUuid = call.open.get(userId);
  call.open.delete(userId);
  call.lastResult = result;
  const user = game.users.get(userId);
  const item = itemUuid ? fromUuidSync(itemUuid) : null;
  if (item) addLog(item, { kind: "call", call: callId, dir: "in", with: keyFor(getPhoneData(item), call.from), result, ...(result === "missed" ? { read: false } : {}) });

  if (!call.origin) {
    const where = item ? ` (${getPhoneData(item)?.label ?? item.name})` : "";
    const text = `${user?.name ?? "?"}${where} ${RESULT_LABELS[result] ?? result} — ${t("Caller").toLowerCase()} : ${maskedLabel(call.caller)}`;
    // Answered: the call window says it. Otherwise a short notice.
    if (result !== "answer") ui.notifications.warn(`📱 ${text}`);
  }

  if (result === "answer") {
    // Someone picked up: stop ringing for the others (shared number, co-owners).
    for (const otherId of call.open.keys()) game.socket.emit(SOCKET, { type: "cancel", targetUserId: otherId, callId });
    call.open.clear();
    if (item) startLive(callId, ...liveSides(call, item, userId));
  }
  if (!call.open.size) {
    pendingCalls.delete(callId);
    stopNearby(call, callId);
    closeDial(callId); // GM ringing window (answered: it is now the call window and stays)
    if (call.origin) finishOrigin(call.origin, result === "answer" ? "answer" : result === "off" ? "voicemail" : "noanswer");
  }
  rerenderAll();
}

/** Closes a call placed by a player: history + outcome shown to them. */
export function finishOrigin(origin, result) {
  const item = fromUuidSync(origin.itemUuid);
  if (item) addLog(item, { kind: "call", call: origin.callId, dir: "out", with: origin.key, result });
  game.socket.emit(SOCKET, { type: "callResult", targetUserId: origin.userId, callId: origin.callId, result, name: origin.name });
}


/** The two ends of an answered call: the calling agent (or the GM's NPC) and the agent who picked up. */
function liveSides(call, item, userId) {
  const phone = getPhoneData(item);
  const b = agentSide(item, userId);
  if (call.origin) {
    const a = agentSide(fromUuidSync(call.origin.itemUuid), call.origin.userId);
    a.seen = displayName(phone, keyFor(phone, call.from));
    b.seen = call.origin.name;
    return [a, b];
  }
  return [npcSide(call.from, displayName(phone, keyFor(phone, call.from)), maskedLabel(call.caller)), b];
}

/**
 * Smartphone: the face of the agent who calls, if they are in this device's contacts.
 * NPC portraits: not yet (no face).
 */
function knownCallerFace(p, from, origin) {
  if (p.phone.model !== "smartphone" || !origin || !findContact(p.phone, from)) return null;
  const actor = fromUuidSync(origin.itemUuid)?.parent;
  return actor instanceof Actor ? actor.img : null;
}

/**
 * Modern landline: the ringing popup shows the caller's number, only when it looks like one (digits).
 * Names, emails and hidden numbers just ring; the vintage landline shows nothing.
 */
function landlineNumber(p, caller) {
  const number = String(caller ?? "").trim();
  if (!isLandline(p.phone) || skinOf(p.phone) !== "modern") return null;
  return /^\+?\d{3,}$/.test(number.replace(/[\s\-.()]/g, "")) ? number : null;
}

/** Stops the soft ring heard by the other players. */
function stopNearby(call, callId) {
  if (call.nearby) game.socket.emit(SOCKET, { type: "ringNearbyStop", callId });
}
