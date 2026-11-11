import { attChatHtml } from "./attachments.js";
import { MASKED, MODULE_ID, PAGER_MAX, SOCKET } from "./constants.js";
import { addLog, allPhones, defaultDeviceFor, getLog, getPhoneData, hasSignal, holders, keyFor, modelOf, msgOn, npcNumber, phoneLabel, phonesByNumber, withItemLock, modeOf } from "./devices.js";
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
  if (model.pager) {
    // One line of PAGER_MAX characters: a callback number, a code, a word.
    const line = (text ?? "").replace(/\s+/g, " ").trim();
    text = line.slice(0, PAGER_MAX).trim();
    if (!text) return "nosms";
    if (line.length > PAGER_MAX && game.user.isGM) ui.notifications.warn(`📟 ${phoneLabel(p)} : ${t("Warn.PagerCut", { n: PAGER_MAX })}`);
  }
  const key = keyFor(p.phone, senderKeyOrName);
  const extra = { ...(att ? { att } : {}), ...(fwd ? { fwd: true } : {}) };
  if (att) await grantAttachments([att], holders(p));
  const switchedOff = modeOf(p.phone) === "off";
  if (!hasSignal(p.phone) || switchedOff) {
    // Pending: delivered (chat copy, beep) when signal returns or the device is switched on.
    await addLog(p.item, { kind: "sms", dir: "in", with: key, text, read: false, pending: true, ...extra });
    ui.notifications.info(`📵 ${phoneLabel(p)} : ${t(switchedOff ? "Info.SmsPendingOff" : "Info.SmsPending")}`);
    return true;
  }
  await addLog(p.item, { kind: "sms", dir: "in", with: key, text, read: false, ...extra });
  // Nothing in the chat: the player reads it on the device (window, floating button badge).
  const users = holders(p);
  if (!users.length) return false;
  const mode = modeOf(p.phone);
  // A pager also buzzes in silent mode, and opens by itself on the player's screen.
  if (mode === "on" || (model.pager && mode === "silent")) {
    const extraSock = model.pager ? { open: p.item.uuid, silent: mode === "silent" } : {};
    for (const u of users) game.socket.emit(SOCKET, { type: "sms", targetUserId: u.id, notif: model.notif, ...extraSock });
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
  if (!phone || !hasSignal(phone) || modeOf(phone) === "off") return;
  const pending = getLog(phone, { includePending: true }).filter((e) => e.pending);
  if (!pending.length) return;
  await item.update({ [`flags.${MODULE_ID}.phone.log`]: (phone.log ?? []).map(({ pending: _, ...e }) => e) });

  const actor = item.parent instanceof Actor ? item.parent : null;
  const users = holders({ item, phone, actor });
  if (!users.length) return;
  const sms = pending.filter((e) => e.kind === "sms");
  const calls = pending.length - sms.length;
  for (const u of users) {
    const open = modelOf(phone).pager && sms.length && modeOf(phone) !== "off" ? item.uuid : undefined;
    game.socket.emit(SOCKET, { type: "signalBack", targetUserId: u.id, sms: sms.length, calls, label: phone.label, bip: modeOf(phone) === "on", notif: modelOf(phone).notif, open });
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
    const user = game.users.get(value);
    if (!user) return ui.notifications.warn(t("Warn.PlayerNotFound"));
    // The player's character phone (created with the default model if needed): the message lands there.
    const p = await defaultDeviceFor(user);
    if (p) {
      await deliverToPhone(p, npcNumber(sender), text, att);
      return ui.notifications.info(`📱 ${t("Info.SentTo", { name: `${user.name} (${p.phone.label})` })}`);
    }
    // No assigned character to carry a phone: nothing is sent.
    return ui.notifications.warn(t("Warn.NoCharacter", { name: user.name }));
  }

  const phones = phonesByNumber(value);
  if (!phones.length) return ui.notifications.warn(t("Warn.NoDevice", { value }));
  for (const p of phones) {
    const ok = await deliverToPhone(p, npcNumber(sender), text, att);
    if (ok === false) ui.notifications.warn(`📱 ${phoneLabel(p)} : ${t("Warn.NobodyHolds")}`);
  }
  ui.notifications.info(`📱 ${t("Info.SentTo", { name: value })}`);
}

