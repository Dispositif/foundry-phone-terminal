import { MODULE_ID, RING_SRC, SMS_SRC } from "./constants.js";
import { addLog, displayName, getPhoneData, holderName, holders, isLandline, keyFor, modelOf, phonesByNumber, gmName, isUnknownNumber } from "./devices.js";
import { deliverToPhone } from "./messages.js";
import { RingDialog } from "./player-calls.js";
import { finishOrigin, hangUp, networkBusy, pendingCalls, ring } from "./ring.js";
import { esc, playLocal, rerenderAll } from "./util.js";
import { labels, t } from "./i18n.js";
import { agentSide, npcSide, startLive } from "./live-call.js";
/* -------------------------------------------- */
/*  GM: handling player actions                 */
/* -------------------------------------------- */

/** GM: does the acting agent actually hold this device? */
export function senderHolds(item, userId) {
  const phone = getPhoneData(item);
  if (!phone || !userId) return false;
  const actor = item.parent instanceof Actor ? item.parent : null;
  const ok = holders({ item, phone, actor }).some((u) => u.id === userId);
  if (!ok) console.warn(`${MODULE_ID} | ${game.users.get(userId)?.name ?? userId} does not hold "${phone.label}": action ignored.`);
  return ok;
}

/** Warns the GM when a compromised device (tapped, known to the enemy) sends or receives. */
function warnCompromised(...phones) {
  for (const phone of phones) if (phone?.compromised) ui.notifications.warn(t("Gm.CompromisedDevice", { label: phone.label }));
}

export async function onPlayerSms({ fromItemUuid, to, text, att = null, fwd = false, userId }) {
  const from = fromUuidSync(fromItemUuid);
  if (!senderHolds(from, userId)) return;
  const fromPhone = getPhoneData(from);
  text = text ?? "";
  if (!fromPhone || (!text.trim() && !att) || !to?.trim()) return;
  if (att && !modelOf(fromPhone).attachments) att = null;
  if (!text.trim() && !att) return;
  const extra = { ...(att ? { att } : {}), ...(fwd ? { fwd: true } : {}) };
  const key = keyFor(fromPhone, to);
  // A pager only gets pages from the GM: an agent writing to one reaches the GM, who decides.
  const targets = phonesByNumber(key).concat(phonesByNumber(to)).filter((p, i, arr) => p.item !== from && !modelOf(p.phone).pager && arr.findIndex((q) => q.item === p.item) === i);
  const who = `${holderName(from, fromPhone)} (${fromPhone.label})`;
  warnCompromised(fromPhone, ...targets.map((p) => p.phone));

  if (targets.length) {
    // Between PCs: delivered directly (nothing in the chat).
    await addLog(from, { kind: "sms", dir: "out", with: key, text, pj: true, ...extra });
    for (const p of targets) await deliverToPhone(p, fromPhone.number, text, att, { fwd });
  } else {
    // To an NPC: lands with the GM.
    await addLog(from, { kind: "sms", dir: "out", with: key, text, seen: false, ...extra });
    const toName = displayName(fromPhone, key);
    ui.notifications.info(`📱 ${t("Gm.WritesTo", { who, name: toName })}`);
    playLocal(SMS_SRC);
  }
  rerenderAll();
}

export const gmIncoming = new Map(); // callId -> { dialog, sound, done, origin }

const OUTCOME_LABELS = labels("Outcome", ["answer", "voicemail", "noanswer", "unreachable", "unassigned"]);
export const NPC_OUTCOMES = {
  answer: { get label() { return OUTCOME_LABELS.answer; }, icon: "fas fa-phone" },
  voicemail: { get label() { return OUTCOME_LABELS.voicemail; }, icon: "fas fa-voicemail" },
  noanswer: { get label() { return OUTCOME_LABELS.noanswer; }, icon: "fas fa-phone-slash" },
  unreachable: { get label() { return OUTCOME_LABELS.unreachable; }, icon: "fas fa-signal" },
  unassigned: { get label() { return OUTCOME_LABELS.unassigned; }, icon: "fas fa-ban" }
};

