import { DialogV2, HANGUP_SRC, MODULE_ID, PICKUP_SRC, RINGBACK_SRC, RING_SRC, SOCKET, VIBRATE_SRC } from "./constants.js";
import { displayName, findContact, getPhoneData, hasSignal, keyFor, modelOf, msgOn, phonesByNumber, skinOf, modeOf } from "./devices.js";
import { updateFab } from "./fab.js";
import { deviceNotice, esc, isMasked, maskedLabel, playLocal, rerenderAll } from "./util.js";
import { PlayerPhone } from "./player-phone.js";
import { t } from "./i18n.js";
import { calledOn, lineBusy } from "./live-call.js";
/* -------------------------------------------- */
/*  Player: incoming calls                      */
/* -------------------------------------------- */

export let activeCall = null; // { callId, caller, sound, dialog, timer, done }

export class RingDialog extends DialogV2 {
  _onClose(options) {
    super._onClose(options);
    this.onClosed?.();
  }
}

export async function receiveRing({ callId, caller, callerNumber, callerImg, timeout, phoneLabel: label, silent, ringSrc, itemUuid, secure = false }) {
  if (activeCall) endCall("decline"); // already on a call: drop the old call
  calledOn(callId); // called: no spectator window for this call

  const call = { callId, itemUuid, caller: caller ? maskedLabel(caller) : t("Call.Incoming"), done: false, sound: null, dialog: null, timer: null };
  activeCall = call;
  updateFab();

  const ringing = getPhoneData(fromUuidSync(itemUuid));
  const icon = ringing ? modelOf(ringing).icon : "fa-mobile-screen";
  const onScreen = ["smartphone", "mobile"].includes(ringing?.model) || (ringing?.model === "landline" && skinOf(ringing) === "modern");
  if (!game.user.isGM && onScreen) {
    // Smartphone, mobile and modern landline show the call on the device itself: open it (or bring it forward).
    call.screen = { caller: caller ? maskedLabel(caller) : callerNumber || null, known: !!caller, silent, img: callerImg ?? null, secure };
    const app = PlayerPhone.instance ?? new PlayerPhone();
    app._state.phoneUuid = itemUuid;
    app._skipRead = true;
    app.render({ force: true }).then(() => app.bringToFront?.());
  } else {
    const sec = secure ? `<p class="spt-ring-secure"><i class="fas fa-shield-halved"></i> ${t("Secure.Line")}</p>` : "";
    const which = label ? `<p class="spt-which"><i class="fas ${icon}"></i> ${esc(label)}${silent ? ` (${t("Mode.silent").toLowerCase()})` : ""}</p>` : "";
    const dialog = new RingDialog({
      window: { title: t("Call.Incoming"), icon: `fas ${icon}` },
      classes: ["spt-phone-ring-dialog", "spt-player-phone", `spt-skin-${ringing ? skinOf(ringing) : "smartphone"}`],
      position: { width: 320 },
      content: caller
        ? `<div class="spt-phone-ring ${silent ? "silent" : ""}">${which}<i class="fas fa-phone-volume"></i><p class="spt-caller">${esc(maskedLabel(caller))}</p><p>${t("Call.IsCalling")}</p>${sec}</div>`
        : `<div class="spt-phone-ring ${silent ? "silent" : ""}">${which}<i class="fas fa-phone-volume"></i><p class="spt-caller">${callerNumber ? esc(callerNumber) : t("Call.Ringing")}</p>${sec}</div>`,
      buttons: [
        { action: "answer", label: t("Call.Answer"), icon: "fas fa-phone", default: true, callback: () => "answer" },
        { action: "decline", label: t("Call.Decline"), icon: "fas fa-phone-slash", callback: () => "decline" }
      ],
      submit: (result) => {
        call.dialog = null; // DialogV2 closes by itself after submit
        endCall(result, call);
      }
    });
    dialog.onClosed = () => endCall("decline", call); // closing with the cross = decline
    call.dialog = dialog;
    dialog.render({ force: true });
  }

  // Silent mode: the agent still feels the phone buzz (only them).
  const src = silent ? VIBRATE_SRC : ringSrc ? `modules/${MODULE_ID}/sounds/${ringSrc}` : RING_SRC;
  call.sound = await playLocal(src, { loop: true });
  if (call.done) call.sound?.stop(); // call ended while the sound was loading
  if (timeout > 0 && !call.done) call.timer = setTimeout(() => endCall("missed", call), timeout * 1000);
}

