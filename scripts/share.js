import { DialogV2, SOCKET } from "./constants.js";
import { conversations, displayName, getLog, modelOf, skinOf } from "./devices.js";
import { playerSendSms } from "./player-calls.js";
import { deviceNotice, esc, isMasked } from "./util.js";
import { t } from "./i18n.js";
/* -------------------------------------------- */
/*  Sharing: show screen, forward               */
/* -------------------------------------------- */

export function findEntry(phone, id) {
  return getLog(phone).find((e) => (e.id ?? String(e.t)) === id) ?? null;
}

export function userName(u) {
  return u.character?.name ?? u.name;
}

/** Nearby agents: a token on the same scene (otherwise, players viewing it). */
export function nearbyUsers() {
  const scene = canvas?.scene ?? game.scenes.get(game.user.viewedScene);
  if (!scene) return [];
  const others = game.users.filter((u) => !u.isGM && u.active && u.id !== game.user.id);
  const actors = scene.tokens.map((tk) => tk.actor).filter(Boolean);
  const present = others.filter((u) => (u.character ? actors.some((a) => a.id === u.character.id) : actors.some((a) => a.testUserPermission(u, "OWNER"))));
  return present.length ? present : others.filter((u) => u.viewedScene === scene.id);
}

/** Attachment content, rendered on the sharer's side (the viewer needs no permission). */
export async function attShowHtml(att) {
  if (!att) return "";
  if (att.type === "image") return `<img class="spt-show-img" src="${esc(att.src)}">`;
  const doc = await fromUuid(att.uuid);
  if (!doc) return `<p><em>${t("DocNotFound")}</em></p>`;
  return `<h3 class="spt-show-doc"><i class="fas fa-file-lines"></i> ${esc(att.name ?? doc.name)}</h3><div class="spt-doc">${await docPagesHtml(doc)}</div>`;
}

/** A journal (or one page) rendered as HTML, as the current user may see it: text and images, secrets hidden. */
export async function docPagesHtml(doc) {
  const pages = doc.documentName === "JournalEntryPage" ? [doc] : [...(doc.pages?.contents ?? [])].sort((a, b) => a.sort - b.sort);
  const TE = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
  const parts = [];
  for (const pg of pages) {
    if (!pg.testUserPermission(game.user, "OBSERVER")) continue;
    if (pg.type === "image" && pg.src) parts.push(`<img class="spt-show-img" src="${esc(pg.src)}">`);
    else if (pg.type === "text") parts.push(await TE.enrichHTML(pg.text?.content ?? "", { secrets: false, relativeTo: pg }));
    else parts.push(`<p><i class="fas fa-file"></i> ${esc(pg.name)}</p>`);
  }
  return parts.join("");
}

/** Shows the screen to nearby agents: they see it but keep nothing. */
export async function showScreen(p, title, html) {
  const users = nearbyUsers();
  if (!users.length) return deviceNotice(t("Share.NobodyNear"));
  const boxes = users.map((u) => `<label class="spt-check"><input type="checkbox" name="u" value="${u.id}" checked> ${esc(userName(u))}</label>`).join("");
  const ids = await DialogV2.wait({
    window: { title: t("Share.ShowScreen"), icon: "fas fa-eye" },
    position: { width: 320 },
    content: `<div class="spt-phone-form"><p>${t("Share.ShowTo")}</p>${boxes}</div>`,
    buttons: [
      { action: "ok", label: t("Share.Show"), icon: "fas fa-eye", default: true, callback: (event, button) => [...button.form.querySelectorAll("[name=u]:checked")].map((i) => i.value) },
      { action: "cancel", label: t("Cancel"), icon: "fas fa-xmark", callback: () => false }
    ],
    rejectClose: false
  });
  if (!ids?.length) return;
  const from = userName(game.user);
  game.socket.emit(SOCKET, { type: "show", targetUserIds: ids, from, title, html, skin: skinOf(p.phone) });
  const names = users.filter((u) => ids.includes(u.id)).map(userName).join(", ");
  deviceNotice(t("Share.YouShow", { names }));
}

export function receiveShow({ from, title, html, skin }) {
  readerWindow({ windowTitle: t("Share.ShowsYou", { from }), icon: "fa-eye", heading: title, html, skin, button: t("Share.GiveBack") });
}

/** The same reader, for oneself: a document or image enlarged from the device. */
export function openReader(title, html, skin) {
  readerWindow({ windowTitle: title, icon: "fa-expand", heading: "", html, skin, button: t("Close") });
}

function readerWindow({ windowTitle, icon, heading, html, skin, button }) {
  // A document is read, not glanced at: a large window; an image gets room too.
  const doc = html.includes("spt-doc");
  const img = !doc && html.includes("spt-show-img");
  const width = Math.min(doc ? 760 : img ? 640 : 440, window.innerWidth - 40);
  new DialogV2({
    window: { title: windowTitle, icon: `fas ${icon}`, resizable: true },
    classes: ["spt-player-phone", "spt-show-window", `spt-skin-${skin}`, ...(doc ? ["spt-show-reading"] : [])],
    // A document gets a fixed height the player can resize; the window itself scrolls.
    position: doc ? { width, height: Math.round(window.innerHeight * 0.85) } : { width },
    content: `<div class="spt-show">${heading ? `<p class="spt-show-title">${esc(heading)}</p>` : ""}${html}</div>`,
    buttons: [{ action: "close", label: button, icon: "fas fa-check", default: true }]
  }).render({ force: true });
}

/** Forwards a message or an attachment over the network, like a real message. */
export async function forwardEntry(p, e) {
  let att = e.att ?? null;
  if (att && !modelOf(p.phone).attachments) {
    if (!e.text) return deviceNotice(t("Fwd.NoAttachments"), { warn: true });
    att = null;
    deviceNotice(t("Fwd.TextOnly"));
  }
  const known = conversations(p.phone)
    .filter((c) => !isMasked(c.key))
    .map((c) => `<option value="${esc(displayName(p.phone, c.key))}">`)
    .join("");
  const what = att ? (att.type === "image" ? t("Fwd.AnImage") : `« ${att.name} »`) : t("Fwd.ThisMessage");
  const to = await DialogV2.wait({
    window: { title: t("Fwd.Forward"), icon: "fas fa-share" },
    position: { width: 340 },
    content: `<div class="spt-phone-form"><p>${t("Fwd.ForwardTo", { what: esc(what) })}</p>
        <input type="text" name="to" list="spt-fwd-known" placeholder="${t("NameOrNumber")}" autofocus>
        <datalist id="spt-fwd-known">${known}</datalist></div>`,
    buttons: [
      { action: "ok", label: t("Fwd.Forward"), icon: "fas fa-share", default: true, callback: (event, button) => button.form.elements.to.value.trim() },
      { action: "cancel", label: t("Cancel"), icon: "fas fa-xmark", callback: () => false }
    ],
    rejectClose: false
  });
  if (!to) return;
  if (playerSendSms(p.item, to, e.text ?? "", { att, fwd: true, fwdSecure: !!e.secure })) deviceNotice(t("Fwd.Done", { to }));
}

