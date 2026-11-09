import { DialogV2, SOCKET } from "./constants.js";
import { conversations, displayName, getLog, modelOf, skinOf } from "./devices.js";
import { playerSendSms } from "./player-calls.js";
import { esc, gmWhisper, isMasked } from "./util.js";
import { t } from "./i18n.js";
/* -------------------------------------------- */
/*  Partage : montrer l'écran, transférer       */
/* -------------------------------------------- */

export function findEntry(phone, id) {
  return getLog(phone).find((e) => (e.id ?? String(e.t)) === id) ?? null;
}

export function userName(u) {
  return u.character?.name ?? u.name;
}

/** Agents à côté de soi : un jeton sur la même scène (à défaut, les joueurs qui la regardent). */
export function nearbyUsers() {
  const scene = canvas?.scene ?? game.scenes.get(game.user.viewedScene);
  if (!scene) return [];
  const others = game.users.filter((u) => !u.isGM && u.active && u.id !== game.user.id);
  const actors = scene.tokens.map((tk) => tk.actor).filter(Boolean);
  const present = others.filter((u) => (u.character ? actors.some((a) => a.id === u.character.id) : actors.some((a) => a.testUserPermission(u, "OWNER"))));
  return present.length ? present : others.filter((u) => u.viewedScene === scene.id);
}

/** Contenu d'une pièce jointe, rendu chez celui qui montre (le spectateur n'a besoin d'aucun droit). */
export async function attShowHtml(att) {
  if (!att) return "";
  if (att.type === "image") return `<img class="spt-show-img" src="${esc(att.src)}">`;
  const doc = await fromUuid(att.uuid);
  if (!doc) return `<p><em>${t("DocNotFound")}</em></p>`;
  const pages = doc.documentName === "JournalEntryPage" ? [doc] : [...(doc.pages?.contents ?? [])].sort((a, b) => a.sort - b.sort);
  const TE = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
  const parts = [];
  for (const pg of pages) {
    if (!pg.testUserPermission(game.user, "OBSERVER")) continue;
    if (pg.type === "image" && pg.src) parts.push(`<img class="spt-show-img" src="${esc(pg.src)}">`);
    else if (pg.type === "text") parts.push(await TE.enrichHTML(pg.text?.content ?? "", { secrets: false, relativeTo: pg }));
    else parts.push(`<p><i class="fas fa-file"></i> ${esc(pg.name)}</p>`);
  }
  return `<h3 class="spt-show-doc"><i class="fas fa-file-lines"></i> ${esc(att.name ?? doc.name)}</h3>${parts.join("")}`;
}

/** Montre son écran aux agents présents : ils voient, mais ne gardent rien. */
export async function showScreen(p, title, html) {
  const users = nearbyUsers();
  if (!users.length) return ui.notifications.info(t("Share.NobodyNear"));
  const boxes = users.map((u) => `<label class="spt-check"><input type="checkbox" name="u" value="${u.id}" checked> ${esc(userName(u))}</label>`).join("");
  const ids = await DialogV2.wait({
    window: { title: t("Share.ShowScreen"), icon: "fas fa-eye" },
    position: { width: 320 },
    content: `<div class="spt-phone-form"><p>${t("Share.ShowTo")}</p>${boxes}</div>`,
    buttons: [
      { action: "ok", label: t("Share.Show"), icon: "fas fa-eye", default: true, callback: (event, button) => [...button.form.querySelectorAll("[name=u]:checked")].map((i) => i.value) },
      { action: "cancel", label: t("Cancel"), icon: "fas fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });
  if (!ids?.length) return;
  const from = userName(game.user);
  game.socket.emit(SOCKET, { type: "show", targetUserIds: ids, from, title, html, skin: skinOf(p.phone) });
  const names = users.filter((u) => ids.includes(u.id)).map(userName).join(", ");
  gmWhisper(`<p class="spt-gm-copy"><i class="fas fa-eye"></i> ${t("Share.GmCopy", { from: `<strong>${esc(from)}</strong>`, title: esc(title), names: esc(names) })}</p>`);
  ui.notifications.info(t("Share.YouShow", { names }));
}

export function receiveShow({ from, title, html, skin }) {
  new DialogV2({
    window: { title: t("Share.ShowsYou", { from }), icon: "fas fa-eye" },
    classes: ["spt-player-phone", "spt-show-window", `spt-skin-${skin}`],
    position: { width: 440 },
    content: `<div class="spt-show"><p class="spt-show-title">${esc(title)}</p>${html}</div>`,
    buttons: [{ action: "close", label: t("Share.GiveBack"), icon: "fas fa-check", default: true }]
  }).render({ force: true });
}

/** Transfère un message ou une pièce jointe, par le réseau, comme un vrai message. */
export async function forwardEntry(p, e) {
  let att = e.att ?? null;
  if (att && !modelOf(p.phone).attachments) {
    if (!e.text) return ui.notifications.warn(t("Fwd.NoAttachments"));
    att = null;
    ui.notifications.info(t("Fwd.TextOnly"));
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
      { action: "cancel", label: t("Cancel"), icon: "fas fa-xmark", callback: () => null }
    ],
    rejectClose: false
  });
  if (!to) return;
  if (playerSendSms(p.item, to, e.text ?? "", { att, fwd: true })) ui.notifications.info(t("Fwd.Done", { to }));
}

