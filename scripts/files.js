import { DialogV2, MODULE_ID, SOCKET } from "./constants.js";
import { filesOf, getLog, getPhoneData, gmName, inboxOf, skinOf, withItemLock } from "./devices.js";
import { senderHolds } from "./gm-actions.js";
import { docPagesHtml, openReader } from "./share.js";
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

/* -------------------------------------------- */
/*  GM overview (panel "Files" tab)             */
/* -------------------------------------------- */

/** One state per file, as shown to players: hidden wins over locked. */
export function fileState(file) {
  return file.hidden ? "hidden" : file.locked ? "locked" : "visible";
}

const STATE_PATCH = {
  visible: { locked: false, hidden: false },
  locked: { locked: true, hidden: false },
  hidden: { hidden: true }
};

/** Sets the state of several files, possibly on several devices: [{ uuid, id }]. */
export async function setFileStates(refs, state) {
  const byItem = new Map();
  for (const r of refs) byItem.set(r.uuid, [...(byItem.get(r.uuid) ?? []), r.id]);
  for (const [uuid, ids] of byItem) {
    const item = await fromUuid(uuid);
    if (item) await setFiles(item, (files) => files.map((f) => (ids.includes(f.id) ? { ...f, ...STATE_PATCH[state] } : f)));
  }
}

/** GM: opens a file in the reader window. */
export async function previewFile(uuid, id) {
  const item = await fromUuid(uuid);
  const file = item && findFile(getPhoneData(item), id);
  if (!file) return;
  const html = await fileHtml(file);
  const body = html == null ? `<p>${t("Files.Unavailable")}</p>` : file.type === "doc" ? `<div class="spt-doc">${html}</div>` : html;
  openReader(file.name, body, skinOf(getPhoneData(item)));
}

/** GM: opens a journal attached to an email in the reader window. */
export async function previewEntry(uuid, entryId) {
  const item = await fromUuid(uuid);
  const phone = item && getPhoneData(item);
  const entry = phone ? getLog(phone, { includePending: true }).find((e) => (e.id ?? String(e.t)) === entryId) : null;
  if (!entry) return;
  const html = await entryDocHtml(entry);
  const body = html == null ? `<p>${t("Files.Unavailable")}</p>` : `<div class="spt-doc">${html}</div>`;
  openReader(entry.att.name ?? t("Document"), body, skinOf(phone));
}

/** Journal a file comes from: the page's journal, the journal itself, or null (image, deleted). */
function sourceJournal(file) {
  if (file.type !== "doc" || !file.uuid) return null;
  const doc = fromUuidSync(file.uuid);
  if (!doc) return null;
  return doc instanceof JournalEntry ? doc : doc.parent instanceof JournalEntry ? doc.parent : null;
}

/**
 * Files of all computers, grouped by device or by source journal.
 * computers: [{ item, phone, label, icon, img, where }] (already sorted); filter: all | visible | locked | hidden.
 */
export function filesOverview(computers, { view = "device", filter = "all" } = {}) {
  const rows = [];
  for (const c of computers) {
    for (const f of filesOf(c.phone, { gm: true })) {
      rows.push({ c, f, state: fileState(f), journal: sourceJournal(f) });
    }
    // Emails carrying a journal page: listed with an @, their access follows the mailbox.
    const inbox = inboxOf(c.phone);
    const mailState = { on: "visible", locked: "locked", none: "hidden" }[inbox];
    for (const e of getLog(c.phone, { includePending: true })) {
      if (e.att?.type !== "doc") continue;
      const who = gmName(c.phone, e.with);
      const f = { id: e.id ?? String(e.t), type: "doc", uuid: e.att.uuid, name: e.att.name ?? t("Document") };
      rows.push({ c, f, mail: true, who: t(e.dir === "in" ? "Files.MailFrom" : "Files.MailTo", { name: who }), state: mailState, journal: sourceJournal(f) });
    }
  }
  const counts = { all: rows.length, visible: 0, locked: 0, hidden: 0 };
  for (const r of rows) counts[r.state]++;
  const shown = rows.filter((r) => filter === "all" || r.state === filter);
  const fileRow = (r, withDevice) => ({
    uuid: r.c.item.uuid,
    id: r.f.id,
    name: r.f.name,
    icon: r.mail ? "fa-at" : r.f.type === "image" ? "fa-file-image" : "fa-file-lines",
    mail: !!r.mail,
    who: r.who ?? null,
    stateIcon: { visible: "fa-eye", locked: "fa-lock", hidden: "fa-eye-slash" }[r.state],
    stateTitle: r.mail ? t("Files.FollowsMailbox", { state: t(`Files.Mail_${inboxOf(r.c.phone)}`) }) : null,
    state: r.state,
    device: withDevice ? r.c.label : null,
    deviceIcon: r.c.icon
  });

  let groups;
  if (view === "journal") {
    const map = new Map();
    for (const r of shown) {
      const key = r.journal?.id ?? (r.f.type === "image" ? "~images" : "~missing");
      if (!map.has(key)) {
        const name = r.journal?.name ?? (key === "~images" ? t("Files.Images") : t("Files.Missing"));
        map.set(key, { key, name, icon: r.journal ? "fa-book" : key === "~images" ? "fa-image" : "fa-circle-question", files: [], devices: new Set(), order: r.journal ? 0 : 1 });
      }
      const g = map.get(key);
      g.files.push(fileRow(r, true));
      g.devices.add(r.c.item.uuid);
    }
    groups = [...map.values()]
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map((g) => ({
        ...g,
        journal: true,
        sub: t("Files.OnDevices", { n: g.files.length, d: g.devices.size }),
        refs: JSON.stringify(g.files.filter((f) => !f.mail).map((f) => ({ uuid: f.uuid, id: f.id }))),
        bulk: g.files.some((f) => !f.mail)
      }));
  } else {
    groups = computers
      .map((c) => {
        const inbox = inboxOf(c.phone);
        return {
          key: c.item.uuid,
          uuid: c.item.uuid,
          name: c.label,
          icon: c.icon,
          img: c.img,
          sub: c.where,
          locked: !!c.phone.locked,
          inbox,
          inboxIcon: { on: "fa-envelope", locked: "fa-lock", none: "fa-ban" }[inbox],
          inboxLabel: t(`Files.Mail_${inbox}`),
          files: shown.filter((r) => r.c === c).map((r) => fileRow(r, false))
        };
      })
      .filter((g) => g.files.length || filter === "all");
  }
  return { groups, counts };
}
