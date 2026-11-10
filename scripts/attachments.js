import { SOCKET } from "./constants.js";
import { getLog, getPhoneData } from "./devices.js";
import { senderHolds } from "./gm-actions.js";
import { grantAttachments } from "./messages.js";
import { esc } from "./util.js";
import { t } from "./i18n.js";
/* -------------------------------------------- */
/*  Attachments (image or journal)           */
/* -------------------------------------------- */

/** Reads a Foundry drag-and-drop: page/journal, or image (tile, file, item…). */
export function attFromDrop(event) {
  let data;
  try {
    data = JSON.parse(event.dataTransfer.getData("text/plain"));
  } catch {
    return null;
  }
  if (!data) return null;
  if (["JournalEntry", "JournalEntryPage"].includes(data.type) && data.uuid) {
    const doc = fromUuidSync(data.uuid);
    return { type: "doc", uuid: data.uuid, name: doc?.name ?? t("Document") };
  }
  const src = data.texture?.src ?? data.src ?? data.img;
  return src ? { type: "image", src } : null;
}

export function pickImage() {
  return new Promise((resolve) => {
    const FP = foundry.applications.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
    new FP({ type: "image", callback: (path) => resolve(path) }).render(true);
  });
}

/** Preview in an input area (GM). */
export function attChipHtml(att) {
  if (!att) return "";
  const what = att.type === "image" ? `<img src="${esc(att.src)}">` : `<i class="fas fa-file-lines"></i> ${esc(att.name)}`;
  return `<div class="spt-att-chip">${what}<a data-action="clearAtt" title="${t("RemoveAttachment")}"><i class="fas fa-xmark"></i></a></div>`;
}

/** Inside a phone bubble. */
export function attHtml(att) {
  if (!att) return "";
  if (att.type === "image") return `<img class="spt-att-img" src="${esc(att.src)}" data-att-img="${esc(att.src)}" title="${t("Enlarge")}">`;
  return `<a class="spt-att-doc" data-att-doc="${esc(att.uuid)}"><i class="fas fa-file-lines"></i> ${esc(att.name)}</a>`;
}

/** In the chat (Foundry makes the @UUID link clickable). */
export function attChatHtml(att) {
  if (att.type === "image") return `<img class="spt-att-img" src="${esc(att.src)}">`;
  return `@UUID[${att.uuid}]{${att.name.replace(/[{}]/g, "")}}`;
}

/** Waits (briefly) for the GM to grant read permission. */
export async function waitForAccess(doc, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (doc.testUserPermission(game.user, "LIMITED")) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return doc.testUserPermission(game.user, "LIMITED");
}

/** GM: an agent holding the device asks for access to a journal received on it. */
export async function onPlayerAccess({ itemUuid, docUuid, userId }) {
  const item = fromUuidSync(itemUuid);
  const phone = getPhoneData(item);
  const user = game.users.get(userId);
  if (!phone || !user || !senderHolds(item, userId)) return;
  const att = getLog(phone).find((e) => e.att?.type === "doc" && e.att.uuid === docUuid)?.att;
  if (att) await grantAttachments([att], [user]);
}

export async function openAttachment(el, item = null) {
  if (el.dataset.attImg) {
    const IP = foundry.applications.apps?.ImagePopout;
    if (IP) return new IP({ src: el.dataset.attImg, window: { title: t("Attachment") } }).render(true);
    return new globalThis.ImagePopout(el.dataset.attImg, { title: t("Attachment") }).render(true);
  }
  const doc = await fromUuid(el.dataset.attDoc);
  if (!doc) return ui.notifications.warn(t("Warn.DocGone"));
  if (!doc.testUserPermission(game.user, "LIMITED")) {
    // Shared device (terminal) or received later: ask the GM for access; the GM checks the agent holds the device.
    if (item && game.users.activeGM) game.socket.emit(SOCKET, { type: "playerAccess", itemUuid: item.uuid, docUuid: el.dataset.attDoc, userId: game.user.id });
    if (!item || !(await waitForAccess(doc))) return ui.notifications.warn(t("Warn.NoAccess"));
  }
  if (doc.documentName === "JournalEntryPage") return doc.parent.sheet.render(true, { pageId: doc.id });
  return doc.sheet.render(true);
}

