import { DialogV2, MODULE_ID, SOCKET } from "./constants.js";
import { filesOf, getLog, getPhoneData, withItemLock } from "./devices.js";
import { senderHolds } from "./gm-actions.js";
import { docPagesHtml } from "./share.js";
import { esc, isActiveGM } from "./util.js";
import { t } from "./i18n.js";
/* -------------------------------------------- */
/*  Computer files (laptop, terminal)           */
/* -------------------------------------------- */
// A file is { id, type: "doc" | "image", uuid | src, name, locked?, hidden? }, stored on the device.
// Players never open the Foundry journal: the GM's browser renders the content and sends it.

export function findFile(phone, id) {
  return filesOf(phone, { gm: true }).find((f) => f.id === id) ?? null;
}

function setFiles(item, fn) {
  return withItemLock(item, () => {
    const phone = getPhoneData(item);
    if (!phone) return;
    return item.update({ [`flags.${MODULE_ID}.phone.files`]: fn([...(phone.files ?? [])]) });
  });
}

/** GM: adds a dropped journal/page or an image to the device's files. */
export function addFile(item, att) {
  const name = att.type === "image" ? decodeURIComponent(String(att.src).split("/").pop() ?? "") || t("Files.Image") : att.name ?? t("Document");
  const file = { id: foundry.utils.randomID(), type: att.type, name, ...(att.type === "image" ? { src: att.src } : { uuid: att.uuid }) };
  return setFiles(item, (files) => [...files, file]);
}

export function patchFile(item, id, patch) {
  return setFiles(item, (files) => files.map((f) => (f.id === id ? { ...f, ...patch } : f)));
}

export function removeFile(item, id) {
  return setFiles(item, (files) => files.filter((f) => f.id !== id));
}

export async function renameFile(item, id) {
  const file = findFile(getPhoneData(item), id);
  if (!file) return;
  const name = await DialogV2.wait({
    window: { title: t("Files.Rename"), icon: "fas fa-pen" },
    position: { width: 360 },
    content: `<div class="spt-phone-form"><input type="text" name="name" value="${esc(file.name)}" autofocus></div>`,
    buttons: [
      { action: "ok", label: t("Ok"), icon: "fas fa-check", default: true, callback: (event, button) => button.form.elements.name.value.trim() },
      { action: "cancel", label: t("Cancel"), icon: "fas fa-xmark", callback: () => false }
    ],
    rejectClose: false
  });
  if (name) await patchFile(item, id, { name });
}

/** File content as HTML (rendered with the current user's rights: the GM's). */
export async function fileHtml(file) {
  if (file.type === "image") return `<img class="spt-show-img" src="${esc(file.src)}">`;
  const doc = await fromUuid(file.uuid);
  return doc ? await docPagesHtml(doc) : null;
}

/* Player side: requests waiting for the GM's answer. */
const pending = new Map();
const REQUEST_MS = 6000;

/**
 * Content of a file for display on the device. The GM renders it locally; a player asks the GM,
 * who checks the agent holds the device and the file is neither locked nor hidden.
 * Resolves to the HTML, or null (unavailable, refused, no GM).
 */
export function loadFile(item, file) {
  if (game.user.isGM) return fileHtml(file);
  return askGm({ type: "fileRequest", itemUuid: item.uuid, fileId: file.id });
}

/** A journal attached to a message on the device: same path as files (the GM renders it). */
export function loadEntryDoc(item, entry) {
  if (game.user.isGM) return entryDocHtml(entry);
  return askGm({ type: "docRequest", itemUuid: item.uuid, entryId: entry.id ?? String(entry.t) });
}

async function entryDocHtml(entry) {
  const doc = entry?.att?.type === "doc" ? await fromUuid(entry.att.uuid) : null;
  return doc ? await docPagesHtml(doc) : null;
}

function askGm(payload) {
  if (!game.users.activeGM) return Promise.resolve(null);
  const reqId = foundry.utils.randomID();
  return new Promise((resolve) => {
    const timer = setTimeout(() => pending.delete(reqId) && resolve(null), REQUEST_MS);
    pending.set(reqId, (html) => {
      clearTimeout(timer);
      pending.delete(reqId);
      resolve(html);
    });
    game.socket.emit(SOCKET, { ...payload, userId: game.user.id, reqId });
  });
}

export function onFileContent({ reqId, html }) {
  pending.get(reqId)?.(html ?? null);
}

/** GM: an agent opens a file on a device they hold. */
export async function onFileRequest({ itemUuid, fileId, userId, reqId }) {
  if (!isActiveGM()) return;
  const item = fromUuidSync(itemUuid);
  const file = item && findFile(getPhoneData(item), fileId);
  const ok = file && !file.locked && !file.hidden && senderHolds(item, userId);
  const html = ok ? await fileHtml(file) : null;
  game.socket.emit(SOCKET, { type: "fileContent", targetUserId: userId, reqId, html });
}

/** GM: an agent opens a journal attached to a message on a device they hold. */
export async function onDocRequest({ itemUuid, entryId, userId, reqId }) {
  if (!isActiveGM()) return;
  const item = fromUuidSync(itemUuid);
  const phone = getPhoneData(item);
  const entry = phone ? getLog(phone).find((e) => (e.id ?? String(e.t)) === entryId) : null;
  const html = entry && senderHolds(item, userId) ? await entryDocHtml(entry) : null;
  game.socket.emit(SOCKET, { type: "fileContent", targetUserId: userId, reqId, html });
}