export async function onPlayerCall({ fromItemUuid, to, callId, userId }) {
  const from = fromUuidSync(fromItemUuid);
  if (!senderHolds(from, userId)) return;
  const fromPhone = getPhoneData(from);
  if (!fromPhone || !to?.trim()) return;
  const key = keyFor(fromPhone, to);
  const origin = { userId, itemUuid: fromItemUuid, callId, key, name: displayName(fromPhone, key) };
  // One call at a time on the network: a second one gets "network busy".
  if (networkBusy()) return finishOrigin(origin, "busy");
  const number = phonesByNumber(key).length ? key : to;
  const targets = phonesByNumber(number).filter((p) => p.item !== from);
  // A landline with nobody in the room: the GM answers in place of whoever is there (NPC).
  const emptyRooms = targets.length > 0 && targets.every((p) => isLandline(p.phone) && !holders(p, { activeOnly: true }).length);

  if (targets.length && !emptyRooms) {
    warnCompromised(fromPhone, ...targets.map((p) => p.phone));
    ring(`phone:${number}`, { caller: fromPhone.number, origin, callId });
    return;
  }
  const place = emptyRooms ? `📍 ${targets.map((p) => `${p.phone.label} (${game.scenes.get(p.phone.sceneId)?.name ?? t("NoPlace")})`).join(", ")}` : "";

  // To an NPC: the GM picks the outcome.
  const who = `${holderName(from, fromPhone)} (${fromPhone.label})`;
  const call = { done: false, sound: null, dialog: null, origin };
  gmIncoming.set(callId, call);
  rerenderAll(); // GM floating button turns orange
  const finish = (result) => {
    if (call.done) return;
    call.done = true;
    call.sound?.stop();
    gmIncoming.delete(callId);
    rerenderAll();
    if (call.dialog?.rendered) call.dialog.close();
    if (result !== "cancelled") finishOrigin(origin, result);
    if (result === "answer") startLive(callId, agentSide(from, userId), npcSide(key, origin.name, gmName(fromPhone, key)));
    else addLog(from, { kind: "call", call: callId, dir: "out", with: key, result: "cancelled" });
  };
  const dialog = new RingDialog({
    window: { title: emptyRooms ? t("Gm.EmptyLandlineCall") : t("Gm.AgentCalling"), icon: emptyRooms ? "fas fa-phone" : "fas fa-mobile-screen" },
    classes: ["spt-phone-ring-dialog"],
    position: { width: 520 },
    content: `<div class="spt-phone-ring"><i class="fas fa-phone-volume"></i><p class="spt-caller">${esc(gmName(fromPhone, key))}${isUnknownNumber(fromPhone, key) ? ` <small>(${t("Directory.Unknown")})</small>` : ""}</p>${place ? `<p><strong>${esc(place)}</strong><br><em>${t("Gm.NobodyThere")}</em></p>` : ""}<p>${t("Gm.CalledBy", { who: `<strong>${esc(who)}</strong>` })}</p>${fromPhone.compromised ? `<p class="spt-compromised"><i class="fas fa-triangle-exclamation"></i> ${t("Gm.CompromisedDevice", { label: esc(fromPhone.label) })}</p>` : ""}</div>`,
    buttons: Object.entries(NPC_OUTCOMES).map(([action, o]) => ({ action, label: o.label, icon: o.icon, default: action === "answer", callback: () => action })),
    submit: (result) => {
      call.dialog = null;
      finish(result);
    }
  });
  dialog.onClosed = () => finish("noanswer");
  call.dialog = dialog;
  call.finish = finish;
  dialog.render({ force: true });
  call.sound = await playLocal(RING_SRC, { loop: true });
  if (call.done) call.sound?.stop();
}

export function onPlayerHangup({ callId }) {
  const npc = gmIncoming.get(callId);
  if (npc) {
    npc.finish("cancelled");
    ui.notifications.info(`📱 ${t("Gm.AgentHungUp")}`);
    return;
  }
  const call = pendingCalls.get(callId);
  if (call?.origin) {
    hangUp(callId, { notifyOrigin: false });
    finishOriginLogOnly(call.origin, "cancelled");
  }
}

export function finishOriginLogOnly(origin, result) {
  const item = fromUuidSync(origin.itemUuid);
  if (item) addLog(item, { kind: "call", call: origin.callId, dir: "out", with: origin.key, result });
}

