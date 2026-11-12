import { esc } from "./util.js";
import { t } from "./i18n.js";
/* -------------------------------------------- */
/*  Attachments (image or journal)           */
/* -------------------------------------------- */

/** Journal page types a device can show (others, such as PDF or video, only give their name). */
const PAGE_TYPES = ["text", "image"];
const VIDEO = /\.(webm|mp4|m4v|ogv|ogg)(\?|$)/i;

/**
 * Reads a Foundry drag-and-drop: a journal page, or an image (tile, file, item…).
 * Recognised but unusable drops (whole journal, PDF page, video, actor…) are refused with
 * their own warning (false); anything unreadable gives null.
 */
export function attFromDrop(event) {
  let data;
  try {
    data = JSON.parse(event.dataTransfer.getData("text/plain"));
  } catch {
    return null;
  }
  if (!data) return null;
  const refuse = (key, opts) => (ui.notifications.warn(t(key, opts)), false);
  if (data.type === "JournalEntry") return refuse("Warn.WholeJournal");
  if (data.type === "JournalEntryPage" && data.uuid) {
    const doc = fromUuidSync(data.uuid);
    if (doc && !PAGE_TYPES.includes(doc.type)) return refuse("Warn.PageType");
    return { type: "doc", uuid: data.uuid, name: doc?.name ?? t("Document") };
  }
  const src = data.texture?.src ?? data.src ?? data.img;
  if (src && VIDEO.test(src)) return refuse("Warn.NoVideo");
  if (src) return { type: "image", src };
  // Another kind of document (actor, scene, macro…): name what was dropped.
  if (data.type && data.uuid) return refuse("Warn.WrongDrop", { type: data.type });
  return null;
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

/** Image attachment: Foundry's image viewer. (Documents open inside the device.) */
export function openAttachment(el) {
  if (!el.dataset.attImg) return;
  const IP = foundry.applications.apps?.ImagePopout;
  if (IP) return new IP({ src: el.dataset.attImg, window: { title: t("Attachment") } }).render(true);
  return new globalThis.ImagePopout(el.dataset.attImg, { title: t("Attachment") }).render(true);
}

