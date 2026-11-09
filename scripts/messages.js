import { attChatHtml } from "./attachments.js";
import { MASKED, MODULE_ID, SOCKET } from "./constants.js";
import { addLog, allPhones, displayName, getLog, getPhoneData, hasSignal, holders, isComputer, keyFor, modelOf, msgOn, phoneLabel, phonesByNumber, smsOn, withItemLock } from "./devices.js";
import { esc, maskedLabel, nl2br } from "./util.js";
import { t } from "./i18n.js";
/* -------------------------------------------- */
/*  SMS                                         */
/* -------------------------------------------- */

export function smsHtml(sender, text, phoneName, att = null, mail = false, icon = null) {
  const to = phoneName ? `<span class="spt-sms-to">${icon ? `<i class="fas ${icon}"></i> ` : "→ "}${esc(phoneName)}</span>` : "";
  const body = [att ? attChatHtml(att) : "", text ? nl2br(text) : ""].filter(Boolean).join("<br>");
  return `<div class="spt-sms ${mail ? "spt-mail" : ""}"><div class="spt-sms-header"><i class="fas ${mail ? "fa-envelope" : "fa-comment-sms"}"></i> ${esc(maskedLabel(sender))} ${to}</div><div class="spt-sms-body">${body}</div></div>`;
}


/** Copie d'un message reçu dans le chat, en privé pour ceux qui ont l'appareil en main (texte masqué s'il est verrouillé). */
export function whisperMessage(phone, users, shown, text, att = null) {
  return ChatMessage.create({
    content: phone.locked
      ? smsHtml(shown, `🔒 ${t("LockedMessage")}`, phone.label, null, isComputer(phone), modelOf(phone).icon)
      : smsHtml(shown, text, phone.label, att, isComputer(phone), modelOf(phone).icon),
    whisper: users.map((u) => u.id),
    speaker: { alias: shown },
    flags: { [MODULE_ID]: { sms: true } }
  });
}

/** Le MJ donne aux destinataires le droit de lire les pages/journaux joints. */
export async function grantAttachments(atts, users) {
  if (!game.user.isGM || !users.length) return;
  const { LIMITED, OBSERVER } = CONST.DOCUMENT_OWNERSHIP_LEVELS;
  for (const att of atts) {
    if (att?.type !== "doc") continue;
    const doc = await fromUuid(att.uuid);
    if (!doc) continue;
    const entry = doc.documentName === "JournalEntryPage" ? doc.parent : null;
    const docUp = {};
    const entryUp = {};
    for (const u of users) {
      if (!doc.testUserPermission(u, "OBSERVER")) docUp[`ownership.${u.id}`] = OBSERVER;
      if (entry && !entry.testUserPermission(u, "LIMITED")) entryUp[`ownership.${u.id}`] = LIMITED;
    }
    if (Object.keys(entryUp).length) await entry.update(entryUp);
    if (Object.keys(docUp).length) await doc.update(docUp);
  }
}

/** Remet un SMS à un téléphone de PJ : historique, chat privé, bip. */
export async function deliverToPhone(p, senderKeyOrName, text, att = null, { fwd = false } = {}) {
  const model = modelOf(p.phone);
  if (!msgOn(p.phone)) {
    if (game.user.isGM) ui.notifications.warn(`📱 ${phoneLabel(p)} : ${t("Warn.NoSms")}`);
    return "nosms";
  }
  if (att && !model.attachments) {
    if (game.user.isGM) ui.notifications.warn(`📱 ${phoneLabel(p)} : ${t("Warn.NoAttachments")}`);
    att = null;
    if (!text) return "nosms";
  }
  const key = keyFor(p.phone, senderKeyOrName);
  const shown = displayName(p.phone, key);
  const extra = { ...(att ? { att } : {}), ...(fwd ? { fwd: true } : {}) };
  if (att) await grantAttachments([att], holders(p));
  if (!hasSignal(p.phone)) {
    // En attente : livré au retour du réseau.
    await addLog(p.item, { kind: "sms", dir: "in", with: key, text, read: false, pending: true, ...extra });
    ui.notifications.info(`📵 ${phoneLabel(p)} : ${t("Info.SmsPending")}`);
    return true;
  }
  await addLog(p.item, { kind: "sms", dir: "in", with: key, text, read: false, ...extra });
  const users = holders(p);
  if (!users.length) return false;
  await whisperMessage(p.phone, users, shown, text, att);
  if ((p.phone.mode ?? "on") === "on") {
    for (const u of users) game.socket.emit(SOCKET, { type: "sms", targetUserId: u.id, notif: modelOf(p.phone).notif });
  }
  return true;
}

/** Retour du réseau : livre les SMS en attente et signale les appels manqués. */
export function flushPending(item) {
  // Dans la file : deux retours de réseau rapprochés ne livrent pas deux fois.
  return withItemLock(item, () => flushPendingNow(item));
}

export async function flushPendingNow(item) {
  const phone = getPhoneData(item);
  if (!phone || !hasSignal(phone)) return;
  const pending = getLog(phone, { includePending: true }).filter((e) => e.pending);
  if (!pending.length) return;
  await item.update({ [`flags.${MODULE_ID}.phone.log`]: (phone.log ?? []).map(({ pending: _, ...e }) => e) });

  const actor = item.parent instanceof Actor ? item.parent : null;
  const users = holders({ item, phone, actor });
  if (!users.length) return;
  const sms = pending.filter((e) => e.kind === "sms").reverse(); // ordre chronologique
  for (const e of sms) {
    const shown = displayName(phone, e.with);
    await whisperMessage(phone, users, shown, e.text, e.att);
  }
  const calls = pending.length - sms.length;
  for (const u of users) {
    game.socket.emit(SOCKET, { type: "signalBack", targetUserId: u.id, sms: sms.length, calls, label: phone.label, bip: (phone.mode ?? "on") === "on", notif: modelOf(phone).notif });
  }
}

export async function flushAll() {
  for (const p of allPhones()) await flushPending(p.item);
}

/** SMS envoyé par le MJ. target = "phone:<numéro>" ou "user:<id>" */
export async function sendSms(target, text, { sender = MASKED, att = null } = {}) {
  if (!game.user.isGM) return ui.notifications.warn(t("Warn.GmOnlySms"));
  text = text?.trim() ?? "";
  if (!text && !att) return ui.notifications.warn(t("Warn.Empty"));
  const [kind, value] = String(target).split(/:(.*)/s);

  if (kind === "user") {
    if (!smsOn()) return ui.notifications.warn(t("Warn.SmsDisabled"));
    const user = game.users.get(value);
    if (!user) return ui.notifications.warn(t("Warn.PlayerNotFound"));
    if (att) await grantAttachments([att], [user]);
    await ChatMessage.create({ content: smsHtml(sender, text, null, att), whisper: [user.id], speaker: { alias: sender } });
    game.socket.emit(SOCKET, { type: "sms", targetUserId: user.id });
    return ui.notifications.info(`📱 ${t("Info.SentTo", { name: user.name })}`);
  }

  const phones = phonesByNumber(value);
  if (!phones.length) return ui.notifications.warn(t("Warn.NoDevice", { value }));
  for (const p of phones) {
    const ok = await deliverToPhone(p, sender, text, att);
    if (ok === false) ui.notifications.warn(`📱 ${phoneLabel(p)} : ${t("Warn.NobodyHolds")}`);
  }
  ui.notifications.info(`📱 ${t("Info.SentTo", { name: value })}`);
}

