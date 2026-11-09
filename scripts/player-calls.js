import { DialogV2, HANGUP_SRC, MODULE_ID, PICKUP_SRC, RING_SRC, SOCKET } from "./constants.js";
import { displayName, getPhoneData, hasSignal, keyFor, modelOf, msgOn, skinOf } from "./devices.js";
import { updateFab } from "./fab.js";
import { esc, isMasked, maskedLabel, playLocal } from "./util.js";
import { t } from "./i18n.js";
/* -------------------------------------------- */
/*  Joueur : appels entrants                    */
/* -------------------------------------------- */

export let activeCall = null; // { callId, caller, sound, dialog, timer, done }

export class RingDialog extends DialogV2 {
  _onClose(options) {
    super._onClose(options);
    this.onClosed?.();
  }
}

export async function receiveRing({ callId, caller, timeout, phoneLabel: label, silent, ringSrc, itemUuid }) {
  if (activeCall) endCall("decline"); // déjà en ligne : on rejette l'ancien appel

  const call = { callId, itemUuid, caller: caller ? maskedLabel(caller) : t("Call.Incoming"), done: false, sound: null, dialog: null, timer: null };
  activeCall = call;
  updateFab();

  const ringing = getPhoneData(fromUuidSync(itemUuid));
  const icon = ringing ? modelOf(ringing).icon : "fa-mobile-screen";
  const which = label ? `<p class="spt-which"><i class="fas ${icon}"></i> ${esc(label)}${silent ? ` (${t("Mode.silent").toLowerCase()})` : ""}</p>` : "";
  const dialog = new RingDialog({
    window: { title: t("Call.Incoming"), icon: `fas ${icon}` },
    classes: ["spt-phone-ring-dialog", "spt-player-phone", `spt-skin-${ringing ? skinOf(ringing) : "smartphone"}`],
    position: { width: 320 },
    content: caller
      ? `<div class="spt-phone-ring ${silent ? "silent" : ""}">${which}<i class="fas fa-phone-volume"></i><p class="spt-caller">${esc(maskedLabel(caller))}</p><p>${t("Call.IsCalling")}</p></div>`
      : `<div class="spt-phone-ring ${silent ? "silent" : ""}">${which}<i class="fas fa-phone-volume"></i><p class="spt-caller">${t("Call.Ringing")}</p></div>`,
    buttons: [
      { action: "answer", label: t("Call.Answer"), icon: "fas fa-phone", default: true, callback: () => "answer" },
      { action: "decline", label: t("Call.Decline"), icon: "fas fa-phone-slash", callback: () => "decline" }
    ],
    submit: (result) => {
      call.dialog = null; // DialogV2 se ferme d'elle-même après submit
      endCall(result, call);
    }
  });
  dialog.onClosed = () => endCall("decline", call); // fermeture par la croix = refus
  call.dialog = dialog;
  dialog.render({ force: true });

  if (!silent) {
    call.sound = await playLocal(ringSrc ? `modules/${MODULE_ID}/sounds/${ringSrc}` : RING_SRC, { loop: true });
    if (call.done) call.sound?.stop(); // appel terminé pendant le chargement du son
  }
  if (timeout > 0 && !call.done) call.timer = setTimeout(() => endCall("missed", call), timeout * 1000);
}

/** Termine l'appel entrant côté joueur. result = answer|decline|missed|cancelled */
export function endCall(result, call = activeCall) {
  if (!call || call.done) return;
  call.done = true;
  clearTimeout(call.timer);
  call.sound?.stop();
  if (activeCall === call) activeCall = null;
  updateFab();
  if (call.dialog?.rendered) call.dialog.close();

  if (result === "answer") playLocal(PICKUP_SRC);
  else if (result === "decline") playLocal(HANGUP_SRC);
  if (result === "cancelled" || result === "missed") ui.notifications.info(`📱 ${t("Call.Missed", { caller: call.caller })}`);
  if (result === "cancelled") return;
  game.socket.emit(SOCKET, { type: "response", callId: call.callId, result, userId: game.user.id });
}

/* -------------------------------------------- */
/*  Joueur : actions sortantes                  */
/* -------------------------------------------- */

export function networkUp(phone) {
  if (!game.users.activeGM) {
    // Le client du MJ fait office de réseau : sans lui, pas de réseau.
    ui.notifications.warn(`📱 ${t("Net.GmAbsent")}`);
    return false;
  }
  if (hasSignal(phone)) return true;
  ui.notifications.warn(`📵 ${t("Net.NoSignal")}`);
  return false;
}

export function playerSendSms(item, to, text, { att = null, fwd = false } = {}) {
  if (!msgOn(getPhoneData(item))) return false;
  text = text?.trim() ?? "";
  to = to?.trim();
  if ((!text && !att) || !to) return false;
  if (isMasked(to)) return ui.notifications.warn(t("Warn.CantReplyMasked")), false;
  if (getPhoneData(item)?.locked) return ui.notifications.warn(`🔒 ${t("Warn.Locked")}`), false;
  if ((getPhoneData(item)?.mode ?? "on") === "off") return ui.notifications.warn(t("Warn.PhoneOff")), false;
  if (!networkUp(getPhoneData(item))) return false;
  game.socket.emit(SOCKET, { type: "playerSms", fromItemUuid: item.uuid, to, text, att, fwd, userId: game.user.id });
  return true;
}

export let outgoing = null; // { callId, dialog, done }

export function playerCall(item, to) {
  to = to?.trim();
  if (!to) return;
  if (isMasked(to)) return ui.notifications.warn(t("Warn.CantCallMasked"));
  const phone = getPhoneData(item);
  if (modelOf(phone).noCalls) return;
  if (phone?.locked) return ui.notifications.warn(`🔒 ${t("Warn.Locked")}`);
  if ((phone?.mode ?? "on") === "off") return ui.notifications.warn(t("Warn.PhoneOff"));
  if (outgoing) return ui.notifications.warn(t("Warn.AlreadyCalling"));
  if (!networkUp(phone)) return;

  const callId = foundry.utils.randomID();
  const call = { callId, done: false, dialog: null };
  outgoing = call;
  const name = displayName(phone, keyFor(phone, to));
  const hangup = () => {
    if (call.done) return;
    call.done = true;
    outgoing = null;
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
}

export const CALLER_RESULTS = {
  answer: (name) => `📞 ${t("CallerResult.answer", { name })}`,
  voicemail: (name) => `📞 ${t("CallerResult.voicemail", { name })}`,
  unassigned: () => `📞 ${t("CallerResult.unassigned")}`,
  unreachable: () => `📞 ${t("CallerResult.unreachable")}`,
  noanswer: (name) => `📞 ${t("CallerResult.noanswer", { name })}`
};

export function onCallResult({ callId, result, name }) {
  if (!outgoing || outgoing.callId !== callId) return;
  const call = outgoing;
  call.done = true;
  outgoing = null;
  if (call.dialog?.rendered) call.dialog.close();
  if (result === "answer") playLocal(PICKUP_SRC);
  const msg = (CALLER_RESULTS[result] ?? CALLER_RESULTS.noanswer)(name);
  if (result === "answer") ui.notifications.info(msg);
  else ui.notifications.warn(msg);
}

