import { MASKED, MODULE_ID, RESULT_LABELS, SOCKET } from "./constants.js";
import { addLog, displayName, getPhoneData, hasSignal, holders, isFixed, isLandline, keyFor, modelOf, npcNumber, phoneLabel, phonesByNumber, skinOf, modeOf } from "./devices.js";
import { esc, gmWhisper, maskedLabel, rerenderAll } from "./util.js";
import { t } from "./i18n.js";
/* -------------------------------------------- */
/*  Calls ringing at players                    */
/* -------------------------------------------- */

// callId -> { caller, label, open: Map<userId, itemUuid|null>, origin, lastResult }
export const pendingCalls = new Map();

/**
 * Rings a device (target = "phone:<number>") or a player ("user:<id>").
 * origin = { userId, itemUuid, callId, key, name } when the call comes from another PC.
 */
export function ring(target, { caller = MASKED, origin = null, callId = foundry.utils.randomID() } = {}) {
  if (!game.user.isGM) return ui.notifications.warn(t("Warn.GmOnlyCall"));
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
    call.label = user.name;
    if (!user.active) return ui.notifications.warn(`📱 ${t("Warn.UserOffline", { name: user.name })}`);
    emitRing(user.id, { caller });
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
          gmWhisper(`<p><strong>📞 ${esc(phoneLabel(p))}</strong> : ${RESULT_LABELS[result]}</p><p><em>${t("Caller")} : ${esc(maskedLabel(caller))}</em></p>`);
        }
        // Without signal, the missed call only shows when signal returns.
        addLog(p.item, { kind: "call", dir: "in", with: keyFor(p.phone, call.from), result: "missed", pending: result === "nosignal" || result === "off" });
        continue;
      }
      for (const u of users) {
        const model = modelOf(p.phone);
        emitRing(u.id, {
          caller: modelOf(p.phone).callerId ? displayName(p.phone, call.from) : null,
          callerNumber: landlineNumber(p, call.from),
          itemUuid: p.item.uuid,
          phoneLabel: isLandline(p.phone) ? `${p.phone.label} (${game.scenes.get(p.phone.sceneId)?.name ?? ""})` : p.phone.label,
          silent: mode === "silent",
          ringSrc: model.ring
        });
      }
      // Narration: every other player hears a carried phone ring (ring mode only), softer.
      if (mode === "on" && !isFixed(p.phone) && p.actor) {
        call.nearby = true;
        game.socket.emit(SOCKET, { type: "ringNearby", callId, exclude: users.map((u) => u.id), name: p.actor.name, ringSrc: modelOf(p.phone).ring, timeout });
      }
    }
  }

  if (!call.open.size) {
    if (origin) finishOrigin(origin, { nosignal: "unreachable", off: "voicemail", unassigned: "unassigned" }[call.lastResult] ?? "noanswer");
    return;
  }
  pendingCalls.set(callId, call);
  if (!origin) ui.notifications.info(`📱 ${t("Info.Calling", { label: call.label, caller: maskedLabel(caller) })}`);
  rerenderAll();
  return callId;
}

export function hangUp(callId, { notifyOrigin = true } = {}) {
  const call = pendingCalls.get(callId);
  if (!call) return;
  pendingCalls.delete(callId);
  stopNearby(call, callId);
  const logged = new Set();
  for (const [userId, itemUuid] of call.open) {
    game.socket.emit(SOCKET, { type: "cancel", targetUserId: userId, callId });
    if (itemUuid && !logged.has(itemUuid)) {
      logged.add(itemUuid);
      const item = fromUuidSync(itemUuid);
      if (item) addLog(item, { kind: "call", dir: "in", with: keyFor(getPhoneData(item), call.from), result: "missed" });
    }
  }
  if (call.origin && notifyOrigin) finishOrigin(call.origin, "noanswer");
  if (!call.origin) ui.notifications.info(`📱 ${t("Info.CallInterrupted")}`);
  rerenderAll();
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
  if (item) addLog(item, { kind: "call", dir: "in", with: keyFor(getPhoneData(item), call.from), result });

  if (!call.origin) {
    const where = item ? ` (${getPhoneData(item)?.label ?? item.name})` : "";
    const text = `${user?.name ?? "?"}${where} ${RESULT_LABELS[result] ?? result} — ${t("Caller").toLowerCase()} : ${maskedLabel(call.caller)}`;
    if (result === "answer") ui.notifications.info(`📱 ${text}`);
    else ui.notifications.warn(`📱 ${text}`);
    gmWhisper(`<p><strong>📞 ${esc(user?.name)}${esc(where)}</strong> ${RESULT_LABELS[result] ?? esc(result)}</p><p><em>${t("Caller")} : ${esc(maskedLabel(call.caller))}</em></p>`);
  }

  if (result === "answer") {
    // Someone picked up: stop ringing for the others (shared number, co-owners).
    for (const otherId of call.open.keys()) game.socket.emit(SOCKET, { type: "cancel", targetUserId: otherId, callId });
    call.open.clear();
  }
  if (!call.open.size) {
    pendingCalls.delete(callId);
    stopNearby(call, callId);
    if (call.origin) finishOrigin(call.origin, result === "answer" ? "answer" : result === "off" ? "voicemail" : "noanswer");
  }
  rerenderAll();
}

/** Closes a call placed by a player: history + outcome shown to them. */
export function finishOrigin(origin, result) {
  const item = fromUuidSync(origin.itemUuid);
  if (item) addLog(item, { kind: "call", dir: "out", with: origin.key, result });
  game.socket.emit(SOCKET, { type: "callResult", targetUserId: origin.userId, callId: origin.callId, result, name: origin.name });
  if (result === "answer") {
    gmWhisper(`<p>📞 ${t("Gm.OnLine", { who: `<strong>${esc(item?.parent?.name ?? "?")}</strong>`, name: `<strong>${esc(origin.name)}</strong>` })}</p>`);
  }
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