/** Ends the incoming call on the player side. result = answer|decline|missed|cancelled */
export function endCall(result, call = activeCall) {
  if (!call || call.done) return;
  call.done = true;
  clearTimeout(call.timer);
  call.sound?.stop();
  if (activeCall === call) activeCall = null;
  updateFab();
  if (call.dialog?.rendered) call.dialog.close();
  if (call.screen) rerenderAll();

  if (result === "answer") playLocal(PICKUP_SRC);
  else if (result === "decline") playLocal(HANGUP_SRC);
  if (result === "cancelled") return;
  game.socket.emit(SOCKET, { type: "response", callId: call.callId, result, userId: game.user.id });
}

/* -------------------------------------------- */
/*  Player: outgoing actions                    */
/* -------------------------------------------- */

export function networkUp(phone) {
  if (!game.users.activeGM) {
    // The GM's client acts as the network: without it, no network.
    deviceNotice(t("Net.GmAbsent"), { warn: true });
    return false;
  }
  if (hasSignal(phone)) return true;
  deviceNotice(t("Net.NoSignal"), { warn: true });
  return false;
}

export function playerSendSms(item, to, text, { att = null, fwd = false } = {}) {
  if (!msgOn(getPhoneData(item))) return false;
  text = text?.trim() ?? "";
  to = to?.trim();
  if ((!text && !att) || !to) return false;
  if (isMasked(to)) return deviceNotice(t("Warn.CantReplyMasked"), { warn: true }), false;
  if (getPhoneData(item)?.locked) return deviceNotice(t("Warn.Locked"), { warn: true }), false;
  if (modeOf(getPhoneData(item)) === "off") return deviceNotice(t("Warn.PhoneOff"), { warn: true }), false;
  if (!networkUp(getPhoneData(item))) return false;
  game.socket.emit(SOCKET, { type: "playerSms", fromItemUuid: item.uuid, to, text, att, fwd, userId: game.user.id });
  return true;
}

export let outgoing = null; // { callId, dialog, done, screen?, itemUuid, hangup }

export function playerCall(item, to) {
  to = to?.trim();
  if (!to) return;
  if (isMasked(to)) return deviceNotice(t("Warn.CantCallMasked"), { warn: true });
  const phone = getPhoneData(item);
  if (modelOf(phone).noCalls) return;
  if (phone?.locked) return deviceNotice(t("Warn.Locked"), { warn: true });
  if (modeOf(phone) === "off") return deviceNotice(t("Warn.PhoneOff"), { warn: true });
  if (outgoing) return deviceNotice(t("Warn.AlreadyCalling"), { warn: true });
  // A call already rings or is in progress at the table: the network is busy (checked again by the GM).
  if (activeCall || lineBusy({ ringing: true })) return deviceNotice(t("CallerResult.busy"), { warn: true, icon: "fa-signal spt-busy" });
  if (!networkUp(phone)) return;

  const callId = foundry.utils.randomID();
  const call = { callId, done: false, dialog: null, sound: null, itemUuid: item.uuid };
  outgoing = call;
  const name = displayName(phone, keyFor(phone, to));
  const hangup = () => {
    if (call.done) return;
    call.done = true;
    outgoing = null;
    stopOutgoingSound(call);
    if (call.screen) rerenderAll();
    game.socket.emit(SOCKET, { type: "playerHangup", callId });
  };
  call.hangup = hangup;
  if (["smartphone", "mobile"].includes(phone.model)) {
    // Smartphone and mobile: the call shows on the device itself, not in a window.
    call.screen = { name, img: knownFace(phone, to), face: phone.model === "smartphone" };
    const app = PlayerPhone.instance ?? new PlayerPhone();
    app._state.phoneUuid = item.uuid;
    app.render({ force: true }).then(() => app.bringToFront?.());
  } else showOutgoingDialog(call, name, hangup);
  game.socket.emit(SOCKET, { type: "playerCall", fromItemUuid: item.uuid, to, callId, userId: game.user.id });
  // Narration: the whole table hears the ringback tone and knows who is on the phone.
  const agent = item.parent?.name ?? game.user.character?.name ?? game.user.name;
  const img = item.parent?.img ?? game.user.character?.img ?? null;
  game.socket.emit(SOCKET, { type: "callNearby", callId, exclude: [game.user.id], name: agent, img, timeout: game.settings.get(MODULE_ID, "ringTimeout") });
  playLocal(RINGBACK_SRC, { loop: true }).then((sound) => {
    call.sound = sound;
    if (call.done || call.ringing) sound?.stop();
  });
}

/**
 * Portrait of who is called, only if the agent knows them (saved in their contacts) and it is
 * another agent's device. NPC portraits: not yet (silhouette).
 */
