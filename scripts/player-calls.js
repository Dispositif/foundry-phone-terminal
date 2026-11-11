import { DialogV2, HANGUP_SRC, MODULE_ID, PICKUP_SRC, RINGBACK_SRC, RING_SRC, SOCKET, VIBRATE_SRC } from "./constants.js";
import { displayName, getPhoneData, hasSignal, keyFor, modelOf, msgOn, skinOf, modeOf } from "./devices.js";
import { updateFab } from "./fab.js";
import { deviceNotice, esc, isMasked, maskedLabel, playLocal, rerenderAll } from "./util.js";
import { PlayerPhone } from "./player-phone.js";
import { t } from "./i18n.js";
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

export async function receiveRing({ callId, caller, callerNumber, timeout, phoneLabel: label, silent, ringSrc, itemUuid }) {
  if (activeCall) endCall("decline"); // already on a call: drop the old call

  const call = { callId, itemUuid, caller: caller ? maskedLabel(caller) : t("Call.Incoming"), done: false, sound: null, dialog: null, timer: null };
  activeCall = call;
  updateFab();

  const ringing = getPhoneData(fromUuidSync(itemUuid));
  const icon = ringing ? modelOf(ringing).icon : "fa-mobile-screen";
  const onScreen = ["smartphone", "mobile"].includes(ringing?.model) || (ringing?.model === "landline" && skinOf(ringing) === "modern");
  if (!game.user.isGM && onScreen) {
    // Smartphone, mobile and modern landline show the call on the device itself: open it (or bring it forward).
    call.screen = { caller: caller ? maskedLabel(caller) : callerNumber || null, known: !!caller, silent };
    const app = PlayerPhone.instance ?? new PlayerPhone();
    app._state.phoneUuid = itemUuid;
    app._skipRead = true;
    app.render({ force: true }).then(() => app.bringToFront?.());
  } else {
    const which = label ? `<p class="spt-which"><i class="fas ${icon}"></i> ${esc(label)}${silent ? ` (${t("Mode.silent").toLowerCase()})` : ""}</p>` : "";
    const dialog = new RingDialog({
      window: { title: t("Call.Incoming"), icon: `fas ${icon}` },
      classes: ["spt-phone-ring-dialog", "spt-player-phone", `spt-skin-${ringing ? skinOf(ringing) : "smartphone"}`],
      position: { width: 320 },
      content: caller
        ? `<div class="spt-phone-ring ${silent ? "silent" : ""}">${which}<i class="fas fa-phone-volume"></i><p class="spt-caller">${esc(maskedLabel(caller))}</p><p>${t("Call.IsCalling")}</p></div>`
        : `<div class="spt-phone-ring ${silent ? "silent" : ""}">${which}<i class="fas fa-phone-volume"></i><p class="spt-caller">${callerNumber ? esc(callerNumber) : t("Call.Ringing")}</p></div>`,
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

export let outgoing = null; // { callId, dialog, done }

export function playerCall(item, to) {
  to = to?.trim();
  if (!to) return;
  if (isMasked(to)) return deviceNotice(t("Warn.CantCallMasked"), { warn: true });
  const phone = getPhoneData(item);
  if (modelOf(phone).noCalls) return;
  if (phone?.locked) return deviceNotice(t("Warn.Locked"), { warn: true });
  if (modeOf(phone) === "off") return deviceNotice(t("Warn.PhoneOff"), { warn: true });
  if (outgoing) return deviceNotice(t("Warn.AlreadyCalling"), { warn: true });
  if (!networkUp(phone)) return;

  const callId = foundry.utils.randomID();
  const call = { callId, done: false, dialog: null, sound: null };
  outgoing = call;
  const name = displayName(phone, keyFor(phone, to));
  const hangup = () => {
    if (call.done) return;
    call.done = true;
    outgoing = null;
    stopOutgoingSound(call);
    game.socket.emit(SOCKET, { type: "playerHangup", callId });
  };
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
  game.socket.emit(SOCKET, { type: "playerCall", fromItemUuid: item.uuid, to, callId, userId: game.user.id });
  // Narration: the whole table hears the ringback tone and knows who is on the phone.
  const agent = item.parent?.name ?? game.user.character?.name ?? game.user.name;
  game.socket.emit(SOCKET, { type: "callNearby", callId, exclude: [game.user.id], name: agent, timeout: game.settings.get(MODULE_ID, "ringTimeout") });
  playLocal(RINGBACK_SRC, { loop: true }).then((sound) => {
    call.sound = sound;
    if (call.done || call.ringing) sound?.stop();
  });
}

/** Stops the ringback tone, here and for the other players. */
function stopOutgoingSound(call) {
  call.sound?.stop();
  game.socket.emit(SOCKET, { type: "nearbyStop", callId: call.callId });
}

export const CALLER_RESULTS = {
  answer: (name) => t("CallerResult.answer", { name }),
  voicemail: (name) => t("CallerResult.voicemail", { name }),
  unassigned: () => t("CallerResult.unassigned"),
  unreachable: () => t("CallerResult.unreachable"),
  noanswer: (name) => t("CallerResult.noanswer", { name })
};

export function onCallResult({ callId, result, name }) {
  if (!outgoing || outgoing.callId !== callId) return;
  const call = outgoing;
  call.done = true;
  outgoing = null;
  stopOutgoingSound(call);
  if (call.dialog?.rendered) call.dialog.close();
  if (result === "answer") playLocal(PICKUP_SRC);
  const msg = (CALLER_RESULTS[result] ?? CALLER_RESULTS.noanswer)(name);
  deviceNotice(msg, { warn: result !== "answer" });
}


/* Narration: every other player hears another agent's phone ring, or their ringback tone, with a small notice. */
const nearby = new Map(); // "kind:callId" -> { sound, timer, done } (a call between agents has both kinds)

async function playNearby({ kind, callId, exclude = [], text, src, timeout }) {
  const id = `${kind}:${callId}`;
  if (game.user.isGM || exclude.includes(game.user.id) || nearby.has(id)) return;
  const entry = { sound: null, timer: null, done: false };
  nearby.set(id, entry);
  ui.notifications.info(text);
  // Safety net if the stop message is lost: the ring duration, or 5 minutes when it rings until answered.
  entry.timer = setTimeout(() => stopNearbyRing({ callId }), (timeout > 0 ? timeout + 2 : 300) * 1000);
  entry.sound = await playLocal(src, { loop: true, gain: 0.7 });
  if (entry.done) entry.sound?.stop();
}

export function receiveNearbyRing({ callId, exclude, name, ringSrc, timeout }) {
  // Call between agents: everyone hears only the ringing phone, not the ringback tone.
  if (nearby.has(`call:${callId}`)) stopEntry(`call:${callId}`);
  else stopEntry(`call:${callId}`, { tombstone: true }); // ringback notice not arrived yet: block it
  if (outgoing?.callId === callId) {
    outgoing.ringing = true;
    outgoing.sound?.stop();
  }
  const src = ringSrc ? `modules/${MODULE_ID}/sounds/${ringSrc}` : RING_SRC;
  return playNearby({ kind: "ring", callId, exclude, timeout, src, text: `📱 ${t("Call.NearbyRinging", { name })}` });
}

export function receiveNearbyCall({ callId, exclude, name, timeout }) {
  return playNearby({ kind: "call", callId, exclude, timeout, src: RINGBACK_SRC, text: `📞 ${t("Call.NearbyCalling", { name })}` });
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

