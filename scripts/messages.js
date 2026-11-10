import { attChatHtml } from "./attachments.js";
import { MASKED, MODULE_ID, SOCKET } from "./constants.js";
import { addLog, allPhones, displayName, getLog, getPhoneData, hasSignal, holders, isComputer, keyFor, modelOf, msgOn, phoneLabel, phonesByNumber, smsOn, withItemLock, modeOf } from "./devices.js";
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


/** Copy of a received message in the chat, whispered to those holding the device (text hidden if locked). */
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

/** The GM grants recipients permission to read attached pages/journals. */
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

/** Delivers a message to a PC's device: history, whispered chat, beep. */
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
    // Pending: delivered when signal returns.
    await addLog(p.item, { kind: "sms", dir: "in", with: key, text, read: false, pending: true, ...extra });
    ui.notifications.info(`📵 ${phoneLabel(p)} : ${t("Info.SmsPending")}`);
    return true;
  }
  await addLog(p.item, { kind: "sms", dir: "in", with: key, text, read: false, ...extra });
  const users = holders(p);
  if (!users.length) return false;
  await whisperMessage(p.phone, users, shown, text, att);
  if (modeOf(p.phone) === "on") {
    for (const u of users) game.socket.emit(SOCKET, { type: "sms", targetUserId: u.id, notif: modelOf(p.phone).notif });
  }
  return true;
}

/** Signal back: delivers pending messages and reports missed calls. */
export function flushPending(item) {
  // In the queue: two close signal returns do not deliver twice.
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
  const sms = pending.filter((e) => e.kind === "sms").reverse(); // chronological order
  for (const e of sms) {
    const shown = displayName(phone, e.with);
    await whisperMessage(phone, users, shown, e.text, e.att);
  }
  const calls = pending.length - sms.length;
  for (const u of users) {
    game.socket.emit(SOCKET, { type: "signalBack", targetUserId: u.id, sms: sms.length, calls, label: phone.label, bip: modeOf(phone) === "on", notif: modelOf(phone).notif });
  }
}

export async function flushAll() {
  for (const p of allPhones()) await flushPending(p.item);
}

/** Message sent by the GM. target = "phone:<number>" or "user:<id>" */
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