function knownFace(phone, to) {
  if (!findContact(phone, to)) return null;
  const target = phonesByNumber(keyFor(phone, to)).find((p) => p.actor?.hasPlayerOwner);
  return target?.actor.img ?? null;
}

/** Landlines and terminals: the outgoing call in a small window. */
function showOutgoingDialog(call, name, hangup) {
  const dialog = new RingDialog({
    window: { title: t("Call.Outgoing"), icon: "fas fa-mobile-screen" },
    classes: ["spt-phone-ring-dialog"],
    position: { width: 320 },
    content: `<div class="spt-phone-ring outgoing"><i class="fas fa-phone"></i><p class="spt-caller">${esc(name)}</p><p>${t("Call.Calling")}</p></div>`,
    buttons: [{ action: "hangup", label: t("Call.HangUp"), icon: "fas fa-phone-slash", default: true, callback: () => "hangup" }],
    submit: () => {
      call.dialog = null;
      hangup();
    }
  });
  dialog.onClosed = hangup;
  call.dialog = dialog;
  dialog.render({ force: true });
}

/** Stops the ringback tone, here and for the other players. */
function stopOutgoingSound(call) {
  call.sound?.stop();
  game.socket.emit(SOCKET, { type: "nearbyStop", callId: call.callId });
}

export const CALLER_RESULTS = {
  voicemail: (name) => t("CallerResult.voicemail", { name }),
  unassigned: () => t("CallerResult.unassigned"),
  unreachable: () => t("CallerResult.unreachable"),
  noanswer: (name) => t("CallerResult.noanswer", { name }),
  busy: () => t("CallerResult.busy"),
  neterror: () => t("CallerResult.neterror")
};

export function onCallResult({ callId, result, name }) {
  if (!outgoing || outgoing.callId !== callId) return;
  const call = outgoing;
  call.done = true;
  outgoing = null;
  stopOutgoingSound(call);
  if (call.dialog?.rendered) call.dialog.close();
  if (call.screen) rerenderAll();
  // Answered: the device shows the call, no notice. Otherwise, a notice on the device.
  if (result === "answer") return playLocal(PICKUP_SRC);
  const msg = (CALLER_RESULTS[result] ?? CALLER_RESULTS.noanswer)(name);
  deviceNotice(msg, { warn: true, icon: ["busy", "neterror"].includes(result) ? "fa-signal spt-busy" : null });
}


/* Narration: every other player hears another agent's phone ring, or their ringback tone (the call window shows who). */
const nearby = new Map(); // "kind:callId" -> { sound, timer, done } (a call between agents has both kinds)

async function playNearby({ kind, callId, exclude = [], src, timeout }) {
  const id = `${kind}:${callId}`;
  if (game.user.isGM || exclude.includes(game.user.id) || nearby.has(id)) return;
  const entry = { sound: null, timer: null, done: false };
  nearby.set(id, entry);
  // No notice: the call window shows who calls and whose phone rings.
  // Safety net if the stop message is lost: the ring duration, or 5 minutes when it rings until answered.
  entry.timer = setTimeout(() => stopNearbyRing({ callId }), (timeout > 0 ? timeout + 2 : 300) * 1000);
  entry.sound = await playLocal(src, { loop: true, gain: 0.7 });
  if (entry.done) entry.sound?.stop();
}

export function receiveNearbyRing({ callId, exclude, ringSrc, timeout }) {
  // Call between agents: everyone hears only the ringing phone, not the ringback tone.
  if (nearby.has(`call:${callId}`)) stopEntry(`call:${callId}`);
  else stopEntry(`call:${callId}`, { tombstone: true }); // ringback notice not arrived yet: block it
  if (outgoing?.callId === callId) {
    outgoing.ringing = true;
    outgoing.sound?.stop();
  }
  const src = ringSrc ? `modules/${MODULE_ID}/sounds/${ringSrc}` : RING_SRC;
  return playNearby({ kind: "ring", callId, exclude, timeout, src });
}

export function receiveNearbyCall({ callId, exclude, timeout }) {
  return playNearby({ kind: "call", callId, exclude, timeout, src: RINGBACK_SRC });
}

export function stopNearbyRing({ callId }) {
  stopEntry(`ring:${callId}`);
  stopEntry(`call:${callId}`);
}

function stopEntry(id, { tombstone = false } = {}) {
  if (tombstone) nearby.set(id, { sound: null, timer: null, done: true });
  const entry = nearby.get(id);
  if (!entry) return;
  entry.done = true;
  clearTimeout(entry.timer);
  entry.sound?.stop();
  // Keep a finished ringback entry so a late callNearby does not start it again.
  if (id.startsWith("call:")) setTimeout(() => nearby.delete(id), 10000);
  else nearby.delete(id);
}

