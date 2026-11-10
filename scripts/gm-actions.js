import { MODULE_ID, RING_SRC, SMS_SRC } from "./constants.js";
import { addLog, displayName, getPhoneData, holderName, holders, keyFor, modelOf, phonesByNumber } from "./devices.js";
import { deliverToPhone, smsHtml } from "./messages.js";
import { RingDialog } from "./player-calls.js";
import { finishOrigin, hangUp, pendingCalls, ring } from "./ring.js";
import { esc, gmWhisper, playLocal, rerenderAll } from "./util.js";
import { labels, t } from "./i18n.js";
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
  const targets = phonesByNumber(key).concat(phonesByNumber(to)).filter((p, i, arr) => p.item !== from && arr.findIndex((q) => q.item === p.item) === i);
  const who = `${holderName(from, fromPhone)} (${fromPhone.label})`;

  if (targets.length) {
    // Between PCs: delivered directly, copy to the GM.
    await addLog(from, { kind: "sms", dir: "out", with: key, text, pj: true, ...extra });
    for (const p of targets) await deliverToPhone(p, fromPhone.number, text, att, { fwd });
    gmWhisper(`<p class="spt-gm-copy">📱 <strong>${esc(who)}</strong>${fwd ? ` ${t("Fwd.Verb")}` : ""} → ${esc(targets.map((p) => holderName(p.item, p.phone)).join(", "))}</p>${smsHtml(who, text, null, att)}`);
  } else {
    // To an NPC: lands with the GM.
    await addLog(from, { kind: "sms", dir: "out", with: key, text, seen: false, ...extra });
    const toName = displayName(fromPhone, key);
    gmWhisper(`<p class="spt-gm-copy">📱 <strong>${esc(who)}</strong>${fwd ? ` ${t("Fwd.Verb")}` : ""} → <strong>${esc(toName)}</strong></p>${smsHtml(who, text, null, att)}`);
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
  const isPJ = phonesByNumber(key).concat(phonesByNumber(to)).some((p) => p.item !== from);

  if (isPJ) {
    const number = phonesByNumber(key).length ? key : to;
    ring(`phone:${number}`, { caller: fromPhone.number, origin, callId });
    return;
  }

  // To an NPC: the GM picks the outcome.
  const who = `${holderName(from, fromPhone)} (${fromPhone.label})`;
  const call = { done: false, sound: null, dialog: null, origin };
  gmIncoming.set(callId, call);
  const finish = (result) => {
    if (call.done) return;
    call.done = true;
    call.sound?.stop();
    gmIncoming.delete(callId);
    if (call.dialog?.rendered) call.dialog.close();
    if (result !== "cancelled") finishOrigin(origin, result);
    else addLog(from, { kind: "call", dir: "out", with: key, result: "cancelled" });
  };
  const dialog = new RingDialog({
    window: { title: t("Gm.AgentCalling"), icon: "fas fa-mobile-screen" },
    classes: ["spt-phone-ring-dialog"],
    position: { width: 520 },
    content: `<div class="spt-phone-ring"><i class="fas fa-phone-volume"></i><p class="spt-caller">${esc(origin.name)}</p><p>${t("Gm.CalledBy", { who: `<strong>${esc(who)}</strong>` })}</p></div>`,
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
  if (item) addLog(item, { kind: "call", dir: "out", with: origin.key, result });
}

